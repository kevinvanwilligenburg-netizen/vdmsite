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

/** Verzendkosten voor een bestelling, in centen. */
export function shippingCost(subtotalCents: number, land: ShippingCountry = "NL"): number {
  const tarief = TARIEVEN[land];
  return subtotalCents >= tarief.gratisVanaf ? 0 : tarief.kosten;
}

/** Wat de klant nog moet besteden voor gratis bezorging; 0 als hij er al is. */
export function tekortVoorGratis(subtotalCents: number, land: ShippingCountry = "NL"): number {
  return Math.max(0, TARIEVEN[land].gratisVanaf - subtotalCents);
}

export function gratisVanaf(land: ShippingCountry = "NL"): number {
  return TARIEVEN[land].gratisVanaf;
}

export function verzendtarief(land: ShippingCountry = "NL"): number {
  return TARIEVEN[land].kosten;
}
