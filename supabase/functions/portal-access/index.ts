import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
function normalizeWhatsAppRecipient(value: string): string {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) throw new Error("Numéro WhatsApp destinataire invalide.");
  let normalized = "";
  if (raw.startsWith("+")) normalized = "+" + digits;
  else if (raw.startsWith("00")) normalized = "+" + digits.slice(2);
  else if (digits.startsWith("225")) normalized = "+" + digits;
  else if (digits.length === 10 && /^0[157]\d{8}$/.test(digits)) normalized = "+225" + digits;
  else if (digits.length === 8) normalized = "+225" + digits;
  else throw new Error("Le numéro WhatsApp destinataire doit être au format international, par exemple +2250700000000.");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Numéro WhatsApp destinataire invalide.");
  return normalized;
}

function maskPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? "•••• " + digits.slice(-4) : null;
}

async function resolveWhatsAppSenderSession(): Promise<{ apiKey: string; senderSessionId: string; senderPhone: string }> {
  const [{ data: apiKey, error: apiError }, { data: configuredPhone, error: phoneError }] = await Promise.all([
    admin.rpc("senndo_get_secret", { p_name: "senndo_api_key" }),
    admin.rpc("senndo_get_secret", { p_name: "senndo_whatsapp_sender_phone" }),
  ]);
  if (apiError || typeof apiKey !== "string" || !apiKey) throw new Error("Clé API Senndo non configurée");
  if (phoneError || typeof configuredPhone !== "string" || !configuredPhone.trim()) throw new Error("Numéro de session WhatsApp Senndo non configuré en base.");

  const response = await fetch("https://api.senndo.com/v1/wa/sessions", {
    method: "GET",
    headers: { authorization: "Bearer " + apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Impossible de lire les sessions WhatsApp Senndo (HTTP " + response.status + ").");

  const asArray = (value: any): any[] => Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
  const rawSessions = [
    ...asArray(payload),
    ...asArray(payload?.sessions),
    ...asArray(payload?.data?.sessions),
    ...asArray(payload?.data),
    ...asArray(payload?.items),
    ...asArray(payload?.results),
    ...asArray(payload?.data?.items),
    ...asArray(payload?.data?.results),
    ...asArray(payload?.session),
    ...asArray(payload?.data?.session),
  ];
  const seenSessions = new Set<any>();
  const sessions = rawSessions
    .filter((item: any) => item && typeof item === "object" && !seenSessions.has(item) && (seenSessions.add(item), true))
    .map((item: any) => {
      const nested = item.session && typeof item.session === "object" ? item.session
        : item.data?.session && typeof item.data.session === "object" ? item.data.session : null;
      return nested ? {
        ...item, ...nested,
        id: nested.id ?? item.id,
        sessionId: nested.sessionId ?? nested.session_id ?? item.sessionId ?? item.session_id,
        senderSessionId: nested.senderSessionId ?? nested.sender_session_id ?? item.senderSessionId ?? item.sender_session_id,
        uuid: nested.uuid ?? item.uuid,
      } : item;
    });

  const nestedObjects = (root: any, depth = 0): any[] => {
    if (!root || typeof root !== "object" || depth > 5) return [];
    return [root, ...Object.values(root).flatMap((value: any) => nestedObjects(value, depth + 1))];
  };
  const technicalSessionId = (session: any): string => {
    const objects = nestedObjects(session);
    const preferred = [
      "senderSessionId", "sender_session_id", "sessionId", "session_id",
      "uniqueSessionId", "unique_session_id", "sessionKey", "session_key",
      "sessionUid", "session_uid", "sessionIdentifier", "session_identifier",
      "instanceId", "instance_id", "deviceId", "device_id", "sid", "uuid", "id",
    ];
    for (const key of preferred) {
      const value = objects.map((object: any) => object?.[key]).find((candidate: any) =>
        (typeof candidate === "string" && candidate.trim()) ||
        (typeof candidate === "number" && Number.isFinite(candidate)));
      if (value !== undefined) return String(value).trim();
    }
    return "";
  };
  const normalizePhone = (value: unknown) => {
    const rawPhone = String(value ?? "").split("@")[0].split(":")[0].replace(/\D/g, "");
    if (!rawPhone) return "";
    const national = rawPhone.startsWith("225") ? rawPhone.slice(3) : rawPhone;
    if (national.length === 10 && /^0[157]\d{8}$/.test(national)) return "225" + national.slice(-8);
    if (national.length === 8) return "225" + national;
    return rawPhone;
  };
  const phoneValues = (session: any) => [
    session?.phoneNumber, session?.phone_number, session?.phone, session?.displayPhoneNumber,
    session?.display_phone_number, session?.number, session?.jid, session?.user?.id,
    session?.user?.jid, session?.me?.id, session?.me?.jid, session?.account?.phone,
    session?.account?.phoneNumber, session?.profile?.phone, session?.whatsapp?.phone,
    session?.session?.phoneNumber, session?.session?.phone_number, session?.session?.user?.id,
    session?.session?.me?.id, session?.creds?.me?.id, session?.authState?.creds?.me?.id,
  ].filter((value) => (typeof value === "string" || typeof value === "number") && String(value).trim());
  const statusOf = (session: any) => String(
    session?.status ?? session?.state ?? session?.connectionStatus ?? session?.connection_status ??
    session?.connection?.status ?? session?.session?.status ?? ""
  ).trim().toLowerCase();
  const connected = sessions.filter((session: any) => ["connected", "open", "ready", "authenticated"].includes(statusOf(session)));
  const senderDigits = normalizePhone(configuredPhone);
  if (!senderDigits) throw new Error("Le numéro de session WhatsApp Senndo configuré est invalide.");
  const matches = connected.filter((session: any) => phoneValues(session).some((value: unknown) => normalizePhone(value) === senderDigits));

  // Senndo peut omettre le téléphone d'une session. Si une seule session est connectée,
  // elle est non ambiguë et peut être utilisée; plusieurs sessions exigent une correspondance exacte.
  const session = matches.length === 1 ? matches[0] : (matches.length === 0 && connected.length === 1 ? connected[0] : null);
  const senderSessionId = session ? technicalSessionId(session) : "";
  if (!session || !senderSessionId) {
    throw new Error(connected.length === 0
      ? "Aucune session WhatsApp connectée n’a été trouvée dans Senndo."
      : connected.length > 1 && matches.length !== 1
        ? "Plusieurs sessions WhatsApp sont connectées sans correspondance unique avec le numéro configuré."
        : "La session WhatsApp est connectée, mais Senndo ne fournit pas son identifiant technique.");
  }
  return { apiKey, senderSessionId, senderPhone: String(configuredPhone).trim() };
}

async function sendOtpWhatsApp(to: string, code: string, clientId: string) {
  const session = await resolveWhatsAppSenderSession();
  const recipient = normalizeWhatsAppRecipient(to);
  const message = "AgriCapital : votre code de vérification pour créer votre premier accès au portail est " + code + ". Il expire dans 10 minutes. Ne le partagez avec personne.";
  const response = await fetch("https://api.senndo.com/v1/messages", {
    method: "POST",
    headers: { authorization: "Bearer " + session.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ channel: "whatsapp_baileys", to: recipient, text: message, senderSessionId: session.senderSessionId, idempotencyKey: "portal-setup-otp:" + clientId + ":" + crypto.randomUUID() }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Échec de l'envoi WhatsApp Senndo (HTTP " + response.status + "). " + String(payload?.message || payload?.error || "").slice(0, 240));
  return payload?.id ?? payload?.messageId ?? payload?.message?.id ?? null;
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
      return json({ success: false, code: "CLIENT_NOT_READY", error: "Votre dossier client doit être validé avant l’accès au portail." }, 403);
    }
    const { data: access, error: accessError } = await supabase.from("client_portal_access_codes")
      .select("id,locked_until,last_verified_at").eq("client_id", client.id).maybeSingle();
    if (accessError) throw accessError;

    if (action === "inspect") {
      if (isDemo) {
        const token = await issueSession(supabase, client.id);
        return json({ success: true, demo: true, demo_code: "2026", access_token: token, client_id: client.id,
          telephone: client.telephone || client.whatsapp || client.telephone_local || client.whatsapp_local, nom_complet: client.nom_complet });
      }
      return json({ success: true, demo: false, telephone_masque: maskPhone(client.whatsapp || client.whatsapp_local || client.telephone || client.telephone_local),
        needs_access_code_setup: !access, locked_until: access?.locked_until || null, pre_activation: isPreActivation, otp_required_for_setup: !access });
    }
    if (action === "request_otp") {
      if (access) return json({ success: false, error: "Un code d'accès existe déjà pour ce compte.", needs_access_code_setup: false }, 409);
      const destination = client.whatsapp || client.whatsapp_local;
      if (!destination) return json({ success: false, code: "WHATSAPP_MISSING", error: "Aucun numéro WhatsApp n'est enregistré dans votre dossier." }, 400);
      const { data: recent, error: recentError } = await supabase.from("otp_codes").select("created_at").eq("telephone", phone)
        .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString()).limit(1);
      if (recentError) throw recentError;
      if (recent?.length) return json({ success: false, code: "OTP_RATE_LIMIT", error: "Un code vient d'être demandé. Patientez une minute avant de recommencer." }, 429);
      const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
      const { error: deleteError } = await supabase.from("otp_codes").delete().eq("telephone", phone).eq("verified", false);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("otp_codes").insert({
        telephone: phone, code: await codeHash(otp, "otp:" + phone),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), verified: false, attempts: 0
      });
      if (insertError) throw insertError;
      try {
        const messageId = await sendOtpWhatsApp(destination, otp, client.id);
        return json({ success: true, otp_sent: true, channel: "whatsapp", message_id: messageId, telephone_masque: maskPhone(destination) });
      } catch (sendError) {
        await supabase.from("otp_codes").delete().eq("telephone", phone).eq("verified", false);
        throw sendError;
      }
    }
    if (action === "setup") {
      if (access) return json({ success: false, error: "Un code d'accès existe déjà pour ce compte. Utilisez-le pour vous connecter.", needs_access_code_setup: false }, 409);
      const code = String(body?.code || ""), confirm = String(body?.confirm_code || "");
      if (!/^\d{4}$/.test(code) || code !== confirm) return json({ success: false, error: "Le code doit contenir exactement 4 chiffres et les deux champs doivent être identiques." }, 400);

      // First-access identity proof: OTP must have been issued to the registered WhatsApp contact.
      const otp = String(body?.otp || "");
      if (!/^\d{6}$/.test(otp)) return json({ success: false, code: "OTP_REQUIRED", error: "Saisissez le code de vérification reçu par WhatsApp." }, 400);
      const { data: otpRow, error: otpReadError } = await supabase.from("otp_codes")
        .select("id,code,expires_at,attempts")
        .eq("telephone", phone).eq("verified", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (otpReadError) throw otpReadError;
      if (!otpRow || new Date(otpRow.expires_at).getTime() <= Date.now()) {
        return json({ success: false, code: "OTP_EXPIRED", error: "Code de vérification expiré. Demandez un nouveau code WhatsApp." }, 400);
      }
      if (Number(otpRow.attempts || 0) >= 5) {
        return json({ success: false, code: "OTP_LOCKED", error: "Trop de tentatives. Demandez un nouveau code WhatsApp." }, 429);
      }
      if (otpRow.code !== await codeHash(otp, "otp:" + phone)) {
        await supabase.from("otp_codes").update({ attempts: Number(otpRow.attempts || 0) + 1 }).eq("id", otpRow.id);
        return json({ success: false, code: "OTP_INVALID", error: "Code de vérification incorrect." }, 401);
      }
      const { data: consumedOtp, error: consumeError } = await supabase.from("otp_codes")
        .update({ verified: true }).eq("id", otpRow.id).eq("verified", false).select("id").maybeSingle();
      if (consumeError) throw consumeError;
      if (!consumedOtp) return json({ success: false, code: "OTP_ALREADY_USED", error: "Ce code a déjà été utilisé. Demandez un nouveau code WhatsApp." }, 409);

      const salt = randomHex(16), hash = await codeHash(code, salt);
      const { error } = await supabase.from("client_portal_access_codes").insert({
        client_id: client.id, code_hash: hash, code_salt: salt, failed_attempts: 0, locked_until: null,
        set_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (error) {
        if (error.code === "23505") return json({ success: false, error: "Un code d'accès vient d'être enregistré pour ce compte. Utilisez-le pour vous connecter.", needs_access_code_setup: false }, 409);
        throw error;
      }
      const token = await issueSession(supabase, client.id);
      await supabase.from("historique_activites").insert({ table_name: "clients", record_id: client.id, action: "PORTAL_ACCESS_CODE_CREATED", details: "Code d'accès portail client à 4 chiffres créé." });
      return json({ success: true, first_connection: true, access_token: token });
    }
    if (action === "login") {
      const code = String(body?.code || "");
      if (!/^\d{4}$/.test(code)) return json({ success: false, error: "Code d'accès invalide." }, 400);
      if (!access) return json({ success: false, needs_access_code_setup: true }, 409);
      if (access.locked_until && new Date(access.locked_until).getTime() > Date.now()) return json({ success: false, error: "Trop de tentatives. Veuillez réessayer plus tard.", locked_until: access.locked_until }, 429);
      const { data: fullAccess, error: fullAccessError } = await supabase.from("client_portal_access_codes").select("*").eq("client_id", client.id).single();
      if (fullAccessError) throw fullAccessError;
      const expected = await codeHash(code, fullAccess.code_salt);
      if (expected !== fullAccess.code_hash) {
        const attempts = Number(fullAccess.failed_attempts || 0) + 1;
        const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await supabase.from("client_portal_access_codes").update({ failed_attempts: attempts >= 5 ? 0 : attempts, locked_until: lockedUntil, updated_at: new Date().toISOString() }).eq("client_id", client.id);
        return json({ success: false, error: lockedUntil ? "Trop de tentatives. Réessayez dans 15 minutes." : "Code d'accès incorrect." }, 401);
      }
      await supabase.from("client_portal_access_codes").update({ failed_attempts: 0, locked_until: null, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("client_id", client.id);
      return json({ success: true, access_token: await issueSession(supabase, client.id) });
    }
    if (action === "logout") {
      const token = String(body?.access_token || "");
      if (token) await supabase.from("client_portal_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", await sessionTokenHash(token));
      return json({ success: true });
    }
    return json({ success: false, error: "Action invalide." }, 400);
  } catch (error: any) {
    console.error("portal-access internal error:", error?.message || error);
    return json({ success: false, code: "TEMPORARY_SERVICE_ERROR", error: "Nous rencontrons une difficulté technique. Veuillez réessayer dans quelques instants. Si le problème persiste, contactez AgriCapital au 05 64 55 17 17." }, 200);
  }
});