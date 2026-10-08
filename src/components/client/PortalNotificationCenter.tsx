import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function PortalNotificationCenter({ compact=false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [items,setItems]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  const { permission, requestPermission, showNotification } = usePushNotifications();
  const seenIds = useRef<Set<string>>(new Set());
  const fingerprint = useRef("");

  const load=async()=>{
    const token=sessionStorage.getItem("agri_portal_access_token");
    const isDemo=sessionStorage.getItem("agri_demo")==="1";
    if(isDemo){
try {
const client=JSON.parse(sessionStorage.getItem("agri_client")||"null");
const stored=JSON.parse(sessionStorage.getItem("agri_demo_notifications")||"null");
setItems(Array.isArray(stored)?stored:(client?.demo_notifications||[]));
} catch { setItems([]); }
return;
}
if(!token) return;
    const {data,error}=await supabase.functions.invoke("portal-messaging",{
      body:{action:"notifications",access_token:token}
    });
    if(error||!data?.success) return;
    const next=data.notifications||[];
    const previous=seenIds.current;
    const isInitial=previous.size===0;
    const nextFingerprint = next.map((n:any) => `${n.id}:${n.read ? "1" : "0"}:${n.created_at}`).join("|");
    seenIds.current=new Set(next.map((n:any)=>n.id));
    if (nextFingerprint !== fingerprint.current) {
      fingerprint.current = nextFingerprint;
      setItems(next);
    }
    if(!isInitial){
      const fresh=next.filter((n:any)=>!previous.has(n.id)&&!n.read);
      for(const n of fresh){
        void showNotification({
          title:n.title,
          body:n.message,
          tag:n.dedupe_key||n.id,
          data:n.data||{},
        });
      }
    }
  };

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),3000);
    return()=>window.clearInterval(timer);
  },[]);

  const unread=items.filter(n=>!n.read).length;
  const enable=async()=>{ await requestPermission(); };
  const markAll=async()=>{
    const token=sessionStorage.getItem("agri_portal_access_token");
    if(!token) return;
    await supabase.functions.invoke("portal-messaging",{body:{action:"mark_notification_read",access_token:token}});
    setItems((prev)=>prev.map(n=>({...n,read:true})));
  };

  return (
    <div className="relative">
      <Button variant={compact?"ghost":"outline"} size={compact?"icon":"sm"} onClick={()=>setOpen(v=>!v)} className={compact?"text-white hover:bg-white/15":"gap-2"}>
        <Bell className={`h-4 w-4 ${unread>0?"text-red-500":""}`}/>{!compact&&"Notifications"}
        {unread>0&&<Badge className={compact?"absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[9px] rounded-full bg-red-600 text-white hover:bg-red-600 border border-white/80":"ml-1 rounded-full bg-red-600 text-white hover:bg-red-600"}>{unread}</Badge>}
      </Button>
      {open&&(
        <div className="absolute right-0 top-full z-[80] mt-2 w-[min(92vw,380px)] rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b p-3">
            <div><p className="text-sm font-bold">Notifications</p><p className="text-[10px] text-muted-foreground">{unread} non lue(s)</p></div>
            {unread>0&&<Button variant="ghost" size="sm" onClick={markAll}><CheckCheck className="mr-1 h-3.5 w-3.5"/>Tout lire</Button>}
          </div>
          {permission!=="granted"&&(
            <div className="border-b bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Activez les notifications pour recevoir les nouveaux messages même lorsque l’écran de messagerie n’est pas ouvert.</p>
              <Button size="sm" className="mt-2" onClick={enable}>Activer les notifications</Button>
            </div>
          )}
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {items.length===0?<p className="p-5 text-center text-xs text-muted-foreground">Aucune notification.</p>:items.map((n:any)=>(
              <button key={n.id} className={`w-full rounded-xl p-3 text-left hover:bg-muted/50 ${n.read?"":"bg-primary/5"}`} onClick={async()=>{
                const token=sessionStorage.getItem("agri_portal_access_token");
                if(token&&!n.read) await supabase.functions.invoke("portal-messaging",{body:{action:"mark_notification_read",access_token:token,notification_id:n.id}});
                setItems(prev=>prev.map(x=>x.id===n.id?{...x,read:true}:x));
                const target = typeof n.data?.route === "string" ? n.data.route : "";
                const plantationId = typeof n.data?.plantation_id === "string" ? n.data.plantation_id : "";
                if (plantationId) navigate("/plantations/" + encodeURIComponent(plantationId));
                else if (target === "/plantations" || target === "plantations" || target === "/messagerie" || target === "messagerie") navigate("/plantations");
              }}>
                <div className="flex items-start gap-2"><Bell className="mt-0.5 h-3.5 w-3.5 text-primary shrink-0"/><div className="min-w-0"><p className="text-xs font-semibold">{n.title}</p><p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p><p className="mt-1 text-[9px] text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</p></div></div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
