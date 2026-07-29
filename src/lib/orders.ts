import { randomInt } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { isKvEnabled, kvGetJSON, kvSAdd, kvSetJSON, kvSMembers } from "@/lib/kv";
import { getMolliePayment } from "@/lib/mollie";
import {
  isPaidStatus,
  type Order,
  type OrderCustomer,
  type OrderItem,
} from "@/lib/types";

/**
 * Orderstore volgens dezelfde conventie als de Klus=r-site, zodat het
 * VDM-dashboard (repo dashboardvdm) de orders automatisch READ-ONLY kan
 * meelezen zodra de KV-credentials daar als VDMSITE_KV_REST_API_URL/TOKEN
 * bekend zijn.
 *
 * ⚠️ EXTERN CONTRACT — KV-keys (niet wijzigen zonder dashboardvdm mee te nemen):
 *   `order:<id>`              → Order-JSON
 *   `order:index`             → SET met alle order-ids
 *   `orderref:<REFERENCE>`    → order-id (lookup op VDM-123456)
 *   `ordermollie:<paymentId>` → order-id (lookup vanuit de Mollie-webhook)
 *   `orders:email:<email>`    → SET met order-ids van die klant
 *
 * Opslag: in-memory cache + KV zodra die is geconfigureerd. Zonder KV worden
 * orders lokaal als JSON bewaard in .data/orders/ (genegeerd door git), zodat
 * de hele flow ook in demomodus blijft werken.
 */

const memory = new Map<string, Order>();

const KEY = {
  order: (id: string) => `order:${id}`,
  ref: (reference: string) => `orderref:${reference.toUpperCase()}`,
  mollie: (paymentId: string) => `ordermollie:${paymentId}`,
  email: (email: string) => `orders:email:${email.trim().toLowerCase()}`,
  index: "order:index",
};

const DATA_DIR = path.join(process.cwd(), ".data", "orders");

const ID_PATTERN = /^ord_[a-z0-9]{6,16}$/;
const REF_PATTERN = /^VDM-\d{6}$/i;

function generateId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += alphabet[randomInt(alphabet.length)];
  }
  return `ord_${suffix}`;
}

function generateReference(): string {
  return `VDM-${randomInt(100000, 1000000)}`;
}

function generatePickupCode(): string {
  return String(randomInt(100000, 1000000));
}

/* ── Bestandsopslag (fallback zonder KV) ───────────────────────── */

async function fileWrite(name: string, value: unknown): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, name), JSON.stringify(value, null, 2), "utf8");
  } catch (error) {
    console.error("[orders] bestand schrijven mislukt:", error);
  }
}

async function fileRead<T>(name: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/* ── Opslaan & laden ───────────────────────────────────────────── */

/**
 * Bewaart de bestelling. Met KV gaat alles daarheen (het dashboard leest die
 * store mee); lukt dat niet, dan valt de opslag terug op bestanden zodat een
 * betaalde bestelling nooit verloren gaat.
 */
async function persist(order: Order): Promise<void> {
  memory.set(order.id, order);

  if (isKvEnabled()) {
    const stored = await kvSetJSON(KEY.order(order.id), order);
    if (stored) {
      await kvSetJSON(KEY.ref(order.reference), order.id);
      await kvSAdd(KEY.index, order.id);
      if (order.customer.email) await kvSAdd(KEY.email(order.customer.email), order.id);
      if (order.molliePaymentId) {
        await kvSetJSON(KEY.mollie(order.molliePaymentId), order.id);
      }
      return;
    }
    console.error(
      `[orders] ${order.reference} kon niet naar KV worden geschreven; bestandsopslag als terugval.`,
    );
  }

  await fileWrite(`${order.id}.json`, order);
  await fileWrite(`ref-${order.reference.toUpperCase()}.json`, { id: order.id });
}

async function loadById(id: string): Promise<Order | null> {
  if (!ID_PATTERN.test(id)) return null;
  const cached = memory.get(id);
  if (cached) return cached;
  // Ook met KV de bestandsopslag raadplegen: daar kan een bestelling staan
  // die tijdens een KV-storing is binnengekomen.
  const fromKv = isKvEnabled() ? await kvGetJSON<Order>(KEY.order(id)) : null;
  const order = fromKv ?? (await fileRead<Order>(`${id}.json`));
  if (order) memory.set(order.id, order);
  return order;
}

/** Zoek een bestelling op order-id (`ord_…`) óf op referentie (`VDM-123456`). */
export async function getOrder(idOrReference: string): Promise<Order | null> {
  const value = (idOrReference ?? "").trim();
  if (ID_PATTERN.test(value)) return loadById(value);
  if (!REF_PATTERN.test(value)) return null;
  const reference = value.toUpperCase();
  for (const order of memory.values()) {
    if (order.reference.toUpperCase() === reference) return order;
  }
  if (isKvEnabled()) {
    const id = await kvGetJSON<string>(KEY.ref(reference));
    if (id) return loadById(id);
  }
  const pointer = await fileRead<{ id: string }>(`ref-${reference}.json`);
  return pointer?.id ? loadById(pointer.id) : null;
}

/**
 * Alle webshopbestellingen van één klant, nieuwste eerst.
 *
 * Voor de accountpagina. De index op e-mailadres wordt bij elke bestelling
 * bijgehouden; zonder KV bestaat die niet en krijgt de klant een lege lijst
 * in plaats van een fout.
 */
export async function getOrdersByEmail(email: string, limit = 25): Promise<Order[]> {
  if (!isKvEnabled()) return [];
  try {
    const ids = await kvSMembers(KEY.email(email));
    const orders: Order[] = [];
    for (const id of ids.slice(0, limit * 2)) {
      const order = await loadById(id);
      if (order) orders.push(order);
    }
    return orders
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit);
  } catch (error) {
    console.error("[orders] bestellingen van klant ophalen mislukt:", error);
    return [];
  }
}

