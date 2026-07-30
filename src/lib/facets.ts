import type { Product } from "@/lib/types";

/**
 * Filters en sortering voor productlijsten.
 *
 * Een categorie kan meer dan duizend artikelen bevatten; zonder filters is dat
 * onwerkbaar. De facetten worden afgeleid uit de producten die je op dat
 * moment ziet, zodat er nooit een filter verschijnt dat niets oplevert. Alles
 * loopt via de URL, dus een gefilterde lijst is deelbaar en indexeerbaar.
 */

export type SortKey = "relevantie" | "prijs-op" | "prijs-af" | "korting" | "naam";

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  options: FacetOption[];
}

export interface ProductFilters {
  merk?: string[];
  /** Soort binnen de categorie ("Lakken", "Muurverf"); voedt ook het menu. */
  subcategorie?: string[];
  glans?: string[];
  verfsoort?: string[];
  toepassing?: string[];
  ondergrond?: string[];
  kwaliteit?: string[];
  kleur?: string[];
  inhoud?: string[];
  prijsMax?: number;
  aanbieding?: boolean;
  mengverf?: boolean;
  opVoorraad?: boolean;
  sort?: SortKey;
}

/**
 * Welke eigenschappen worden een filter, en hoe heten ze voor de klant?
 *
 * De volgorde is de volgorde in de kolom. `kleur` staat er sinds een telling
 * op de feed: dat veld is in élke categorie voor 76 tot 99% gevuld en was het
 * enige bruikbare filter bij kit, lijm, elektra en bevestiging — categorieën
 * die daarvóór met één filter of helemaal zonder in beeld stonden.
 */
const FACET_KEYS = [
  "subcategorie",
  "kleur",
  "glans",
  "verfsoort",
  "toepassing",
  "ondergrond",
  "kwaliteit",
  "inhoud",
] as const;

type FacetKey = (typeof FACET_KEYS)[number];

const ATTRIBUTE_LABELS: Record<FacetKey, string> = {
  subcategorie: "Soort",
  kleur: "Kleur",
  glans: "Glansgraad",
  verfsoort: "Verfsoort",
  toepassing: "Toepassing",
  ondergrond: "Ondergrond",
  kwaliteit: "Kwaliteit",
  inhoud: "Inhoud",
};

/**
 * Boven dit aandeel van de resultaten zegt een filteroptie niets meer.
 * Twee derde van de catalogus staat op kleur "Transparant"; daarop filteren
 * levert bijna dezelfde lijst op.
 */
const MAX_AANDEEL = 0.7;

/**
 * Waarden die wel in de feed staan maar geen filter zijn.
 *
 * Het veld `kleur` telt 147 verschillende waarden. Daarvan is "NoColour" een
 * placeholder, en tientallen zijn kale kleurcodes zonder naam ("6213", "701",
 * "H138") die alleen de leverancier iets zeggen. Als keuze in de kolom zijn
 * die onbruikbaar; een klant zoekt op "wit", niet op "6763".
 */
const PLACEHOUDERS = new Set(["nocolour", "no colour", "n.v.t.", "nvt", "onbekend", "-", "div.", "diversen"]);
const ALLEEN_EEN_CODE = /^[a-z]{0,2}\s?\d{2,5}[a-z]?$/i;

function bruikbareWaarde(key: string, waarde: string): boolean {
  const schoon = waarde.trim().toLowerCase();
  if (schoon.length < 2) return false;
  if (PLACEHOUDERS.has(schoon)) return false;
  // Codes weren we alleen bij kleur; bij inhoud is "750" juist een maat.
  if (key === "kleur" && ALLEEN_EEN_CODE.test(schoon)) return false;
  return true;
}

/** Waarden van een attribuut; `inhoud` bevat meerdere waarden per product. */
function valuesOf(product: Product, key: string): string[] {
  const raw = product.attributes?.[key];
  if (!raw) return [];
  return raw.split("|").map((value) => value.trim()).filter(Boolean);
}

