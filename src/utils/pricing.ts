/**
 * Moteur d'affichage tarifaire d'AC_Clients.
 *
 * La table `offres` du CRM/DB est l'unique source de vérité.
 * AC_Clients ne maintient aucun tarif statique.
 *
 * Types métier : PI (Paiement initial) et MENSUALITE (Mensualité).
 */

export interface PricingSchedule {
  paiement_initial: number;
  an1_mensuel: number;
  an1_duree_mois: number;
  an2_mensuel: number;
  an2_duree_mois: number;
  an3_mensuel: number;
  an3_duree_mois: number;
  total_par_ha: number;
  duree_totale_mois: number;
  cash_price: number;
}

export interface OfferPricingSource {
  code?: string | null;
  montant_pi_par_ha?: number | null;
  mensualite_par_ha?: number | null;
  montant_total_par_ha?: number | null;
  montant_cash_par_ha?: number | null;
  duree_paiement_mois?: number | null;
  tranches_paiement?: unknown;
}

export interface CurrentRate {
  annee: number;
  label: string;
  mensuel_par_ha: number;
  jour_par_ha: number;
  semaine_par_ha: number;
  trimestre_par_ha: number;
  semestre_par_ha: number;
  annuel_par_ha: number;
  mois_restants_dans_annee: number;
  mois_ecoules: number;
  schedule: PricingSchedule;
}

export interface PaymentBreakdownSegment {
  label: string;
  annee: number;
  jours: number;
  moisEquivalent: number;
  mensuel_par_ha: number;
  montant: number;
}

export interface ProgressivePaymentResult {
  montant: number;
  totalJours: number;
  segments: PaymentBreakdownSegment[];
}

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function getTranches(offre?: OfferPricingSource | null): Array<{ annee: number; mois: number; mensualite_par_ha: number }> {
  const raw = offre?.tranches_paiement;
  const parsed = Array.isArray(raw) ? raw : [];
  return parsed
    .filter((t: any) => String(t?.type || '').toLowerCase() !== 'paiement_initial')
    .map((t: any) => ({
      annee: toNumber(t?.annee),
      mois: toNumber(t?.mois),
      mensualite_par_ha: toNumber(t?.mensualite_par_ha),
    }))
    .filter((t) => t.annee > 0 && t.mois > 0 && t.mensualite_par_ha > 0)
    .sort((a, b) => a.annee - b.annee);
}

export function getPricingScheduleFromOffer(offre?: OfferPricingSource | null): PricingSchedule | null {
  if (!offre) return null;
  const tranches = getTranches(offre);
  const paiementInitial = toNumber(offre.montant_pi_par_ha);
  const mensualiteFallback = toNumber(offre.mensualite_par_ha);
  if (tranches.length === 0 && mensualiteFallback <= 0 && paiementInitial <= 0) return null;

  const fallbackDuration = Math.max(0, toNumber(offre.duree_paiement_mois));
  const trancheDuration = tranches.reduce((sum, t) => sum + t.mois, 0);
  const duration = fallbackDuration > 0 ? fallbackDuration : trancheDuration;
  const byYear = [tranches[0], tranches[1] || tranches[0], tranches[2] || tranches[1] || tranches[0]];
  const an1Mensuel = byYear[0]?.mensualite_par_ha || mensualiteFallback;
  const an2Mensuel = byYear[1]?.mensualite_par_ha || an1Mensuel;
  const an3Mensuel = byYear[2]?.mensualite_par_ha || an2Mensuel;
  const an1Duree = byYear[0]?.mois || Math.min(12, duration);
  const an2Duree = byYear[1]?.mois || Math.min(12, Math.max(0, duration - an1Duree));
  const an3Duree = byYear[2]?.mois || Math.max(0, duration - an1Duree - an2Duree);
  const totalRecalcule = paiementInitial
    + an1Mensuel * an1Duree
    + an2Mensuel * an2Duree
    + an3Mensuel * an3Duree;

  return {
    paiement_initial: paiementInitial,
    an1_mensuel: an1Mensuel,
    an1_duree_mois: an1Duree,
    an2_mensuel: an2Mensuel,
    an2_duree_mois: an2Duree,
    an3_mensuel: an3Mensuel,
    an3_duree_mois: an3Duree,
    total_par_ha: toNumber(offre.montant_total_par_ha, totalRecalcule),
    duree_totale_mois: duration,
    cash_price: toNumber(offre.montant_cash_par_ha, toNumber(offre.montant_total_par_ha, totalRecalcule)),
  };
}

function getElapsedDays(dateActivation: string | null | undefined): number {
  if (!dateActivation) return 0;
  const activation = new Date(dateActivation).getTime();
  if (!Number.isFinite(activation)) return 0;
  return Math.max(0, Math.floor((Date.now() - activation) / 86400000));
}

function getElapsedMonths(dateActivation: string | null | undefined): number {
  if (!dateActivation) return 0;
  const activation = new Date(dateActivation);
  if (Number.isNaN(activation.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - activation.getFullYear()) * 12 + (now.getMonth() - activation.getMonth()));
}

