import { demoCategories, demoProducts, demoStockFor } from "@/lib/catalog";
import { demoStores } from "@/lib/stores";
import type { Category, Product, Store } from "@/lib/types";

/**
 * Datalaag van de site. Architectuur (afgestemd met het VDM-dashboard):
 *
 * - CATALOGUS & WINKELS: lokale data (de winkels zijn de echte vestigingen).
 * - VOORRAAD: via de gedeelde voorraad-hub van het VDM-dashboard, die op de
 *   échte Tilroy Stock API draait — beide shops putten zo uit dezelfde
 *   voorraad. We roepen Tilroy dus bewust NIET rechtstreeks aan.
 * - BESTELLINGEN: naar KV (lib/orders.ts); het dashboard leest ze daar en
 *   verzorgt centraal de fulfilment (DHL-labels, track & trace, kassa).
 *
 * Alles is best-effort: zolang de hub `configured: false` antwoordt of niet
 * bereikbaar is, valt de voorraad terug op de ingebouwde demo-aantallen.
 */

const DASHBOARD_API_URL = (
  process.env.DASHBOARD_API_URL ?? "https://dashboardvdm.vercel.app"
).replace(/\/$/, "");

/* ── Catalogus ─────────────────────────────────────────────────── */

export async function getProducts(): Promise<Product[]> {
  return demoProducts;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return demoProducts.find((product) => product.slug === slug);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return demoProducts.find((product) => product.id === id);
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  return demoProducts.filter((product) => product.category === categorySlug);
}

export async function getCategories(): Promise<Category[]> {
  return demoCategories;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return demoCategories.find((category) => category.slug === slug);
}

/* ── Winkels ───────────────────────────────────────────────────── */

export async function getStores(): Promise<Store[]> {
  return demoStores;
}

export async function getStore(idOrSlug: string): Promise<Store | undefined> {
  return demoStores.find((store) => store.id === idOrSlug || store.slug === idOrSlug);
}

/* ── Voorraad via de dashboard-hub ─────────────────────────────── */

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
    console.error("[voorraad] hub niet bereikbaar, demo-voorraad actief:", error);
    return null;
  }
}

export interface StoreStock {
  store: Store;
  qty: number;
}

export async function getStockByStore(product: Product): Promise<StoreStock[]> {
  const stores = await getStores();
  const hub = await fetchHubStock([product.sku]);
  if (hub) {
    const wanted = product.sku.toLowerCase();
    const item = hub.items.find((entry) => entry.sku?.toLowerCase() === wanted);
    return stores.map((store) => {
      const qty = item && store.tilroyShopId ? item.shops?.[store.tilroyShopId] : undefined;
      return { store, qty: Number.isFinite(qty) ? (qty as number) : 0 };
    });
  }
  return stores.map((store) => ({ store, qty: demoStockFor(product.id, store.id) }));
}
