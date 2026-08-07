import type { Category, Product } from "@/lib/types";
import type { Zoekregel } from "@/lib/zoekregels";

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

/**
 * Score voor één term; 0 betekent: dit product past niet.
 *
 * Een SYNONIEM weegt minder dan het woord zelf. Zonder dat verschil scoorde
 * "Latex Werkhandschoenen" op de zoekterm "muurverf" net zo hoog als
 * "Muurverf roller": `muurverf → latex` staat in de synoniemenlijst, de
 * handschoen begint met "latex", en dat gaf tien punten. Zoeken op muurverf
 * en een werkhandschoen bovenaan krijgen is precies waarom mensen denken dat
 * een zoekfunctie niet werkt.
 *
 * De term zelf houdt zijn volle gewicht; alles daarna telt voor iets meer dan
 * de helft. Genoeg om gevonden te worden, te weinig om te winnen van een
 * echte treffer.
 */
const SYNONIEM_GEWICHT = 0.55;

function scoreTerm(entry: Indexed, term: Term): number {
  for (const [index, variant] of term.variants.entries()) {
    const gewicht = index === 0 ? 1 : SYNONIEM_GEWICHT;
    if (entry.name.startsWith(variant)) return 10 * gewicht;
    if (entry.name.includes(variant)) return 7 * gewicht;
    if (entry.haystack.includes(variant)) return 3 * gewicht;
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

/**
 * Zoek en scoor; producten die niet op álle termen matchen vallen af.
 *
 * `regel` is de curatie die Kevin in het dashboard instelt voor deze zoekterm
 * (zie lib/zoekregels.ts). Ontbreekt hij, dan gedraagt het zoeken zich
 * precies zoals daarvoor — curatie is een correctie, geen voorwaarde.
 */
export function scoreProducts(
  products: Product[],
  query: string,
  regel?: Zoekregel,
): SearchHit[] {
  let terms = buildTerms(query);
  if (terms.length === 0) return [];

  if (regel) {
    const uit = new Set(regel.nietSynoniemen ?? []);
    terms = terms.map((term) => ({
      ...term,
      variants: [
        // De term zelf blijft altijd staan, ook als iemand hem per ongeluk
        // uitsluit — anders zoek je op een woord dat nergens meer op matcht.
        term.value,
        ...[...term.variants.slice(1), ...(regel.synoniemen ?? [])]
          .filter((variant) => variant !== term.value && !uit.has(variant))
          // Ontdubbelen: de vaste lijst en Kevins lijst overlappen soms.
          .filter((variant, index, alle) => alle.indexOf(variant) === index),
      ],
    }));
  }

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
    /*
     * Zit het product in de rubriek waar je op zoekt? Dan telt dat zwaar.
     *
     * Zonder dit won "Muurverf roller" van elke echte muurverf: die roller
     * begínt met het woord en scoort dus tien, terwijl "Alabastine 2 in 1
     * Muurverf Vlekken Mat" het woord middenin heeft en op zeven blijft
     * steken. Wie "muurverf" typt wil verf, geen roller — en dat verschil
     * staat in de rubriek, niet in de titel.
     */
    if (
      terms.some((term) =>
        term.variants.some(
          (variant) =>
            variant.length > 2 &&
            normalize(product.attributes?.subcategorie ?? "").includes(variant),
        ),
      )
    ) {
      total += 6;
    }

    // Kleine voorkeur voor wat de klant direct kan kopen en zien.
    if (product.image) total += 1;
    if (product.inStock !== false) total += 1;
    if (product.compareAtPrice && product.compareAtPrice > product.price) total += 0.5;

    if (regel) {
      const merk = (product.brand ?? "").trim().toLowerCase();
      if ((regel.merkVoorkeur ?? []).some((m) => m.trim().toLowerCase() === merk)) total += 8;
      if (
        regel.rubriek &&
        normalize(product.attributes?.subcategorie ?? "").includes(normalize(regel.rubriek))
      ) {
        total += 8;
      }
    }

    hits.push({ product, score: total });
  }

  hits.sort((a, b) => b.score - a.score);

  /*
   * Vastgepinde artikelen bovenaan, in de volgorde die Kevin koos.
   *
   * Bewust ná het sorteren en niet met een enorme score: een score die alles
   * overtreft is een getal dat je later niet meer begrijpt, en bij twee
   * gepinde artikelen zou de onderlinge volgorde alsnog van het toeval
   * afhangen.
   *
   * Een gepinde sku die niet in de resultaten zit, halen we er niet bij. Wie
   * "muurverf" typt hoort geen kwast te krijgen omdat iemand die ooit heeft
   * vastgepind — pinnen bepaalt de volgorde, niet wat er gevonden wordt.
   */
  const pinnen = regel?.vastgepind ?? [];
  if (pinnen.length === 0) return hits;

  const positie = (hit: SearchHit) => {
    const skus = [hit.product.sku, ...(hit.product.variants ?? []).map((v) => v.sku)];
    const index = pinnen.findIndex((pin) => skus.includes(pin));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return hits.sort((a, b) => positie(a) - positie(b));
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
