import { isKvEnabled, kvGetRaw, kvSetEx } from "@/lib/kv";
import { parseBase } from "@/lib/paint-bases";
import { DASHBOARD_API_URL } from "@/lib/site";
import type { Category, Product, ProductVariant } from "@/lib/types";

/**
 * Echte productcatalogus van De Voordeelmarkt, via de productfeed van het
 * VDM-dashboard (GET {DASHBOARD_API_URL}/api/doofinder/feed).
 *
 * De feed is een RSS/XML-stroom van ~5.000 varianten met per item onder meer:
 *   id, group_id, group_leader, title, description, link, image_link, brand,
 *   categories ("Verf > Muurverf"), price (advies), sale_price (onze prijs),
 *   availability, voorraad, maat, inhoud_liter, mengverf (Ja/Nee), glans,
 *   verfsoort, toepassing, ondergrond, zoektermen.
 *
 * Varianten met hetzelfde `group_id` horen bij één product (bv. 1L/2,5L/5L).
 * De feed is de bron; voorraad per winkel komt uit de voorraad-hub.
 *
 * De feed is ~6,5 MB en duurt ~13 s. Daarom: in-memory cache + Next-cache,
 * en pagina's die 'm gebruiken draaien op ISR (revalidate 1 uur).
 */

const FEED_URL = `${DASHBOARD_API_URL}/api/doofinder/feed`;
const CACHE_MS = 60 * 60 * 1000;

/* ── Categorie-indeling ────────────────────────────────────────── */

// De feed levert "Verf > <subcategorie>". Die subcategorieën bundelen we tot
// een winkelbare indeling; alles wat niet genoemd is valt onder "overig".
const CATEGORY_MAP: { slug: string; match: string[] }[] = [
  { slug: "verf", match: ["muurverf", "lakken", "speciaalverven", "beits, olie en vernis", "verdunningsmiddelen"] },
  { slug: "verfbenodigdheden", match: ["schildersger", "voorbewerken", "behang"] },
  { slug: "lijm-en-kit", match: ["lijmen, kitten", "vulmiddelen"] },
  { slug: "bevestiging", match: ["bevestigingsmateriaal", "ijzerwaren", "hang en sluitwerk"] },
  { slug: "gereedschap", match: ["handgereedschap", "elektrisch gereedschap", "acc. elektrisch"] },
  { slug: "elektra", match: ["lichtbronnen", "zaklampen", "verlengkabels", "tafelcontactdozen", "elektra"] },
  { slug: "huishouden", match: ["huishoudelijk", "reinig", "schoonmaak"] },
  { slug: "auto-en-tuin", match: ["auto", "tuin", "buiten"] },
];

export const feedCategories: Category[] = [
  {
    slug: "verf",
    name: "Verf",
    description:
      "Muurverf, lak, beits en speciaalverf voor de laagste prijs. Mengverf maken we gratis in elke gewenste kleur.",
    icon: "roller",
    hue: 25,
  },
  {
    slug: "verfbenodigdheden",
    name: "Verfbenodigdheden",
    description:
      "Kwasten, rollers, schuurpapier, afplaktape en behang: alles om je verfklus strak af te werken.",
    icon: "brush",
    hue: 45,
  },
  {
    slug: "lijm-en-kit",
    name: "Lijm, kit & vulmiddelen",
    description:
      "Kitten, lijmen, plamuur en vulmiddelen voor elke reparatie en afwerking in en om het huis.",
    icon: "can",
    hue: 200,
  },
  {
    slug: "bevestiging",
    name: "Bevestiging & ijzerwaren",
    description:
      "Schroeven, pluggen, beslag en hang- en sluitwerk. Alles om het stevig vast te zetten.",
    icon: "screw",
    hue: 220,
  },
  {
    slug: "gereedschap",
    name: "Gereedschap",
    description:
      "Hand- en elektrisch gereedschap met bijbehorende accessoires, voor elke klus in huis.",
    icon: "wrench",
    hue: 215,
  },
  {
    slug: "elektra",
    name: "Elektra & Verlichting",
    description:
      "Lichtbronnen, zaklampen, verlengkabels en contactdozen: voordelig licht en stroom waar je het nodig hebt.",
    icon: "bulb",
    hue: 265,
  },
  {
    slug: "huishouden",
    name: "Huishouden & Reinigen",
    description: "Handige huishoudartikelen en schoonmaakmiddelen voor elke dag.",
    icon: "spray",
    hue: 190,
  },
  {
    slug: "auto-en-tuin",
    name: "Auto & Tuin",
    description: "Accessoires voor auto, aanhanger, tuin en terras.",
    icon: "leaf",
    hue: 130,
  },
  {
    slug: "overig",
    name: "Overig assortiment",
    description: "Alle overige artikelen uit onze winkels.",
    icon: "box",
    hue: 210,
  },
];

