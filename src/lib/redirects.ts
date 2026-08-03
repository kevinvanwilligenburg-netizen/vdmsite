import { findRalBySlug, ralSlug } from "@/lib/kleurpaginas";
import { demoStores } from "@/lib/stores";
import { getCategories, getProducts } from "@/lib/tilroy";

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

/**
 * Oude categorie- en menupaden → een ZOEKTERM, niet een vast pad.
 *
 * Hier stond een tabel met doelen als `/categorie/lakken`. Die rot: sinds de
 * feed op Tilroy-groepscodes overging (`g1000`) bestaat geen van die slugs
 * nog, en stuurden acht van de negen menupaden naar een 404. Een term
 * overleeft dat wél, want die zoeken we op in de rubrieken die er nú zijn.
 */
const OUDE_CATEGORIE_TERMEN: Record<string, string> = {
  verf: "verf en beits",
  verfbenodigdheden: "verfbenodigdheden",
  bouw: "lijmen, kitten en vulmiddelen",
  "lijm-en-kit": "lijmen, kitten en vulmiddelen",
  bevestiging: "ijzerwaren",
  gereedschap: "gereedschap",
  elektra: "elektra",
  behang: "behang",
  vloer: "vloeren",
  vloeren: "vloeren",
  "auto-aanhang": "auto",
  "auto-en-tuin": "auto",
  reinigen: "schoonmaak",
  huishouden: "schoonmaak",
};

/** Themapagina's van de oude site die nu een gids zijn. */
const GIDS_TREFWOORDEN: [RegExp, string][] = [
  [/buiten|gevel|schutting|tuinhuis/, "beste-buitenverf"],
  [/kozijn|deur|raamhout/, "beste-kozijnlak"],
  [/beits|hout-?beits/, "beste-beits"],
  [/grondverf|primer|voorstrijk/, "beste-grondverf"],
  [/muurverf|muur|plafond|latex/, "beste-muurverf"],
];

/** "kwasten-kopen", "verf-online-kopen" → "kwasten", "verf". */
function zoektermUit(segment: string): string {
  return segment
    .replace(/-?online-?/g, "-")
    .replace(/-?kopen$/, "")
    .replace(/^verf-/, "")
    .replace(/-+/g, " ")
    .trim();
}

