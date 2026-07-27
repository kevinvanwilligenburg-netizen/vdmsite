import { demoStores } from "@/lib/stores";
import { getProducts } from "@/lib/tilroy";

/**
 * Redirects van de huidige (Tilroy-)site naar de nieuwe.
 *
 * Bij de overgang moet elke bestaande URL blijven werken, anders verliezen we
 * de posities in Google en lopen bezoekers tegen een 404. De productfeed
 * levert per artikel de huidige URL (`link`), dus die mapping is exact. De
 * vaste pagina's staan hieronder.
 *
 * Alles komt binnen via de catch-all in app/[...pad]/page.tsx en antwoordt
 * met een permanente redirect (308), die Google net als een 301 verwerkt.
 */

/** Vaste paden van de huidige site → nieuwe pagina. */
const STATIC_REDIRECTS: Record<string, string> = {
  "/nl": "/",
  "/nl/home": "/",
  "/nl/winkels": "/winkels",
  "/winkels": "/winkels",
  "/nl/content/kluspas": "/klantenservice",
  "/nl/content/wie-zijn-wij": "/klantenservice",
  "/nl/content/veelgestelde-vragen": "/klantenservice",
  "/nl/content/bestellen-en-betalen": "/klantenservice",
  "/nl/content/bezorgopties-en-verzendkosten": "/bezorgen-en-afhalen",
  "/nl/content/garantie-retourneren": "/bezorgen-en-afhalen",
  "/nl/content/algemene-voorwaarden": "/algemene-voorwaarden",
  "/nl/content/privacy-en-cookieverklaring": "/privacy",
  "/nl/content/privacy": "/privacy",
  "/nl/kleurenkiezer": "/kleurkiezer",
  "/nl/kleurkiezer": "/kleurkiezer",
  "/nl/contact": "/klantenservice",
  "/nl/klantenservice": "/klantenservice",
};

/** Categorieën uit het oude menu → nieuwe categoriepagina's. */
const CATEGORY_REDIRECTS: Record<string, string> = {
  verf: "/categorie/verf",
  verfbenodigdheden: "/categorie/verfbenodigdheden",
  bouw: "/categorie/lijm-en-kit",
  gereedschap: "/categorie/gereedschap",
  elektra: "/categorie/elektra",
  behang: "/categorie/verfbenodigdheden",
  vloer: "/categorie/verf",
  "auto-aanhang": "/categorie/auto-en-tuin",
  reinigen: "/categorie/huishouden",
};

function normalize(path: string): string {
  const lower = `/${path}`.replace(/\/+/g, "/").toLowerCase().replace(/\/+$/, "");
  return lower === "" ? "/" : lower;
}

/**
 * Bepaal waarheen een oud pad moet wijzen. `null` = geen match (404).
 * De volgorde is: vaste pagina's → winkels → producten → categorieën.
 */
export async function resolveLegacyPath(segments: string[]): Promise<string | null> {
  const path = normalize(segments.join("/"));

  const fixed = STATIC_REDIRECTS[path];
  if (fixed) return fixed;

  // Winkelpagina's: /nl/shop/de-voordeelmarkt-nijverdal/7827 of /shop/…
  const shopMatch = path.match(/^(?:\/nl)?\/shop\/([a-z0-9-]+)(?:\/(\d+))?$/);
  if (shopMatch) {
    const [, slug, tilroyId] = shopMatch;
    const store =
      demoStores.find((entry) => entry.tilroyShopId === tilroyId) ??
      demoStores.find((entry) => slug.includes(entry.slug));
    return store ? `/winkels/${store.slug}` : "/winkels";
  }

  // Productpagina's: exacte match op de link uit de feed.
  const products = await getProducts();
  const exact = products.find((product) => product.legacyPath === path);
  if (exact) return `/product/${exact.slug}`;

  // Zelfde artikel, ander taalpad of losse trailing-varianten: match op het
  // artikelnummer achteraan (bv. …-1000021).
  const idMatch = path.match(/-(\d{4,})$/);
  if (idMatch) {
    const suffix = `-${idMatch[1]}`;
    const byId = products.find((product) => product.legacyPath?.endsWith(suffix));
    if (byId) return `/product/${byId.slug}`;
  }

  // Categorie uit het oude menu.
  const categoryMatch = path.match(/^(?:\/nl)?\/([a-z0-9-]+)$/);
  if (categoryMatch) {
    const target = CATEGORY_REDIRECTS[categoryMatch[1]];
    if (target) return target;
  }

  // Onbekende /nl/-pagina: stuur naar de homepage in plaats van een 404,
  // zodat er geen bezoeker verdwaalt bij de overgang.
  if (path.startsWith("/nl/") || path === "/nl") return "/";

  return null;
}