function categorySlugFor(rawCategory: string): string {
  const sub = (rawCategory.split(">").pop() ?? rawCategory).trim().toLowerCase();
  for (const entry of CATEGORY_MAP) {
    if (entry.match.some((needle) => sub.includes(needle))) return entry.slug;
  }
  return "overig";
}

/* ── XML-parsing ───────────────────────────────────────────────── */

type FeedItem = Record<string, string>;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/g;
  const fieldPattern = /<([a-z_0-9]+)>([\s\S]*?)<\/\1>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(xml)) !== null) {
    const fields: FeedItem = {};
    const body = itemMatch[1];
    let fieldMatch: RegExpExecArray | null;
    fieldPattern.lastIndex = 0;
    while ((fieldMatch = fieldPattern.exec(body)) !== null) {
      fields[fieldMatch[1]] = decodeXml(fieldMatch[2]);
    }
    if (fields.id) items.push(fields);
  }
  return items;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function toCents(value: string | undefined): number {
  if (!value) return 0;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

/**
 * Pad van dit artikel op de huidige (Tilroy-)site, bv.
 * "/nl/histor-p-f-zg-leliewit-750ml-1000021". Wordt gebruikt om oude URL's
 * na de overgang naar de nieuwe productpagina te sturen.
 */
function legacyPathFrom(link: string | undefined): string | undefined {
  if (!link) return undefined;
  try {
    const path = new URL(link).pathname.toLowerCase().replace(/\/+$/, "");
    return path && path !== "/" ? path : undefined;
  } catch {
    return undefined;
  }
}

function buildSpecs(item: FeedItem): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  const add = (label: string, key: string) => {
    if (item[key]) specs.push({ label, value: item[key] });
  };
  add("Merk", "brand");
  add("Productlijn", "productlijn");
  add("Inhoud", "maat_range");
  add("Verfsoort", "verfsoort");
  add("Glans", "glans");
  add("Toepassing", "toepassing");
  add("Ondergrond", "ondergrond");
  add("Kwaliteit", "kwaliteit");
  return specs;
}

/**
 * Bepaalt welke feed-items bij één product horen.
 *
 * Normaal is dat `group_id` (dezelfde verf in 1 L / 2,5 L / 5 L). Bij mengverf
 * staan de basissen (licht/midden/donker) in de feed als afzonderlijke
 * groepen met een eigen prijs. Die voegen we samen op productlijn + glans, want
 * voor de klant is het één product: hij kiest een kleur en een inhoud, en wij
 * kiezen de basis (zie lib/paint-bases.ts).
 */
function groupKeyFor(item: FeedItem): string {
  if (item.mengverf === "Ja" && item.productlijn && parseBase(item.mengbasis)) {
    return `meng:${[item.productlijn, item.glans, item.verfsoort]
      .filter(Boolean)
      .join("|")
      .toLowerCase()}`;
  }
  return item.group_id ?? item.id;
}

