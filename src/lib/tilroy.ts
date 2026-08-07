import { demoCategories, demoProducts, demoStockFor } from "@/lib/catalog";
import { hardloperScore } from "@/lib/facets";
import { isEchtMerk, merknaam } from "@/lib/merken";
import { categorieenUit, loadFeedProducts } from "@/lib/product-feed";
import { toonbareRubriek } from "@/lib/rubrieken";
import { scoreProducts, suggestTerms } from "@/lib/search";
import { noteerMagereHit, zoekregels } from "@/lib/zoekregels";
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

/**
 * Zoek het product bij een sku, ook als die van een variant is.
 *
 * De winkelwagen en de checkout praten in sku's, niet in product-id's; om te
 * weten van welk merk een regel is (bijvoorbeeld voor de franco-afspraak met
 * Sikkens) moeten we die kant op kunnen zoeken.
 */
export async function getProductBySku(sku: string): Promise<Product | undefined> {
  const gezocht = sku.trim();
  if (!gezocht) return undefined;
  const products = await getProducts();
  return products.find(
    (product) =>
      product.sku === gezocht ||
      product.id === gezocht ||
      (product.variants ?? []).some(
        // Ook de fabriekswit-sku telt: de winkelwagenregel van "100% Wit"
        // draagt díé sku, en wie hem hier niet vindt kent het merk niet —
        // waardoor Sikkens-wit zijn franco-verzending kwijtraakte.
        (variant) => variant.sku === gezocht || variant.wit?.sku === gezocht,
      ),
  );
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.category === categorySlug);
}

export async function getCategories(): Promise<Category[]> {
  const products = await loadFeedProducts();
  if (products.length === 0) return demoCategories;
  // De categorieën komen uit de producten, dus per definitie alleen de
  // rubrieken waar ook echt iets in zit.
  return categorieenUit(products);
}

/**
 * Ondergrens voor een rubriek in de navigatie.
 *
 * De kassa-indeling kent bakjes die per leverancier zijn aangemaakt en geen
 * assortimentsgroep zijn: "Anza" (3 artikelen), "Fitex non paint" (1),
 * "Alabastine toebehoren" (7), "Postnl" (1). Op naam uitsluiten werkt één keer
 * en verloopt daarna — er komt volgend jaar een nieuwe leverancier bij en
 * niemand houdt zo'n lijst bij. Een ondergrens vangt ze structureel.
 *
 * Gemeten op de hele catalogus (6.132 artikelen): 33 rubrieken vallen onder de
 * acht, samen 89 artikelen. Anderhalf procent van het assortiment, en geen
 * ervan is een groep waar een klant op zou zoeken.
 */
const MIN_ARTIKELEN_IN_NAVIGATIE = 8;

/**
 * Rubrieken die groot genoeg zijn maar toch geen rubriek. Op naam, want de
 * slug is sinds de hoofdgroepen een code (g13) en codes onthouden niemand:
 *
 * - "Euromat" (37) is een leveranciersnaam; een klant zoekt op dekzeil.
 * - "Diversen" (8) en "Toebehoren" (13) zeggen niets over wat erin ligt.
 * - "Verf" (code 1, 34 artikelen) is een oud restgroepje NAAST de echte
 *   groep "Verf en Beits" (code 1000, 1.891); twee keer verf in het menu is
 *   verwarring zonder winst.
 *
 * De artikelen blijven in de webshop staan en op /categorieen vindbaar — er
 * staat alleen geen wegwijzer in menu en footer naartoe.
 */
function rubriekNaamSleutel(category: Category): string {
  return category.name.trim().toLocaleLowerCase("nl");
}

/**
 * Hoort deze rubriek in navigatie en op merkpagina's?
 *
 * De lijst zelf staat in lib/rubrieken, zodat ook de catalogusopbouw en
 * client-componenten hem kunnen gebruiken zonder de Redis-client mee te
 * slepen. Eén Sikkens-artikel staat in Tilroy nog in het restgroepje "Verf"
 * (code 1); zonder deze regel kreeg de merkpagina een knop "Verf 1" naast
 * "Verf en Beits 59" — twee knoppen die hetzelfde beloven, waarvan er één
 * bijna leeg is.
 */
