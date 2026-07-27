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

/** Zet de varianten van één group_id om in één Product. */
function buildProduct(group: FeedItem[]): Product | null {
  const leader = group.find((item) => item.group_leader === "true") ?? group[0];
  if (!leader?.title) return null;

  const sorted = [...group].sort(
    (a, b) => Number(a.inhoud_liter ?? 0) - Number(b.inhoud_liter ?? 0),
  );

  const variants: ProductVariant[] = sorted
    .filter((item) => item.maat)
    .map((item) => ({
      id: item.id,
      name: item.maat,
      price: toCents(item.sale_price ?? item.price),
      sku: item.id,
    }));

  const prices = (variants.length > 0 ? variants.map((v) => v.price) : [toCents(leader.sale_price)])
    .filter((price) => price > 0);
  if (prices.length === 0) return null;
  const price = Math.min(...prices);
  const compareAtPrice = toCents(leader.price);

  const groupId = (leader.group_id ?? leader.id).replace(/^g:/, "");
  const name = leader.title;
  const inStock = group.some((item) => Number(item.voorraad ?? 0) > 0);

  return {
    id: groupId,
    slug: `${slugify(name)}-${groupId}`,
    name,
    brand: leader.brand || "De Voordeelmarkt",
    sku: leader.id,
    category: categorySlugFor(leader.categories ?? ""),
    shortDescription:
      leader.description && leader.description !== name
        ? leader.description
        : `${name} — voordelig online bestellen bij De Voordeelmarkt.`,
    description:
      [leader.description, leader.toepassing, leader.ondergrond]
        .filter(Boolean)
        .join(" ") || name,
    price,
    compareAtPrice: compareAtPrice > price ? compareAtPrice : undefined,
    unit: leader.maat_range || leader.maat || undefined,
    colorMixable: leader.mengverf === "Ja",
    variants: variants.length > 1 ? variants : undefined,
    specs: buildSpecs(leader),
    tags: (leader.zoektermen ?? "").split(/\s+/).filter(Boolean).slice(0, 24),
    image: leader.image_link || undefined,
    inStock,
    art: { icon: leader.mengverf === "Ja" ? "palette" : "bucket", hue: 25 },
  };
}

/* ── Publieke API ──────────────────────────────────────────────── */

let cache: { at: number; products: Product[] } | null = null;
let inflight: Promise<Product[]> | null = null;

async function fetchFeed(): Promise<Product[]> {
  const res = await fetch(FEED_URL, {
    signal: AbortSignal.timeout(45000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Productfeed gaf status ${res.status}`);
  const xml = await res.text();
  const items = parseItems(xml);

  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    const key = item.group_id ?? item.id;
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

/** Alle producten uit de feed. Leeg bij storing (aanroeper valt dan terug). */
export async function loadFeedProducts(): Promise<Product[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.products;
  if (inflight) return inflight;

  inflight = fetchFeed()
    .then((products) => {
      cache = { at: Date.now(), products };
      return products;
    })
    .catch((error) => {
      console.error("[catalogus] productfeed niet beschikbaar:", error);
      return cache?.products ?? [];
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