/** Zet de varianten van één groep om in één Product. */
function buildProduct(group: FeedItem[]): Product | null {
  const leader = group.find((item) => item.group_leader === "true") ?? group[0];
  if (!leader?.title) return null;

  const sorted = [...group].sort(
    (a, b) => Number(a.inhoud_liter ?? 0) - Number(b.inhoud_liter ?? 0),
  );

  const variants: ProductVariant[] = sorted
    .filter((item) => item.maat)
    .map((item) => {
      const base = parseBase(item.mengbasis);
      return {
        id: item.id,
        name: item.maat,
        price: toCents(item.sale_price ?? item.price),
        sku: item.id,
        size: item.maat,
        ...(base ? { base } : {}),
      };
    });

  const prices = (variants.length > 0 ? variants.map((v) => v.price) : [toCents(leader.sale_price)])
    .filter((price) => price > 0);
  if (prices.length === 0) return null;
  const price = Math.min(...prices);
  const compareAtPrice = toCents(leader.price);
  // Kluspas-prijs uit de feed (komma-notatie, bv. "4,13").
  const kluspasPrice = toCents(leader.kluspas_prijs);

  const groupId = (leader.group_id ?? leader.id).replace(/^g:/, "");
  const inStock = group.some((item) => Number(item.voorraad ?? 0) > 0);

  // Mengverf-familie: de basissen zijn samengevoegd, dus de titel van één
  // basis-artikel ("… Lichte basis") klopt niet meer als productnaam.
  const isBaseFamily = variants.some((variant) => variant.base);
  const name = isBaseFamily ? (leader.productlijn || leader.title) : leader.title;

  return {
    id: groupId,
    slug: `${slugify(name)}-${groupId}`,
    name,
    brand: leader.brand || "De Voordeelmarkt",
    sku: leader.id,
    category: categorySlugFor(leader.categories ?? ""),
    shortDescription: isBaseFamily
      ? `${name} in elke gewenste kleur — wij mengen gratis in de juiste basis.`
      : leader.description && leader.description !== name
        ? leader.description
        : `${name} — voordelig online bestellen bij De Voordeelmarkt.`,
    description:
      [leader.description, leader.toepassing, leader.ondergrond]
        .filter(Boolean)
        .join(" ") || name,
    price,
    compareAtPrice: compareAtPrice > price ? compareAtPrice : undefined,
    kluspasPrice: kluspasPrice > 0 && kluspasPrice < price ? kluspasPrice : undefined,
    unit: leader.maat_range || leader.maat || undefined,
    colorMixable: leader.mengverf === "Ja",
    variants: variants.length > 1 ? variants : undefined,
    specs: buildSpecs(leader),
    tags: (leader.zoektermen ?? "").split(/\s+/).filter(Boolean).slice(0, 24),
    image: leader.image_link || undefined,
    inStock,
    // Elke variant heeft een eigen URL op de huidige site; die moeten
    // straks allemaal naar deze pagina wijzen.
    legacyPaths: [
      ...new Set(
        group
          .map((item) => legacyPathFrom(item.link))
          .filter((path): path is string => Boolean(path)),
      ),
    ],
    art: { icon: leader.mengverf === "Ja" ? "palette" : "bucket", hue: 25 },
  };
}

/* ── Publieke API ──────────────────────────────────────────────── */

let cache: { at: number; products: Product[] } | null = null;
let inflight: Promise<Product[]> | null = null;

/**
 * Haal de feed op, met geduld bij tijdelijke blokkades.
 *
 * De feed is ~7 MB en doet er seconden over. Tijdens een build draaien er
 * meerdere workers naast elkaar, en Vercel's bot-mitigatie beantwoordt zulke
 * herhaalde zware verzoeken soms met een 403. Dat is tijdelijk, dus we wachten
 * even en proberen het opnieuw in plaats van meteen op de demo-catalogus terug
 * te vallen.
 */
