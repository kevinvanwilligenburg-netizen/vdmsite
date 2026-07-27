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
    description: "Voor diepe en donkere tinten — meer pigment nodig.",
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
 * Kies de variant die past bij de gewenste inhoud en kleur. Bestaat de
 * ideale basis niet in die maat, dan pakken we de dichtstbijzijnde die er wel
 * is (een donkere kleur kan altijd in een donkerdere basis, nooit in een te
 * lichte).
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

  const wanted = baseForColor(color.hex);
  const order: PaintBaseId[] =
    wanted === "licht"
      ? ["licht", "midden", "donker"]
      : wanted === "midden"
        ? ["midden", "donker", "licht"]
        : ["donker", "midden", "licht"];

  for (const base of order) {
    const match = candidates.find((variant) => variant.base === base);
    if (match) return match;
  }
  return candidates[0];
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