export { toonbareRubriek };

/**
 * De rubrieken die in menu en footer horen: groot genoeg om een rubriek te
 * zijn, en de grootste eerst. `getCategories()` blijft compleet — een klant
 * die op /categorie/anza belandt krijgt gewoon zijn pagina, we zetten er
 * alleen geen wegwijzer meer naartoe.
 */
export async function getNavCategories(limit = 12): Promise<Category[]> {
  const categories = await getCategories();
  const groot = categories.filter(
    (category) =>
      category.count >= MIN_ARTIKELEN_IN_NAVIGATIE &&
      toonbareRubriek(category.slug) &&
      toonbareRubriek(rubriekNaamSleutel(category)),
  );
  // Valt alles onder de grens (demo-catalogus, lege feed), dan liever de
  // volledige lijst dan een leeg menu.
  const bron = groot.length > 0 ? groot : categories;
  // Tilroy kent "Gereedschap" twee keer (code 5 én 8000). Twee gelijknamige
  // knoppen in het menu zijn een raadsel voor de klant; de grootste wint, de
  // kleine blijft via /categorieen bereikbaar.
  const opNaam = new Map<string, Category>();
  for (const category of [...bron].sort((a, b) => b.count - a.count)) {
    const sleutel = rubriekNaamSleutel(category);
    if (!opNaam.has(sleutel)) opNaam.set(sleutel, category);
  }
  return [...opNaam.values()].slice(0, limit);
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug);
}

/* ── Menu-inhoud ───────────────────────────────────────────────── */

export interface MenuEntry {
  label: string;
  href: string;
  count: number;
}

export interface MenuCategory extends Category {
  /** Zit er mengverf in deze rubriek? Dan heeft de kleurkiezer nut. */
  mengverf: boolean;
  /** Soorten binnen de categorie ("Lakken", "Muurverf"). */
  soorten: MenuEntry[];
  /** De merken met de meeste artikelen in deze categorie. */
  merken: MenuEntry[];
}

/**
 * De inhoud van het hoofdmenu, afgeleid uit de catalogus.
 *
 * Een balk met alleen negen categorieën zegt een klant weinig: die wil zien
 * dát er lakken, muurverf en beits zijn, en van welke merken. Deze functie
 * levert per categorie de soorten en de grootste merken, zodat het menu
 * meegroeit met het assortiment in plaats van handmatig bijgehouden te
 * worden.
 */
export async function getMenu(): Promise<MenuCategory[]> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  // Ook het uitklapmenu ("Alle categorieën") is een wegwijzer, en daar hoort
  // een leveranciersnaam niet in: "Euromat 3" naast "Verf en Beits 1.891"
  // belooft een rubriek die geen rubriek is. De artikelen blijven gewoon
  // vindbaar via zoeken en /categorieen.
  const bruikbaar = categories.filter(
    (category) => toonbareRubriek(category.name) && toonbareRubriek(category.slug),
  );

  // Tilroy kent "Gereedschap" twee keer (code 5 met 12 artikelen én 8000 met
  // 195). Twee identieke knoppen onder elkaar is een raadsel voor de klant;
  // de grootste wint, net als in de menubalk. Het kleine groepje blijft
  // bereikbaar via /categorieen.
  const perNaam = new Map<string, Category>();
  for (const category of [...bruikbaar].sort((a, b) => b.count - a.count)) {
    const sleutel = rubriekNaamSleutel(category);
    if (!perNaam.has(sleutel)) perNaam.set(sleutel, category);
  }

  return [...perNaam.values()]
    .sort((a, b) => b.count - a.count)
    .map((category) => {
    const inCategory = products.filter((product) => product.category === category.slug);

    const soortCounts = new Map<string, number>();
    const merkCounts = new Map<string, number>();
    for (const product of inCategory) {
      // Een artikel kan in twee rubrieken horen (een parketlak is vernis én
      // lak); die staan als "A|B" in het kenmerk, net als bij de andere
      // filters. Allebei apart tellen, anders komt "Vernis|Lakken" als één
      // onleesbare knop in het menu.
      for (const soort of (product.attributes?.subcategorie ?? "")
        .split("|")
        .map((waarde) => waarde.trim())
        .filter(Boolean)) {
        soortCounts.set(soort, (soortCounts.get(soort) ?? 0) + 1);
      }
      if (isEchtMerk(product.brand)) {
        const naam = merknaam(product.brand!);
        merkCounts.set(naam, (merkCounts.get(naam) ?? 0) + 1);
      }
    }

    const soorten = [...soortCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({
        label,
        count,
        href: `/categorie/${category.slug}?subcategorie=${encodeURIComponent(label)}`,
      }));

    const merken = [...merkCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count, href: `/merk/${brandSlug(label)}` }));

    return {
      ...category,
      count: inCategory.length,
      mengverf: inCategory.some((product) => product.colorMixable),
      soorten,
      merken,
    };
  });
}

