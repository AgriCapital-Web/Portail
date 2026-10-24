import { describe, expect, it } from "vitest";
import { canShowPayments } from "@/utils/portalRoles";

describe("portal financial access", () => {
  it("never exposes payments to a landowner account, even if stale data claims a subscription", () => {
    expect(canShowPayments({
      portal_primary_role: "proprietaire_foncier",
      portal_roles: ["proprietaire_foncier"],
      has_financial_subscriptions: true,
      montant_total_contrat: 100000,
    })).toBe(false);
  });

  it("keeps payments available to a validated commercial client account", () => {
    expect(canShowPayments({
      portal_primary_role: "client",
      portal_roles: ["client"],
      type_client: "client",
      has_financial_subscriptions: true,
    })).toBe(true);
  });


  it("rejects stale client-role data when the actual account is a landowner", () => {
    expect(canShowPayments({
      portal_primary_role: "client",
      portal_roles: ["client", "proprietaire_foncier"],
      type_client: "proprietaire_foncier",
      has_financial_subscriptions: true,
      montant_total_contrat: 100000,
    })).toBe(false);
  });

  it("does not expose payments to a particular beneficiary", () => {
    expect(canShowPayments({
      portal_primary_role: "beneficiaire_particulier",
      portal_roles: ["beneficiaire_particulier"],
      is_beneficiaire_particulier: true,
    })).toBe(false);
  });
});
