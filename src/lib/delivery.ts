/**
 * Bezorgbelofte — puur, testbaar en client-veilig.
 *
 * De belofte hangt af van waar het artikel ligt:
 *
 *  - **Op voorraad in Nijverdal** (dat is het webshopmagazijn): standaard
 *    morgen bezorgd met DHL. Bestelt de klant vóór 09:00, dan kan hij
 *    daarnaast kiezen voor vandaag, tegen een toeslag.
 *  - **Alleen in een andere winkel**: die winkel verstuurt het pakket zelf met
 *    PostNL, bezorging binnen één werkdag. Zulke orders worden in Tilroy
 *    verwerkt door de winkel die het artikel heeft. Vandaag bezorgen kan dan
 *    niet.
 *  - **Nergens op voorraad**: geen bezorgbelofte.
 *
 * Vandaag bezorgen is dus een keuze die de klant maakt en betaalt, geen
 * automatische toekenning. Dat is niet alleen een prijskwestie: het dashboard
 * hangt aan `delivery.type === "same-day"` een DHL-label met spoedoptie. Staat
 * dat veld verkeerd, dan krijgt een klant die voor spoed betaalde een gewoon
 * label — of andersom.
 *
 * Alles rekent in lokale tijd (NL-publiek); `now` is injecteerbaar zodat de
 * logica deterministisch te testen is.
 */

export const SAME_DAY_CUTOFF_HOUR = 9;

/** Toeslag voor vandaag bezorgen, in centen. */
export const SAME_DAY_SURCHARGE_CENTS = 125;

/** Vestiging die de webshopvoorraad houdt. */
export const WEBSHOP_STORE_ID = "nijverdal";

export type DeliveryType = "same-day" | "next-day" | "next-workday" | "unavailable";
export type Carrier = "dhl" | "postnl";

export interface DeliveryPromise {
  type: DeliveryType;
  carrier?: Carrier;
  /** De (lokale) bezorgdatum, op middernacht genormaliseerd. */
  deliveryDate?: Date;
  /** Milliseconden tot de cutoff van 09:00; 0 zodra die voorbij is. */
  msUntilCutoff: number;
  /** Korte tekst voor de klant. */
  label: string;
  /**
   * Kan de klant hiervoor bijbetalen om het vandaag te krijgen? Alleen waar
   * vóór de cutoff én met voorraad in Nijverdal; ligt het artikel in een
   * andere winkel, dan gaat het met PostNL en kan vandaag niet.
   */
  sameDayAvailable: boolean;
  /** Wat die keuze kost, in centen. */
  sameDaySurcharge: number;
  /** De bezorgdatum als de klant vandaag kiest. */
  sameDayDate?: Date;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Eerstvolgende werkdag (PostNL bezorgt niet op zondag). */
function nextWorkday(from: Date): Date {
  let date = addDays(startOfDay(from), 1);
  while (date.getDay() === 0) date = addDays(date, 1);
  return date;
}

function msUntilCutoffFrom(now: Date): number {
  const cutoff = startOfDay(now);
  cutoff.setHours(SAME_DAY_CUTOFF_HOUR, 0, 0, 0);
  return Math.max(0, cutoff.getTime() - now.getTime());
}

export interface StockSnapshot {
  /** Aantal in Nijverdal (webshopvoorraad). */
  webshopQty: number;
  /** Aantal in de overige winkels samen. */
  otherStoresQty: number;
}

/**
 * Bepaal de bezorgbelofte voor één artikel (of voor een hele bestelling, door
 * de laagste voorraad van de regels mee te geven).
 */
export function deliveryPromise(
  stock: StockSnapshot,
  now: Date = new Date(),
): DeliveryPromise {
  const msUntilCutoff = msUntilCutoffFrom(now);
  const beforeCutoff = now.getHours() < SAME_DAY_CUTOFF_HOUR;

  if (stock.webshopQty > 0) {
    // Morgen is de standaard en die is gratis. Vandaag is een keuze die de
    // klant in de checkout maakt en betaalt — daarom staat hier nooit
    // "same-day" als type: dat veld stuurt het DHL-spoedlabel aan.
    return {
      type: "next-day",
      carrier: "dhl",
      deliveryDate: addDays(startOfDay(now), 1),
      msUntilCutoff,
      label: "Morgen bezorgd",
      sameDayAvailable: beforeCutoff,
      sameDaySurcharge: SAME_DAY_SURCHARGE_CENTS,
      ...(beforeCutoff ? { sameDayDate: startOfDay(now) } : {}),
    };
  }

  if (stock.otherStoresQty > 0) {
    return {
      type: "next-workday",
      carrier: "postnl",
      deliveryDate: nextWorkday(now),
      msUntilCutoff,
      label: "Binnen 1 werkdag bezorgd",
      sameDayAvailable: false,
      sameDaySurcharge: SAME_DAY_SURCHARGE_CENTS,
    };
  }

  return {
    type: "unavailable",
    msUntilCutoff,
    label: "Tijdelijk niet leverbaar",
    sameDayAvailable: false,
    sameDaySurcharge: SAME_DAY_SURCHARGE_CENTS,
  };
}

/** Combineer de beloftes van meerdere artikelen: de traagste bepaalt de order. */
export function combinePromises(promises: DeliveryPromise[]): DeliveryPromise {
  if (promises.length === 0) {
    return {
      type: "unavailable",
      msUntilCutoff: 0,
      label: "Tijdelijk niet leverbaar",
      sameDayAvailable: false,
      sameDaySurcharge: SAME_DAY_SURCHARGE_CENTS,
    };
  }
  const rank: Record<DeliveryType, number> = {
    "same-day": 0,
    "next-day": 1,
    "next-workday": 2,
    unavailable: 3,
  };
  const traagste = promises.reduce((slowest, current) =>
    rank[current.type] > rank[slowest.type] ? current : slowest,
  );
  // Vandaag bezorgen kan alleen als élke regel het aankan: ligt één artikel
  // in een andere winkel, dan wacht de hele order op dat pakket.
  return {
    ...traagste,
    sameDayAvailable: promises.every((promise) => promise.sameDayAvailable),
  };
}

/** Korte uitleg onder de belofte. */
export function deliveryExplanation(promise: DeliveryPromise): string {
  switch (promise.type) {
    case "same-day":
      return "Op voorraad in ons webshopmagazijn — DHL bezorgt het vandaag nog.";
    case "next-day":
      return promise.sameDayAvailable
        ? `Op voorraad in ons webshopmagazijn. DHL bezorgt morgen, of vandaag nog als je daar bij het afrekenen voor kiest (bestel dan vóór ${SAME_DAY_CUTOFF_HOUR}:00).`
        : `Op voorraad in ons webshopmagazijn — na ${SAME_DAY_CUTOFF_HOUR}:00 besteld, dus DHL bezorgt morgen.`;
    case "next-workday":
      return "Dit artikel ligt in een van onze winkels; die verstuurt het met PostNL, binnen één werkdag bij je thuis.";
    default:
      return "Dit artikel is nu nergens op voorraad. Neem gerust contact op met de klantenservice.";
  }
}
