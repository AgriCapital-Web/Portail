import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Smartphone, Sparkles, ShieldCheck } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const DISMISS_KEY="pwa-install-last-dismissed-ac-clients";
const DAY=24*60*60*1000;
const standalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches||window.matchMedia("(display-mode: minimal-ui)").matches||(window.navigator as any).standalone===true;
async function installed(){if(standalone())return true;try{const f=(navigator as any).getInstalledRelatedApps;if(typeof f==="function"){const a=await f.call(navigator);return Array.isArray(a)&&a.length>0;}}catch{}return false;}
const allowed=()=>{const t=Number(localStorage.getItem(DISMISS_KEY)||0);return !t||Date.now()-t>=DAY;};
export default function InstallPrompt(){
 const [deferred,setDeferred]=useState<BeforeInstallPromptEvent|null>(null),[show,setShow]=useState(false),[ios,setIos]=useState(false),[isInstalled,setInstalled]=useState(false);
 useEffect(()=>{let dead=false;const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);setIos(isIOS);
 const before=async(e:Event)=>{e.preventDefault();if(await installed()||!allowed()||dead)return;setDeferred(e as BeforeInstallPromptEvent);window.setTimeout(()=>{if(!dead&&!standalone()&&allowed())setShow(true);},2500);};
 const app=()=>{localStorage.removeItem(DISMISS_KEY);setInstalled(true);setDeferred(null);setShow(false);};
 void installed().then(v=>{if(!dead&&v)setInstalled(true);});
 window.addEventListener("beforeinstallprompt",before);window.addEventListener("appinstalled",app);
 if(isIOS&&!standalone()&&allowed())window.setTimeout(()=>{if(!dead&&!standalone())setShow(true);},3500);
 return()=>{dead=true;window.removeEventListener("beforeinstallprompt",before);window.removeEventListener("appinstalled",app);};
 },[]);
 const dismiss=()=>{localStorage.setItem(DISMISS_KEY,String(Date.now()));setShow(false);};
 const install=async()=>{if(!deferred)return;await deferred.prompt();await deferred.userChoice;localStorage.setItem(DISMISS_KEY,String(Date.now()));setDeferred(null);setShow(false);};
 if(!show||isInstalled)return null;
 return <Dialog open={show} onOpenChange={o=>!o&&dismiss()}><DialogContent className="max-w-[92vw] rounded-[2rem] p-0 sm:max-w-md">
  <div className="bg-[image:var(--gradient-hero)] px-6 pb-7 pt-8 text-primary-foreground"><div className="flex items-start gap-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-3xl bg-white p-1.5"><img src="/images/logo-light.png" alt="AgriCapital" className="h-full w-full object-contain"/></div><DialogHeader className="text-left"><div className="inline-flex w-fit items-center gap-1 rounded-full border border-white/20 px-2 py-1 text-[10px] font-bold uppercase"><Sparkles className="h-3 w-3"/> App officielle</div><DialogTitle className="text-xl font-black text-primary-foreground">Installer AC_Clients</DialogTitle><DialogDescription className="text-primary-foreground/75">Accédez rapidement à votre espace client AgriCapital.</DialogDescription></DialogHeader></div></div>
  <div className="p-6">{ios?<div className="rounded-2xl bg-muted/40 p-4 text-sm"><p className="font-medium text-foreground">Pour installer sur iPhone/iPad :</p><ol className="mt-2 list-decimal list-inside space-y-2"><li>Appuyez sur <strong>Partager</strong>.</li><li>Choisissez <strong>Sur l’écran d’accueil</strong>.</li><li>Appuyez sur <strong>Ajouter</strong>.</li></ol></div>:<p className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">Installez AC_Clients comme application sur votre appareil.</p>}<div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-2xl border bg-primary/5 p-3"><Smartphone className="mb-2 h-4 w-4 text-primary"/><p className="text-[11px] font-bold">Plein écran</p></div><div className="rounded-2xl border bg-primary/5 p-3"><ShieldCheck className="mb-2 h-4 w-4 text-primary"/><p className="text-[11px] font-bold">Sécurisé</p></div></div><div className="mt-6 flex flex-col gap-2">{!ios&&deferred&&<Button onClick={()=>void install()} size="lg" className="w-full gap-2 rounded-2xl"><Download className="h-5 w-5"/>Installer l’application</Button>}<Button variant="outline" onClick={dismiss} className="w-full rounded-2xl">Plus tard</Button></div><p className="mt-4 text-center text-xs text-muted-foreground">Le rappel ne réapparaît pas avant 24 heures.</p></div>
 </DialogContent></Dialog>;
}
