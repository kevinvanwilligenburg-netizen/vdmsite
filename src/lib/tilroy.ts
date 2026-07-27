import { demoCategories, demoProducts, demoStockFor } from "@/lib/catalog";
import { demoStores } from "@/lib/stores";
import type { Category, Order, Product, Store } from "@/lib/types";

/**
 * Tilroy-koppeling (datalaag van de site).
 *
 * Alle pagina's en API-routes praten uitsluitend met deze facade. Zonder
 * TILROY_API_KEY (of als de API niet bereikbaar is) draait de site volledig
 * op de ingebouwde demo-catalogus, zodat alles lokaal werkt en testbaar is.
 *
 * De endpoint-paden en veldnamen verschillen per Tilroy-omgeving; pas de
 * map-functies hieronder aan op het antwoord van jouw account (zie README).
 */

const TILROY_API_URL = (process.env.TILROY_API_URL ?? "https://api.tilroy.com").replace(/\/$/, "");
const TILROY_API_KEY = process.env.TILROY_API_KEY;
const PRODUCTS_ENDPOINT = process.env.TILROY_PRODUCTS_ENDPOINT ?? "/products";
const SHOPS_ENDPOINT = process.env.TILROY_SHOPS_ENDPOINT ?? "/shops";
const SALES_ENDPOINT = process.env.TILROY_SALES_ENDPOINT ?? "/sales";

export function tilroyEnabled(): boolean {
  return Boolean(TILROY_API_KEY);
}

async function tilroyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TILROY_API_URL}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": TILROY_API_KEY ?? "",
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
    // Catalogusdata mag 5 minuten gecachet worden.
    next: init?.method && init.method !== "GET" ? undefined : { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Tilroy API ${path} antwoordde met status ${res.status}`);
  }
  return (await res.json()) as T;
}

/* ── Mapping van Tilroy-antwoorden naar interne types ─────────── */

type TilroyRecord = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapTilroyProduct(record: TilroyRecord): Product | null {
  const id = str(record.id ?? record.productId ?? record.sku);
  const name = str(record.name ?? record.description);
  if (!id || !name) return null;
  const priceRaw = record.price ?? record.sellPrice ?? record.grossPrice;
  const price =
    typeof priceRaw === "number" ? Math.round(priceRaw * 100) : Number(priceRaw) * 100 || 0;
  return {
    id,
    slug: toSlug(str(record.slug, name)),
    name,
    brand: str(record.brand, "De Voordeelmarkt"),
    sku: str(record.sku, id),
    category: toSlug(str(record.category ?? record.productGroup, "assortiment")),
    shortDescription: str(record.shortDescription ?? record.description, name),
    description: str(record.longDescription ?? record.description, name),
    price,
    unit: str(record.unit) || undefined,
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : undefined,
    art: { icon: "🛒", hue: 215 },
  };
}

function mapTilroyShop(record: TilroyRecord): Store | null {
  const id = str(record.id ?? record.shopId ?? record.code);
  const name = str(record.name);
  if (!id || !name) return null;
  return {
    id,
    slug: toSlug(name),
    name,
    address: str(record.street ?? record.address),
    postalCode: str(record.postalCode ?? record.zip),
    city: str(record.city),
    phone: str(record.phone),
    openingHours: [],
  };
}

/* ── Catalogus ─────────────────────────────────────────────────── */

export async function getProducts(): Promise<Product[]> {
  if (!tilroyEnabled()) return demoProducts;
  try {
    const data = await tilroyFetch<TilroyRecord[]>(PRODUCTS_ENDPOINT);
    const mapped = data.map(mapTilroyProduct).filter((p): p is Product => p !== null);
    return mapped.length > 0 ? mapped : demoProducts;
  } catch (error) {
    console.error("[tilroy] producten ophalen mislukt, demo-catalogus actief:", error);
    return demoProducts;
  }
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

// Categorieën komen uit de eigen indeling; Tilroy-productgroepen kunnen
// hierop gemapt worden zodra de koppeling live is.
export async function getCategories(): Promise<Category[]> {
  return demoCategories;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug);
}

/* ── Winkels & voorraad ────────────────────────────────────────── */

export async function getStores(): Promise<Store[]> {
  if (!tilroyEnabled()) return demoStores;
  try {
    const data = await tilroyFetch<TilroyRecord[]>(SHOPS_ENDPOINT);
    const mapped = data.map(mapTilroyShop).filter((s): s is Store => s !== null);
    return mapped.length > 0 ? mapped : demoStores;
  } catch (error) {
    console.error("[tilroy] winkels ophalen mislukt, demo-winkels actief:", error);
    return demoStores;
  }
}

export async function getStore(idOrSlug: string): Promise<Store | undefined> {
  const stores = await getStores();
  return stores.find((store) => store.id === idOrSlug || store.slug === idOrSlug);
}

export interface StoreStock {
  store: Store;
  qty: number;
}

export async function getStockByStore(product: Product): Promise<StoreStock[]> {
  const stores = await getStores();
  if (tilroyEnabled()) {
    try {
      const data = await tilroyFetch<TilroyRecord[]>(
        `${PRODUCTS_ENDPOINT}/${encodeURIComponent(product.id)}/stock`,
      );
      return stores.map((store) => {
        const row = data.find((entry) => str(entry.shopId ?? entry.storeId) === store.id);
        const qty = row ? Number(row.quantity ?? row.qty ?? 0) : 0;
        return { store, qty: Number.isFinite(qty) ? qty : 0 };
      });
    } catch (error) {
      console.error("[tilroy] voorraad ophalen mislukt, demo-voorraad actief:", error);
    }
  }
  return stores.map((store) => ({ store, qty: demoStockFor(product.id, store.id) }));
}

/* ── Bestellingen naar Tilroy ──────────────────────────────────── */

/**
 * Zet een betaalde webbestelling als verkoop/afhaalorder in Tilroy, zodat de
 * winkel hem in de kassa ziet en kan klaarzetten. Retourneert het Tilroy-id,
 * of null in demomodus / bij een fout (de bestelling zelf blijft geldig).
 */
export async function pushOrderToTilroy(order: Order): Promise<string | null> {
  if (!tilroyEnabled()) {
    console.info(`[tilroy] demomodus: bestelling ${order.id} niet doorgezet naar Tilroy.`);
    return null;
  }
  try {
    const payload = {
      reference: order.id,
      shopId: order.store.id,
      type: "pickup",
      customer: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
      },
      pickupCode: order.pickupCode,
      lines: order.items.map((item) => ({
        sku: item.productId,
        variantId: item.variantId ?? null,
        description:
          item.name +
          (item.variantName ? ` – ${item.variantName}` : "") +
          (item.color ? ` – RAL ${item.color.code} ${item.color.name}` : ""),
        quantity: item.qty,
        unitPrice: item.unitPrice / 100,
      })),
      totalAmount: order.totals.total / 100,
      paymentStatus: "paid",
    };
    const data = await tilroyFetch<TilroyRecord>(SALES_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return str(data.id ?? data.saleId) || null;
  } catch (error) {
    console.error(`[tilroy] bestelling ${order.id} doorzetten mislukt:`, error);
    return null;
  }
}
