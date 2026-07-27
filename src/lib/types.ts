/* ── Catalogus (prijzen in centen, alleen site-intern) ─────────── */

export interface ProductVariant {
  id: string;
  name: string;
  price: number; // in centen, incl. btw
  sku: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  sku: string;
  category: string; // categorie-slug
  shortDescription: string;
  description: string;
  price: number; // in centen; bij varianten de "vanaf"-prijs
  compareAtPrice?: number; // adviesprijs in centen, voor voordeel-badge
  unit?: string;
  colorMixable?: boolean; // verf die in de winkel op RAL-kleur wordt gemengd
  variants?: ProductVariant[];
  specs?: { label: string; value: string }[];
  tags?: string[];
  art: { icon: string; hue: number }; // placeholder-afbeelding
}

export interface Category {
  slug: string;
  name: string;
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
  openingHours: { day: string; hours: string }[];
}

export interface RalColor {
  code: string;
  name: string;
  hex: string;
  group: string;
}

export interface CartColor {
  code: string;
  name: string;
  hex: string;
}

/** Winkelwagenregel (client-side, prijzen in centen). */
export interface CartItem {
  key: string; // uniek per product+variant+kleur
  productId: string;
  slug: string;
  name: string;
  variantId?: string;
  variantName?: string;
  color?: CartColor;
  unitPrice: number; // centen
  qty: number;
  icon: string;
  hue: number;
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
  city?: string;
  country?: string;
}

/** Orderregel volgens het gedeelde contract (prijs in euro's per stuk). */
export interface OrderItem {
  key: string;
  productId: string;
  variantId?: string;
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
  isTest?: boolean;
  channel?: "web" | "pos";
  refundedAmount?: number;
  molliePaymentId?: string;
  shipment?: { trackTrace?: string };
  // VDM-extra's voor de afhaalflow:
  fulfilment: "pickup";
  store: { id: string; name: string; city: string };
  pickupCode: string;
  readyForPickupAt?: string;
  pickedUpAt?: string;
  tilroySaleId?: string;
}

export interface CheckoutItemInput {
  productId: string;
  variantId?: string;
  colorCode?: string;
  qty: number;
}

export interface CheckoutInput {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  storeId: string;
  items: CheckoutItemInput[];
}
