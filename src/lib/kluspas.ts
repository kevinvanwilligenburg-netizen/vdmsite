/**
 * Kluspas — de klantenkaart van De Voordeelmarkt (5% korting).
 *
 * De kortingsprijs staat per artikel in de productfeed (`kluspas_prijs`), dus
 * we rekenen niets zelf uit: we tonen wat de bron zegt. Bij het afrekenen kan
 * de klant zijn pasnummer invullen; dat gaat mee in de order zodat de winkel
 * (en het dashboard) het kan koppelen aan de klantenkaart.
 *
 * Het pasnummer wordt hier niet gevalideerd tegen een ledenbestand — die
 * controle hoort bij de kassa. We accepteren dus alleen een plausibel formaat
 * en laten de winkel het laatste woord.
 */

export const KLUSPAS_DISCOUNT_LABEL = "5% Kluspas-korting";

const CARD_PATTERN = /^[0-9]{6,20}$/;

/** Normaliseer een ingevoerd pasnummer (spaties en streepjes eruit). */
export function normalizeKluspasNumber(input: string): string {
  return (input ?? "").replace(/[\s-]/g, "").trim();
}

/** Ziet dit eruit als een geldig pasnummer? */
export function isPlausibleKluspasNumber(input: string): boolean {
  return CARD_PATTERN.test(normalizeKluspasNumber(input));
}

/** Prijs per stuk met Kluspas; valt terug op de gewone prijs. */
export function kluspasUnitPrice(price: number, kluspasPrice?: number): number {
  return kluspasPrice && kluspasPrice > 0 && kluspasPrice < price ? kluspasPrice : price;
}

/** Hoeveel scheelt de Kluspas op dit artikel (in centen)? */
export function kluspasSaving(price: number, kluspasPrice?: number): number {
  return Math.max(0, price - kluspasUnitPrice(price, kluspasPrice));
}
