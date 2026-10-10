import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Country = { code:string; name:string; callingCode:string; flag:string; minLocalDigits?:number; maxLocalDigits?:number; isDefault?:boolean };
type Props = { label?:string; countryCode?:string; localValue?:string; required?:boolean; disabled?:boolean; onChange:(v:{countryCode:string;callingCode:string;localValue:string;internationalValue:string})=>void };
const countryFlag = (code: string) =>
  String(code || "").toUpperCase().replace(/[A-Z]/g, (letter) =>
    String.fromCodePoint(127397 + letter.charCodeAt(0))
  );
const digits=(value:string)=>String(value||"").replace(/\D/g,"");

export default function CountryPhoneInput({label,countryCode,localValue="",required,disabled,onChange}:Props){
  const [countries,setCountries]=useState<Country[]>([]);
  const [selectedCode,setSelectedCode]=useState("");
  const lastEmittedCallingCode=useRef<string|null>(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{let active=true;void(async()=>{const {data,error}=await(supabase as any).from("referentiels_systeme").select("code,libelle,ordre,metadata").eq("categorie","pays_telephone").eq("actif",true).order("ordre").order("libelle");if(active&&!error)setCountries((data||[]).map((r:any)=>({code:r.code,name:r.libelle,callingCode:r.metadata?.callingCode||"",flag:r.metadata?.flag||countryFlag(r.code),minLocalDigits:r.metadata?.minLocalDigits,maxLocalDigits:r.metadata?.maxLocalDigits,isDefault:!!r.metadata?.is_default})).filter((c:Country)=>c.callingCode));})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!countries.length)return;if(lastEmittedCallingCode.current&&countryCode===lastEmittedCallingCode.current){lastEmittedCallingCode.current=null;return;}const exact=countries.find(c=>c.code===countryCode);const matches=countries.filter(c=>c.callingCode===countryCode);setSelectedCode((exact|| (matches.length===1?matches[0]:undefined)||countries.find(c=>c.isDefault)||countries[0])?.code||"");},[countryCode,countries]);
  const selected=countries.find(c=>c.code===selectedCode)||countries.find(c=>c.isDefault)||countries[0];
  const options=useMemo(()=>countries.map(c=>({value:c.code,label:c.flag+" "+c.name+" "+c.callingCode})),[countries]);
  const emit=(country:Country,value:string)=>{setSelectedCode(country.code);lastEmittedCallingCode.current=country.callingCode;const local=digits(value).slice(0,country.maxLocalDigits||undefined);onChange({countryCode:country.code,callingCode:country.callingCode,localValue:local,internationalValue:local?country.callingCode+local:""});};
  return <div className="space-y-2 min-w-0">
    {label&&<label className="text-sm font-medium">{label}{required&&" *"}</label>}
    <div className="flex w-full min-w-0 gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" disabled={disabled||!selected} className="w-[112px] shrink-0 justify-between px-3 font-normal"><span className="truncate">{selected?selected.flag+" "+selected.callingCode:"Pays"}</span><ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50"/></Button></PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] p-0"><Command><CommandInput placeholder="Rechercher un pays..."/><CommandList><CommandEmpty>Aucun pays trouvé.</CommandEmpty><CommandGroup>{options.map(o=><CommandItem key={o.value} value={o.label} onSelect={()=>{const c=countries.find(x=>x.code===o.value);if(c)emit(c,localValue);setOpen(false);}}><Check className={cn("mr-2 h-4 w-4",selected?.code===o.value?"opacity-100":"opacity-0")}/><span className="truncate">{o.label}</span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent>
      </Popover>
      <Input className="min-w-0 flex-1" type="tel" inputMode="numeric" autoComplete="tel" value={localValue} disabled={disabled||!selected} required={required} minLength={selected?.minLocalDigits} maxLength={selected?.maxLocalDigits} placeholder="Numéro local" onChange={e=>selected&&emit(selected,e.target.value)}/>
    </div>
  </div>;
}
