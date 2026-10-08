import { addDays } from "date-fns";
import { demoProfileUrl, demoMediaUrls } from './demoMedia';

export const DEMO_ACCESS_CODE = "2026";
const d = (days:number) => addDays(new Date(), days).toISOString();

export const createDemoAccount = (telephone="+2250700000000") => {
  const plantationId="DEMO-PLANTATION-001";
  const steps:any[]=[
    ["validation_parcelle","Validation de la parcelle","termine",-20,"Parcelle validée après contrôle."],
    ["defrichage","Défrichage","termine",-17,"Défrichage terminé."],
    ["piquetage","Piquetage","termine",-14,"Piquetage et alignement contrôlés."],
    ["trouaison","Trouaison","termine",-10,"Trouaison terminée."],
    ["mise_en_terre","Mise en terre","termine",-6,"Mise en terre réalisée et contrôlée."],
    ["remplacement","Remplacement des manquants","en_cours",-2,"Contrôle de reprise en cours."],
    ["entretien","Entretien","pending",0,"Premier entretien programmé."],
    ["fertilisation","Fertilisation","pending",0,"Plan de fertilisation à venir."],
    ["mise_production","Mise en production","pending",0,"Étape future."],
    ["remise","Remise au client","pending",0,"Étape finale du parcours."]
  ].map(([key,label,statut,days,commentaire])=>({key,type:key,label,statut,date_realisation:statut==="pending"?null:d(Number(days)),commentaire}));
  const reports:any[]=Array.from({length:6},(_,i)=>{const n=i+1;return{id:"DEMO-R-"+n,titre:"Rapport de suivi technique M"+n,date_visite:d(-30+i*5),statut:"valide",client_visible:true,etat_plantation:n===6?"Reprise satisfaisante, suivi en cours.":"Phase de mise en place suivie.",contenu:"Rapport de démonstration M"+n+" : observations, travaux réalisés et recommandations.",prochaine_intervention:d(14),medias:[{id:"DEMO-RM-"+n,media_type:"photo",url:demoMediaUrls[i],nom_fichier:"suivi-m"+n+".jpg",description:"Photo terrain M"+n} ]};});
  const plantation:any={
    id:plantationId,id_unique:"PL-DEMO-001",nom:"Plantation démonstration",nom_plantation:"PalmTerroir — Démonstration Gonaté",
    statut:"active",statut_global:"actif",formule_code:"PALMTERROIR",formule_nom:"PalmTerroir",superficie_ha:2.5,superficie_activee:2.5,
    surface_reellement_plantee:2.5,nombre_plants_prevus:358,nombre_plants_mis_en_terre:358,nombre_plants_remplaces:0,densite_plants:143,taux_reussite:98.6,
    variete:"Tenera sélectionnée",date_activation:d(-20),date_plantation:d(-6),derniere_visite:d(-2),derniere_intervention:"Contrôle de reprise",
    prochaine_intervention:"Dans 14 jours",village:"Gonaté",village_nom:"Gonaté — zone agricole démonstration",localite:"GONATÉ",
    latitude:6.97,longitude:-6.22,localisation_gps_lat:6.97,localisation_gps_lng:-6.22,etapes:steps,interventions:steps,
    medias:demoMediaUrls.map((url,i)=>({id:"DEMO-M-"+(i+1),type:"photo",url,operation:steps[i].label,commentaire:"Photo terrain de démonstration.",date:steps[i].date_realisation||d(-2)})),
    documents:[
      {id:"DEMO-D1",nom:"Contrat de souscription — Démo",categorie:"Contrat",statut:"valide",url:"/demo/contrat-souscription-demo.pdf"},
      {id:"DEMO-D2",nom:"Plan de localisation — Démo",categorie:"Foncier",statut:"valide",url:"/demo/plan-localisation-demo.pdf"},
      ...[1,2,3,4,5,6].map(n=>({id:"DEMO-D"+(n+2),nom:"Rapport technique M"+n,categorie:"Technique",statut:"valide",url:"/demo/rapport-m"+n+".pdf"}))
    ],
    rapports_visites:reports,
    tickets_techniques:[{id:"DEMO-T1",titre:"Contrôle de reprise",description:"Contrôle terrain après mise en terre.",statut:"en_cours",priorite:"normale"},{id:"DEMO-T2",titre:"Mise en terre validée",description:"Mise en terre contrôlée.",statut:"resolu",priorite:"normale"}],
    messages:[
      {id:"DEMO-MS1",auteur_type:"technicien",auteur_nom:"KOUAMÉ PIERRE KOFFI",message:"La mise en terre a été contrôlée. La parcelle est en phase de reprise.",created_at:d(-5),lu:true},
      {id:"DEMO-MS2",auteur_type:"commercial",auteur_nom:"KONAN AMENAN LARISSA",message:"Votre dossier de démonstration est complet : étapes, photos, documents et rapports sont disponibles.",created_at:d(-4),lu:true},
      {id:"DEMO-MS3",auteur_type:"client",auteur_nom:"Compte DÉMO",message:"Merci pour le suivi.",created_at:d(-3),lu:true},
      {id:"DEMO-MS4",auteur_type:"technicien",auteur_nom:"KOUAMÉ PIERRE KOFFI",message:"Le prochain contrôle de reprise est prévu dans deux semaines.",created_at:d(-1),lu:false}
    ]
  };
  const client:any={
    id:"DEMO-FRONT-ONLY",id_unique:"DEMO-FRONT",nom_complet:"Compte DÉMO AgriCapital",civilite:"M",nom_famille:"DÉMO",prenoms:"AgriCapital",
    telephone,telephone_local:telephone.replace(/^\+\d{1,3}/,""),telephone_indicatif:telephone.match(/^\+\d{1,3}/)?.[0]||"+225",
    email:"demo@agricapital.ci",localite:"GONATÉ",type_client:"client_officiel",statut:"actif",statut_global:"a_jour",compte_actif:true,demo:true,_demo:true,
    portal_primary_role:"client",offre_id:"DEMO-OFFRE-PALMTERROIR",prochaine_echeance:d(10),
    paiement_etat:{paiement_initial:{solde:0},mensualite:{montant:12500,montant_a_payer:12500,montant_arriere:0,jours_retard:0,hectares_actifs:2.5}},
    total_hectares:2.5,nombre_plantations:1,phase_actuelle:"reprise",famille_offre:"PalmTerroir",formule_code:"PALMTERROIR",formule_nom:"PalmTerroir",
    offres:{nom:"PalmTerroir",formule_nom:"PalmTerroir"},photo_profil_url:demoProfileUrl,numero_contrat:"DEMO-AC-2026",
    parcelle:{id:"DEMO-PARCELLE-001",id_unique:"PAR-DEMO-001",nom:"Parcelle démonstration — Gonaté",surface_totale_ha:2.5,village:"Gonaté",village_nom:"Gonaté — zone agricole démonstration",localisation_gps_lat:6.97,localisation_gps_lng:-6.22,statut:"actif"},
    parcelles:[],attributions:[],proprietaire:null,documents:plantation.documents,technique_interventions:steps,
    technique_progression:steps.map((e:any)=>({key:e.key,label:e.label,statut:e.statut,date:e.date_realisation,commentaire:e.commentaire})),
    commercial:{nom:"KONAN AMENAN LARISSA",fonction:"Conseiller AgriCapital",telephone:"+2250700000000",email:"commercial@agricapital.ci",photo:demoProfileUrl,photo_url:demoProfileUrl},
    technicien:{nom:"KOUAMÉ PIERRE KOFFI",fonction:"Technicien terrain",telephone:"+2250700000001",photo_url:demoProfileUrl},
    techniciens:[],demo_messages:plantation.messages,
    demo_notifications:[
      {id:"DEMO-N1",title:"Mise en terre terminée",message:"La mise en terre a été réalisée et contrôlée.",created_at:d(-6),read:true,data:{plantation_id:plantationId}},
      {id:"DEMO-N2",title:"Nouveau rapport technique",message:"Le rapport M6 est disponible.",created_at:d(-2),read:false,data:{plantation_id:plantationId}},
      {id:"DEMO-N3",title:"Nouveau message",message:"Votre technicien vous a écrit.",created_at:d(-1),read:false,data:{plantation_id:plantationId}}
    ]
  };
  return {demo_code:DEMO_ACCESS_CODE,client,plantations:[plantation],paiements:[]};
};
