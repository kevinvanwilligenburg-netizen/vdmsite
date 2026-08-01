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

import { bezorgdagMogelijk } from "@/lib/feestdagen";

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

/** Eerstvolgende werkdag (PostNL bezorgt niet op zondag en niet op feestdagen). */
function nextWorkday(from: Date): Date {
  let date = addDays(startOfDay(from), 1);
  while (date.getDay() === 0 || !bezorgdagMogelijk(date)) date = addDays(date, 1);
  return date;
}

/**
 * DHL hanteert dezelfde kalender: morgen, tenzij dat een zondag of feestdag
 * is. Rond Pasen schuift "morgen" zo twee dagen op — op paaszaterdag is de
 * eerstvolgende bezorgdag dinsdag, en dat moet het label ook zeggen.
 */
const eerstvolgendeBezorgdag = nextWorkday;

function msUntilCutoffFrom(now: Date): number {
  const cutoff = startOfDay(now);
  cutoff.setHours(SAME_DAY_CUTOFF_HOUR, 0, 0, 0);
  return Math.max(0, cutoff.getTime() - now.getTime());
}

/**
 * De bezorgbelofte als tekst, afhankelijk van dag en tijd.
 *
 * Eén bron voor elke plek die iets belooft (homepage, menubalk, winkelwagen):
 * vóór 09:00 op een werkdag mag "vandaag verzonden" er staan, daarna is het
 * morgen, en in het weekend rijdt de spoeddienst niet — dan is zaterdag
 * "maandag in huis". Een statische tekst die om 14:00 nog "vandaag" roept,
 * maakt een belofte die we al vijf uur niet meer waarmaken.
 */