/**
 * Aanbiedingen voor de homepage: hoogste voordeel eerst.
 *
 * Met een cap van twee per merk. Puur op kortingspercentage stonden er drie
 * spaarlampen van hetzelfde merk bovenaan de homepage van een verfzaak — dat
 * is geen etalage, dat is een toevalstreffer van de kassa.
 */
export async function getDeals(limit = 8): Promise<Product[]> {
  const products = await getProducts();
  const gesorteerd = products
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
    );

  const perMerk = new Map<string, number>();
  const gekozen: Product[] = [];
  for (const product of gesorteerd) {
    const merk = (product.brand ?? "").toLowerCase();
    const aantal = perMerk.get(merk) ?? 0;
    if (aantal >= 2) continue;
    perMerk.set(merk, aantal + 1);
    gekozen.push(product);
    if (gekozen.length >= limit) break;
  }
  // Zijn er te weinig merken voor een gevulde rij, dan vullen we aan met de
  // rest: een halve rij ziet er kapot uit.
  if (gekozen.length < limit) {
    for (const product of gesorteerd) {
      if (gekozen.length >= limit) break;
      if (!gekozen.includes(product)) gekozen.push(product);
    }
  }
  return gekozen;
}

/**
 * De etalage van één merk, voor de homepage.
 *
 * Kevin over de topdeals: "willen we hier niet ook sikkens?" Sikkens staat er
 * nooit tussen, want op Sikkens zit geen korting — dat merk verkoopt op naam,
 * niet op een rode vlag. Daarom een eigen rij in plaats van een neppe deal.
 */