function getScheduleTranches(schedule: PricingSchedule) {
  return [
    { annee: 1, label: 'An 1', mois: schedule.an1_duree_mois, mensuel: schedule.an1_mensuel },
    { annee: 2, label: 'An 2', mois: schedule.an2_duree_mois, mensuel: schedule.an2_mensuel },
    { annee: 3, label: 'An 3', mois: schedule.an3_duree_mois, mensuel: schedule.an3_mensuel },
  ].filter((t) => t.mois > 0 && t.mensuel > 0);
}

export function getCurrentRateFromOffer(
  offre: OfferPricingSource | null | undefined,
  dateActivation: string | null | undefined,
): CurrentRate | null {
  const schedule = getPricingScheduleFromOffer(offre);
  if (!schedule) return null;
  const moisEcoules = getElapsedMonths(dateActivation);
  let annee: number;
  let mensuel: number;
  let moisRestants: number;

  if (moisEcoules < schedule.an1_duree_mois) {
    annee = 1;
    mensuel = schedule.an1_mensuel;
    moisRestants = schedule.an1_duree_mois - moisEcoules;
  } else if (moisEcoules < schedule.an1_duree_mois + schedule.an2_duree_mois) {
    annee = 2;
    mensuel = schedule.an2_mensuel;
    moisRestants = schedule.an1_duree_mois + schedule.an2_duree_mois - moisEcoules;
  } else {
    annee = 3;
    mensuel = schedule.an3_mensuel;
    moisRestants = Math.max(0, schedule.duree_totale_mois - moisEcoules);
  }

  return {
    annee,
    label: `An ${annee}`,
    mensuel_par_ha: mensuel,
    jour_par_ha: Math.round(mensuel / 30),
    semaine_par_ha: Math.round(mensuel / 4),
    trimestre_par_ha: mensuel * 3,
    semestre_par_ha: mensuel * 6,
    annuel_par_ha: mensuel * 12,
    mois_restants_dans_annee: moisRestants,
    mois_ecoules: moisEcoules,
    schedule,
  };
}

export function getFullTariffGridFromOffer(offre: OfferPricingSource | null | undefined): {
  label: string;
  mensuel: number;
  duree: number;
  total: number;
}[] | null {
  const schedule = getPricingScheduleFromOffer(offre);
  if (!schedule) return null;
  return getScheduleTranches(schedule).map((t) => ({
    label: `${t.label} — ${t.mois} mois`,
    mensuel: t.mensuel,
    duree: t.mois,
    total: t.mensuel * t.mois,
  }));
}

export function periodToDays(
  periodType: 'jour' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee',
  count: number,
): number {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const unitDays: Record<typeof periodType, number> = {
    jour: 1,
    semaine: 7,
    mois: 30,
    trimestre: 90,
    semestre: 180,
    annee: 360,
  };
  return unitDays[periodType] * safeCount;
}

export function calculateProgressiveAmountByDays(
  offre: OfferPricingSource | null | undefined,
  startDayOffset: number,
  daysCount: number,
  superficieHa: number,
): ProgressivePaymentResult {
  const schedule = getPricingScheduleFromOffer(offre);
  const sup = Math.max(0, Number(superficieHa) || 0);
  const totalDays = Math.max(0, Math.floor(Number(daysCount) || 0));
  if (!schedule || sup <= 0 || totalDays <= 0) return { montant: 0, totalJours: totalDays, segments: [] };

  const segments: PaymentBreakdownSegment[] = [];
  let cursor = Math.max(0, Math.floor(Number(startDayOffset) || 0));
  let remaining = totalDays;

  for (const tranche of getScheduleTranches(schedule)) {
    const trancheDays = tranche.mois * 30;
    if (cursor >= trancheDays) {
      cursor -= trancheDays;
      continue;
    }
    const available = trancheDays - cursor;
    const days = Math.min(remaining, available);
    const amount = (tranche.mensuel / 30) * days * sup;
    segments.push({
      label: tranche.label,
      annee: tranche.annee,
      jours: days,
      moisEquivalent: days / 30,
      mensuel_par_ha: tranche.mensuel,
      montant: amount,
    });
    remaining -= days;
    cursor = 0;
    if (remaining <= 0) break;
  }

  return {
    montant: segments.reduce((sum, segment) => sum + segment.montant, 0),
    totalJours: totalDays - remaining,
    segments,
  };
}

export function calculateProgressivePeriodAmount(
  offre: OfferPricingSource | null | undefined,
  dateActivation: string | null | undefined,
  periodType: 'jour' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'annee',
  count: number,
  superficieHa: number,
): ProgressivePaymentResult {
  return calculateProgressiveAmountByDays(offre, getElapsedDays(dateActivation), periodToDays(periodType, count), superficieHa);
}

export function formatCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount || 0)) + ' F';
}
