import type { PaintBaseId, PaintColor, Product, ProductVariant } from "@/lib/types";

/**
 * Mengbasis-logica.
 *
 * Een gemengde kleur wordt aangemaakt in een tinting-basis: hoe donkerder de
 * kleur, hoe meer pigment en hoe transparanter de basis. In het assortiment
 * zijn dat aparte artikelen met een eigen prijs en eigen voorraad (bv. Drenth
 * Grondlak 1 L lichte basis € 31,55 versus donkere basis € 33,70).
 *
 * De klant kiest een kleur en een inhoud; wij kiezen de juiste basis. Zo kan
 * er geen verkeerd blik besteld worden.
 */

export const PAINT_BASES: Record<PaintBaseId, { label: string; description: string }> = {
  licht: {
    label: "Lichte basis",
    description: "Voor witte, lichte en pasteltinten.",
  },
  midden: {
    label: "Middenbasis",
    description: "Voor heldere en middentinten.",
  },
  donker: {
    label: "Donkere basis",
    description: "Voor diepe en donkere tinten, meer pigment nodig.",
  },
};

/** Herken de basis uit de tekst in de feed ("Lichte basis", "Donkere basis", …). */
export function parseBase(value: string | undefined): PaintBaseId | undefined {
  if (!value) return undefined;
  const text = value.toLowerCase();
  if (text.includes("licht")) return "licht";
  if (text.includes("midden") || text.includes("medium")) return "midden";
  if (text.includes("donker") || text.includes("deep")) return "donker";
  return undefined;
}