export async function getMerkEtalage(merk: string, limit = 4): Promise<Product[]> {
  const products = await getProducts();
  const naam = merk.toLowerCase();
  return products
    .filter(
      (product) =>
        product.brand?.toLowerCase() === naam &&
        product.image &&
        product.inStock !== false,
    )
    .sort((a, b) => hardloperScore(b) - hardloperScore(a) || a.price - b.price)
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

  if (!isVerf) {
    // Geen verf: kijk of er een van de regels hierboven past.
    const naam = product.name;
    return NIET_VERF_REGELS.find((entry) => entry.herkent.test(naam))?.regels ?? [];
  }

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

/**
 * Wat er buiten de verf bij hoort.
 *
 * Het blok "hier heb je dit ook bij nodig" kende alleen verfregels, dus bleef
 * het leeg op elke andere pagina — bij een werklamp, een schroef of een
 * rookmelder stond er niets. Deze regels zijn geen gokwerk op basis van
 * verkoopdata die we niet hebben; het is wat er in de winkel ook naast ligt.
 */
const NIET_VERF_REGELS: { herkent: RegExp; regels: CompanionRule[] }[] = [
  {
    herkent: /werklamp|bouwlamp|zaklamp|koplamp|lamp\b/i,
    regels: [
      { needles: ["batterij"], reason: "Zodat hij het meteen doet" },
      { needles: ["verlengkabel", "haspel"], reason: "Stroom tot waar je werkt" },
    ],
  },
  {
    herkent: /rookmelder|koolmonoxide|melder/i,
    regels: [{ needles: ["batterij"], reason: "Vervangen bij het ophangen" }],
  },
  {
    herkent: /schroef|bout|plug|anker/i,
    regels: [
      { needles: ["boor", "steenboor", "houtboor"], reason: "Het juiste gat vooraf" },
      { needles: ["bit", "schroefbit"], reason: "Past op je schroevendraaier" },
    ],
  },
  {
    herkent: /kit\b|kitten|siliconen|acrylaat/i,
    regels: [
      { needles: ["kitpistool"], reason: "Zonder pistool krijg je het er niet uit" },
      { needles: ["kitstrip", "afwerkset", "voegspaan"], reason: "Voor een strakke naad" },
    ],
  },
  {
    herkent: /behang|vlies|glasweefsel/i,
    regels: [
      { needles: ["behanglijm", "behangplaksel"], reason: "Hoort erbij" },
      { needles: ["behangkwast", "behangborstel", "naadroller"], reason: "Strak aandrukken" },
      { needles: ["afbreekmes", "stanleymes"], reason: "Netjes bijsnijden" },
    ],
  },
  {
    herkent: /laminaat|vinyl|ondervloer/i,
    regels: [
      { needles: ["ondervloer"], reason: "Onder de vloer, tegen geluid" },
      { needles: ["plint"], reason: "De rand netjes afwerken" },
      { needles: ["legset", "kliktang"], reason: "Handig bij het leggen" },
    ],
  },
];

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
  const anders = products.filter((candidate) => candidate.id !== product.id);
  const opVoorraad = (candidate: Product) => candidate.inStock !== false;

  /*
   * In lagen zoeken, van meest naar minst verwant.
   *
   * De eerste versie eiste categorie én foto in één keer. Dat werkte zolang
   * er tien grote categorieën waren; sinds de indeling van Tilroy wordt
   * gevolgd zijn de rubrieken kleiner, en van 3.400 producten hebben er ruim
   * 900 geen foto. Bij een werklamp in "Overig electra" bleef er dan niets
   * over en verdween het blok helemaal — precies op de pagina's waar een
   * suggestie het meeste helpt.
   */
  const lagen: ((candidate: Product) => boolean)[] = [
    (c) => c.category === product.category && c.brand === product.brand && !!c.image && opVoorraad(c),
    (c) => c.category === product.category && !!c.image && opVoorraad(c),
    (c) => c.brand === product.brand && !!c.image && opVoorraad(c),
    (c) => c.category === product.category && opVoorraad(c),
    (c) => c.category === product.category,
  ];

  const gekozen: Product[] = [];
  for (const laag of lagen) {
    if (gekozen.length >= limit) break;
    for (const candidate of anders.filter(laag)) {
      if (gekozen.length >= limit) break;
      if (!gekozen.some((entry) => entry.id === candidate.id)) gekozen.push(candidate);
    }
  }
  return gekozen;
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

export { isEchtMerk, merknaam };

export function brandSlug(name: string): string {
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
  /** Foto van een artikel van dit merk, als beeld op de merkenpagina. */
  image?: string;
}

export interface BrandPage extends BrandSummary {
  products: Product[];
}

/** Merken met de meeste artikelen eerst. */
export async function getBrands(
  limit = 40,
  options: { categorySlug?: string } = {},
): Promise<BrandSummary[]> {
  const products = await getProducts();
  const bron = options.categorySlug
    ? products.filter((product) => product.category === options.categorySlug)
    : products;

  const byBrand = new Map<string, { name: string; items: Product[] }>();
  for (const product of bron) {
    if (!isEchtMerk(product.brand)) continue;
    const slug = brandSlug(product.brand!);
    if (!slug) continue;
    const entry = byBrand.get(slug);
    if (entry) entry.items.push(product);
    else byBrand.set(slug, { name: merknaam(product.brand!), items: [product] });
  }
  return [...byBrand.entries()]
    .map(([slug, entry]) => ({
      slug,
      name: entry.name,
      count: entry.items.length,
      fromPrice: Math.min(...entry.items.map((item) => item.price)),
      // Een merklogo hebben we niet; een productfoto uit het merk geeft de
      // kaart toch een gezicht.
      image: entry.items.find((item) => item.image)?.image,
    }))
    .filter((brand) => brand.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getBrand(slug: string): Promise<BrandPage | null> {
  const products = await getProducts();
  const items = products.filter(
    (product) => isEchtMerk(product.brand) && brandSlug(product.brand) === slug,
  );
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => {
    const aScore = (a.image ? 2 : 0) + (a.inStock !== false ? 1 : 0);
    const bScore = (b.image ? 2 : 0) + (b.inStock !== false ? 1 : 0);
    return bScore - aScore || a.price - b.price;
  });
  return {
    slug,
    name: merknaam(items[0].brand),
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
  /*
   * Curatie ophalen voor déze zoekterm. De regels staan op de hele zoekzin
   * (kleine letters), niet per woord: Kevin cureert "witte muurverf" als
   * geheel, of "muurverf" — niet "witte".
   */
  const regels = await zoekregels();
  const regel = regels.get(query.trim().toLowerCase());
  const hits = scoreProducts(products, query, regel);

  /*
   * Zoekopdrachten met weinig of geen resultaten onthouden. Niet afgewacht:
   * de klant hoort niet te wachten op onze administratie. Zie
   * lib/zoekregels.ts voor waarom dit de enige plek is waar dit kan.
   */
  void noteerMagereHit(query, hits.length);

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
 * deur uit en valt onder de strakke cutoff (vóór 09:00 = vandaag bezorgd).
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
  /** "live" of "snapshot" — snapshot is de nachtstand van ~05:00. */
  bron?: string;
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
    // De hub hoort sinds de KV-cache + crawlslot (dashboard-PR #378) altijd
    // "live" te serveren; valt hij terug op de nachtstand, dan willen we dat
    // in de logs zien vóór een klant het aan de kassa merkt.
    if (data.bron === "snapshot") {
      console.warn("[voorraad] hub serveert snapshot (nachtstand) in plaats van live voorraad");
    }
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
   * Voorraad die met DHL onder de 09:00-cutoff verstuurd kan worden: dat is
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

/**
 * Voorraad per sku, in ÉÉN aanvraag naar de hub.
 *
 * De checkout vroeg de voorraad per orderregel apart op, ná elkaar — bij vijf
 * artikelen en een koude hub telde dat op tot de "je wordt doorgestuurd…"
 * die maar bleef staan waar Kevin op stuitte. Zelfde gegevens, één rit.
 */
export async function getStockPerSku(
  skus: string[],
  /**
   * Hoe lang we op de hub willen wachten. De koude start van de hub duurt
   * gemeten 40 seconden; een klant die wil afrekenen laten we hooguit deze
   * tijd staan en krijgt daarna de voorzichtige belofte (binnen 1 werkdag,
   * geen spoedoptie) in plaats van een hangende knop.
   */
  maxWachtMs?: number,
): Promise<Map<string, { webshopQty: number; otherStoresQty: number }> | null> {
  const uniek = [...new Set(skus.filter(Boolean))];
  const hubBelofte = fetchHubStock(uniek);
  const begrensd = maxWachtMs
    ? Promise.race([
        hubBelofte,
        new Promise<null>((klaar) => setTimeout(() => klaar(null), maxWachtMs)),
      ])
    : hubBelofte;
  const [stores, hub] = await Promise.all([getStores(), begrensd]);
  if (!hub) return null;

  const winkelShopIds = stores
    .map((store) => store.tilroyShopId)
    .filter((id): id is string => Boolean(id) && id !== TEST_SHOP_ID);

  const kaart = new Map<string, { webshopQty: number; otherStoresQty: number }>();
  for (const item of hub.items) {
    const sku = String(item.sku ?? "");
    if (!sku) continue;
    const qtyVoor = (shopId: string) => {
      const qty = item.shops?.[shopId];
      return Number.isFinite(qty) ? (qty as number) : 0;
    };
    const webshopQty = qtyVoor(NIJVERDAL_SHOP_ID) + qtyVoor(WAREHOUSE_SHOP_ID);
    const otherStoresQty = winkelShopIds
      .filter((id) => id !== NIJVERDAL_SHOP_ID && id !== WAREHOUSE_SHOP_ID)
      .reduce((totaal, id) => totaal + qtyVoor(id), 0);
    kaart.set(sku, { webshopQty, otherStoresQty });
  }
  return kaart;
}