/* ── Aanmaken & bijwerken ──────────────────────────────────────── */

export interface CreateOrderInput {
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number; // euro's
  shipping: number; // euro's
  total: number; // euro's
  fulfilment: "pickup" | "delivery";
  store?: { id: string; name: string; city: string };
  delivery?: Order["delivery"];
  kluspasNumber?: string;
  kluspasSavings?: number;
  isTest?: boolean;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const order: Order = {
    id: generateId(),
    reference: generateReference(),
    createdAt: new Date().toISOString(),
    paymentStatus: "open",
    customer: input.customer,
    items: input.items,
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.total,
    isTest: input.isTest,
    ...(input.kluspasNumber ? { kluspasNumber: input.kluspasNumber } : {}),
    ...(input.kluspasSavings ? { kluspasSavings: input.kluspasSavings } : {}),
    channel: "web",
    fulfilment: input.fulfilment,
    ...(input.fulfilment === "pickup"
      ? { store: input.store, pickupCode: generatePickupCode() }
      : { delivery: input.delivery }),
  };
  await persist(order);
  return order;
}

export async function updateOrder(
  idOrReference: string,
  patch: Partial<Order>,
): Promise<Order | null> {
  const order = await getOrder(idOrReference);
  if (!order) return null;
  const updated: Order = { ...order, ...patch };
  await persist(updated);
  return updated;
}

export async function setMolliePaymentId(
  idOrReference: string,
  molliePaymentId: string,
): Promise<Order | null> {
  return updateOrder(idOrReference, { molliePaymentId });
}

/**
 * Verwerkt de uitkomst van een betaling (webhook, demo-betaling of lazy sync).
 * Idempotent: een al betaalde bestelling wordt nooit teruggezet. Betaalde
 * orders staan in KV; het dashboard pakt ze daar op voor fulfilment
 * (kassa, DHL-label, track & trace).
 */
export async function applyPaymentResult(
  order: Order,
  outcome: "paid" | "failed" | "canceled" | "expired",
  info?: { method?: string },
): Promise<Order> {
  if (isPaidStatus(order.paymentStatus)) return order;
  return (
    (await updateOrder(order.id, {
      paymentStatus: outcome,
      paymentMethod: info?.method ?? order.paymentMethod,
    })) ?? order
  );
}

/**
 * Haalt een bestelling op en synchroniseert onderweg de Mollie-status als de
 * betaling nog openstaat. Zo klopt de status ook zonder bereikbare webhook
 * (bijvoorbeeld op localhost).
 */
export async function getOrderSynced(idOrReference: string): Promise<Order | null> {
  const order = await getOrder(idOrReference);
  if (!order) return null;
  if (order.paymentStatus !== "open" || !order.molliePaymentId) return order;
  try {
    const payment = await getMolliePayment(order.molliePaymentId);
    if (payment.status === "paid") {
      return applyPaymentResult(order, "paid", { method: payment.method ?? undefined });
    }
    if (payment.status === "failed" || payment.status === "canceled" || payment.status === "expired") {
      return applyPaymentResult(order, payment.status);
    }
  } catch (error) {
    console.error(`[mollie] status van bestelling ${order.reference} bijwerken mislukt:`, error);
  }
  return order;
}
