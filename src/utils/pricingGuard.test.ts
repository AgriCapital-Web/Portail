import { describe, it, expect, beforeEach } from "vitest";
import {
  assertOfferPricingFresh,
  validateOfferPricing,
  PRICING_GUARD_EVENT,
  __resetPricingGuardForTests,
} from "./pricingGuard";

beforeEach(() => __resetPricingGuardForTests());

const goodOffer = {
  code: "PALMINVEST",
  montant_pi_par_ha: 90700,
  montant_total_par_ha: 2465200,
  mensualite_par_ha: 59362.5,
  duree_paiement_mois: 40,
  tranches_paiement: [
    { type: "mensualite_unique", mois: 40, mois_debut: 1, mois_fin: 40, mensualite_par_ha: 59362.5, total_periode_par_ha: 2374500 },
  ],
};

describe("pricingGuard — émission d'un événement UI", () => {
  it("ne dispatch rien quand la DB est cohérente", () => {
    let fired = 0;
    const h = () => fired++;
    window.addEventListener(PRICING_GUARD_EVENT, h);
    assertOfferPricingFresh(goodOffer);
    window.removeEventListener(PRICING_GUARD_EVENT, h);
    expect(fired).toBe(0);
  });

  it("dispatch un CustomEvent avec les issues quand un décalage existe", () => {
    const events: any[] = [];
    const h = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener(PRICING_GUARD_EVENT, h);
    assertOfferPricingFresh({ ...goodOffer, montant_total_par_ha: 1 });
    window.removeEventListener(PRICING_GUARD_EVENT, h);
    expect(events).toHaveLength(1);
    expect(events[0].issues[0].field).toBe("montant_total_par_ha");
  });

  it("validateOfferPricing reste utilisable seul (pas d'effet de bord)", () => {
    const issues = validateOfferPricing({ ...goodOffer, duree_paiement_mois: 34 });
    expect(issues.some((i) => i.field === "duree_paiement_mois")).toBe(true);
  });
});