/** Relatieve helderheid van een kleur (0 = zwart, 1 = wit). */
export function luminance(hex: string): number {
  const value = hex.replace("#", "");
  if (value.length < 6) return 1;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Welke basis hoort bij deze kleur? */
export function baseForColor(hex: string): PaintBaseId {
  const lum = luminance(hex);
  if (lum > 0.62) return "licht";
  if (lum > 0.34) return "midden";
  return "donker";
}

/**
 * Kies de variant die past bij de gewenste inhoud en kleur.
 *
 * Bestaat de ideale basis niet in die maat, dan pakken we een DONKERDERE die
 * er wel is. Nooit een lichtere: in een lichte basis zit te veel wit pigment
 * om er een diepe tint van te maken, en dan komt er grijs uit de machine in
 * plaats van zwart.
 *
 * ⚠️ Die regel stond hier al in het commentaar maar niet in de code. De
 * volgorde eindigde voor elke kleur op "licht", dus viel hij daar altijd op
 * terug. Melissa liep er tegenaan bij de Histor betonverf, die alleen in een
 * lichte basis bestaat: de site bood Gitzwart RAL 9005 gewoon aan en zette
 * eronder "wordt gemengd in de lichte basis". Dat kan de winkel niet maken.
 *
 * Kan het niet, dan geven we `undefined` terug. Dat is het eerlijke antwoord;
 * de koopknop hoort daarop te reageren en niet op een blik dat toevallig
 * bestaat.
 */
export function pickVariant(
  product: Product,
  size: string | undefined,
  color: PaintColor | null,
): ProductVariant | undefined {
  const variants = product.variants ?? [];
  if (variants.length === 0) return undefined;

  const inSize = size ? variants.filter((variant) => variant.size === size) : variants;
  const candidates = inSize.length > 0 ? inSize : variants;

  if (!color) return candidates[0];

  // Alleen deze basis of donkerder. Een lichte kleur mág in een donkere basis
  // (zonde van het pigment, maar het klopt); andersom nooit.
  const wanted = baseForColor(color.hex);
  const order: PaintBaseId[] =
    wanted === "licht"
      ? ["licht", "midden", "donker"]
      : wanted === "midden"
        ? ["midden", "donker"]
        : ["donker"];

  for (const base of order) {
    const match = candidates.find((variant) => variant.base === base);
    if (match) return match;
  }

  /*
   * Geen enkele bruikbare basis. Heeft dit product helemaal geen basis-
   * varianten, dan is het geen mengverf en slaat de hele vraag niet op — dan
   * gewoon het blik teruggeven, zoals hiervoor.
   */
  return candidates.some((variant) => variant.base) ? undefined : candidates[0];
}

/**
 * Kan deze kleur in dit product gemengd worden?
 *
 * Zo niet, dan hoort de klant dat te lezen vóórdat hij bestelt — en hoort de
 * bestelling geweigerd te worden als hij het toch probeert.
 */
export function kleurKanInProduct(
  product: Product,
  size: string | undefined,
  color: PaintColor | null,
): boolean {
  if (!color) return true;
  return pickVariant(product, size, color) !== undefined;
}

/** Een maat als liters: "2,5 L" → 2.5, "375 ml" → 0.375. Null zonder eenheid. */
function naarLiter(tekst: string): number | null {
  const m = tekst.match(/(\d+(?:[.,]\d+)?)\s*(ml|milliliter|liter|ltr|l)\b/i);
  if (!m) return null;
  const getal = Number(m[1].replace(",", "."));
  if (!Number.isFinite(getal) || getal <= 0) return null;
  return /^m/i.test(m[2]) ? getal / 1000 : getal;
}

/**
 * De maat die in de productnaam staat, als die bij een van de maten hoort.
 *
 * ⚠️ Dit repareert een prijsverschil dat Google al aanmerkte. Maatvarianten
 * zijn samengevoegd tot één product, maar de naam komt van de groepsleider —
 * en die noemt vaak één maat: "Fitex Creative+ Trappenlak Mat Dekkend 2,5
 * liter". De pagina koos daarnaast gewoon `sizes[0]`, en dat is de kleinste.
 * Resultaat: een kop die 2,5 liter belooft boven de prijs van 375 ml
 * (€ 14,52 in plaats van € 92,45), terwijl de Shopping-feed voor diezelfde URL
 * het grote blik opgeeft. Voor Google is dat een prijsafwijking op de
 * landingspagina; voor de klant een verrassing in de winkelwagen.
 *
 * Vergelijken op liters en niet op tekst: de naam schrijft "2,5 liter" en de
 * maatknop "2,5 L". Staat er geen inhoud in de naam (schroeven, tape, kwasten
 * — daar gaat het over millimeters), dan vergelijken we op de tekst zelf met
 * een woordgrens; zonder die grens zou "1 L" ook in "11 L" passen.
 */
export function maatUitNaam(naam: string, maten: string[]): string | undefined {
  if (maten.length === 0) return undefined;

  const doel = naarLiter(naam);
  if (doel !== null) {
    const opLiter = maten.find((maat) => {
      const liter = naarLiter(maat);
      return liter !== null && Math.abs(liter - doel) < 0.0005;
    });
    if (opLiter) return opLiter;
  }

  const schoon = (tekst: string) => tekst.toLowerCase().replace(/\s+/g, " ").replace(",", ".").trim();
  const naamSchoon = schoon(naam);
  return maten.find((maat) => {
    const m = schoon(maat);
    if (m.length < 2) return false;
    // Woordgrenzen aan beide kanten, anders matcht "1 l" binnen "11 l".
    return new RegExp(`(^|[^0-9a-z.])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^0-9a-z]|$)`).test(
      naamSchoon,
    );
  });
}

/**
 * De prijs van de maat die de productnaam noemt; anders de gewone prijs.
 *
 * ⚠️ Voor metadata en JSON-LD, niet voor productkaarten. Op een kaart is
 * `product.price` de "vanaf"-prijs en dat klopt daar. Maar op de productpagina
 * zélf staat één maat geselecteerd — die uit de naam — en dan mag de titel,
 * de OG-tag en het Offer-blok niet de prijs van het kleinste blikje noemen.
 *
 * Dat verschil was precies wat Google aanmerkte: de Shopping-feed gaf € 92,45
 * voor de 2,5 liter, de pagina zei € 13,80 in de titel en € 14,52 in beeld.
 * Drie bedragen voor één URL.
 */
export function prijsVanNaamMaat(product: Product): {
  prijs: number;
  vanaf?: number;
  variant?: ProductVariant;
} {
  const maat = maatUitNaam(product.name, sizesOf(product));
  const variant = maat
    ? (product.variants ?? []).find((v) => (v.size ?? v.name) === maat)
    : undefined;
  if (!variant) return { prijs: product.price, ...(product.compareAtPrice ? { vanaf: product.compareAtPrice } : {}) };
  return {
    prijs: variant.price,
    ...(variant.compareAtPrice ? { vanaf: variant.compareAtPrice } : {}),
    variant,
  };
}

/** De beschikbare inhoudsmaten van een product, in de volgorde van de feed. */
export function sizesOf(product: Product): string[] {
  const sizes: string[] = [];
  for (const variant of product.variants ?? []) {
    const size = variant.size ?? variant.name;
    if (size && !sizes.includes(size)) sizes.push(size);
  }
  return sizes;
}

/** Heeft dit product echte basis-varianten (en dus automatische basiskeuze)? */
export function hasBases(product: Product): boolean {
  return (product.variants ?? []).some((variant) => Boolean(variant.base));
}

/**
 * Rendement in m² per liter, uit de specificaties ("Ca. 8 m² per liter").
 * `null` als het er niet staat — dan tonen we de rekenhulp niet.
 */
export function coveragePerLiter(product: Product): number | null {
  for (const spec of product.specs ?? []) {
    const match = spec.value.match(/([\d,.]+)\s*m²?\s*(?:per|\/)\s*(?:liter|l\b)/i);
    if (match) {
      const value = Number(match[1].replace(",", "."));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

/** Inhoudsmaten in liters, afgeleid uit de variantnamen ("2,5 L", "750 ml"). */
export function sizesInLiters(product: Product): number[] {
  const liters = new Set<number>();
  for (const variant of product.variants ?? []) {
    const label = variant.size ?? variant.name;
    const ml = label.match(/([\d,.]+)\s*ml\b/i);
    if (ml) {
      const value = Number(ml[1].replace(",", ".")) / 1000;
      if (Number.isFinite(value) && value > 0) liters.add(value);
      continue;
    }
    const l = label.match(/([\d,.]+)\s*l\b/i);
    if (l) {
      const value = Number(l[1].replace(",", "."));
      if (Number.isFinite(value) && value > 0) liters.add(value);
    }
  }
  return [...liters].sort((a, b) => a - b);
}
