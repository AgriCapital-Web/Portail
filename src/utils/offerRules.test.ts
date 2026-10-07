import { describe, expect, it } from "vitest";
import { isManagedPlusOffer } from "./offerRules";

describe("offerRules — offres Plus canoniques", () => {
  it("active le parcours Plus uniquement pour PalmInvest+", () => {
    expect(isManagedPlusOffer({ code: "PALMINVEST+" })).toBe(true);
  });

  it("active le parcours Plus uniquement pour TerraPalm+", () => {
    expect(isManagedPlusOffer({ code: "TERRAPALM+" })).toBe(true);
  });

  it("n'active pas le parcours Plus pour les offres sans +", () => {
    expect(isManagedPlusOffer({ code: "PALMINVEST" })).toBe(false);
    expect(isManagedPlusOffer({ code: "TERRAPALM" })).toBe(false);
    expect(isManagedPlusOffer({ code: "PALMTERROIR_ESSENTIELLE" })).toBe(false);
  });

  it("n'accepte aucun alias ou autre code se terminant par +", () => {
    expect(isManagedPlusOffer({ code: "AUTRE+" })).toBe(false);
    expect(isManagedPlusOffer({ code: "PALMINVEST-PLUS" })).toBe(false);
    expect(isManagedPlusOffer({ code: "TERRAPALMPLUS" })).toBe(false);
  });
});
