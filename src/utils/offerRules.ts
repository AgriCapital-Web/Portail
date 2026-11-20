/**
 * Règles métier des offres visibles dans AC_Clients.
 * Le CRM/DB est la seule source de vérité du code d'offre.
 *
 * Les onglets Production / Intrants / Revenus sont réservés aux formules « Sous gestion »
 * de PalmInvest et TerraPalm, identifiées par leurs codes réels en base.
 */

export const MANAGED_PLUS_OFFER_CODES = ["PALMINVEST_DELEGUE", "TERRAPALM_DELEGUE"] as const;

export function isManagedPlusOffer(offerOrCode: unknown): boolean {
  const code = typeof offerOrCode === "object" && offerOrCode !== null
    ? (offerOrCode as { code?: unknown }).code
    : offerOrCode;
  return MANAGED_PLUS_OFFER_CODES.includes(String(code ?? "").trim().toUpperCase() as (typeof MANAGED_PLUS_OFFER_CODES)[number]);
}
