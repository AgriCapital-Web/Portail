import { describe, it, expect } from "vitest";
import { getPricingScheduleFromOffer, getFullTariffGridFromOffer, formatCFA } from "./pricing";

const palmOffer = {
  code: "PALMINVEST",
  montant_pi_par_ha: 90700,
  montant_total_par_ha: 2467900,
  montant_cash_par_ha: 2266000,
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
  montant_cash_par_ha: 1466200,
  mensualite_par_ha: 36600,
  duree_paiement_mois: 42,
  tranches_paiement: [
    { type: "mensualite_unique", mois: 42, mois_debut: 1, mois_fin: 42, mensualite_par_ha: 36600, total_periode_par_ha: 1537200 },
  ],
};

describe("Affichage tarifaire depuis CRM/DB", () => {
  it("affiche PalmInvest avec une mensualité uniforme sur 42 mois", () => {
    const schedule = getPricingScheduleFromOffer(palmOffer)!;
    const grid = getFullTariffGridFromOffer(palmOffer)!;
    expect(schedule.duree_totale_mois).toBe(42);
    expect(formatCFA(schedule.total_par_ha)).toMatch(/2[\s\u00a0\u202f]467[\s\u00a0\u202f]900 F/);
    expect(grid).toHaveLength(1);
    expect(grid[0].label).toBe("Mensualité unique — 42 mois");
    expect(grid[0].mensuel).toBe(56600);
  });

  it("affiche TerraPalm avec une mensualité uniforme sur 42 mois", () => {
    const schedule = getPricingScheduleFromOffer(terraOffer)!;
    const grid = getFullTariffGridFromOffer(terraOffer)!;
    expect(schedule.duree_totale_mois).toBe(42);
    expect(formatCFA(schedule.total_par_ha)).toMatch(/1[\s\u00a0\u202f]621[\s\u00a0\u202f]900 F/);
    expect(grid).toHaveLength(1);
    expect(grid[0].label).toBe("Mensualité unique — 42 mois");
    expect(grid[0].mensuel).toBe(36600);
  });
});
