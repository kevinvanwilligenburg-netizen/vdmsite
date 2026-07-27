import type { Category, Product } from "@/lib/types";

/**
 * Zoeken over de catalogus.
 *
 * Mensen typen niet zoals producttitels geschreven zijn: ze zoeken op
 * "witte muurverf", "kwast buiten", "sikkens 2,5 liter" of typen "muurvef".
 * Daarom: synoniemen, tolerantie voor kleine tikfouten en een score die naam
 * boven omschrijving zet.
 */

/** Woorden die klanten gebruiken → wat er in het assortiment staat. */
const SYNONYMS: Record<string, string[]> = {
  muurverf: ["latex", "muur", "wandverf"],
  latex: ["muurverf"],
  wandverf: ["muurverf", "latex"],
  lak: ["lakverf", "aflak"],
  grondverf: ["primer", "grondlak"],
  primer: ["grondverf"],
  beits: ["houtbeits", "lazuur"],
  kwast: ["penseel", "blokkwast"],
  roller: ["verfroller", "vachtroller"],
  tape: ["afplaktape", "schilderstape"],
  schuurpapier: ["schuurblok", "schuurlinnen"],
  kit: ["kitten", "acrylaatkit", "siliconenkit"],
  plamuur: ["vulmiddel", "vulplamuur"],
  wit: ["ral 9010", "ral9010", "gebroken wit"],
  zwart: ["ral 9005", "ral9005"],
  antraciet: ["ral 7016", "ral7016"],
  buiten: ["exterior", "buitenverf"],
  binnen: ["interior", "binnenverf"],
  hout: ["houtverf", "houtlak"],
  metaal: ["metaallak", "ijzer"],
  vloer: ["vloerverf", "betonverf"],
  radiator: ["radiatorlak", "radiatorverf"],
};

/** Normaliseer: kleine letters, accenten weg, komma's in maten uniform. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein-afstand met een bovengrens: zodra het verschil te groot wordt,
 * stoppen we. Zo blijft zoeken snel over duizenden producten.
 */
function withinDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const huidige = [i];
    let besteInRij = i;
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
      const waarde = Math.min(huidige[j - 1] + 1, vorige[j] + 1, vorige[j - 1] + kosten);
      huidige.push(waarde);
      if (waarde < besteInRij) besteInRij = waarde;
    }
    if (besteInRij > max) return false;
    vorige = huidige;
  }
  return vorige[b.length] <= max;
}

/** Hoeveel tikfouten tolereren we? Korte woorden: geen, lange: één of twee. */
function toleranceFor(term: string): number {
  if (term.length <= 4) return 0;
  if (term.length <= 7) return 1;
  return 2;
}

interface Term {
  value: string;
  variants: string[];
  tolerance: number;
}

function buildTerms(query: string): Term[] {
  return normalize(query)
    .split(" ")
    .filter((term) => term.length > 1)
    .map((term) => ({
      value: term,
      variants: [term, ...(SYNONYMS[term] ?? []).map(normalize)],
      tolerance: toleranceFor(term),
    }));
}

interface Indexed {
  product: Product;
  name: string;
  haystack: string;
  words: string[];
}

function indexProduct(product: Product): Indexed {
  const name = normalize(product.name);
  const haystack = normalize(
    [
      product.name,
      product.brand,
      product.sku,
      product.shortDescription,
      Object.values(product.attributes ?? {}).join(" "),
      ...(product.tags ?? []),
    ].join(" "),
  );
  return { product, name, haystack, words: haystack.split(" ") };
}

/** Score voor één term; 0 betekent: dit product past niet. */
function scoreTerm(entry: Indexed, term: Term): number {
  for (const variant of term.variants) {
    if (entry.name.startsWith(variant)) return 10;
    if (entry.name.includes(variant)) return 7;
    if (entry.haystack.includes(variant)) return 3;
  }
  // Tikfout-tolerantie: alleen als niets exact matcht.
  if (term.tolerance > 0) {
    for (const word of entry.words) {
      if (withinDistance(word, term.value, term.tolerance)) return 2;
    }
  }
  return 0;
}

export interface SearchHit {
  product: Product;
  score: number;
}

/** Zoek en scoor; producten die niet op álle termen matchen vallen af. */
export function scoreProducts(products: Product[], query: string): SearchHit[] {
  const terms = buildTerms(query);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const product of products) {
    const entry = indexProduct(product);
    let total = 0;
    let alle = true;
    for (const term of terms) {
      const score = scoreTerm(entry, term);
      if (score === 0) {
        alle = false;
        break;
      }
      total += score;
    }
    if (!alle) continue;
    // Kleine voorkeur voor wat de klant direct kan kopen en zien.
    if (product.image) total += 1;
    if (product.inStock !== false) total += 1;
    if (product.compareAtPrice && product.compareAtPrice > product.price) total += 0.5;
    hits.push({ product, score: total });
  }

  return hits.sort((a, b) => b.score - a.score);
}

/**
 * Suggesties als er weinig of niets gevonden is: welke woorden uit het
 * assortiment lijken op wat er getypt is?
 */
export function suggestTerms(products: Product[], query: string, limit = 4): string[] {
  const term = normalize(query).split(" ")[0] ?? "";
  if (term.length < 4) return [];

  const counts = new Map<string, number>();
  for (const product of products) {
    for (const word of normalize(product.name).split(" ")) {
      if (word.length < 4) continue;
      if (word === term) continue;
      if (word.startsWith(term.slice(0, 4)) || withinDistance(word, term, 2)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/** Categorieën die passen bij de zoekterm, voor snelle navigatie. */
export function matchingCategories(
  categories: Category[],
  hits: SearchHit[],
  limit = 4,
): { category: Category; count: number }[] {
  const counts = new Map<string, number>();
  for (const hit of hits) {
    counts.set(hit.product.category, (counts.get(hit.product.category) ?? 0) + 1);
  }
  return categories
    .filter((category) => counts.has(category.slug))
    .map((category) => ({ category, count: counts.get(category.slug) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
