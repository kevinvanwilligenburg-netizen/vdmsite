import { demoCategories, demoProducts, demoStockFor } from "@/lib/catalog";
import { feedCategories, loadFeedProducts } from "@/lib/product-feed";
import { scoreProducts, suggestTerms } from "@/lib/search";
import { DASHBOARD_API_URL } from "@/lib/site";
import { demoStores } from "@/lib/stores";
import type { Category, Product, Store } from "@/lib/types";

/**
 * Datalaag van de site. Architectuur (afgestemd met het VDM-dashboard):
 *
 * - CATALOGUS: de echte productfeed van het dashboard (lib/product-feed.ts).
 *   Is die niet bereikbaar, dan draait de site door op de demo-catalogus.
 * - VOORRAAD: via de voorraad-hub van het dashboard, die op de échte Tilroy
 *   Stock API draait, zodat beide shops uit dezelfde voorraad putten.
 * - BESTELLINGEN: naar KV (lib/orders.ts); het dashboard leest ze daar en
 *   verzorgt de fulfilment (kassa, DHL-label, track & trace).
 *
 * We roepen Tilroy dus nooit rechtstreeks aan.
 */

/* ── Catalogus ─────────────────────────────────────────────────── */

export async function getProducts(): Promise<Product[]> {
  const products = await loadFeedProducts();
  return products.length > 0 ? products : demoProducts;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.id === id);
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.category === categorySlug);
}

export async function getCategories(): Promise<Category[]> {
  const products = await loadFeedProducts();
  if (products.length === 0) return demoCategories;
  // Toon alleen categorieën waar ook echt artikelen in zitten.
  const used = new Set(products.map((product) => product.category));
  return feedCategories.filter((category) => used.has(category.slug));
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug);
}

/** Aanbiedingen voor de homepage: hoogste voordeel eerst. */
export async function getDeals(limit = 8): Promise<Product[]> {
  const products = await getProducts();
  return products
    .filter(
      (product) =>
        product.compareAtPrice &&
        product.compareAtPrice > product.price &&
        product.image &&
        product.inStock !== false,
    )
    .sort(
      (a, b) =>
        (b.compareAtPrice! - b.price) / b.compareAtPrice! -
        (a.compareAtPrice! - a.price) / a.compareAtPrice!,
    )
    .slice(0, limit);
}

/**
 * "Maak je klus af": welk gereedschap hoort bij dit product?
 *
 * Bij verf hangt het benodigde gereedschap af van het soort verf: muurverf
 * vraagt om een muurroller en afplaktape, lak om een lakkwast, schuurpapier
 * en grondverf, beits om een beitskwast. De regels kijken naar de categorie,
 * de glansgraad en de omschrijving uit de feed.
 */
interface CompanionRule {
  /** Waar in het assortiment moet gezocht worden. */
  needles: string[];
  /** Waarom dit erbij hoort (voor de klant). */
  reason: string;
}

