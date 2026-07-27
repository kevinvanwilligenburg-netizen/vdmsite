/**
 * Bezorgbelofte — puur, testbaar en client-veilig.
 *
 * De belofte hangt af van waar het artikel ligt:
 *
 *  - **Op voorraad in Nijverdal** (dat is het webshopmagazijn): dan geldt de
 *    strakke belofte. Besteld vóór 10:00 → vandaag bezorgd met DHL; daarna →
 *    morgen.
 *  - **Alleen in een andere winkel**: die winkel verstuurt het pakket zelf met
 *    PostNL, bezorging binnen één werkdag. Zulke orders worden in Tilroy
 *    verwerkt door de winkel die het artikel heeft.
 *  - **Nergens op voorraad**: geen bezorgbelofte.
 *
 * Alles rekent in lokale tijd (NL-publiek); `now` is injecteerbaar zodat de
 * logica deterministisch te testen is.
 */

export const SAME_DAY_CUTOFF_HOUR = 10;

/** Vestiging die de webshopvoorraad houdt. */
export const WEBSHOP_STORE_ID = "nijverdal";

export type DeliveryType = "same-day" | "next-day" | "next-workday" | "unavailable";
export type Carrier = "dhl" | "postnl";

export interface DeliveryPromise {
  type: DeliveryType;
  carrier?: Carrier;
  /** De (lokale) bezorgdatum, op middernacht genormaliseerd. */
  deliveryDate?: Date;
  /** Milliseconden tot de cutoff van 10:00; 0 zodra die voorbij is. */
  msUntilCutoff: number;
  /** Korte tekst voor de klant. */
  label: string;
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
    return beforeCutoff
      ? {
          type: "same-day",
          carrier: "dhl",
          deliveryDate: startOfDay(now),
          msUntilCutoff,
          label: "Vandaag bezorgd",
        }
      : {
          type: "next-day",
          carrier: "dhl",
          deliveryDate: addDays(startOfDay(now), 1),
          msUntilCutoff: 0,
          label: "Morgen bezorgd",
        };
  }

  if (stock.otherStoresQty > 0) {
    return {
      type: "next-workday",
      carrier: "postnl",
      deliveryDate: nextWorkday(now),
      msUntilCutoff,
      label: "Binnen 1 werkdag bezorgd",
    };
  }

  return {
    type: "unavailable",
    msUntilCutoff,
    label: "Tijdelijk niet leverbaar",
  };
}

/** Combineer de beloftes van meerdere artikelen: de traagste bepaalt de order. */
export function combinePromises(promises: DeliveryPromise[]): DeliveryPromise {
  if (promises.length === 0) {
    return { type: "unavailable", msUntilCutoff: 0, label: "Tijdelijk niet leverbaar" };
  }
  const rank: Record<DeliveryType, number> = {
    "same-day": 0,
    "next-day": 1,
    "next-workday": 2,
    unavailable: 3,
  };
  return promises.reduce((slowest, current) =>
    rank[current.type] > rank[slowest.type] ? current : slowest,
  );
}

/** Korte uitleg onder de belofte. */
export function deliveryExplanation(promise: DeliveryPromise): string {
  switch (promise.type) {
    case "same-day":
      return `Op voorraad in ons webshopmagazijn — bestel vóór ${SAME_DAY_CUTOFF_HOUR}:00 en DHL bezorgt vandaag nog.`;
    case "next-day":
      return "Op voorraad in ons webshopmagazijn — na 10:00 besteld, dus DHL bezorgt morgen.";
    case "next-workday":
      return "Dit artikel ligt in een van onze winkels; die verstuurt het met PostNL, binnen één werkdag bij je thuis.";
    default:
      return "Dit artikel is nu nergens op voorraad. Neem gerust contact op met de klantenservice.";
  }
}