async function fetchFeedResponse(attempt = 0): Promise<Response> {
  // LET OP: geen `cache: "no-store"` hier. Dat maakt elke pagina die de
  // catalogus gebruikt dynamisch, terwijl die statisch (ISR) is gedeclareerd —
  // Next gooit dan "Page changed from static to dynamic at runtime" en de
  // pagina geeft een 500. Het echte cachen doet Redis.
  const res = await fetch(FEED_URL, {
    signal: AbortSignal.timeout(45000),
    next: { revalidate: 3600 },
  });
  const retriable = res.status === 403 || res.status === 429 || res.status >= 500;
  if (retriable && attempt < 3) {
    const wachttijd = 2000 * 2 ** attempt + Math.floor(Math.random() * 500);
    console.warn(
      `[catalogus] feed gaf ${res.status}; opnieuw proberen over ${Math.round(wachttijd / 1000)}s.`,
    );
    await new Promise((resolve) => setTimeout(resolve, wachttijd));
    return fetchFeedResponse(attempt + 1);
  }
  return res;
}

async function fetchFeed(): Promise<Product[]> {
  const res = await fetchFeedResponse();
  if (!res.ok) throw new Error(`Productfeed gaf status ${res.status}`);
  const xml = await res.text();
  const items = parseItems(xml);

  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    const key = groupKeyFor(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const products: Product[] = [];
  const seenSlugs = new Set<string>();
  for (const group of groups.values()) {
    const product = buildProduct(group);
    if (!product || seenSlugs.has(product.slug)) continue;
    seenSlugs.add(product.slug);
    products.push(product);
  }
  return products;
}

/**
 * LET OP: hoog het versienummer op zodra het Product-schema verandert (nieuw
 * veld, andere groepering). De opgeslagen catalogus blijft anders 24 uur
 * staan en mist dan het nieuwe veld — dat kostte de Kluspas-prijs een deploy.
 */
const KV_KEY = "catalog:products:v3";
/**
 * De catalogus blijft een dag houdbaar, maar wordt na een uur ververst. Zo
 * draait de winkel gewoon door als de feed even niet bereikbaar is (storing,
 * rate limit, deploy van het dashboard) in plaats van terug te vallen op de
 * schrale demo-catalogus.
 */
const KV_TTL_SECONDS = 24 * 3600;
const KV_FRESH_MS = 60 * 60 * 1000;

interface CachedCatalog {
  at: number;
  products: Product[];
}

async function readFromKv(): Promise<CachedCatalog | null> {
  if (!isKvEnabled()) return null;
  try {
    const raw = await kvGetRaw(KV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    return Array.isArray(parsed?.products) && parsed.products.length > 0 ? parsed : null;
  } catch (error) {
    console.error("[catalogus] uit KV lezen mislukt:", error);
    return null;
  }
}

async function writeToKv(products: Product[]): Promise<void> {
  if (!isKvEnabled() || products.length === 0) return;
  try {
    const payload: CachedCatalog = { at: Date.now(), products };
    await kvSetEx(KV_KEY, JSON.stringify(payload), KV_TTL_SECONDS);
  } catch (error) {
    console.error("[catalogus] naar KV schrijven mislukt:", error);
  }
}

/**
 * Alle producten. Volgorde: geheugen → Redis → feed.
 *
 * Is de opgeslagen catalogus ouder dan een uur, dan halen we de feed opnieuw
 * op; mislukt dat, dan blijven we die oudere versie gebruiken. Alleen als er
 * helemaal niets is, krijgt de aanroeper een lege lijst (en valt die terug op
 * de demo-catalogus).
 */
export async function loadFeedProducts(): Promise<Product[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.products;
  if (inflight) return inflight;

  inflight = (async () => {
    const stored = await readFromKv();
    if (stored && Date.now() - stored.at < KV_FRESH_MS) {
      cache = { at: Date.now(), products: stored.products };
      return stored.products;
    }

    try {
      const products = await fetchFeed();
      cache = { at: Date.now(), products };
      await writeToKv(products);
      return products;
    } catch (error) {
      console.error("[catalogus] productfeed niet beschikbaar:", error);
      if (stored) {
        const uren = Math.round((Date.now() - stored.at) / 3_600_000);
        console.warn(`[catalogus] terugval op opgeslagen catalogus (${uren} uur oud).`);
        cache = { at: Date.now() - CACHE_MS / 2, products: stored.products };
        return stored.products;
      }
      return cache?.products ?? [];
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
