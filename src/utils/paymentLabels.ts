/**
 * Vocabulaire unique des paiements dans AC_Clients.
 * Types métier autorisés : Paiement initial et Mensualité.
 * Codes techniques : PI et MENSUALITE.
 */
export const PAYMENT_TYPE_LABELS = {
  PI: "Paiement initial",
  MENSUALITE: "Mensualité",
} as const;

export const PAYMENT_TYPE_SHORT_LABELS = {
  PI: "Paiement initial",
  MENSUALITE: "Mensualité",
} as const;

export function getPaymentTypeLabel(type: string | null | undefined): string {
  const key = String(type || "").trim().toUpperCase() as keyof typeof PAYMENT_TYPE_LABELS;
  return PAYMENT_TYPE_LABELS[key] ?? "Paiement";
}

export function getPaymentTypeShortLabel(type: string | null | undefined): string {
  const key = String(type || "").trim().toUpperCase() as keyof typeof PAYMENT_TYPE_SHORT_LABELS;
  return PAYMENT_TYPE_SHORT_LABELS[key] ?? "Paiement";
}
