/* ── Catalogus (prijzen in centen, alleen site-intern) ─────────── */

/** Mengbasis waarin een kleur wordt aangemaakt. */
export type PaintBaseId = "licht" | "midden" | "donker";

export interface ProductVariant {
  id: string;
  name: string;
  price: number; // in centen, incl. btw
  sku: string;
  /** Inhoud (bv. "2,5 L"); bij mengverf los van de basis. */
  size?: string;
  /** Basis waarin deze variant wordt gemengd; alleen bij mengverf. */
  base?: PaintBaseId;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  sku: string;
  ean?: string;
  category: string; // categorie-slug
  shortDescription: string;
  description: string;
  price: number; // in centen; bij varianten de "vanaf"-prijs
  compareAtPrice?: number; // adviesprijs in centen, voor voordeel-badge
  /** Prijs met Kluspas (in centen); komt uit de feed. */
  kluspasPrice?: number;
  unit?: string;
  colorMixable?: boolean; // verf die in de winkel op kleur wordt gemengd
  variants?: ProductVariant[];
  specs?: { label: string; value: string }[];
  /** Filterbare eigenschappen uit de feed (glans, verfsoort, inhoud, …). */
  attributes?: Record<string, string>;
  tags?: string[];
  /** Productfoto uit de feed; ontbreekt die, dan tonen we het icoon. */
  image?: string;
  inStock?: boolean;
  /**
   * Alle paden waarop dit artikel op de huidige site staat (één per variant),
   * zodat elke bestaande URL na de overgang blijft werken.
   */
  legacyPaths?: string[];
  art: { icon: string; hue: number };
}

export interface Category {
  slug: string;
  name: string;
  /**
   * Kortere naam voor de menubalk. De volledige namen samen zijn breder dan
   * een laptopscherm; met alleen de lange vorm moest de balk horizontaal
   * scrollen en verdwenen de laatste categorieën uit beeld.
   */
  menuLabel?: string;
  description: string;
  icon: string;
  hue: number;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email?: string;
  /** Vestigings-id in Tilroy; key in de voorraad-feed van het dashboard. */
  tilroyShopId?: string;
  openingHours: { day: string; hours: string }[];
  /** Coördinaten voor lokale SEO en kaartweergave. */
  geo?: { lat: number; lng: number };
  /** Diensten die deze vestiging levert (lokale SEO en klantinfo). */
  services?: string[];
}

export interface RalColor {
  code: string;
  name: string;
  hex: string;
  group: string;
}

/** Kleur in de kleurkiezer: uit de dashboard-feed of de RAL-waaier. */
export interface PaintColor {
  /** Stabiele sleutel, bv. "ral:9010" of "hub:<collectionId>:<slug>". */
  key: string;
  /** Weergavecode incl. prefix, bv. "RAL 9010" of een merkcode; kan leeg zijn. */
  code: string;
  name: string;
  hex: string;
  /** Weergavenaam van de collectie/waaier. */
  group: string;
  /** Id van de collectie, voor het filter. */
  collectionId?: string;
}

export interface CartColor {
  key?: string;
  code: string;
  name: string;
  hex: string;
  collection?: string;
}

/** Winkelwagenregel (client-side, prijzen in centen). */
export interface CartItem {
  key: string; // uniek per product+variant+kleur
  productId: string;
  /** Tilroy-sku van de gekozen variant; nodig voor de voorraadcheck. */
  sku?: string;
  slug: string;
  name: string;
  variantId?: string;
  variantName?: string;
  color?: CartColor;
  unitPrice: number; // centen
  /** Prijs per stuk met Kluspas (centen), als die er is. */
  kluspasUnitPrice?: number;
  qty: number;
  icon: string;
  hue: number;
  /** Productfoto, zodat de winkelwagen het artikel toont en niet een icoon. */
  image?: string;
}