function companionRulesFor(product: Product): CompanionRule[] {
  const haystack = [product.name, product.category, ...(product.tags ?? [])]
    .join(" ")
    .toLowerCase();
  const specs = (product.specs ?? []).map((spec) => spec.value.toLowerCase()).join(" ");
  const glans = specs;

  const isMuurverf = /muurverf|latex|muur|plafond|wand/.test(haystack);
  const isLak = /lak|hoogglans|zijdeglans/.test(haystack) || /hoogglans|zijdeglans/.test(glans);
  const isBeits = /beits|olie|vernis|hout/.test(haystack);
  const isSpuitbus = /spuitbus|spuitlak|spray/.test(haystack);
  const isVerf = product.colorMixable || isMuurverf || isLak || isBeits || isSpuitbus;

  if (!isVerf) return [];

  const rules: CompanionRule[] = [];
  if (isMuurverf) {
    rules.push(
      { needles: ["muurverfroller", "muurroller", "roller"], reason: "Rollen zonder spatten" },
      { needles: ["verfbak", "verfrooster"], reason: "Handig bij het rollen" },
      { needles: ["afplaktape", "afplak", "tape"], reason: "Voor strakke randen" },
      { needles: ["afdekzeil", "afdekfolie"], reason: "Vloer en meubels beschermd" },
    );
  }
  if (isLak) {
    rules.push(
      { needles: ["lakkwast", "kwast"], reason: "Voor een gladde laklaag" },
      { needles: ["lakroller", "roller"], reason: "Grote vlakken snel klaar" },
      { needles: ["schuurpapier", "schuurblok"], reason: "Eerst schuren, dan lakken" },
      { needles: ["grondverf", "primer"], reason: "Betere hechting en dekking" },
    );
  }
  if (isBeits) {
    rules.push(
      { needles: ["beitskwast", "blokkwast", "kwast"], reason: "Beits gelijkmatig aanbrengen" },
      { needles: ["schuurpapier"], reason: "Hout voorbereiden" },
    );
  }
  if (isSpuitbus) {
    rules.push(
      { needles: ["afplak", "afdekfolie", "afdekzeil"], reason: "Voorkomt overspray" },
      { needles: ["ontvetter", "schuurpapier"], reason: "Schone ondergrond, beter resultaat" },
    );
  }
  if (product.colorMixable) {
    rules.push({ needles: ["roerspaan", "verfstok", "verfbak"], reason: "Even goed doorroeren" });
  }
  return rules;
}

export interface CompanionProduct {
  product: Product;
  reason: string;
}

/** Passende accessoires bij dit product, met uitleg waarom. */
export async function getCompanions(
  product: Product,
  limit = 4,
): Promise<CompanionProduct[]> {
  const rules = companionRulesFor(product);
  if (rules.length === 0) return [];

  const products = await getProducts();
  const usable = products.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.image &&
      candidate.inStock !== false &&
      !candidate.colorMixable,
  );

  const picks: CompanionProduct[] = [];
  for (const rule of rules) {
    if (picks.length >= limit) break;
    const match = usable
      .filter((candidate) => {
        if (picks.some((pick) => pick.product.id === candidate.id)) return false;
        const name = candidate.name.toLowerCase();
        return rule.needles.some((needle) => name.includes(needle));
      })
      // Goedkoopste eerst: laagdrempelig om mee te bestellen.
      .sort((a, b) => a.price - b.price)[0];
    if (match) picks.push({ product: match, reason: rule.reason });
  }
  return picks.slice(0, limit);
}

/** Vergelijkbare producten: zelfde categorie, bij voorkeur zelfde merk. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const products = await getProducts();
  const sameCategory = products.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.category === product.category &&
      candidate.image &&
      candidate.inStock !== false,
  );
  const sameBrand = sameCategory.filter((candidate) => candidate.brand === product.brand);
  const picks = [...sameBrand, ...sameCategory];
  const unique: Product[] = [];
  for (const candidate of picks) {
    if (unique.length >= limit) break;
    if (!unique.some((entry) => entry.id === candidate.id)) unique.push(candidate);
  }
  return unique;
}

/**
 * Bijverkoop in de winkelwagen: goedkope, veelgekochte losse artikelen
 * (geen mengverf — die vraagt om een kleurkeuze).
 */
export async function getUpsellProducts(limit = 6): Promise<Product[]> {
  const products = await getProducts();
  return products
    .filter(
      (product) =>
        !product.colorMixable &&
        product.image &&
        product.inStock !== false &&
        !product.variants &&
        product.price >= 150 &&
        product.price <= 1500 &&
        product.compareAtPrice &&
        product.compareAtPrice > product.price,
    )
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);
}

/* ── Merken (eigen landingspagina's, goed vindbaar in zoekmachines) ─ */

function brandSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface BrandSummary {
  slug: string;
  name: string;
  count: number;
  fromPrice: number;
}

