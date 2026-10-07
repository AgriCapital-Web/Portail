import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const normalizeStatus = (value: any) => {
  const s = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["termine","terminee","valide","validee","realise","realisee","acheve","achevee","complete","complet"].includes(s)) return "termine";
  if (["en_cours","encours","en cours","demarre","demarree"].includes(s)) return "en_cours";
  return "pending";
};

export const ProgressionTab = ({ plantation }: { plantation: any; client: any }) => {
  const [references, setReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any).from("referentiels_systeme").select("code,libelle,ordre,metadata").eq("categorie","etape_plantation").eq("actif",true).order("ordre");
      if (active) { setReferences(error ? [] : (data || [])); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const source: any[] = plantation?.etapes?.length ? plantation.etapes : plantation?.interventions || [];
  const etapes = useMemo(() => references.map((ref:any) => {
    const aliases = ref.code === "mise_en_terre" ? ["mise_en_terre","planting"] : [ref.code];
    const matches = source.filter((x:any) => aliases.includes(String(x.type || x.key || x.type_intervention)));
    const found = matches.find((x:any) => normalizeStatus(x.statut)==="termine") || matches.find((x:any) => normalizeStatus(x.statut)==="en_cours") || matches[0];
    return {...ref, optional:Boolean(ref.metadata?.optional), statut:normalizeStatus(found?.statut), date:found?.date_realisation||found?.date_intervention||found?.date, commentaire:found?.commentaire||found?.observations};
  }),[references,source]);
  const required=etapes.filter(e=>!e.optional);
  const completed=required.filter(e=>e.statut==="termine").length;
  const pct=required.length?Math.round(completed/required.length*100):0;
  const firstPending=etapes.findIndex(e=>e.statut!=="termine");
  if(loading) return <div className="flex min-h-[220px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary"/></div>;
  return <div className="space-y-3">
    <Card className="card-brand rounded-2xl"><CardContent className="p-4">
      <div className="flex items-center justify-between mb-2"><span className="font-semibold text-sm">Progression globale</span><span className="text-xl font-bold text-primary">{pct} %</span></div>
      <Progress value={pct} className="h-3"/><p className="text-[11px] text-muted-foreground mt-2">La progression reflète les réalisations réellement enregistrées dans le CRM.</p>
    </CardContent></Card>
    <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground mb-4">Étapes techniques</p><ol className="relative ml-2">
      {etapes.map((e:any,i:number)=>{const done=e.statut==="termine",inProgress=e.statut==="en_cours",nextDone=etapes[i+1]?.statut==="termine",last=i===etapes.length-1;return <li key={e.code} className="relative ml-4 pb-5 last:pb-0">
        {!last&&<span className={`absolute left-[-17px] top-5 bottom-0 w-0.5 ${done&&nextDone?"bg-primary":"bg-border/60"}`} aria-hidden="true"/>}
        <span className={`absolute -left-[25px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm ${done?"border-primary bg-primary":inProgress?"border-gold bg-gold":"border-muted-foreground/30 bg-background"}`}>{done?<Check className="h-3 w-3 text-white"/>:inProgress?<Loader2 className="h-2.5 w-2.5 text-white animate-spin"/>:<Circle className="h-2 w-2 text-muted-foreground"/>}</span>
        <div className="rounded-xl border bg-card p-3"><div className="flex items-center justify-between gap-2"><p className={`text-sm font-semibold ${done?"text-foreground":"text-muted-foreground"}`}>{i+1}. {e.libelle}</p>{done&&<Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">Réalisée</Badge>}{inProgress&&<Badge variant="outline" className="text-[9px] bg-gold/10 text-gold-dark border-gold/30">En cours</Badge>}</div>
        {e.date&&<p className="text-[10px] text-muted-foreground mt-1">{new Date(e.date).toLocaleDateString("fr-FR")}</p>}{e.commentaire&&<p className="text-[11px] text-muted-foreground italic mt-1">{e.commentaire}</p>}{firstPending===i&&<p className="mt-2 text-[10px] font-semibold text-primary">Prochaine étape du parcours</p>}</div>
      </li>})}
    </ol></CardContent></Card>
  </div>;
};