/** Leest filters uit de query-string van een pagina. */
export function parseFilters(searchParams: Record<string, string | string[] | undefined>): ProductFilters {
  /**
   * Meerdere waarden staan als herhaalde parameters in de URL
   * (`?merk=Histor&merk=Flexa`), niet komma-gescheiden.
   *
   * Dat is geen stijlkeuze: filterwaarden bevatten zelf komma's. "Beits,
   * olie en vernis" en "Lijmen, kitten en vulmiddelen" werden bij het
   * splitsen in stukken geknipt die nergens op matchten — die twee
   * menu-items leidden naar een lege pagina terwijl er 169 en 236 artikelen
   * achter zaten.
   */
  const list = (key: string): string[] | undefined => {
    const value = searchParams[key];
    if (!value) return undefined;
    const values = Array.isArray(value) ? value : [value];
    const cleaned = values.map((entry) => entry.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  };

  const prijsMax = Number(searchParams.prijs);
  const sort = searchParams.sorteer as SortKey | undefined;

  return {
    merk: list("merk"),
    subcategorie: list("subcategorie"),
    glans: list("glans"),
    verfsoort: list("verfsoort"),
    toepassing: list("toepassing"),
    ondergrond: list("ondergrond"),
    kwaliteit: list("kwaliteit"),
    kleur: list("kleur"),
    inhoud: list("inhoud"),
    prijsMax: Number.isFinite(prijsMax) && prijsMax > 0 ? prijsMax : undefined,
    aanbieding: searchParams.aanbieding === "1",
    mengverf: searchParams.mengverf === "1",
    opVoorraad: searchParams.voorraad === "1",
    sort: sort && ["relevantie", "prijs-op", "prijs-af", "korting", "naam"].includes(sort)
      ? sort
      : undefined,
  };
}

function matches(product: Product, filters: ProductFilters): boolean {
  if (filters.merk && !filters.merk.includes(product.brand)) return false;
  if (filters.aanbieding && !(product.compareAtPrice && product.compareAtPrice > product.price)) {
    return false;
  }
  if (filters.mengverf && !product.colorMixable) return false;
  if (filters.opVoorraad && product.inStock === false) return false;
  if (filters.prijsMax && product.price > filters.prijsMax * 100) return false;

  for (const key of FACET_KEYS) {
    const wanted = filters[key];
    if (!wanted || wanted.length === 0) continue;
    const has = valuesOf(product, key);
    if (!wanted.some((value) => has.includes(value))) return false;
  }
  return true;
}

/** Pas de filters toe en sorteer. */
export function applyFilters(products: Product[], filters: ProductFilters): Product[] {
  const filtered = products.filter((product) => matches(product, filters));

  switch (filters.sort) {
    case "prijs-op":
      return [...filtered].sort((a, b) => a.price - b.price);
    case "prijs-af":
      return [...filtered].sort((a, b) => b.price - a.price);
    case "naam":
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "nl"));
    case "korting":
      return [...filtered].sort((a, b) => {
        const kortingA = a.compareAtPrice ? 1 - a.price / a.compareAtPrice : 0;
        const kortingB = b.compareAtPrice ? 1 - b.price / b.compareAtPrice : 0;
        return kortingB - kortingA;
      });
    default:
      // Standaard: leverbaar en met foto eerst, dan de scherpste aanbiedingen.
      return [...filtered].sort((a, b) => {
        const scoreA = (a.image ? 2 : 0) + (a.inStock !== false ? 2 : 0) + (a.compareAtPrice ? 1 : 0);
        const scoreB = (b.image ? 2 : 0) + (b.inStock !== false ? 2 : 0) + (b.compareAtPrice ? 1 : 0);
        return scoreB - scoreA || a.price - b.price;
      });
  }
}

/**
 * Bouw de facetten. Tellingen zijn gebaseerd op de producten die overblijven
 * ná de overige filters, zodat de aantallen kloppen met wat je krijgt als je
 * erop klikt.
 */
