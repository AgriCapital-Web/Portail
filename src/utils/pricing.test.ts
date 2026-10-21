import { describe, it, expect } from "vitest";
import {
  getPricingScheduleFromOffer,
  getCurrentRateFromOffer,
  getFullTariffGridFromOffer,
  calculateProgressiveAmountByDays,
  formatCFA,
} from "./pricing";
import { validateOfferPricing } from "./pricingGuard";

const palmOffer = {
  code: "PALMINVEST",
  montant_pi_par_ha: 90700,
  montant_total_par_ha: 2467900,
  mensualite_par_ha: 56600,
  duree_paiement_mois: 42,
  tranches_paiement: [
    { type: "mensualite_unique", mois: 42, mois_debut: 1, mois_fin: 42, mensualite_par_ha: 56600, total_periode_par_ha: 2377200 },
  ],
};

const terraOffer = {
  code: "TERRAPALM",
  montant_pi_par_ha: 84700,
  montant_total_par_ha: 1621900,
  mensualite_par_ha: 36600,
  duree_paiement_mois: 42,
  tranches_paiement: [
    { type: "mensualite_unique", mois: 42, mois_debut: 1, mois_fin: 42, mensualite_par_ha: 36600, total_periode_par_ha: 1537200 },
  ],
};

describe("pricing.ts — source CRM/DB", () => {
  it("reconstruit PalmInvest depuis la mensualité uniforme de l'offre", () => {
    const s = getPricingScheduleFromOffer(palmOffer)!;
    expect(s.paiement_initial).toBe(90700);
    expect(s.an1_mensuel).toBe(56600);
    expect(s.an1_duree_mois).toBe(42);
    expect(s.an2_duree_mois).toBe(0);
    expect(s.an3_duree_mois).toBe(0);
    expect(s.mensualite_unique).toBe(true);
    expect(s.duree_totale_mois).toBe(42);
    expect(s.total_par_ha).toBe(2467900);
  });

  it("reconstruit TerraPalm depuis la mensualité uniforme de l'offre", () => {
    const s = getPricingScheduleFromOffer(terraOffer)!;
    expect(s.duree_totale_mois).toBe(42);
    expect(s.total_par_ha).toBe(1621900);
    expect(s.mensualite_unique).toBe(true);
    expect(getFullTariffGridFromOffer(terraOffer)![0].label).toBe("Mensualité unique — 42 mois");
  });

  it("conserve le même tarif mensuel sur toute la durée", () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 25);
    const r = getCurrentRateFromOffer(palmOffer, d.toISOString())!;
    expect(r.label).toBe("Mensualité unique");
    expect(r.mensuel_par_ha).toBe(56600);
  });

  it("construit une seule ligne d'échéancier depuis tranches_paiement", () => {
    const grid = getFullTariffGridFromOffer(palmOffer)!;
    expect(grid).toHaveLength(1);
    expect(grid[0].label).toBe("Mensualité unique — 42 mois");
    expect(grid[0].mensuel).toBe(56600);
  });
});

describe("pricing.ts — calculs issus des tranches CRM/DB", () => {
  it("calcule 30 jours de mensualité unique sur 1 ha", () => {
    const r = calculateProgressiveAmountByDays(palmOffer, 0, 30, 1);
    expect(Math.round(r.montant)).toBe(56600);
    expect(r.segments[0].label).toBe("Mensualité unique");
  });

  it("garde la même mensualité après 12 mois", () => {
    const r = calculateProgressiveAmountByDays(palmOffer, 360, 30, 1);
    expect(Math.round(r.montant)).toBe(56600);
  });

  it("s'arrête à la fin de l'échéancier", () => {
    const r = calculateProgressiveAmountByDays(palmOffer, 1300, 100, 1);
    expect(r.montant).toBe(0);
    expect(r.totalJours).toBe(0);
  });
});

describe("pricingGuard — cohérence CRM/DB", () => {
  it("ne signale aucun problème quand l'offre est synchronisée", () => {
    expect(validateOfferPricing(palmOffer)).toEqual([]);
    expect(validateOfferPricing(terraOffer)).toEqual([]);
  });

  it("signale un décalage de total", () => {
    const bad = { ...palmOffer, montant_total_par_ha: 9999999 };
    expect(validateOfferPricing(bad).some((i) => i.field === "montant_total_par_ha")).toBe(true);
  });

  it("signale un décalage de durée", () => {
    const bad = { ...palmOffer, duree_paiement_mois: 34 };
    expect(validateOfferPricing(bad).some((i) => i.field === "duree_paiement_mois")).toBe(true);
  });
});

describe("formatCFA", () => {
  it("formate le montant", () => {
    expect(formatCFA(2467900)).toMatch(/2[\\s\\u00a0\\u202f]467[\\s\\u00a0\\u202f]900 F/);
  });
});
