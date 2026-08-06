import { randomInt } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { isKvEnabled, kvGetJSON, kvSAdd, kvSetJSON, kvSMembers } from "@/lib/kv";
import { getMolliePayment } from "@/lib/mollie";
import { stuurOrderbevestiging } from "@/lib/orderbevestiging";
import { isStaalOrderItem } from "@/lib/stalen";
import { getProductById, getProductBySku } from "@/lib/tilroy";
import { maakStaalVoucher, verzilverVoucher } from "@/lib/vouchers";
import { stuurVoucherMail } from "@/lib/vouchermail";
import {
  isPaidStatus,
  type Adres,
  type CartItem,
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

/**
 * Alle bestellingen uit de bestandsopslag.
 *
 * Alleen voor de demomodus, waar KV uit staat en er dus ook geen index per
 * e-mailadres wordt bijgehouden. Zonder dit toont het account lokaal altijd
 * een lege lijst, ook vlak nadat je zelf een bestelling hebt geplaatst — en
 * dan is er niets te zien en niets na te lopen.
 */
async function fileList(): Promise<Order[]> {
  try {
    const namen = await fs.readdir(DATA_DIR);
    const orders: Order[] = [];
    for (const naam of namen) {
      if (!naam.startsWith("ord_") || !naam.endsWith(".json")) continue;
      const order = await fileRead<Order>(naam);
      if (order?.id) orders.push(order);
    }
    return orders;
  } catch {
    return [];
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
  const adres = (email ?? "").trim().toLowerCase();
  if (!adres) return [];

  const nieuwsteEerst = (orders: Order[]) =>
    orders.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit);

  // Zonder KV staan de bestellingen als bestand op schijf en is er geen index
  // per e-mailadres; dan lopen we de map door. Dat kan alleen lokaal, en daar
  // is het ook voor bedoeld.
  if (!isKvEnabled()) {
    const alles = await fileList();
    return nieuwsteEerst(
      alles.filter((order) => (order.customer?.email ?? "").trim().toLowerCase() === adres),
    );
  }

  try {
    const ids = await kvSMembers(KEY.email(adres));
    const orders: Order[] = [];
    for (const id of ids.slice(0, limit * 2)) {
      const order = await loadById(id);
      if (order) orders.push(order);
    }
    return nieuwsteEerst(orders);
  } catch (error) {
    console.error("[orders] bestellingen van klant ophalen mislukt:", error);
    return [];
  }
}

/**
 * De bestelling, maar alleen als hij van déze klant is.
 *
 * Het referentienummer is zes cijfers (VDM-123456): genoeg om een bestelling
 * mee op te zoeken, maar het is geen bewijs van wie je bent — net zomin als
 * het Kluspas-nummer, dat gewoon oploopt. Alles wat vanuit het account iets
 * mét een bestelling doet, gaat daarom via deze functie, met het adres uit de
 * sessie.
 */
export async function getOrderForEmail(
  idOrReference: string,
  email: string,
): Promise<Order | null> {
  const gezocht = (email ?? "").trim().toLowerCase();
  if (!gezocht) return null;
  const order = await getOrder(idOrReference);
  if (!order) return null;
  const van = (order.customer?.email ?? "").trim().toLowerCase();
  return van && van === gezocht ? order : null;
}

/* ── Nog eens bestellen ────────────────────────────────────────── */

/** Winkelwagenregel uit een eerdere bestelling, met de prijs van vandaag. */
export interface HerhaalRegel extends CartItem {
  /**
   * Wat de klant er destijds per stuk voor betaalde (centen).
   *
   * Alleen om een verschil te kunnen benoemen. De prijs die telt is
   * `unitPrice`, en die komt uit de catalogus.
   */
  eerderePrijs: number;
}

export interface OvergeslagenRegel {
  titel: string;
  reden: string;
}

export interface Herhaling {
  regels: HerhaalRegel[];
  overgeslagen: OvergeslagenRegel[];
  /** Aantal regels in de oorspronkelijke bestelling. */
  regelsInBestelling: number;
  /** Wat de overgenomen regels nu kosten en wat ze toen kostten (centen). */
  totaalNu: number;
  totaalToen: number;
}

/**
 * Zet een eerdere bestelling om in winkelwagenregels van vandaag.
 *
 * Twee dingen liggen hier vast, en die zijn belangrijker dan het gemak van de
 * knop:
 *
 * 1. De prijs komt uit de huidige catalogus, nooit uit de oude bestelling.
 *    Een klant mag niet de prijs van vorig jaar afrekenen, en de checkout
 *    rekent toch opnieuw — dan kan hij die prijs beter meteen zien.
 * 2. Wat er niet meer is, wordt overgeslagen én benoemd. Een mandje dat
 *    stilletjes korter is dan de bestelling waar het uit komt, ontdekt de
 *    klant pas bij de bezorging.
 */
export async function herhaalBestelling(order: Order): Promise<Herhaling> {
  const regels: HerhaalRegel[] = [];
  const overgeslagen: OvergeslagenRegel[] = [];

  for (const item of order.items ?? []) {
    // Op id én op sku zoeken: een artikel kan in de feed een ander id
    // gekregen hebben terwijl het gewoon nog in de schappen ligt.
    const product =
      (await getProductById(item.productId ?? "")) ??
      (item.sku ? await getProductBySku(item.sku) : undefined);

    if (!product) {
      overgeslagen.push({ titel: item.title, reden: "staat niet meer in ons assortiment" });
      continue;
    }

    const varianten = product.variants ?? [];
    const variant =
      varianten.find((kandidaat) => kandidaat.id === item.variantId) ??
      (item.sku ? varianten.find((kandidaat) => kandidaat.sku === item.sku) : undefined);

    // Het artikel bestaat nog, maar de maat die de klant koos niet meer. Dan
    // is het een ander product geworden; liever overslaan en benoemen dan
    // ongevraagd een andere maat in het mandje leggen.
    if (varianten.length > 0 && (item.variantId || item.sku) && !variant) {
      overgeslagen.push({
        titel: item.title,
        reden: "deze maat verkopen we niet meer",
      });
      continue;
    }

    const aantal = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));
    const unitPrice = variant?.price ?? product.price;
    const kluspasUnitPrice = variant ? variant.kluspasPrice : product.kluspasPrice;
    const pickupOnly = variant?.pickupOnly ?? product.pickupOnly;
    // Dezelfde sleutelvorm als de productpagina, zodat een regel die er al in
    // ligt wordt opgeteld en niet twee keer in de wagen komt.
    const key = `${product.id}:${variant?.id ?? ""}:${item.color?.key ?? ""}`;

    const bestaand = regels.find((regel) => regel.key === key);
    if (bestaand) {
      bestaand.qty = Math.min(99, bestaand.qty + aantal);
      continue;
    }

    regels.push({
      key,
      productId: product.id,
      sku: variant?.sku ?? product.sku,
      slug: product.slug,
      name: product.name,
      ...(variant ? { variantId: variant.id, variantName: variant.name } : {}),
      ...(item.color ? { color: item.color } : {}),
      unitPrice,
      ...(kluspasUnitPrice ? { kluspasUnitPrice } : {}),
      qty: aantal,
      icon: product.art.icon,
      hue: product.art.hue,
      ...(pickupOnly ? { pickupOnly } : {}),
      ...(product.image ? { image: product.image } : {}),
      // Orderbedragen staan in euro's, de winkelwagen rekent in centen.
      eerderePrijs: Math.round((Number(item.price) || 0) * 100),
    });
  }

  return {
    regels,
    overgeslagen,
    regelsInBestelling: (order.items ?? []).length,
    totaalNu: regels.reduce((som, regel) => som + regel.unitPrice * regel.qty, 0),
    totaalToen: regels.reduce((som, regel) => som + regel.eerderePrijs * regel.qty, 0),
  };
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
  /** Afgerekend met ProfPas: 10% korting, gratis bezorgd, geen kluspunten. */
  /** Factuuradres, als dat afwijkt van het bezorgadres. */
  billing?: Adres;
  profpas?: boolean;
  /** Verzilverde staal-voucher; de korting zit al in `total`. */
  voucherCode?: string;
  voucherKorting?: number;
  isTest?: boolean;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const order: Order = {
    id: generateId(),
    reference: generateReference(),
    createdAt: new Date().toISOString(),
    paymentStatus: "open",
    customer: input.customer,
    // Factuuradres alleen als het echt afwijkt; anders is het bezorgadres het
    // factuuradres en levert een kopie alleen maar twee plekken op die uit
    // elkaar kunnen lopen.
    ...(input.billing ? { billing: input.billing } : {}),
    items: input.items,
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.total,
    isTest: input.isTest,
    ...(input.kluspasNumber ? { kluspasNumber: input.kluspasNumber } : {}),
    ...(input.kluspasSavings ? { kluspasSavings: input.kluspasSavings } : {}),
    ...(input.profpas ? { profpas: true as const } : {}),
    ...(input.voucherCode ? { voucherCode: input.voucherCode } : {}),
    ...(input.voucherKorting ? { voucherKorting: input.voucherKorting } : {}),
    channel: "web",
    // Welke webshop dit is. Vast op "vdm": deze code draait maar op één shop.
    // Het dashboard rapporteert per shop en hoeft het nu niet meer uit de
    // checkout-URL af te leiden.
    site: "vdm",
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

  // De bevestiging markeren we in dezelfde schrijfactie als de statuswissel.
  // Deze functie wordt vanuit twee kanten aangeroepen — de Mollie-webhook en
  // het openen van de besteldpagina — en die kunnen elkaar kruisen. Door het
  // stempel meteen mee te schrijven is er maar één aanroep die 'm daarna ook
  // echt verstuurt.
  const magMailen = outcome === "paid" && !order.confirmationSentAt;

  // Kleurtesters in de bestelling leveren een voucher op. Aanmaken vóór de
  // schrijfactie, zodat code én status in dezelfde write staan — hetzelfde
  // patroon als het mailstempel hierboven.
  let nieuweVoucher: Awaited<ReturnType<typeof maakStaalVoucher>> = null;
  if (magMailen && !order.staalVoucher && order.items.some(isStaalOrderItem)) {
    try {
      nieuweVoucher = await maakStaalVoucher(order);
    } catch (error) {
      console.error(`[voucher] aanmaken voor ${order.reference} mislukt:`, error);
    }
  }

  const bijgewerkt =
    (await updateOrder(order.id, {
      paymentStatus: outcome,
      paymentMethod: info?.method ?? order.paymentMethod,
      ...(magMailen ? { confirmationSentAt: new Date().toISOString() } : {}),
      ...(nieuweVoucher
        ? { staalVoucher: { code: nieuweVoucher.code, bedrag: nieuweVoucher.bedrag / 100 } }
        : {}),
    })) ?? order;

  if (magMailen) {
    // Bewust afwachten: op een serverless functie wordt werk dat na het
    // antwoord doorloopt zonder pardon afgekapt, en dan komt de bevestiging
    // nooit aan.
    await stuurOrderbevestiging(bijgewerkt);

    // Een bij het afrekenen ingezette voucher wordt pas nu opgemaakt: een
    // mislukte betaling mag het tegoed niet kosten.
    if (order.voucherCode) {
      await verzilverVoucher(order.voucherCode, order.reference);
    }
    if (nieuweVoucher) {
      await stuurVoucherMail(bijgewerkt, nieuweVoucher);
    }
  }

  return bijgewerkt;
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
