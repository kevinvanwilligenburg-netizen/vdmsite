/**
 * Betaalmethoden zoals de klant ze kiest, vóór het doorsturen naar Mollie.
 *
 * Waarom hier en niet pas bij Mollie: koos de klant niets, dan kwam er ná de
 * knop "Bestellen en betalen" eerst nóg een keuzescherm van Mollie. Dat is een
 * extra stap op het moment dat de klant al besloten heeft — precies waar
 * mensen afhaken. Geven we `method` mee, dan landt de klant meteen bij zijn
 * eigen bank, Klarna of Apple Pay.
 *
 * De id's zijn die van de Mollie API; de logo's zijn Mollie's eigen iconen
 * (32×24), lokaal opgeslagen in /public zodat de checkout niets van buiten
 * hoeft te laden.
 */

export interface Betaalmethode {
  /** Mollie-id, gaat mee als `method` bij het aanmaken van de betaling. */
  id: string;
  label: string;
  /** Eén regel die de twijfel wegneemt, geen marketingtekst. */
  uitleg: string;
  logo: string;
  /** Landen waar we deze methode tonen; leeg = overal. */
  landen?: ("NL" | "BE")[];
  /** Alleen tonen zodra er een bedrijfsnaam is ingevuld (betalen op rekening). */
  zakelijk?: boolean;
}

export const BETAALMETHODEN: Betaalmethode[] = [
  {
    id: "ideal",
    label: "iDEAL",
    uitleg: "Betaal direct met je eigen bank",
    logo: "/betaalmethoden/ideal.svg",
    landen: ["NL"],
  },
  {
    id: "bancontact",
    label: "Bancontact",
    uitleg: "Betaal direct met je Belgische bankkaart",
    logo: "/betaalmethoden/bancontact.svg",
    landen: ["BE"],
  },
  {
    id: "kbc",
    label: "KBC/CBC",
    uitleg: "Betaal via de KBC- of CBC-app",
    logo: "/betaalmethoden/kbc.svg",
    landen: ["BE"],
  },
  {
    id: "belfius",
    label: "Belfius",
    uitleg: "Betaal via Belfius Direct Net",
    logo: "/betaalmethoden/belfius.svg",
    landen: ["BE"],
  },
  {
    id: "klarna",
    label: "Klarna",
    uitleg: "Achteraf betalen — je hebt 14 dagen de tijd",
    logo: "/betaalmethoden/klarna.svg",
  },
  {
    id: "creditcard",
    label: "Creditcard",
    uitleg: "Visa, Mastercard of American Express",
    logo: "/betaalmethoden/creditcard.svg",
  },
  {
    id: "applepay",
    label: "Apple Pay",
    uitleg: "Met Touch ID of Face ID, in één keer klaar",
    logo: "/betaalmethoden/applepay.svg",
  },
  {
    id: "googlepay",
    label: "Google Pay",
    uitleg: "Betaal met de kaarten in je Google-account",
    logo: "/betaalmethoden/googlepay.svg",
  },
  {
    id: "paypal",
    label: "PayPal",
    uitleg: "Betaal met je PayPal-saldo of gekoppelde rekening",
    logo: "/betaalmethoden/paypal.svg",
  },
  {
    id: "billie",
    label: "Op rekening (Billie)",
    uitleg: "Voor bedrijven: achteraf betalen op factuur, 30 dagen",
    logo: "/betaalmethoden/billie.svg",
    zakelijk: true,
  },
];

/** Welke methoden tonen we in dit land, in deze volgorde? */
export function betaalmethodenVoor(land: "NL" | "BE"): Betaalmethode[] {
  return BETAALMETHODEN.filter(
    (methode) => !methode.landen || methode.landen.includes(land),
  );
}

/** Accepteren we deze id? De checkout mag geen willekeurige waarde doorgeven. */
export function isBetaalmethode(waarde: unknown): waarde is string {
  return (
    typeof waarde === "string" && BETAALMETHODEN.some((methode) => methode.id === waarde)
  );
}
