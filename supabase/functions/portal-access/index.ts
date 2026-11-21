import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { SenndoClient } from "npm:@senndo/sdk@1.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizePhone(value: unknown) {
  const raw = String(value ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (raw.length < 8 || raw.length > 15) throw new Error("Numéro de téléphone invalide.");
  const hasIvoryCoastCode = raw.startsWith("225");
  const national = hasIvoryCoastCode ? raw.slice(3) : raw;
  // Match older 8-digit subscriber numbers with newer 10-digit CI mobile numbers.
  if (national.length === 10 && /^0[157]\d{8}$/.test(national)) return national.slice(-8);
  if (national.length === 9 && national.startsWith("0")) return national.slice(1);
  return hasIvoryCoastCode ? national : national.replace(/^0+/, "");
}
function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map(x => x.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, "0")).join("");
}
async function codeHash(code: string, salt: string) {
  const secret = Deno.env.get("PORTAL_ACCESS_CODE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return sha256(code + ":" + salt + ":" + secret);
}
async function sessionTokenHash(token: string) { return sha256(token); }
async function issueSession(supabase: any, clientId: string) {
  const raw = randomHex(32) + "." + randomHex(16);
  const token_hash = await sessionTokenHash(raw);
  const { error } = await supabase.from("client_portal_sessions").insert({
    client_id: clientId,
    token_hash,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  return raw;
}
async function findClient(supabase: any, phone: string) {
  const tail = phone.slice(-8);
  const { data, error } = await supabase.from("clients")
    .select("id,telephone,whatsapp,telephone_local,whatsapp_local,telephone_indicatif,whatsapp_indicatif,email,nom_complet,compte_actif,validation_statut,statut_global,id_unique,type_client,is_internal,offre_id,montant_total_contrat,contrat_solde_at")
    .or(`telephone.ilike.%${tail},whatsapp.ilike.%${tail},telephone_local.ilike.%${tail},whatsapp_local.ilike.%${tail}`)
    .limit(100);
  if (error) throw error;
  const contacts = (c: any) => [
    c.telephone, c.whatsapp, c.telephone_local, c.whatsapp_local,
    c.telephone_indicatif && c.telephone_local ? String(c.telephone_indicatif) + String(c.telephone_local) : null,
    c.whatsapp_indicatif && c.whatsapp_local ? String(c.whatsapp_indicatif) + String(c.whatsapp_local) : null,
  ].filter(Boolean);
  return (data || []).find((c: any) => contacts(c).some((value: any) => {
    try { return normalizePhone(value) === phone; } catch { return false; }
  })) || null;
}
function maskPhone(value: unknown) {
  const d = String(value ?? "").replace(/\D/g, "");
  return d.length >= 4 ? "•••• " + d.slice(-4) : null;
}
function smsDestination(client: any) {
  // Utiliser le téléphone principal du dossier CRM, jamais le numéro WhatsApp par défaut.
  const dial = String(client.telephone_indicatif || "225").replace(/\D/g, "");
  let local = String(client.telephone_local || client.telephone || "").replace(/\D/g, "").replace(/^00/, "");
  if (!local) return null;
  if (local.startsWith(dial) && local.length > dial.length + 7) local = local.slice(dial.length);
  if (!client.telephone_indicatif && local.length > 10) return "+" + local;
  if (dial === "225") return "+225" + local;
  return "+" + dial + local.replace(/^0+/, "");
}
async function sendOtpSms(supabase: any, to: string, code: string, otpId: string) {
  const { data: apiKey, error } = await supabase.rpc("senndo_get_secret", { p_name: "senndo_api_key" });
  if (error || typeof apiKey !== "string" || !apiKey) throw new Error("Configuration Senndo SMS indisponible.");
  const senndo = new SenndoClient({ apiKey, baseUrl: "https://api.senndo.com", timeoutMs: 30000, maxRetries: 2, userAgent: "AgriCapital-Portal/1.0" });
  const result = await senndo.sendMessage({
    channel: "sms", to, text: "AgriCapital : votre code de verification portail est " + code + ". Valable 10 minutes. Ne le partagez pas.",
    ...(to.startsWith("+225") ? { senderId: "AgriCapital" } : {}),
    idempotencyKey: "portal-otp-" + otpId,
  });
  console.info("[Portal OTP] SMS accepté par Senndo", { messageId: result?.id || null, destination: maskPhone(to) });
  return result;
}
async function resolveWhatsAppSenderSession(supabase: any) {
  const [{ data: apiKey, error: apiError }, { data: configuredPhone, error: phoneError }] = await Promise.all([
    supabase.rpc("senndo_get_secret", { p_name: "senndo_api_key" }),
    supabase.rpc("senndo_get_secret", { p_name: "senndo_whatsapp_sender_phone" }),
  ]);
  if (apiError || typeof apiKey !== "string" || !apiKey) throw new Error("Clé API Senndo non configurée.");
  if (phoneError || typeof configuredPhone !== "string" || !configuredPhone.trim()) throw new Error("Numéro de session WhatsApp Senndo non configuré.");

  const response = await fetch("https://api.senndo.com/v1/wa/sessions", {
    method: "GET", headers: { authorization: "Bearer " + apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Impossible de vérifier la session WhatsApp Senndo (HTTP " + response.status + ").");

  const asArray = (v: any): any[] => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  const raw = [
    ...asArray(payload), ...asArray(payload?.sessions), ...asArray(payload?.data?.sessions),
    ...asArray(payload?.data), ...asArray(payload?.items), ...asArray(payload?.results),
    ...asArray(payload?.data?.items), ...asArray(payload?.data?.results),
    ...asArray(payload?.session), ...asArray(payload?.data?.session),
  ];
  const sessions = raw.filter((s: any) => s && typeof s === "object").map((s: any) => {
    const nested = s.session && typeof s.session === "object" ? s.session
      : s.data?.session && typeof s.data.session === "object" ? s.data.session : null;
    return nested ? { ...s, ...nested,
      id: nested.id ?? s.id,
      sessionId: nested.sessionId ?? nested.session_id ?? s.sessionId ?? s.session_id,
      senderSessionId: nested.senderSessionId ?? nested.sender_session_id ?? s.senderSessionId ?? s.sender_session_id,
      uuid: nested.uuid ?? s.uuid,
    } : s;
  });
  const normalize = (v: unknown) => {
    const rawPhone = String(v ?? "").split("@")[0].split(":")[0].replace(/\D/g, "").replace(/^00/, "");
    if (!rawPhone) return "";
    const national = rawPhone.startsWith("225") ? rawPhone.slice(3) : rawPhone;
    if (national.length === 10 && /^0[157]\d{8}$/.test(national)) return "225" + national.slice(-8);
    if (national.length === 8) return "225" + national;
    return rawPhone;
  };
  const phoneValues = (s: any) => [
    s?.phoneNumber, s?.phone_number, s?.phone, s?.displayPhoneNumber, s?.display_phone_number,
    s?.number, s?.jid, s?.user?.id, s?.user?.jid, s?.me?.id, s?.me?.jid,
    s?.account?.phone, s?.account?.phoneNumber, s?.profile?.phone, s?.whatsapp?.phone,
    s?.session?.phoneNumber, s?.session?.phone_number, s?.session?.user?.id, s?.session?.me?.id,
    s?.creds?.me?.id, s?.authState?.creds?.me?.id,
  ].filter((v) => (typeof v === "string" || typeof v === "number") && String(v).trim());
  const statusOf = (s: any) => String(s?.status ?? s?.state ?? s?.connectionStatus ??
    s?.connection_status ?? s?.connection?.status ?? s?.session?.status ?? "").trim().toLowerCase();
  const connected = sessions.filter((s: any) => ["connected", "open", "ready", "authenticated"].includes(statusOf(s)));
  const senderDigits = normalize(configuredPhone);
  const matches = connected.filter((s: any) => phoneValues(s).some((v: unknown) => normalize(v) === senderDigits));
  const session = matches.length === 1 ? matches[0] : (matches.length === 0 && connected.length === 1 ? connected[0] : null);
  const nestedObjects = (root: any, depth = 0): any[] => !root || typeof root !== "object" || depth > 5
    ? [] : [root, ...Object.values(root).flatMap((v: any) => nestedObjects(v, depth + 1))];
  const preferred = ["senderSessionId", "sender_session_id", "sessionId", "session_id", "uniqueSessionId",
    "unique_session_id", "sessionKey", "session_key", "sessionUid", "session_uid", "sessionIdentifier",
    "session_identifier", "instanceId", "instance_id", "deviceId", "device_id", "sid", "uuid", "id", "key", "name"];
  const objects = session ? nestedObjects(session) : [];
  const senderSessionId = preferred.map((key) => objects.map((o: any) => o?.[key]).find((v: any) =>
    (typeof v === "string" && v.trim()) || (typeof v === "number" && Number.isFinite(v))))
    .find((v) => v !== undefined);
  if (!session || !senderSessionId) throw new Error(connected.length === 0
    ? "Aucune session WhatsApp connectée n’a été trouvée dans Senndo."
    : connected.length > 1 && matches.length !== 1
      ? "Plusieurs sessions WhatsApp sont connectées sans correspondance unique avec le numéro configuré."
      : "La session WhatsApp est connectée, mais son identifiant technique est indisponible.");
  return { apiKey, senderSessionId: String(senderSessionId), senderPhone: String(configuredPhone).trim() };
}

async function sendOtpWhatsApp(supabase: any, to: string, code: string, otpId: string) {
  const session = await resolveWhatsAppSenderSession(supabase);
  const response = await fetch("https://api.senndo.com/v1/messages", {
    method: "POST",
    headers: { authorization: "Bearer " + session.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      channel: "whatsapp_baileys", to,
      text: "AgriCapital : votre code de vérification du portail est " + code + ". Valable 10 minutes. Ne le partagez pas.",
      senderSessionId: session.senderSessionId, idempotencyKey: "portal-otp-" + otpId,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payload?.message === "string" ? payload.message.slice(0, 220) : "";
    throw new Error("Senndo a refusé l’envoi WhatsApp (HTTP " + response.status + ")." + (detail ? " " + detail : ""));
  }
  console.info("[Portal OTP] WhatsApp accepté par Senndo", {
    messageId: payload?.id || payload?.messageId || payload?.message?.id || null,
    destination: maskPhone(to), sender: maskPhone(session.senderPhone),
  });
  return { id: payload?.id ?? payload?.messageId ?? payload?.message?.id ?? null };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body?.action || "inspect";
    const phone = normalizePhone(body?.telephone || body?.phone || "");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
    if (!secret) throw new Error("Service database indisponible.");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secret);
    const client = await findClient(supabase, phone);
    if (!client) return json({ success: false, code: "CLIENT_NOT_FOUND", error: "Ce numéro n'est pas enregistré dans votre dossier client AgriCapital." });
    const isDemo = client.id_unique === "AC-DEMO";
    const isBeneficiary = client.type_client === "beneficiaire_particulier";
    const isPreActivation = !client.compte_actif && client.validation_statut === "valide" && !client.is_internal && !isDemo && !isBeneficiary;
    if (!client.compte_actif && !isDemo && !isBeneficiary && !isPreActivation) {
      return json({ success: false, code: "CLIENT_NOT_READY", error: "Votre dossier client doit être validé avant l’accès au portail." });
    }
    const { data: access, error: accessError } = await supabase.from("client_portal_access_codes")
      .select("id,locked_until,last_verified_at").eq("client_id", client.id).maybeSingle();
    if (accessError) throw accessError;

    if (action === "inspect") {
      if (isDemo) {
        const token = await issueSession(supabase, client.id);
        return json({ success: true, demo: true, demo_code: "2026", access_token: token });
      }
      // Never disclose client identity before the caller proves control of the phone or knows the code.
      return json({ success: true, demo: false, telephone_masque: maskPhone(client.telephone || client.whatsapp || client.telephone_local),
        needs_access_code_setup: !access, locked_until: access?.locked_until || null, pre_activation: isPreActivation, otp_required_for_setup: !access });
    }
    if (action === "request_otp") {
      if (access) return json({ success: false, error: "Un code d'accès existe déjà pour ce compte.", needs_access_code_setup: false });
      const dest = smsDestination(client);
      if (!dest) return json({ success: false, error: "Aucun numéro joignable n'est enregistré pour ce dossier." });
      const channel = dest.startsWith("+225") ? "sms" : "whatsapp";
      const { data: recent } = await supabase.from("otp_codes").select("created_at").eq("telephone", phone)
        .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString()).limit(1);
      if (recent && recent.length) return json({ success: false, error: "Un code vient d'être envoyé. Patientez une minute avant d'en demander un autre." });
      const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
      await supabase.from("otp_codes").delete().eq("telephone", phone);
      const { data: otpRow, error: otpErr } = await supabase.from("otp_codes").insert({
        telephone: phone, code: await codeHash(otp, "otp:" + phone),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), verified: false, attempts: 0,
      }).select("id").single();
      if (otpErr || !otpRow) throw otpErr || new Error("Impossible d'enregistrer le code de vérification.");
      const { data: delivery, error: deliveryInsertError } = await supabase.from("notification_deliveries").insert({
        source_type: "client",
        source_id: client.id,
        recipient_name: client.nom_complet || "Client AgriCapital",
        recipient_phone: dest,
        canal: channel,
        fournisseur: "senndo",
        statut: "en_cours",
        contenu: "Code de vérification de première connexion au portail (code non conservé dans le CRM).",
        dedupe_key: "portal-otp:" + otpRow.id,
        metadata: { purpose: "portal_first_access_otp", requested_channel: channel, otp_record_id: otpRow.id },
      }).select("id").maybeSingle();
      if (deliveryInsertError) console.error("[Portal OTP] Suivi CRM indisponible", deliveryInsertError.message);
      try {
        const providerResult = channel === "sms"
          ? await sendOtpSms(supabase, dest, otp, otpRow.id)
          : await sendOtpWhatsApp(supabase, dest, otp, otpRow.id);
        if (delivery?.id) {
          const { error: deliveryUpdateError } = await supabase.from("notification_deliveries").update({
            statut: "envoye",
            provider_message_id: providerResult?.id || null,
            provider_status: "accepted",
            sent_at: new Date().toISOString(),
          }).eq("id", delivery.id);
          if (deliveryUpdateError) console.error("[Portal OTP] Mise à jour CRM impossible", deliveryUpdateError.message);
        }
      } catch (sendError: any) {
        if (delivery?.id) {
          await supabase.from("notification_deliveries").update({
            statut: "echoue",
            erreur: String(sendError?.message || "Échec Senndo").slice(0, 300),
            provider_status: String(sendError?.status || sendError?.statusCode || "rejected"),
          }).eq("id", delivery.id);
        }
        console.error("[Portal OTP] Échec Senndo " + channel, {
          status: sendError?.status || sendError?.statusCode || null,
          code: sendError?.code || null,
          message: String(sendError?.message || "Erreur fournisseur").slice(0, 300),
          destination: maskPhone(dest),
        });
        return json({
          success: false,
          code: channel === "sms" ? "SMS_SEND_FAILED" : "WHATSAPP_SEND_FAILED",
          error: "Le code n'a pas pu être envoyé par " + (channel === "sms" ? "SMS" : "WhatsApp") + ". Vérifiez le numéro enregistré ou réessayez dans quelques instants.",
        }, 502);
      }
      return json({ success: true, otp_sent: true, canal: channel, telephone_masque: maskPhone(dest) });
    }
    if (action === "verify_otp") {
      const otp = String(body?.otp || "");
      if (!/^\d{6}$/.test(otp)) return json({ success: false, code: "OTP_INVALID", error: "Saisissez le code de vérification à 6 chiffres." });
      const { data: otpRow, error: otpReadError } = await supabase.from("otp_codes")
        .select("id,code,expires_at,attempts").eq("telephone", phone).eq("verified", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (otpReadError) throw otpReadError;
      if (!otpRow || new Date(otpRow.expires_at).getTime() < Date.now() || Number(otpRow.attempts || 0) >= 5) {
        return json({ success: false, code: "OTP_EXPIRED", error: "Code de vérification expiré ou inexistant. Demandez un nouveau code." });
      }
      if (otpRow.code !== await codeHash(otp, "otp:" + phone)) {
        await supabase.from("otp_codes").update({ attempts: Number(otpRow.attempts || 0) + 1 }).eq("id", otpRow.id);
        return json({ success: false, code: "OTP_INVALID", error: "Code de vérification incorrect." });
      }
      const { error: verifyError } = await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRow.id);
      if (verifyError) throw verifyError;
      return json({ success: true, otp_verified: true });
    }
    if (action === "setup") {
      if (access) return json({ success: false, error: "Un code d'accès existe déjà pour ce compte. Utilisez-le pour vous connecter.", needs_access_code_setup: false });
      const code = String(body?.code || ""), confirm = String(body?.confirm_code || "");
      if (!/^\d{4}$/.test(code) || code !== confirm) return json({ success: false, error: "Le code doit contenir exactement 4 chiffres et les deux champs doivent être identiques." });
      // Le téléphone a déjà été vérifié par l'action verify_otp.
      const { data: otpRow, error: otpReadError } = await supabase.from("otp_codes")
        .select("id,expires_at,attempts").eq("telephone", phone).eq("verified", true)
        .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      if (otpReadError) throw otpReadError;
      if (!otpRow || Number(otpRow.attempts || 0) >= 5) {
        return json({ success: false, code: "OTP_REQUIRED", error: "Vérifiez d'abord le code reçu sur le canal indiqué." });
      }
      const salt = randomHex(16), hash = await codeHash(code, salt);
      const { error } = await supabase.from("client_portal_access_codes").insert({
        client_id: client.id, code_hash: hash, code_salt: salt, failed_attempts: 0, locked_until: null,
        set_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (error) {
        if (error.code === "23505") return json({ success: false, error: "Un code d'accès vient d'être enregistré pour ce compte. Utilisez-le pour vous connecter.", needs_access_code_setup: false });
        throw error;
      }
      await supabase.from("otp_codes").delete().eq("id", otpRow.id);
      const token = await issueSession(supabase, client.id);
      await supabase.from("historique_activites").insert({ table_name: "clients", record_id: client.id, action: "PORTAL_ACCESS_CODE_CREATED", details: "Code d'accès portail client à 4 chiffres créé après vérification du numéro de téléphone." });
      return json({ success: true, first_connection: true, access_token: token });
    }
    if (action === "login") {
      const code = String(body?.code || "");
      if (!/^\d{4}$/.test(code)) return json({ success: false, error: "Code d'accès invalide." });
      if (!access) return json({ success: false, needs_access_code_setup: true });
      if (access.locked_until && new Date(access.locked_until).getTime() > Date.now()) return json({ success: false, error: "Trop de tentatives. Veuillez réessayer plus tard.", locked_until: access.locked_until });
      const { data: fullAccess, error: fullAccessError } = await supabase.from("client_portal_access_codes").select("*").eq("client_id", client.id).single();
      if (fullAccessError) throw fullAccessError;
      const expected = await codeHash(code, fullAccess.code_salt);
      if (expected !== fullAccess.code_hash) {
        const attempts = Number(fullAccess.failed_attempts || 0) + 1;
        const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await supabase.from("client_portal_access_codes").update({ failed_attempts: attempts >= 5 ? 0 : attempts, locked_until: lockedUntil, updated_at: new Date().toISOString() }).eq("client_id", client.id);
        return json({ success: false, error: lockedUntil ? "Trop de tentatives. Réessayez dans 15 minutes." : "Code d'accès incorrect." });
      }
      await supabase.from("client_portal_access_codes").update({ failed_attempts: 0, locked_until: null, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("client_id", client.id);
      return json({ success: true, access_token: await issueSession(supabase, client.id) });
    }
    if (action === "logout") {
      const token = String(body?.access_token || "");
      if (token) await supabase.from("client_portal_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", await sessionTokenHash(token));
      return json({ success: true });
    }
    return json({ success: false, error: "Action invalide." });
  } catch (error: any) {
    console.error("portal-access internal error:", error?.message || error);
    return json({ success: false, code: "TEMPORARY_SERVICE_ERROR", error: "Nous rencontrons une difficulté technique. Veuillez réessayer dans quelques instants. Si le problème persiste, contactez AgriCapital au 05 64 55 17 17." }, 200);
  }
});