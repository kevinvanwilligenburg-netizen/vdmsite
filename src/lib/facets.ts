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
  inhoud?: string[];
  prijsMax?: number;
  aanbieding?: boolean;
  mengverf?: boolean;
  opVoorraad?: boolean;
  sort?: SortKey;
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  subcategorie: "Soort",
  glans: "Glansgraad",
  verfsoort: "Verfsoort",
  inhoud: "Inhoud",
};

/** Waarden van een attribuut; `inhoud` bevat meerdere waarden per product. */
function valuesOf(product: Product, key: string): string[] {
  const raw = product.attributes?.[key];
  if (!raw) return [];
  return raw.split("|").map((value) => value.trim()).filter(Boolean);
}

/** Leest filters uit de query-string van een pagina. */
export function parseFilters(searchParams: Record<string, string | string[] | undefined>): ProductFilters {
  const list = (key: string): string[] | undefined => {
    const value = searchParams[key];
    if (!value) return undefined;
    const values = Array.isArray(value) ? value : value.split(",");
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

  for (const key of ["subcategorie", "glans", "verfsoort", "inhoud"] as const) {
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
  for (const key of ["subcategorie", "glans", "verfsoort", "inhoud"] as const) {
    const counts = new Map<string, number>();
    for (const product of withoutSelf(key)) {
      for (const value of valuesOf(product, key)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    const options = [...counts.entries()]
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

/** Aantal actieve filters, voor de "wis filters"-knop. */
export function activeFilterCount(filters: ProductFilters): number {
  return (
    (filters.merk?.length ?? 0) +
    (filters.subcategorie?.length ?? 0) +
    (filters.glans?.length ?? 0) +
    (filters.verfsoort?.length ?? 0) +
    (filters.inhoud?.length ?? 0) +
    (filters.prijsMax ? 1 : 0) +
    (filters.aanbieding ? 1 : 0) +
    (filters.mengverf ? 1 : 0) +
    (filters.opVoorraad ? 1 : 0)
  );
}
