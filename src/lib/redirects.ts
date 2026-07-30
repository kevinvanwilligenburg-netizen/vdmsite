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

/**
 * De categorieën van de webshop volgen sinds 30 juli 2026 de indeling van
 * Tilroy in plaats van tien zelfbedachte bakken. Deze tien slugs hebben
 * bestaan; ze wijzen naar de rubriek die er het dichtst bij komt, zodat
 * gedeelde links en al geïndexeerde pagina's blijven werken.
 */
const OUDE_CATEGORIEEN: Record<string, string> = {
  "/categorie/verf": "/categorie/lakken",
  "/categorie/verfbenodigdheden": "/categorie/schildersger-en-schuurpapier",
  "/categorie/lijm-en-kit": "/categorie/lijmen-kitten-en-vulmiddelen",
  "/categorie/bevestiging": "/categorie/bevestigingsmaterialen",
  "/categorie/gereedschap": "/categorie/handgereedschap",
  "/categorie/vloeren": "/categorie/laminaat",
  "/categorie/elektra": "/categorie/lichtbronnen-en-zaklampen",
  "/categorie/huishouden": "/categorie/huishoudelijk",
  "/categorie/auto-en-tuin": "/categorie/auto-accessoires",
  "/categorie/overig": "/",
};

/** Vaste paden van de huidige site → nieuwe pagina. */
const STATIC_REDIRECTS: Record<string, string> = {
  ...OUDE_CATEGORIEEN,
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

  // Productpagina's: exacte match op een van de URL's uit de feed.
  const products = await getProducts();
  const exact = products.find((product) => product.legacyPaths?.includes(path));
  if (exact) return `/product/${exact.slug}`;

  // Zelfde artikel via een ander taalpad of met een suffix: match op het
  // artikelnummer achteraan (bv. …-1000021).
  const idMatch = path.match(/-(\d{4,})(?:[/?].*)?$/);
  if (idMatch) {
    const suffix = `-${idMatch[1]}`;
    const byId = products.find((product) =>
      product.legacyPaths?.some((legacy) => legacy.endsWith(suffix)),
    );
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