export interface BrandPage extends BrandSummary {
  products: Product[];
}

/** Merken met de meeste artikelen eerst. */
export async function getBrands(limit = 40): Promise<BrandSummary[]> {
  const products = await getProducts();
  const byBrand = new Map<string, { name: string; items: Product[] }>();
  for (const product of products) {
    if (!product.brand || product.brand === "De Voordeelmarkt") continue;
    const slug = brandSlug(product.brand);
    if (!slug) continue;
    const entry = byBrand.get(slug);
    if (entry) entry.items.push(product);
    else byBrand.set(slug, { name: product.brand, items: [product] });
  }
  return [...byBrand.entries()]
    .map(([slug, entry]) => ({
      slug,
      name: entry.name,
      count: entry.items.length,
      fromPrice: Math.min(...entry.items.map((item) => item.price)),
    }))
    .filter((brand) => brand.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getBrand(slug: string): Promise<BrandPage | null> {
  const products = await getProducts();
  const items = products.filter((product) => brandSlug(product.brand) === slug);
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => {
    const aScore = (a.image ? 2 : 0) + (a.inStock !== false ? 1 : 0);
    const bScore = (b.image ? 2 : 0) + (b.inStock !== false ? 1 : 0);
    return bScore - aScore || a.price - b.price;
  });
  return {
    slug,
    name: items[0].brand,
    count: items.length,
    fromPrice: Math.min(...items.map((item) => item.price)),
    products: sorted,
  };
}

/* ── Zoeken (server-side; de catalogus telt duizenden artikelen) ─ */

export interface SearchResult {
  products: Product[];
  total: number;
  facets: { slug: string; name: string; count: number }[];
  /** Alternatieve zoektermen als er niets gevonden is. */
  suggestions: string[];
  /** Alle treffers (ongepagineerd), voor filters op de zoekpagina. */
  all: Product[];
}

/**
 * Zoeken over de catalogus. De scoring, synoniemen en tikfout-tolerantie
 * zitten in lib/search.ts; hier komen de resultaten samen met de categorieën
 * en de suggesties.
 */
export async function searchProducts(
  query: string,
  options: { categorySlug?: string; limit?: number } = {},
): Promise<SearchResult> {
  const products = await getProducts();
  const hits = scoreProducts(products, query);

  if (hits.length === 0) {
    return {
      products: [],
      total: 0,
      facets: [],
      suggestions: suggestTerms(products, query),
      all: [],
    };
  }

  const categories = await getCategories();
  const counts = new Map<string, number>();
  for (const hit of hits) {
    counts.set(hit.product.category, (counts.get(hit.product.category) ?? 0) + 1);
  }
  const facets = categories
    .filter((category) => counts.has(category.slug))
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      count: counts.get(category.slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const gevonden = hits.map((hit) => hit.product);
  const filtered = options.categorySlug
    ? gevonden.filter((product) => product.category === options.categorySlug)
    : gevonden;

  return {
    products: filtered.slice(0, options.limit ?? 48),
    total: filtered.length,
    facets,
    suggestions: [],
    all: filtered,
  };
}

/* ── Winkels ───────────────────────────────────────────────────── */

export async function getStores(): Promise<Store[]> {
  return demoStores;
}

export async function getStore(idOrSlug: string): Promise<Store | undefined> {
  return demoStores.find((store) => store.id === idOrSlug || store.slug === idOrSlug);
}

/* ── Voorraad via de dashboard-hub ─────────────────────────────── */

/**
 * Vestigings-id's in Tilroy zoals de hub ze aanlevert.
 *
 * Nijverdal (7827) houdt de webshopvoorraad: wat daar ligt, gaat met DHL de
 * deur uit en valt onder de strakke cutoff (vóór 10:00 = vandaag bezorgd).
 * Ligt een artikel alleen in een andere winkel, dan verstuurt die winkel het
 * met PostNL binnen één werkdag. De testvestiging telt nooit mee; het
 * magazijn-id (8934) is administratief en wordt niet als winkel getoond.
 */
const NIJVERDAL_SHOP_ID = "7827";
const WAREHOUSE_SHOP_ID = "8934";
const TEST_SHOP_ID = "8602";

interface HubStockItem {
  sku: string;
  description?: string;
  qty: number;
  shops: Record<string, number>;
}

interface HubStockResponse {
  configured: boolean;
  asOf?: string;
  items: HubStockItem[];
  missing: string[];
}

/**
 * Vraag voorraad per SKU op bij de hub (max 200 sku's per call).
 * `null` bij storing of zolang de hub nog niet geconfigureerd is.
 *
 * De hub doet bij een koude cache een volledige crawl (~40 s) en is daarna
 * 5 minuten snel. Daarom een ruime timeout: deze functie draait alleen in
 * onze eigen /api/voorraad-route, die de pagina niet blokkeert.
 */
async function fetchHubStock(skus: string[]): Promise<HubStockResponse | null> {
  if (skus.length === 0) return null;
  try {
    const url = `${DASHBOARD_API_URL}/api/voorraad/skus?skus=${encodeURIComponent(
      skus.slice(0, 200).join(","),
    )}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(55000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HubStockResponse;
    if (!data || data.configured !== true || !Array.isArray(data.items)) return null;
    return data;
  } catch (error) {
    console.error("[voorraad] hub niet bereikbaar:", error);
    return null;
  }
}

export interface StoreStock {
  /** Winkel-id (slug), zodat de client de naam zelf kan tonen. */
  storeId: string;
  city: string;
  qty: number;
}

export interface ProductStock {
  /** Voorraad per winkel (voor afhalen). */
  stores: StoreStock[];
  /**
   * Voorraad die met DHL onder de 10:00-cutoff verstuurd kan worden: dat is
   * Nijverdal (webshopvoorraad) plus het administratieve magazijn.
   * `null` als de voorraad onbekend is.
   */
  webshopQty: number | null;
  /** Voorraad in de overige winkels; die versturen met PostNL. */
  otherStoresQty: number | null;
  /** Komen deze cijfers live uit de voorraad-hub? */
  live: boolean;
  /** Tijdstip van de voorraadstand volgens de hub. */
  asOf?: string;
}

/** Voorraad voor een set sku's (alle varianten van één product). */
export async function getStockForSkus(skus: string[]): Promise<ProductStock> {
  const stores = await getStores();
  const hub = await fetchHubStock([...new Set(skus)]);

  if (!hub) {
    return { stores: [], webshopQty: null, otherStoresQty: null, live: false };
  }

  const sumForShop = (shopId: string) =>
    hub.items.reduce((total, item) => {
      const qty = item.shops?.[shopId];
      return Number.isFinite(qty) ? total + (qty as number) : total;
    }, 0);

  const storeRows = stores.map((store) => ({
    storeId: store.slug,
    city: store.city,
    // De testvestiging telt nooit mee.
    qty:
      store.tilroyShopId && store.tilroyShopId !== TEST_SHOP_ID
        ? sumForShop(store.tilroyShopId)
        : 0,
  }));

  const webshopQty = sumForShop(NIJVERDAL_SHOP_ID) + sumForShop(WAREHOUSE_SHOP_ID);
  const otherStoresQty = storeRows
    .filter((row) => row.storeId !== "nijverdal")
    .reduce((total, row) => total + row.qty, 0);

  return {
    stores: storeRows,
    webshopQty,
    otherStoresQty,
    live: true,
    asOf: hub.asOf,
  };
}

/** Alle sku's van een product (hoofdartikel + varianten). */
export function skusFor(product: Product): string[] {
  return [...new Set([product.sku, ...(product.variants ?? []).map((v) => v.sku)])];
}
