import type { CartColor, OrderItem } from "@/lib/types";

/**
 * Kleurtesters (kleurstalen): een potje van 30 ml, gemengd in elke kleur die
 * we voeren — óók de 18.000 merkkleuren waar fabrikanten geen kant-en-klare
 * tester van maken.
 *
 * Prijsafspraak (Kevin, 1 aug 2026): de tester kost hetzelfde als bij
 * verfwinkel.nl (daar € 2,99 voor 30 ml, gemeten 1 aug 2026), en verzendkosten
 * komen er gewoon bovenop — testers tellen mee in het gewone verzendtarief.
 * Het gekochte bedrag krijgt de klant terug als voucher zodra hij de echte
 * verf koopt (zie lib/vouchers.ts).
 *
 * ⚠️ De tester is een VIRTUEEL artikel: hij staat (nog) niet in Tilroy en dus
 * niet in de productfeed. De checkout herkent hem aan STAAL_PRODUCT_ID en
 * bouwt de orderregel uit déze constanten — prijs dus altijd server-side.
 * Zodra Kevin het artikel in Tilroy aanmaakt, moet de sku hieronder gelijk
 * zijn aan die in Tilroy, anders kan de kassa de regel niet boeken.
 */

export const STAAL_PRODUCT_ID = "kleurtester";
/**
 * Het Tilroy-artikel voor een kleurtester.
 *
 * ⚠️ Zonder streepje. Hier stond "KLEURTESTER-30ML", maar Kevin heeft het
 * artikel op 6 augustus 2026 aangemaakt als **KLEURTESTER30ML**. Eén teken
 * verschil en de kassa kent de orderregel niet — dan strandt elke
 * testerbestelling, en dat merk je pas bij het inboeken.
 */
export const STAAL_SKU = "KLEURTESTER30ML";
export const STAAL_NAAM = "Kleurtester 30 ml";

/** In centen. Gelijk aan de testerprijs van verfwinkel.nl (€ 2,99). */
export const STAAL_PRIJS = 299;
export const STAAL_PRIJS_TEKST = "€ 2,99";

/** Meer testers dan dit is geen kleurtwijfel meer; de winkel mengt ze met de hand. */
export const MAX_STALEN_PER_ORDER = 10;

/** Is deze regel (winkelwagen of checkout-invoer) een kleurtester? */
export function isStaalRegel(entry: { productId?: string }): boolean {
  return entry.productId === STAAL_PRODUCT_ID;
}

/** Is deze orderregel een kleurtester? (Order-items dragen dezelfde id.) */
export function isStaalOrderItem(item: { productId?: string }): boolean {
  return item.productId === STAAL_PRODUCT_ID;
}

/** Totaalbedrag (euro's) aan testers in een set orderregels — de voucherwaarde. */
export function staalBedrag(items: { productId?: string; price: number; quantity: number }[]): number {
  return items
    .filter((item) => isStaalOrderItem(item))
    .reduce((som, item) => som + item.price * item.quantity, 0);
}

/** Bouw de orderregel voor een tester; prijs en naam komen uit deze module. */
export function staalOrderItem(color: CartColor, qty: number): OrderItem {
  return {
    key: `${STAAL_PRODUCT_ID}::${color.key ?? color.code}`,
    productId: STAAL_PRODUCT_ID,
    sku: STAAL_SKU,
    title: STAAL_NAAM,
    brand: "De Voordeelmarkt",
    image: "",
    variantLabel: [color.code, color.name].filter(Boolean).join(" "),
    quantity: qty,
    price: STAAL_PRIJS / 100,
    color,
    icon: "palette",
    hue: 25,
  };
}