export function bezorgBelofte(now: Date = new Date()): {
  vandaagKan: boolean;
  badge: string;
  usp: string;
} {
  // "Vandaag verzonden" alleen op een gewone werkdag: op een feestdag rijdt
  // DHL niet, ook al is het magazijn (verkort) open.
  const werkdag = now.getDay() >= 1 && now.getDay() <= 5 && bezorgdagMogelijk(now);
  if (werkdag && now.getHours() < SAME_DAY_CUTOFF_HOUR) {
    return {
      vandaagKan: true,
      badge: "Vóór 09:00 besteld, vandaag verzonden",
      usp: "Vóór 09:00 besteld? Vandaag bezorgd mogelijk",
    };
  }
  // DHL bezorgt niet op zondag en niet op feestdagen: op zaterdag is de
  // eerstvolgende bezorgdag maandag, op paaszaterdag pas dinsdag.
  const bezorgdag = eerstvolgendeBezorgdag(now);
  const morgen = addDays(startOfDay(now), 1);
  const wanneer =
    bezorgdag.getTime() === morgen.getTime() ? "morgen" : DAGNAMEN[bezorgdag.getDay()];
  return {
    vandaagKan: false,
    badge: `Voor 23:59 besteld, ${wanneer} in huis`,
    usp: `Vandaag besteld, ${wanneer} in huis`,
  };
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
  land: "NL" | "BE" = "NL",
): DeliveryPromise {
  const msUntilCutoff = msUntilCutoffFrom(now);
  // Same-day alleen op gewone werkdagen vóór de cutoff: in het weekend en op
  // feestdagen rijdt de spoeddienst niet, en een klant die € 1,25 betaalt
  // voor "vandaag" krijgt anders gewoon later zijn pakket.
  const werkdag = now.getDay() >= 1 && now.getDay() <= 5 && bezorgdagMogelijk(now);
  const beforeCutoff = werkdag && now.getHours() < SAME_DAY_CUTOFF_HOUR;

  // België: DHL doet er een dag langer over en het spoednetwerk (same-day)
  // stopt bij de grens. Belofte is 1–2 werkdagen, zonder betaalde spoedoptie —
  // een belofte die we niet waar kunnen maken is erger dan een ruime.
  if (land === "BE") {
    if (stock.webshopQty > 0 || stock.otherStoresQty > 0) {
      return {
        type: "next-workday",
        carrier: stock.webshopQty > 0 ? "dhl" : "postnl",
        deliveryDate: nextWorkday(nextWorkday(now)),
        msUntilCutoff,
        label: "Binnen 1–2 werkdagen bezorgd",
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

  if (stock.webshopQty > 0) {
    // Morgen is de standaard en die is gratis. Vandaag is een keuze die de
    // klant in de checkout maakt en betaalt — daarom staat hier nooit
    // "same-day" als type: dat veld stuurt het DHL-spoedlabel aan.
    //
    // "Morgen" kan een zondag óf feestdag zijn, en dan bezorgt DHL niet:
    // dan verschuift de bezorgdag en moet het label die dag bij naam noemen
    // (op paaszaterdag: "Dinsdag bezorgd").
    const bezorgdag = eerstvolgendeBezorgdag(now);
    const isMorgen = bezorgdag.getTime() === addDays(startOfDay(now), 1).getTime();
    const dagnaam = DAGNAMEN[bezorgdag.getDay()];
    return {
      type: "next-day",
      carrier: "dhl",
      deliveryDate: bezorgdag,
      msUntilCutoff,
      label: isMorgen
        ? "Morgen bezorgd"
        : `${dagnaam.charAt(0).toUpperCase() + dagnaam.slice(1)} bezorgd`,
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
const DAGNAMEN = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
] as const;

/** "morgen" als dat de bezorgdag is, anders de dag bij naam ("maandag"). */
function bezorgdagWoord(promise: DeliveryPromise, now: Date): string {
  const dag = promise.deliveryDate;
  if (!dag) return "morgen";
  const morgen = addDays(startOfDay(now), 1);
  return dag.getTime() === morgen.getTime() ? "morgen" : DAGNAMEN[dag.getDay()];
}

export function deliveryExplanation(
  promise: DeliveryPromise,
  now: Date = new Date(),
): string {
  switch (promise.type) {
    case "same-day":
      return "Op voorraad in ons webshopmagazijn — DHL bezorgt het vandaag nog.";
    case "next-day": {
      // De uitleg moet dezelfde dag noemen als het label erboven. Die stond
      // hier hard op "morgen", zodat op zaterdag "Maandag bezorgd" boven
      // "DHL bezorgt morgen" kwam te staan — en morgen is dan zondag, als er
      // niemand rijdt.
      const dag = bezorgdagWoord(promise, now);
      if (promise.sameDayAvailable) {
        return `Op voorraad in ons webshopmagazijn. DHL bezorgt ${dag}, of vandaag nog als je daar bij het afrekenen voor kiest (bestel dan vóór ${SAME_DAY_CUTOFF_HOUR}:00).`;
      }
      // Waaróm vandaag niet meer kan verschilt: doordeweeks is de cutoff
      // voorbij, in het weekend en op feestdagen rijdt de spoeddienst
      // simpelweg niet.
      const weekend = now.getDay() === 0 || now.getDay() === 6;
      if (weekend) {
        return `Op voorraad in ons webshopmagazijn — in het weekend rijdt DHL niet, dus je hebt het ${dag} in huis.`;
      }
      if (!bezorgdagMogelijk(now)) {
        return `Op voorraad in ons webshopmagazijn — op feestdagen rijdt DHL niet, dus je hebt het ${dag} in huis.`;
      }
      return `Op voorraad in ons webshopmagazijn — na ${SAME_DAY_CUTOFF_HOUR}:00 besteld, dus DHL bezorgt ${dag}.`;
    }
    case "next-workday":
      return "Dit artikel ligt in een van onze winkels; die verstuurt het met PostNL, binnen één werkdag bij je thuis.";
    default:
      return "Dit artikel is nu nergens op voorraad. Neem gerust contact op met de klantenservice.";
  }
}
