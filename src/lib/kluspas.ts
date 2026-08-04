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

/**
 * Wat we over de korting zeggen als we geen bedrag kunnen noemen.
 *
 * Bewust geen "5%": dat klopt voor de meeste artikelen, maar niet voor de
 * ruim 500 waar 30% of 50% op zit. Waar we het bedrag wél weten (winkelwagen,
 * checkout) noemen we dat in euro's, want dat is altijd waar.
 */
export const KLUSPAS_DISCOUNT_LABEL = "Ledenkorting";

/**
 * Ondergrens voor een geloofwaardige paskorting: minstens deze fractie van de
 * verkoopprijs moet overblijven.
 *
 * ⚠️ Dit is een noodrem tegen een invoerfout, geen commerciële grens.
 *
 * Op 29 juli 2026 stond deze waarde op 0,9, omdat 504 van de 6.132 feedregels
 * op exact 30% of 50% korting stonden en dat patroon op een rekenfout leek.
 * Kevin heeft op 30 juli bevestigd dat die kortingen kloppen — het zijn echte
 * acties. De grens staat nu zo laag dat alleen een echte blunder wordt
 * tegengehouden: een verschoven komma (€ 170,42 die als € 17,04 binnenkomt)
 * of een pasprijs van nul.
 *
 * Zet hem niet weer omhoog "voor de zekerheid": dan verdwijnt bij 504
 * artikelen het pasvoordeel van het scherm zonder dat iemand een foutmelding
 * ziet.
 */
const MIN_KLUSPAS_FRACTIE = 0.25;

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

/**
 * Profpas: 10% korting voor zakelijke klanten.
 *
 * Regel van Kevin (4 augustus 2026): de Profpas geeft 10% van de gewone prijs.
 * Anders dan bij de Kluspas staat die prijs NIET in de feed — Tilroy levert
 * maar één kortingsprijs per artikel, en dat is de Kluspas-prijs. Daarom
 * rekenen we hem hier uit.
 *
 * ⚠️ Dat betekent dat deze 10% een afspraak is en geen bron. Rekent de kassa
 * iets anders af, dan ziet de klant online een andere prijs dan in de winkel.
 * Komt er ooit een `profpas_prijs` in de feed, gebruik die dan en gooi deze
 * som weg.
 *
 * De laagste van de twee wint. Op ruim 500 artikelen staat een actie van 30%
 * of 50% in de Kluspas-prijs; 10% van de gewone prijs zou daar duurder zijn.
 * Een pashouder die méér betaalt dan een gewone klant is het enige echt
 * onvergeeflijke uitgangspunt hier.
 */
export const PROFPAS_KORTING = 0.1;

export function profpasUnitPrice(price: number, kluspasPrice?: number): number {
  const viaProfpas = Math.round(price * (1 - PROFPAS_KORTING));
  const viaKluspas = kluspasUnitPrice(price, kluspasPrice);
  return Math.min(viaProfpas, viaKluspas);
}
