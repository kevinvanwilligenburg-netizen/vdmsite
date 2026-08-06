/**
 * Een post-adres: bezorgadres, factuuradres of een regel uit het adresboek.
 *
 * Staat hier en niet in lib/adressen.ts omdat `Order` hem nodig heeft en dat
 * anders een kringverwijzing geeft. De logica (lezen, controleren, opslaan)
 * zit wél in lib/adressen.ts.
 */
export interface Adres {
  /** Vrije naam in het adresboek ("Loods", "Thuis"); alleen voor de klant. */
  label?: string;
  /** Op de factuur en op het pakket; bij zakelijk vrijwel altijd gevuld. */
  bedrijf?: string;
  voornaam?: string;
  achternaam?: string;
  straat: string;
  huisnummer: string;
  toevoeging?: string;
  postcode: string;
  plaats: string;
  /** "NL" of "BE". */
  land: string;
}

/* ── Catalogus (prijzen in centen, alleen site-intern) ─────────── */

/** Mengbasis waarin een kleur wordt aangemaakt. */
export type PaintBaseId = "licht" | "midden" | "donker";

export interface ProductVariant {
  id: string;
  name: string;
  price: number; // in centen, incl. btw
  /**
   * Adviesprijs en Kluspas-prijs horen bij de maat, niet bij het product:
   * 500 ml Rubbol kost € 44,84 (Kluspas € 42,60) en 2,5 L € 179,39
   * (Kluspas € 170,42). Eén waarde voor het hele product laat de klant naar
   * een korting kijken die niet bij zijn blik hoort.
   */
  compareAtPrice?: number;
  kluspasPrice?: number;
  /** Loopt er op deze maat een Tilroy-actie? Zie `actie` op Product. */
  actie?: boolean;
  sku: string;
  /** Inhoud of maat (bv. "2,5 L", "70 MM"); bij mengverf los van de basis. */
  size?: string;
  /**
   * Ligt déze maat ergens op voorraad? Uitverkochte maten blijven zichtbaar
   * (de klant zoekt op maat en moet zien dát we hem voeren), maar zijn niet
   * bestelbaar — hij krijgt er een seintje op.
   */
  inStock?: boolean;
  /**
   * Verpakkingsaantal ("3 stuks", "per stuk), als hetzelfde artikel in
   * dezelfde maat in meerdere verpakkingen bestaat. Maat en verpakking zijn
   * twee losse keuzes; als één lijst gecombineerd levert dat tientallen
   * knoppen op waarin niemand zijn maat terugvindt.
   */
  packaging?: string;
  /** Basis waarin deze variant wordt gemengd; alleen bij mengverf. */
  base?: PaintBaseId;
  /**
   * Reden waarom juist deze maat niet met de pakketdienst mee kan. Staat per
   * variant omdat het per maat verschilt: 2,5 liter gaat prima mee, 25 liter
   * niet.
   */
  pickupOnly?: string;
  /**
   * Het fabriekswit-artikel bij deze maat (Sikkens): een écht artikel met
   * eigen sku, prijs en voorraad. Wie 100% wit kiest bestelt dít artikel —
   * dan boekt de kassa de juiste voorraad af, en wit is geregeld goedkoper
   * dan dezelfde verf gemengd (tot € 58 op een blik van 5 liter).
   */
  wit?: {
    sku: string;
    price: number; // centen
    compareAtPrice?: number;
    kluspasPrice?: number;
    inStock: boolean;
  };
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
  /**
   * Er loopt een Tilroy-actie op dit product; `price` ís al de actieprijs en
   * `compareAtPrice` de normale prijs.
   *
   * Zo'n actie geldt voor iedereen, dus er hoort géén tweede korting
   * overheen — niet de Kluspas (die staat hier al op 0) en niet de Profpas,
   * die wij zélf uitrekenen en anders zou stapelen op korting die de kassa al
   * gegeven heeft. Regel van Kevin, 6 augustus 2026.
   */
  actie?: boolean;
  /** Looptijd van die actie ("JJJJ-MM-DD"), voor `sale_price_effective_date`. */
  actieVan?: string;
  actieTot?: string;
  unit?: string;
  colorMixable?: boolean; // verf die in de winkel op kleur wordt gemengd
  /** Waar: de omschrijving is Tilroy's handgeschreven webtekst, geen terugvalzin. */
  heeftEigenTekst?: boolean;
  variants?: ProductVariant[];
  specs?: { label: string; value: string }[];
  /** Filterbare eigenschappen uit de feed (glans, verfsoort, inhoud, …). */
  attributes?: Record<string, string>;
  tags?: string[];
  /** Productfoto uit de feed; ontbreekt die, dan tonen we het icoon. */
  image?: string;
  inStock?: boolean;
  /**
   * Reden waarom dit artikel in géén enkele maat bezorgd kan worden — een
   * kruiwagen, een zak strooizout van 25 kg. Alleen gezet als élke maat
   * afvalt; verschilt het per maat, dan staat het bij de variant.
   */
  pickupOnly?: string;
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
  /**
   * Aantal artikelen in de rubriek. Navigatie gebruikt dit om te bepalen wat
   * er getoond wordt: de kassa-indeling kent leveranciersbakjes van één of
   * twee artikelen ("Anza", "Fitex non paint") die geen rubriek zijn.
   */
  count: number;
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
  /** Gezet als dit artikel in deze maat alleen afgehaald kan worden. */
  pickupOnly?: string;
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
  /** Bedrijfsnaam; vereist voor betalen op rekening (Billie), verder optioneel. */
  company?: string;
  /** Zakelijke gegevens; alleen gevuld bij zakelijk bestellen. */
  kvk?: string;
  btw?: string;
  bedrijfsType?: string;
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
  /**
   * Afgerekend met ProfPas (10%, altijd gratis bezorgd).
   *
   * Staat los van `kluspasNumber`: een ProfPas-houder telt intern ook als
   * pashouder, maar spaart géén kluspunten. Zonder dit veld kon de
   * bevestigingsmail dat verschil niet zien.
   */
  profpas?: boolean;
  /** Verzilverde staal-voucher: code en korting (euro's) op deze bestelling. */
  voucherCode?: string;
  voucherKorting?: number;
  /**
   * Voucher die deze bestelling heeft opgeleverd (kleurtesters): code en
   * waarde in euro's. Gezet zodra de betaling binnen is; de mail met de code
   * gaat in dezelfde stap de deur uit.
   */
  staalVoucher?: { code: string; bedrag: number };
  /** Wanneer de orderbevestiging is verstuurd; voorkomt een tweede mail. */
  confirmationSentAt?: string;
  /** Wanneer de verzendmail is verstuurd; het dashboard mag opnieuw aankloppen. */
  shippedMailSentAt?: string;
  /**
   * Wanneer de annuleringsmail is verstuurd. Bewust pas gezet ná een
   * geslaagde mail: het dashboard mag de webhook herhalen tot dit stempel er
   * staat, en de klant hoort het nieuws precies één keer.
   */
  canceledMailSentAt?: string;
  /** Reden zoals het dashboard die meegaf bij de annulering. */
  cancelReason?: string;
  /** Wat de Kluspas op deze bestelling scheelde (euro's). */
  kluspasSavings?: number;
  isTest?: boolean;
  channel?: "web" | "pos";
  /**
   * Welke webshop deze bestelling heeft aangemaakt: "vdm" of "klusr".
   *
   * Het dashboard rapporteert sinds 4 augustus 2026 per shop en leidde dat tot
   * nu toe af uit de checkout-URL. Dat werkt, maar het is raden op iets wat wij
   * gewoon weten; met dit veld erbij hoeft daar niet meer naar gekeken te
   * worden.
   */
  site?: "vdm" | "klusr";
  refundedAmount?: number;
  molliePaymentId?: string;
  shipment?: { trackTrace?: string };
  // VDM-extra's voor bezorgen/afhalen:
  fulfilment: "pickup" | "delivery";
  /** Alleen bij afhalen. */
  store?: { id: string; name: string; city: string };
  pickupCode?: string;
  readyForPickupAt?: string;
  /**
   * Wanneer de "je bestelling ligt klaar"-mail is verstuurd.
   *
   * Zelfde rol als `shippedMailSentAt`: het dashboard mag de webhook herhalen
   * tot dit stempel er staat, en de klant hoort het precies één keer.
   */
  readyMailSentAt?: string;
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
  /** Particulier of zakelijk; bepaalt welke kortingsgronden gelden. */
  klantType?: "particulier" | "zakelijk";
  /** Particulier: maak bij deze bestelling een account aan → directe korting. */
  accountAanmaken?: boolean;
  /** Zakelijk: Profpas aanvragen → korting, mits VIES het BTW-nummer bevestigt. */
  profpas?: boolean;
  kvk?: string;
  btw?: string;
  bedrijfsType?: string;
  customer: {
    firstName: string;
    lastName: string;
    /** Bedrijfsnaam; nodig om op rekening (Billie) te kunnen betalen. */
    company?: string;
    email: string;
    phone: string;
    street?: string;
    houseNumber?: string;
    houseNumberSuffix?: string;
    postalCode?: string;
    city?: string;
    /** "NL" of "BE"; bepaalt de verzendkosten. */
    country?: string;
  };
  /**
   * Factuuradres, als dat afwijkt van het bezorgadres.
   *
   * Bepaalt niet waar de doos heen gaat maar op wiens naam de factuur staat —
   * bij een bouwbedrijf zelden hetzelfde adres. Ontbreekt het, dan is het
   * bezorgadres ook het factuuradres.
   *
   * Staat er los van `customer` omdat een AFHAALbestelling geen bezorgadres
   * heeft maar wel een factuur kan vragen; die had voorheen helemaal geen
   * adres om op te zetten.
   */
  billing?: Adres;
  fulfilment: "pickup" | "delivery";
  storeId?: string;
  /** Mollie-id van de gekozen betaalmethode ("ideal", "klarna", …). */
  betaalmethode?: string;
  /**
   * Kiest de klant voor bezorging vandaag, tegen toeslag? De server
   * controleert of dat op dat moment ook echt kan — een klant die dit
   * meestuurt na de cutoff of zonder voorraad in Nijverdal krijgt gewoon de
   * standaardbelofte, en betaalt de toeslag dan ook niet.
   */
  sameDay?: boolean;
  /** Optioneel Kluspas-nummer; levert 5% korting op het hele mandje. */
  kluspasNumber?: string;
  /** Staal-vouchercode ("STAAL-AB12CD"); de server beoordeelt geldigheid. */
  voucherCode?: string;
  items: CheckoutItemInput[];
}
