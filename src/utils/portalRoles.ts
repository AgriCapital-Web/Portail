/** Display rules only; the CRM remains responsible for authorization. */
export const isLocalDemo = (client: any) => client?.id === 'DEMO-FRONT-ONLY' && client?.demo === true && !sessionStorage.getItem('agri_portal_access_token');
export const canShowPayments = (client: any) => {
  const owner = client?.type_client === 'proprietaire_foncier' ||
    client?.is_proprietaire_foncier ||
    (client?.portal_roles || []).includes('proprietaire_foncier');
  const beneficiary = client?.is_beneficiaire_particulier ||
    client?.type_client === 'beneficiaire_particulier' ||
    (client?.portal_roles || []).includes('beneficiaire_particulier');
  return client?.portal_primary_role === 'client' &&
    !owner &&
    (!beneficiary || client?.has_financial_subscriptions === true);
};