/* ── Bestellingen ──────────────────────────────────────────────────
 *
 * ⚠️ EXTERN CONTRACT — zelfde conventie als de Klus=r-site. Het VDM-dashboard
 * (repo dashboardvdm) leest de KV READ-ONLY mee op de keys `order:<id>`
 * (Order-JSON) en `order:index` (SET met alle order-ids) en op deze
 * veldnamen: reference / createdAt / paymentStatus / customer / items
 * (title, quantity, price, variantLabel) / subtotal / shipping / total /
 * paymentMethod / isTest / channel / refundedAmount / shipment.
 * Bedragen zijn EURO'S (decimaal, bv. 24.95) — géén centen. Extra velden
 * zijn prima (het dashboard leest defensief), maar wijzig deze namen niet
 * zonder dashboardvdm mee te nemen.
 * ────────────────────────────────────────────────────────────────── */

export type OrderPaymentStatus =
  | "open"
  | "pending"
  | "paid"
  | "authorized"
  | "shipped"
  | "delivered"
  | "canceled"
  | "failed"
  | "expired"
  | "refunded";

export function isPaidStatus(status: OrderPaymentStatus): boolean {
  return ["paid", "authorized", "shipped", "delivered"].includes(status);
}

export function isOpenStatus(status: OrderPaymentStatus): boolean {
  return ["open", "pending"].includes(status);
}

export function isFailedStatus(status: OrderPaymentStatus): boolean {
  return ["canceled", "failed", "expired"].includes(status);
}

export interface OrderCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  /** Straatnaam (zonder huisnummer — Tilroy wil die velden apart). */
  street?: string;
  houseNumber?: string;
  houseNumberSuffix?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

/** Orderregel volgens het gedeelde contract (prijs in euro's per stuk). */
export interface OrderItem {
  key: string;
  productId: string;
  variantId?: string;
  /** Tilroy-artikel-id/sourceId van de bestelde variant — nodig om de order
   *  later in Tilroy te kunnen zetten (voorraad afboeken in de bron). */
  sku?: string;
  ean?: string;
  title: string;
  brand?: string;
  image?: string;
  variantLabel?: string;
  slug?: string;
  quantity: number;
  price: number; // euro's per stuk, incl. btw
  // VDM-extra's (dashboard negeert onbekende velden):
  color?: CartColor;
  icon?: string;
  hue?: number;
}

export interface Order {
  id: string; // ord_xxxxxxxx
  reference: string; // VDM-123456
  createdAt: string; // ISO
  paymentStatus: OrderPaymentStatus;
  paymentMethod?: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number; // euro's
  shipping: number; // euro's (afhalen = 0)
  total: number; // euro's
  /** Kluspas-nummer van de klant; de korting zit al in de bedragen. */
  kluspasNumber?: string;
  /** Wat de Kluspas op deze bestelling scheelde (euro's). */
  kluspasSavings?: number;
  isTest?: boolean;
  channel?: "web" | "pos";
  refundedAmount?: number;
  molliePaymentId?: string;
  shipment?: { trackTrace?: string };
  // VDM-extra's voor bezorgen/afhalen:
  fulfilment: "pickup" | "delivery";
  /** Alleen bij afhalen. */
  store?: { id: string; name: string; city: string };
  pickupCode?: string;
  readyForPickupAt?: string;
  pickedUpAt?: string;
  /**
   * Alleen bij bezorgen: de belofte op het bestelmoment.
   *
   * `carrier` bepaalt hoe de order wordt uitgevoerd: DHL vanuit de
   * webshopvoorraad in Nijverdal, of PostNL vanuit de winkel die het artikel
   * heeft. Bij PostNL wordt de order door die winkel in Tilroy verwerkt —
   * `fulfilStoreId` zegt om welke winkel het gaat.
   */
  delivery?: {
    type: "same-day" | "next-day" | "next-workday";
    carrier: "dhl" | "postnl";
    expectedDate: string;
    fulfilStoreId?: string;
  };
}

export interface CheckoutItemInput {
  productId: string;
  variantId?: string;
  /** Kleur-key uit de kleurkiezer (bv. "ral:9010"); oude RAL-codes blijven werken. */
  colorKey?: string;
  qty: number;
}

export interface CheckoutInput {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street?: string;
    houseNumber?: string;
    houseNumberSuffix?: string;
    postalCode?: string;
    city?: string;
  };
  fulfilment: "pickup" | "delivery";
  storeId?: string;
  /** Optioneel Kluspas-nummer; levert 5% korting op het hele mandje. */
  kluspasNumber?: string;
  items: CheckoutItemInput[];
}
