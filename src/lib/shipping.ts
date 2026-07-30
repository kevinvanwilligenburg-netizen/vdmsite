/**
 * Verzendkosten.
 *
 * Eén plek voor de tarieven, zodat de productpagina, de winkelwagen, de
 * checkout en de order nooit uit elkaar lopen. Bedragen in centen.
 */

export type ShippingCountry = "NL" | "BE";

interface Tarief {
  land: ShippingCountry;
  naam: string;
  /** Vanaf dit orderbedrag is bezorgen gratis. */
  gratisVanaf: number;
  /** Kosten daaronder. */
  kosten: number;
}

const TARIEVEN: Record<ShippingCountry, Tarief> = {
  NL: { land: "NL", naam: "Nederland", gratisVanaf: 5900, kosten: 495 },
  BE: { land: "BE", naam: "België", gratisVanaf: 5900, kosten: 795 },
};

export const SHIPPING_COUNTRIES = Object.values(TARIEVEN);

export function shippingCountry(value: string | undefined): ShippingCountry {
  return value?.toUpperCase() === "BE" ? "BE" : "NL";
}

/**
 * Merken die we altijd gratis bezorgen, ongeacht het orderbedrag.
 *
 * Afspraak met de leverancier: Sikkens gaat franco de deur uit. Dat geldt
 * alleen voor de bezorging zelf — kiest de klant voor bezorging vandaag, dan
 * betaalt hij die toeslag gewoon; dat is onze koerier, niet de verzending.
 */
const ALTIJD_FRANCO = new Set(["sikkens"]);

/** Zit er een merk in het mandje dat altijd gratis bezorgd wordt? */
export function franco(merken: (string | undefined)[]): boolean {
  return merken.some((merk) => merk && ALTIJD_FRANCO.has(merk.trim().toLowerCase()));
}

/** Verzendkosten voor een bestelling, in centen. */
export function shippingCost(
  subtotalCents: number,
  land: ShippingCountry = "NL",
  gratisOngeachtBedrag = false,
): number {
  if (gratisOngeachtBedrag) return 0;
  const tarief = TARIEVEN[land];
  return subtotalCents >= tarief.gratisVanaf ? 0 : tarief.kosten;
}

/** Wat de klant nog moet besteden voor gratis bezorging; 0 als hij er al is. */
export function tekortVoorGratis(
  subtotalCents: number,
  land: ShippingCountry = "NL",
  gratisOngeachtBedrag = false,
): number {
  if (gratisOngeachtBedrag) return 0;
  return Math.max(0, TARIEVEN[land].gratisVanaf - subtotalCents);
}

export function gratisVanaf(land: ShippingCountry = "NL"): number {
  return TARIEVEN[land].gratisVanaf;
}

export function verzendtarief(land: ShippingCountry = "NL"): number {
  return TARIEVEN[land].kosten;
}

/*
 * Dezelfde bedragen als tekst, voor in de teksten op de site.
 *
 * De drempel stond op dertien plekken uitgeschreven: in de USP-balk, de
 * voetnoot, de productpagina, de algemene voorwaarden, llms.txt en de
 * bezorgpagina. De berekening zat wél op één plek, dus er ging niets stuk —
 * maar bij de volgende tariefwijziging klopt de site twaalf keer niet meer,
 * en dat merk je pas als een klant erover belt. De Klus=r-site had dit in het
 * echt: de winkelwagen toonde € 50 terwijl de checkout op € 59 zat.
 */
function bedrag(centen: number): string {
  return `€ ${(centen / 100).toFixed(2).replace(".", ",").replace(",00", "")}`;
}

/** "€ 59" — de grens voor gratis bezorgen. */
export const GRATIS_VANAF_TEKST = bedrag(TARIEVEN.NL.gratisVanaf);

/** "€ 4,95" of "€ 7,95" — wat bezorgen kost onder die grens. */
export function tariefTekst(land: ShippingCountry = "NL"): string {
  return bedrag(TARIEVEN[land].kosten);
}
