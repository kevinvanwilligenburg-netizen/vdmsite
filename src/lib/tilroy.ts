import { demoCategories, demoProducts, demoStockFor } from "@/lib/catalog";
import { feedCategories, loadFeedProducts } from "@/lib/product-feed";
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

/** Bijverkoop: eerst uit dezelfde categorie, met foto en op voorraad. */
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

/* ── Zoeken (server-side; de catalogus telt duizenden artikelen) ─ */

export interface SearchResult {
  products: Product[];
  total: number;
  facets: { slug: string; name: string; count: number }[];
}

function scoreProduct(product: Product, terms: string[]): number {
  const name = product.name.toLowerCase();
  const haystack = [
    product.name,
    product.brand,
    product.sku,
    product.shortDescription,
    ...(product.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (!haystack.includes(term)) return 0;
    if (name.startsWith(term)) score += 6;
    else if (name.includes(term)) score += 4;
    else score += 1;
  }
  if (product.image) score += 1;
  if (product.inStock !== false) score += 1;
  if (product.compareAtPrice && product.compareAtPrice > product.price) score += 0.5;
  return score;
}

export async function searchProducts(
  query: string,
  options: { categorySlug?: string; limit?: number } = {},
): Promise<SearchResult> {
  const products = await getProducts();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { products: [], total: 0, facets: [] };

  const scored = products
    .map((product) => ({ product, score: scoreProduct(product, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);

  const categories = await getCategories();
  const counts = new Map<string, number>();
  for (const product of scored) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  const facets = categories
    .filter((category) => counts.has(category.slug))
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      count: counts.get(category.slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const filtered = options.categorySlug
    ? scored.filter((product) => product.category === options.categorySlug)
    : scored;

  return {
    products: filtered.slice(0, options.limit ?? 48),
    total: filtered.length,
    facets,
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
 * Vestigings-id's in Tilroy zoals de hub ze aanlevert. Naast de vijf winkels
 * bestaan er twee bijzondere "shops": het webshopmagazijn (waar bezorgingen
 * uit gaan) en een testvestiging die we altijd negeren.
 */
const WEBSHOP_SHOP_ID = "8934";
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
 */
async function fetchHubStock(skus: string[]): Promise<HubStockResponse | null> {
  if (skus.length === 0) return null;
  try {
    const url = `${DASHBOARD_API_URL}/api/voorraad/skus?skus=${encodeURIComponent(
      skus.slice(0, 200).join(","),
    )}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HubStockResponse;
    if (!data || data.configured !== true || !Array.isArray(data.items)) return null;
    return data;
  } catch (error) {
    console.error("[voorraad] hub niet bereikbaar, indicatie uit de feed:", error);
    return null;
  }
}

export interface StoreStock {
  store: Store;
  qty: number;
}

export interface ProductStock {
  /** Voorraad per winkel (voor afhalen). */
  stores: StoreStock[];
  /** Voorraad in het webshopmagazijn (voor bezorgen); null als onbekend. */
  webshopQty: number | null;
  /** Komen deze cijfers live uit de voorraad-hub, of is het een indicatie? */
  live: boolean;
}

export async function getStockByStore(product: Product): Promise<ProductStock> {
  const stores = await getStores();
  const skus = [product.sku, ...(product.variants ?? []).map((variant) => variant.sku)];
  const hub = await fetchHubStock([...new Set(skus)]);

  if (hub) {
    const sumForShop = (shopId: string) =>
      hub.items.reduce((total, item) => {
        const qty = item.shops?.[shopId];
        return Number.isFinite(qty) ? total + (qty as number) : total;
      }, 0);

    return {
      stores: stores.map((store) => ({
        store,
        // De testvestiging telt nooit mee.
        qty:
          store.tilroyShopId && store.tilroyShopId !== TEST_SHOP_ID
            ? sumForShop(store.tilroyShopId)
            : 0,
      })),
      webshopQty: sumForShop(WEBSHOP_SHOP_ID),
      live: true,
    };
  }

  // Zonder hub: indicatie, maar respecteer of het artikel überhaupt
  // leverbaar is volgens de productfeed.
  return {
    stores: stores.map((store) => ({
      store,
      qty: product.inStock === false ? 0 : demoStockFor(product.id, store.id),
    })),
    webshopQty: null,
    live: false,
  };
}