function vereenvoudig(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const VULWOORDEN = new Set(["en", "de", "het", "een", "of", "voor"]);

function woorden(tekst: string): string[] {
  return vereenvoudig(tekst)
    .split(" ")
    .filter((woord) => woord && !VULWOORDEN.has(woord));
}

/**
 * Past deze rubrieknaam bij deze zoekterm?
 *
 * Op hele woorden, niet op deelstrings. Met `includes` sloeg de rubriek
 * "Verf" aan op de term "verfbenodigheden", en belandde elke kwasten- en
 * tapepagina op de kale Verf-rubriek van 34 artikelen.
 */
function rubriekPast(naam: string, term: string): boolean {
  const naamWoorden = woorden(naam);
  const termWoorden = woorden(term);
  if (naamWoorden.length === 0 || termWoorden.length === 0) return false;
  // Alle woorden van de rubrieknaam komen als heel woord in de term voor.
  if (naamWoorden.every((woord) => termWoorden.includes(woord))) return true;
  // Of de term ís het eerste woord van de rubriek: "auto" hoort bij
  // "Auto-accessoires", maar "verfbenodigheden" niet bij "Verf".
  return termWoorden.length === 1 && naamWoorden[0] === termWoorden[0];
}

/**
 * Mogelijke enkelvouden van een meervoud, om in productnamen te zoeken.
 * Nederlands verdubbelt de medeklinker ("kit" → "kitten"), dus alleen "-en"
 * afhalen levert "kitt" op en dat staat in geen enkele productnaam.
 */
function stammen(term: string): string[] {
  const kern = vereenvoudig(term);
  const kandidaten = new Set([kern]);
  if (kern.endsWith("en")) {
    const zonder = kern.slice(0, -2);
    kandidaten.add(zonder);
    if (/(.)\1$/.test(zonder)) kandidaten.add(zonder.slice(0, -1));
  }
  if (kern.endsWith("s")) kandidaten.add(kern.slice(0, -1));
  return [...kandidaten].filter((woord) => woord.length >= 3);
}

/**
 * Oude categorie-, kleur- en themapagina's naar de pagina die er nu voor in
 * de plaats is gekomen.
 *
 * Zonder dit belandden 284 geïndexeerde pagina's — kwasten-kopen,
 * verf-ral-9010, buiten-schilderen — via het vangnet onderaan allemaal op de
 * homepage. Google leest zo'n massale omleiding naar één pagina als een
 * verkapte 404 en laat de posities vallen, terwijl de vervangers (167
 * RAL-pagina's, 20 rubrieken, 5 gidsen) gewoon bestaan.
 */
async function resolveLegacyCategory(path: string): Promise<string | null> {
  const segmenten = path.split("/").filter(Boolean);
  if (segmenten.length === 0) return null;
  const laatste = segmenten[segmenten.length - 1];

  // 1. RAL-kleur, waar in het pad hij ook staat: /nl/…/verf-ral-9010.
  const ralCode = path.match(/ral-?(\d{4})\b/)?.[1];
  if (ralCode) {
    const kleur = findRalBySlug(`ral-${ralCode}`);
    if (kleur) return `/kleuren/ral/${ralSlug(kleur)}`;
    return "/kleuren/ral";
  }
  if (/kleur(en)?-?(kiezen|kiezer|waaier)/.test(path)) return "/kleurkiezer";

  // 2. Themapagina's ("verf-klussen-buiten-schilderen") → de gids erover.
  //    Alleen bij klus-achtige paden: anders vangt "muur" ook een muurbeugel.
  if (/klussen|advies|inspiratie|schilderen|tips/.test(path)) {
    for (const [patroon, gids] of GIDS_TREFWOORDEN) {
      if (patroon.test(path)) return `/gids/${gids}`;
    }
  }

  // 3. Rubriek op naam. Eerst het laatste segment, dan het voorlaatste —
  //    "/verfbenodigheden-online-kopen/kwasten-kopen" is specifiek naar
  //    algemeen.
  const termen = segmenten
    .slice(-2)
    .reverse()
    .map((segment) => zoektermUit(segment))
    .filter(Boolean);

  const categorieen = await getCategories();
  for (const term of termen) {
    const gezocht = OUDE_CATEGORIE_TERMEN[term.replace(/ /g, "-")] ?? term;
    if (!gezocht) continue;
    // Langste naam eerst: "Lijmen, Kitten en Vulmiddelen" wint van "Lijmen".
    const treffer = [...categorieen]
      .sort((a, b) => woorden(b.name).length - woorden(a.name).length)
      .find((categorie) => rubriekPast(categorie.name, gezocht));
    if (treffer) return `/categorie/${treffer.slug}`;
  }

  // 4. Oude rubrieknaam die nu een subgroep bínnen een rubriek is.
  const producten = await getProducts();
  for (const term of termen) {
    const gezocht = vereenvoudig(term);
    if (!gezocht) continue;
    const treffer = producten.find(
      (product) => vereenvoudig(product.attributes?.subcategorie ?? "") === gezocht,
    );
    if (treffer?.attributes?.subcategorie) {
      return `/categorie/${treffer.category}?subcategorie=${encodeURIComponent(
        treffer.attributes.subcategorie,
      )}`;
    }
  }

  // 5. Geen rubriek die zo heet ("kwasten", "schilderstape"), maar het
  //    assortiment kent het woord wel. Kijk in welke rubriek die artikelen
  //    vooral zitten en stuur daarheen: een echte, indexeerbare rubriekpagina
  //    is voor Google en klant beter dan de zoekpagina (die op noindex staat).
  const term = termen[0];
  if (term && term.length >= 4) {
    let beste: [string, number] | undefined;
    for (const stam of stammen(term)) {
      const perRubriek = new Map<string, number>();
      for (const product of producten) {
        if (!vereenvoudig(product.name).includes(stam)) continue;
        perRubriek.set(product.category, (perRubriek.get(product.category) ?? 0) + 1);
      }
      const top = [...perRubriek.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && (!beste || top[1] > beste[1])) beste = top;
    }
    // Een handvol treffers kan toeval zijn; pas vanaf tien is het een rubriek.
    if (beste && beste[1] >= 10) return `/categorie/${beste[0]}`;
    if (/-kopen$/.test(laatste)) return `/zoeken?q=${encodeURIComponent(term)}`;
  }

  return null;
}

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

  // Oude categorie-, kleur- en themapagina's. Moet vóór het vangnet hieronder:
  // anders verdwijnt elke geïndexeerde /nl/-zoekpagina naar de homepage.
  const categorie = await resolveLegacyCategory(path);
  if (categorie) return categorie;

  // Onbekende /nl/-pagina: stuur naar de homepage in plaats van een 404,
  // zodat er geen bezoeker verdwaalt bij de overgang.
  if (path.startsWith("/nl/") || path === "/nl") return "/";

  return null;
}
