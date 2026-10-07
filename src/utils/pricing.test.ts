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
  code: "PALMINVEST+",
  montant_pi_par_ha: 90700,
  montant_total_par_ha: 2465200,
  mensualite_par_ha: 83800,
  duree_paiement_mois: 40,
  tranches_paiement: [
    { type: "paiement_initial", mois: 1, montant: 90700, mensualite_par_ha: 0 },
    { annee: 1, mois: 11, mois_debut: 2, mois_fin: 12, mensualite_par_ha: 31900 },
    { annee: 2, mois: 12, mois_debut: 13, mois_fin: 24, mensualite_par_ha: 56900 },
    { annee: 3, mois: 16, mois_debut: 25, mois_fin: 40, mensualite_par_ha: 83800 },
  ],
};

const terraOffer = {
  code: "TERRAPALM+",
  montant_pi_par_ha: 84700,
  montant_total_par_ha: 1620200,
  mensualite_par_ha: 49800,
  duree_paiement_mois: 40,
  tranches_paiement: [
    { type: "paiement_initial", mois: 1, montant: 84700, mensualite_par_ha: 0 },
    { annee: 1, mois: 11, mois_debut: 2, mois_fin: 12, mensualite_par_ha: 26900 },
    { annee: 2, mois: 12, mois_debut: 13, mois_fin: 24, mensualite_par_ha: 36900 },
    { annee: 3, mois: 16, mois_debut: 25, mois_fin: 40, mensualite_par_ha: 49800 },
  ],
};

describe("pricing.ts — source CRM/DB", () => {
  it("reconstruit PalmInvest+ depuis les données de l'offre", () => {
    const s = getPricingScheduleFromOffer(palmOffer)!;
    expect(s.paiement_initial).toBe(90700);
    expect(s.an1_mensuel).toBe(31900);
    expect(s.an2_mensuel).toBe(56900);
    expect(s.an3_mensuel).toBe(83800);
    expect(s.duree_totale_mois).toBe(40);
    expect(s.total_par_ha).toBe(2465200);
  });

  it("reconstruit TerraPalm+ depuis les données de l'offre", () => {
    const s = getPricingScheduleFromOffer(terraOffer)!;
    expect(s.duree_totale_mois).toBe(40);
    expect(s.total_par_ha).toBe(1620200);
    expect(s.an3_duree_mois).toBe(16);
  });

  it("suit la phase courante depuis l'offre DB", () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 25);
    const r = getCurrentRateFromOffer(palmOffer, d.toISOString())!;
    expect(r.annee).toBe(3);
    expect(r.mensuel_par_ha).toBe(83800);
  });

  it("construit la grille uniquement depuis tranches_paiement", () => {
    const grid = getFullTariffGridFromOffer(palmOffer)!;
    expect(grid).toHaveLength(3);
    expect(grid[2].label).toBe("An 3 — 16 mois");
    expect(grid[2].mensuel).toBe(83800);
  });
});

describe("pricing.ts — calculs issus des tranches CRM/DB", () => {
  it("calcule 30 jours An1 sur 1 ha", () => {
    const r = calculateProgressiveAmountByDays(palmOffer, 0, 30, 1);
    expect(Math.round(r.montant)).toBe(31900);
  });

  it("traverse An1 vers An2", () => {
    const r = calculateProgressiveAmountByDays(palmOffer, 320, 30, 1);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].annee).toBe(1);
    expect(r.segments[1].annee).toBe(2);
  });

  it("s'arrête à la fin de l'échéancier", () => {
    const r = calculateProgressiveAmountByDays(palmOffer, 1200, 100, 1);
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
    expect(formatCFA(2465200)).toMatch(/2[\\s\\u00a0\\u202f]465[\\s\\u00a0\\u202f]200 F/);
  });
});
