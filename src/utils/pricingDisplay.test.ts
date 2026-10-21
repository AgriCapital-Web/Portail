import { describe, it, expect } from "vitest";
import { getPricingScheduleFromOffer, getFullTariffGridFromOffer, formatCFA } from "./pricing";

const palmOffer = {
  code: "PALMINVEST",
  montant_pi_par_ha: 90700,
  montant_total_par_ha: 2465200,
  montant_cash_par_ha: 2465200,
  mensualite_par_ha: 59362.5,
  duree_paiement_mois: 40,
  tranches_paiement: [
    { type: "mensualite_unique", mois: 40, mois_debut: 1, mois_fin: 40, mensualite_par_ha: 59362.5, total_periode_par_ha: 2374500 },
  ],
};

const terraOffer = {
  code: "TERRAPALM",
  montant_pi_par_ha: 84700,
  montant_total_par_ha: 1620200,
  montant_cash_par_ha: 1620200,
  mensualite_par_ha: 38387.5,
  duree_paiement_mois: 40,
  tranches_paiement: [
    { type: "mensualite_unique", mois: 40, mois_debut: 1, mois_fin: 40, mensualite_par_ha: 38387.5, total_periode_par_ha: 1535500 },
  ],
};

describe("Affichage tarifaire depuis CRM/DB", () => {
  it("affiche PalmInvest avec une mensualité uniforme sur 40 mois", () => {
    const schedule = getPricingScheduleFromOffer(palmOffer)!;
    const grid = getFullTariffGridFromOffer(palmOffer)!;
    expect(schedule.duree_totale_mois).toBe(40);
    expect(formatCFA(schedule.total_par_ha)).toMatch(/2[\\s\\u00a0\\u202f]465[\\s\\u00a0\\u202f]200 F/);
    expect(grid).toHaveLength(1);
    expect(grid[0].label).toBe("Mensualité unique — 40 mois");
    expect(grid[0].mensuel).toBe(59362.5);
  });

  it("affiche TerraPalm avec une mensualité uniforme sur 40 mois", () => {
    const schedule = getPricingScheduleFromOffer(terraOffer)!;
    const grid = getFullTariffGridFromOffer(terraOffer)!;
    expect(schedule.duree_totale_mois).toBe(40);
    expect(formatCFA(schedule.total_par_ha)).toMatch(/1[\\s\\u00a0\\u202f]620[\\s\\u00a0\\u202f]200 F/);
    expect(grid).toHaveLength(1);
    expect(grid[0].label).toBe("Mensualité unique — 40 mois");
    expect(grid[0].mensuel).toBe(38387.5);
  });
});
