import { describe, it, expect } from "vitest";
import { PAYMENT_TYPE_LABELS, getPaymentTypeLabel, getPaymentTypeShortLabel } from "./paymentLabels";

describe("paymentLabels — vocabulaire canonique", () => {
  it("n’autorise que les deux types de paiement métier", () => {
    expect(PAYMENT_TYPE_LABELS.PI).toBe("Paiement initial");
    expect(PAYMENT_TYPE_LABELS.MENSUALITE).toBe("Mensualité");
    expect(Object.keys(PAYMENT_TYPE_LABELS)).toEqual(["PI", "MENSUALITE"]);
  });

  it("retourne les libellés canoniques", () => {
    expect(getPaymentTypeLabel("PI")).toBe("Paiement initial");
    expect(getPaymentTypeLabel("MENSUALITE")).toBe("Mensualité");
    expect(getPaymentTypeShortLabel("PI")).toBe("Paiement initial");
    expect(getPaymentTypeShortLabel("MENSUALITE")).toBe("Mensualité");
  });

  it("reste sûr pour un type inconnu", () => {
    expect(getPaymentTypeLabel("foo")).toBe("Paiement");
    expect(getPaymentTypeLabel(null)).toBe("Paiement");
  });
});
