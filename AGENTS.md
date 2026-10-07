# Portal architecture

- Treat CRM responses as the authority for real account data and payment state; browser state is only a display cache.
- Use the shared role predicates for payment presentation and one dashboard for all portal roles, so stakeholder accounts retain the same navigation without payment controls.
- Retrieve public country and technical-step labels through the restricted invoker RPC, so anonymous portal sessions do not require staff rights.
- Keep demo records and interactions browser-local; never authenticate demo identities or send demo writes to CRM services.
- Display payment success only after the payment service returns a validated ledger record, not from widget callbacks or URL parameters.