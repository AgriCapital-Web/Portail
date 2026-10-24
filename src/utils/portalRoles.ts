/** Display rules only; the CRM remains responsible for authorization. */
export const isLocalDemo = (client: any) => client?.id === 'DEMO-FRONT-ONLY' && client?.demo === true && !sessionStorage.getItem('agri_portal_access_token');
export const canShowPayments = (client: any) =>
  client?.portal_primary_role === 'client' &&
  client?.type_client !== 'proprietaire_foncier' &&
  !client?.is_proprietaire_foncier &&
  !(client?.portal_roles || []).includes('proprietaire_foncier') &&
  !client?.is_beneficiaire_particulier &&
  client?.type_client !== 'beneficiaire_particulier';