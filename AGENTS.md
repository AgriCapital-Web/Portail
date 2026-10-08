# Portal architecture
- Real account data and permissions come from CRM services; presentation helpers never authorize server operations.
- Demo fixtures and simulations stay in browser session storage and must branch before any payment or messaging service call.
- Demo media uses imported CDN asset pointers shared by profile, gallery and reports so every view displays the same supplied photos.
- Client and demo share dashboard and payment components; only their data source and transaction execution differ.
- Public country and progression labels come from the CRM reference RPC, cached through the shared query provider.