export function buildFacets(products: Product[], filters: ProductFilters): Facet[] {
  const facets: Facet[] = [];

  const withoutSelf = (key: keyof ProductFilters) => {
    const rest = { ...filters, [key]: undefined };
    return products.filter((product) => matches(product, rest));
  };

  // Merken
  const merkCounts = new Map<string, number>();
  for (const product of withoutSelf("merk")) {
    if (!product.brand || product.brand === "De Voordeelmarkt") continue;
    merkCounts.set(product.brand, (merkCounts.get(product.brand) ?? 0) + 1);
  }
  const merken = [...merkCounts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .filter((option) => option.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  if (merken.length > 1) facets.push({ key: "merk", label: "Merk", options: merken });

  // Attributen
  for (const key of FACET_KEYS) {
    const basis = withoutSelf(key);
    const counts = new Map<string, number>();
    for (const product of basis) {
      for (const value of valuesOf(product, key)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    const options = [...counts.entries()]
      .filter(([value]) => bruikbareWaarde(key, value))
      // Een optie die bijna álles omvat filtert niets weg. "Transparant"
      // staat bij Tilroy op twee derde van de catalogus; als keuze in de
      // kolom belooft die een verfijning die er niet is.
      .filter(([, count]) => count < basis.length * MAX_AANDEEL)
      .map(([value, count]) => ({ value, label: value, count }))
      .filter((option) => option.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, key === "inhoud" ? 12 : 8);
    if (options.length > 1) {
      facets.push({ key, label: ATTRIBUTE_LABELS[key] ?? key, options });
    }
  }

  return facets;
}

/**
 * Alle sleutels die een filter in de URL zetten. De "wis alles"-knop liep
 * hier eerder achteraan: die had een eigen lijstje, en filters die later
 * bijkwamen bleven na het wissen gewoon aanstaan.
 */
export const FILTER_KEYS: string[] = [
  "merk",
  ...FACET_KEYS,
  "prijs",
  "aanbieding",
  "mengverf",
  "voorraad",
];

/**
 * De opvallendste filterwaarden over alle groepen heen, als één rijtje
 * bovenaan de kolom — zoals Gamma dat doet met "Populaire filters".
 *
 * Waarom: de meeste klanten weten wél wát ze zoeken ("Histor", "2,5 L",
 * "mat"), maar niet onder wélke kop dat filter staat. Acht dichtgeklapte
 * groepen doorlopen kost meer moeite dan één lijstje met de grote namen.
 *
 * We nemen per groep de sterkste optie en sorteren op aantal, zodat er
 * variatie in staat en niet acht merken achter elkaar.
 */
export function popularFacets(facets: Facet[], max = 8): (FacetOption & { key: string; groep: string })[] {
  const perGroep = facets
    .map((facet) =>
      facet.options
        .slice(0, 3)
        .map((option) => ({ ...option, key: facet.key, groep: facet.label })),
    )
    .filter((opties) => opties.length > 0);

  // Om beurten uit elke groep pakken; anders vult het merkfilter de hele lijst.
  const uit: (FacetOption & { key: string; groep: string })[] = [];
  for (let ronde = 0; ronde < 3 && uit.length < max; ronde++) {
    for (const opties of perGroep) {
      if (uit.length >= max) break;
      const optie = opties[ronde];
      if (optie) uit.push(optie);
    }
  }
  return uit;
}

/** Aantal actieve filters, voor de "wis filters"-knop. */
export function activeFilterCount(filters: ProductFilters): number {
  return (
    (filters.merk?.length ?? 0) +
    (filters.subcategorie?.length ?? 0) +
    (filters.glans?.length ?? 0) +
    (filters.verfsoort?.length ?? 0) +
    (filters.toepassing?.length ?? 0) +
    (filters.ondergrond?.length ?? 0) +
    (filters.kwaliteit?.length ?? 0) +
    (filters.kleur?.length ?? 0) +
    (filters.inhoud?.length ?? 0) +
    (filters.prijsMax ? 1 : 0) +
    (filters.aanbieding ? 1 : 0) +
    (filters.mengverf ? 1 : 0) +
    (filters.opVoorraad ? 1 : 0)
  );
}
