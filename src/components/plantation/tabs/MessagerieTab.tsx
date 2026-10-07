import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Loader2, UserRound, Headphones, Wrench, BriefcaseBusiness, Paperclip, X, FileText, Image as ImageIcon, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Props = { client: any; plantation?: any };
type PendingAttachment = { file: File; preview?: string };
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " Ko" : (bytes / 1024 / 1024).toFixed(1) + " Mo";
const attachmentIcon = (type = "") => type.startsWith("image/") ? ImageIcon : type.startsWith("video/") ? Video : FileText;

async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml" || file.size <= 2 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
}

const labelFor = (type: string) => {
  if (type === "technicien") return { label: "Technicien", icon: Wrench };
  if (type === "commercial") return { label: "Commercial", icon: BriefcaseBusiness };
  if (type === "staff") return { label: "AgriCapital", icon: Headphones };
  return { label: "Vous", icon: UserRound };
};

export const MessagerieTab = ({ client, plantation }: Props) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const token=sessionStorage.getItem("agri_portal_access_token");
  const isDemo=sessionStorage.getItem("agri_demo")==="1";

  const load = useCallback(async () => {
    if (isDemo) {
try {
const stored = JSON.parse(sessionStorage.getItem("agri_demo_messages") || "null");
setMessages(Array.isArray(stored) ? stored : (client?.demo_messages || plantation?.messages || []));
} catch { setMessages(client?.demo_messages || plantation?.messages || []); }
setLoading(false);
return;
}
if (!token) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke("portal-messaging", {
      body: { action: "list", access_token: token, plantation_id: plantation?.id || null },
    });
    if (!error && data?.success) {
      const nextMessages=data.messages||[];
      const unread=nextMessages.filter((m:any)=>m.auteur_type!=="client"&&!m.lu).map((m:any)=>m.id);
      if(unread.length){const readAt=new Date().toISOString();await supabase.functions.invoke("portal-messaging",{body:{action:"mark_read",access_token:token,plantation_id:plantation?.id||null}});setMessages(nextMessages.map((m:any)=>unread.includes(m.id)?{...m,lu:true,lu_at:readAt}:m));}else setMessages(nextMessages);
    }
    setLoading(false);
  }, [token, plantation?.id, client?.demo_messages, plantation?.messages, isDemo]);

  useEffect(() => {
    void load();
    const timer=window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const currentMessages = useMemo(
    () => messages.filter((m) => !plantation?.id || !m.plantation_id || m.plantation_id === plantation.id),
    [messages, plantation?.id]
  );

  const chooseFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { alert("Fichier trop volumineux. La limite est de 50 Mo."); return; }
    const optimized = await optimizeImage(file).catch(() => file);
    const preview = optimized.type.startsWith("image/") ? URL.createObjectURL(optimized) : undefined;
    if (pending?.preview) URL.revokeObjectURL(pending.preview);
    setPending({ file: optimized, preview });
  };

  const removePending = () => {
    if (pending?.preview) URL.revokeObjectURL(pending.preview);
    setPending(null);
  };

  const uploadAttachment = async (file: File) => {
    const form = new FormData();
    form.append("access_token", token || "");
    form.append("plantation_id", plantation?.id || "");
    form.append("file", file);
    const { data, error } = await supabase.functions.invoke("portal-message-upload", { body: form });
    if (error || !data?.success) throw new Error(data?.error || error?.message || "Upload impossible.");
    return data;
  };

  const isMobileLike=()=>typeof window!=="undefined"&&(window.matchMedia?.("(pointer: coarse)").matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  const send=async()=>{
    const message = draft.trim();
    if ((!message && !pending)) return;
if (isDemo) {
const current = (() => { try { return JSON.parse(sessionStorage.getItem("agri_demo_messages") || "null"); } catch { return null; } })() || client?.demo_messages || plantation?.messages || [];
const next = [...current, { id: "DEMO-LOCAL-" + Date.now(), auteur_type: "client", auteur_nom: client?.nom_complet || "Compte DÉMO", message, created_at: new Date().toISOString(), lu: true }];
sessionStorage.setItem("agri_demo_messages", JSON.stringify(next));
setMessages(next); setDraft(""); removePending();
// Réponse simulée locale — aucune écriture en base.
window.setTimeout(() => {
  try {
    const cur = JSON.parse(sessionStorage.getItem("agri_demo_messages") || "[]");
    const reply = { id: "DEMO-REPLY-" + Date.now(), auteur_type: "commercial", auteur_nom: client?.commercial?.nom || "Conseiller AgriCapital", message: "Merci pour votre message. Ceci est une réponse simulée du mode démonstration.", created_at: new Date().toISOString(), lu: true };
    const updated = [...(Array.isArray(cur) ? cur : next), reply];
    sessionStorage.setItem("agri_demo_messages", JSON.stringify(updated));
    setMessages(updated);
  } catch { /* noop */ }
}, 1500);
return;
}
if (!token) return;
    setSending(true);
    try {
      const attachment = pending ? await uploadAttachment(pending.file) : null;
      const { data, error } = await supabase.functions.invoke("portal-messaging", {
        body: { action: "send", access_token: token, message, plantation_id: plantation?.id || null, attachment },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Envoi impossible.");
      setDraft("");
      removePending();
      await load();
    } catch (e: any) {
      alert(e?.message || "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" /> Messagerie AgriCapital
        </CardTitle>
        <p className="text-xs text-muted-foreground">Échangez avec votre équipe AgriCapital. Vos messages sont rattachés à votre dossier et, si applicable, à la plantation sélectionnée.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="min-h-[260px] max-h-[460px] overflow-y-auto rounded-xl bg-muted/20 p-3 space-y-3">
          {loading ? (
            <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : currentMessages.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold">Aucun message</p>
              <p className="text-xs text-muted-foreground">Écrivez à votre équipe pour démarrer la conversation.</p>
            </div>
          ) : currentMessages.map((m) => {
            const meta = labelFor(m.auteur_type);
            const Icon = meta.icon;
            const mine = m.auteur_type === "client";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 ${mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-white border rounded-bl-md"}`}>
                  <div className={`flex items-center gap-1.5 mb-1 text-[10px] ${mine ? "text-white/75" : "text-muted-foreground"}`}>
                    <Icon className="h-3 w-3" />
                    <span className="font-semibold">{mine ? "Vous" : (m.auteur_nom || meta.label)}</span>
                    {!mine && <Badge variant="outline" className="h-4 px-1 text-[8px]">{meta.label}</Badge>}
                  </div>
                  {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                  {m.piece_jointe_url && (
                    <a href={m.piece_jointe_url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-lg bg-black/5 p-2">
                      {(() => { const AttachmentIcon = attachmentIcon(m.piece_jointe_type); return <AttachmentIcon className="h-4 w-4 shrink-0" />; })()}
                      <span className="text-xs font-medium truncate">{m.piece_jointe_nom || "Pièce jointe"}</span>
                      <span className="text-[10px] opacity-70">{formatBytes(m.piece_jointe_taille || 0)}</span>
                    </a>
                  )}
                  <p className={`text-[9px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleString("fr-FR")}{mine&&<span className="ml-2">{m.lu?"✓✓ Lu":m.recu_at?"✓ Reçu":"✓ Envoyé"}</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {pending && (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
            {pending.preview ? <img src={pending.preview} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <FileText className="h-7 w-7 text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{pending.file.name}</p>
              <p className="text-[10px] text-muted-foreground">{formatBytes(pending.file.size)} · optimisation automatique si nécessaire</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={removePending} disabled={sending}><X className="h-4 w-4" /></Button>
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            uppercase={false}
            value={draft}
            maxLength={4000}
            rows={3}
            placeholder="Écrire un message à AgriCapital… (Entrée = envoyer sur ordinateur, Maj+Entrée = nouvelle ligne ; Entrée = nouvelle ligne sur mobile)"
            onChange={e=>setDraft(e.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !isMobileLike()) {
                event.preventDefault();
                void send();
              }
            }}
            disabled={sending}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input id="portal-message-file" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" className="hidden" disabled={sending} onChange={(e) => { void chooseFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
              <label htmlFor="portal-message-file">
                <Button type="button" variant="outline" asChild disabled={sending}><span className="cursor-pointer"><Paperclip className="h-4 w-4 mr-2" />Joindre</span></Button>
              </label>
              <span className="text-[10px] text-muted-foreground">{draft.length}/4000</span>
            </div>
            <Button type="button" onClick={send} disabled={sending||(!draft.trim()&&!pending)} className="btn-brand">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
