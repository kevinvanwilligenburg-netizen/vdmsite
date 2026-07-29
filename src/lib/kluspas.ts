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

/**
 * Ondergrens voor een geloofwaardige paskorting: minstens deze fractie van de
 * verkoopprijs moet overblijven.
 *
 * ⚠️ Dit is een noodrem op de feed, geen commerciële keuze. Bij een telling
 * op 29 juli 2026 stonden 523 van de 6.132 feedregels op exact 50% korting —
 * Histor Dekkende Muurverf Voorstrijk van € 13,20 naar € 6,60, bij een
 * adviesprijs van € 34,50. Precies de helft, tot op de cent, over
 * verschillende merken en prijsklassen: dat patroon hoort bij een rekenfout,
 * niet bij een actie. De overige 5.578 regels staan netjes op 5%, tien
 * Parador-regels op 30%.
 *
 * Zolang die prijzen zo binnenkomen tonen én rekenen we ze niet: de klant
 * betaalt dan gewoon de normale prijs. Liever tijdelijk geen pasvoordeel dan
 * 523 artikelen met verlies verkopen. Klopt de 50% wél, of komt er een echte
 * actie met meer korting, zet deze grens dan lager — hij staat expres op één
 * plek.
 */
const MIN_KLUSPAS_FRACTIE = 0.9;

const CARD_PATTERN = /^[0-9]{6,20}$/;

/**
 * Is deze paskorting geloofwaardig genoeg om te tonen en te rekenen?
 *
 * Bedragen in dezelfde eenheid (bij ons: centen).
 */
export function isGeloofwaardigeKluspasPrijs(price: number, kluspasPrice?: number): boolean {
  if (!kluspasPrice || kluspasPrice <= 0 || price <= 0) return false;
  if (kluspasPrice >= price) return false;
  return kluspasPrice >= price * MIN_KLUSPAS_FRACTIE;
}

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
  return isGeloofwaardigeKluspasPrijs(price, kluspasPrice) ? kluspasPrice! : price;
}

/** Hoeveel scheelt de Kluspas op dit artikel (in centen)? */
export function kluspasSaving(price: number, kluspasPrice?: number): number {
  return Math.max(0, price - kluspasUnitPrice(price, kluspasPrice));
}
