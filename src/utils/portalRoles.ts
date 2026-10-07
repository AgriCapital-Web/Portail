/** Presentation only. Authorization is enforced by the CRM services. */
export const canShowPayments = (client: any): boolean =>
  client?.portal_primary_role === "client" &&
  !client?.is_beneficiaire_particulier &&
  client?.type_client !== "beneficiaire_particulier";

export const portalRoleLabel = (client: any): string => {
  const roles: string[] = client?.portal_roles || [];
  const owner = client?.portal_primary_role === "proprietaire_foncier" || roles.includes("proprietaire_foncier");
  const beneficiary = client?.portal_primary_role === "beneficiaire_particulier" || roles.includes("beneficiaire_particulier") || client?.is_beneficiaire_particulier || client?.type_client === "beneficiaire_particulier";
  if (owner && beneficiary) return "Propriétaire partenaire · Bénéficiaire";
  if (owner) return "Propriétaire partenaire";
  if (beneficiary) return "Bénéficiaire";
  return "Client";
};