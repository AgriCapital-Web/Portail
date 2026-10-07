import { describe, it, expect } from "vitest";
import { getPricingScheduleFromOffer, getFullTariffGridFromOffer, formatCFA } from "./pricing";

const palmOffer = {
  code: "PALMINVEST+",
  montant_pi_par_ha: 90700,
  montant_total_par_ha: 2465200,
  montant_cash_par_ha: 2465200,
  mensualite_par_ha: 83800,
  duree_paiement_mois: 40,
  tranches_paiement: [
    { type: "paiement_initial", mois: 1, montant: 90700, mensualite_par_ha: 0 },
    { annee: 1, mois: 11, mensualite_par_ha: 31900 },
    { annee: 2, mois: 12, mensualite_par_ha: 56900 },
    { annee: 3, mois: 16, mensualite_par_ha: 83800 },
  ],
};

const terraOffer = {
  code: "TERRAPALM+",
  montant_pi_par_ha: 84700,
  montant_total_par_ha: 1620200,
  montant_cash_par_ha: 1620200,
  mensualite_par_ha: 49800,
  duree_paiement_mois: 40,
  tranches_paiement: [
    { type: "paiement_initial", mois: 1, montant: 84700, mensualite_par_ha: 0 },
    { annee: 1, mois: 11, mensualite_par_ha: 26900 },
    { annee: 2, mois: 12, mensualite_par_ha: 36900 },
    { annee: 3, mois: 16, mensualite_par_ha: 49800 },
  ],
};

describe("Affichage tarifaire depuis CRM/DB", () => {
  it("affiche PalmInvest+ avec 40 mois et An 3 — 16 mois", () => {
    const schedule = getPricingScheduleFromOffer(palmOffer)!;
    const grid = getFullTariffGridFromOffer(palmOffer)!;
    expect(schedule.duree_totale_mois).toBe(40);
    expect(formatCFA(schedule.total_par_ha)).toMatch(/2[\\s\\u00a0\\u202f]465[\\s\\u00a0\\u202f]200 F/);
    expect(grid[2].label).toBe("An 3 — 16 mois");
    expect(grid[2].mensuel).toBe(83800);
  });

  it("affiche TerraPalm+ avec 40 mois et An 3 — 16 mois", () => {
    const schedule = getPricingScheduleFromOffer(terraOffer)!;
    const grid = getFullTariffGridFromOffer(terraOffer)!;
    expect(schedule.duree_totale_mois).toBe(40);
    expect(formatCFA(schedule.total_par_ha)).toMatch(/1[\\s\\u00a0\\u202f]620[\\s\\u00a0\\u202f]200 F/);
    expect(grid[2].label).toBe("An 3 — 16 mois");
    expect(grid[2].mensuel).toBe(49800);
  });
});
