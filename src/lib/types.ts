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
  unit?: string; // bv. "per set" of "2,5 liter"
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
  openingHours: { day: string; hours: string }[];
}

export interface RalColor {
  code: string; // bv. "9010"
  name: string; // bv. "Zuiver wit"
  hex: string; // indicatieve weergave
  group: string; // bv. "Wit & zwart"
}

export interface CartColor {
  code: string;
  name: string;
  hex: string;
}

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

export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "paid"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface OrderPayment {
  provider: "mollie" | "demo";
  id?: string;
  method?: string;
  paidAt?: string;
}

export interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  items: CartItem[];
  totals: { subtotal: number; total: number };
  customer: OrderCustomer;
  store: { id: string; name: string; city: string };
  pickupCode: string;
  payment: OrderPayment;
  tilroySaleId?: string;
}

export interface CheckoutItemInput {
  productId: string;
  variantId?: string;
  colorCode?: string;
  qty: number;
}

export interface CheckoutInput {
  customer: OrderCustomer;
  storeId: string;
  items: CheckoutItemInput[];
}
