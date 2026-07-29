import { isKvEnabled, kvGetRaw, kvSetEx } from "@/lib/kv";
import { parseBase } from "@/lib/paint-bases";
import { DASHBOARD_API_URL } from "@/lib/site";
import type { Category, Product, ProductVariant } from "@/lib/types";

/**
 * Echte productcatalogus van De Voordeelmarkt, via de productfeed van het
 * VDM-dashboard. Bij voorkeur de gepagineerde JSON-feed
 * (GET /api/doofinder/json); is die niet bereikbaar, dan de XML-feed
 * (GET /api/doofinder/feed) als terugval. De prijzen komen daar sinds
 * juli 2026 rechtstreeks uit de Tilroy Price API, dus ze zijn actueel in
 * plaats van zo vers als de laatste feedgeneratie.
 *
 * De feed levert ~5.000 varianten met per item onder meer:
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
/**
 * De gepagineerde JSON-feed. Let op het ontbreken van een punt in het pad:
 * bij `feed.json` ziet Vercel het als een statisch bestand en wordt de route
 * nooit uitgevoerd — dat gaf maandenlang een 404 op code die wél gedeployd
 * was. Niet "verbeteren" naar een bestandsnaam met extensie.
 */
const FEED_JSON_URL = `${DASHBOARD_API_URL}/api/doofinder/json`;
const CACHE_MS = 60 * 60 * 1000;
/** Aantal artikelen per pagina uit de JSON-feed. */
const PAGE_SIZE = 500;

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
    menuLabel: "Benodigdheden",
    description:
      "Kwasten, rollers, schuurpapier, afplaktape en behang: alles om je verfklus strak af te werken.",
    icon: "brush",
    hue: 45,
  },
  {
    slug: "lijm-en-kit",
    name: "Lijm, kit & vulmiddelen",
    menuLabel: "Lijm & kit",
    description:
      "Kitten, lijmen, plamuur en vulmiddelen voor elke reparatie en afwerking in en om het huis.",
    icon: "can",
    hue: 200,
  },
  {
    slug: "bevestiging",
    name: "Bevestiging & ijzerwaren",
    menuLabel: "Bevestiging",
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
    menuLabel: "Elektra",
    description:
      "Lichtbronnen, zaklampen, verlengkabels en contactdozen: voordelig licht en stroom waar je het nodig hebt.",
    icon: "bulb",
    hue: 265,
  },
  {
    slug: "huishouden",
    name: "Huishouden & Reinigen",
    menuLabel: "Huishouden",
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
    menuLabel: "Overig",
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

/**
 * De subcategorie uit de feed ("Verf > Lakken" → "Lakken").
 *
 * Tilroy zet alles onder één hoofdcategorie "Verf"; de bruikbare indeling
 * zit in het deel erachter. Dezelfde subcategorie komt in meerdere
 * schrijfwijzen voor ("LIJMEN, KITTEN EN VULMIDDELEN" naast "Lijmen,
 * kitten en vulmiddelen"), dus normaliseren we naar één weergavevorm —
 * anders staat hetzelfde filter er twee keer in.
 */
function subcategoryOf(rawCategory: string | undefined): string | undefined {
  if (!rawCategory) return undefined;
  const sub = (rawCategory.split(">").pop() ?? "").trim();
  if (!sub) return undefined;
  const lower = sub.toLocaleLowerCase("nl");
  return lower.charAt(0).toLocaleUpperCase("nl") + lower.slice(1);
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
 * Productfoto via de beeldproxy, in de vorm die het ook echt doet.
 *
 * Ongeveer één op de acht artikelen kreeg een URL van de vorm
 * `/s/resizeinbox/580x580/…` mee; die geeft bij de proxy een 403, terwijl
 * `/v7/…` voor precies dezelfde foto gewoon werkt (gemeten: 4/30 tegenover
 * 30/30, en alle 20 herschreven mislukkelingen kwamen door). De foto's
 * bestaan dus wel degelijk — het is puur de URL-vorm.
 *
 * Het dashboard normaliseert dit sinds 2026-07-27 zelf (PR #310), dus in
 * de praktijk valt hier niets meer om te zetten. Blijft staan als vangnet:
 * de omzetting is idempotent en kost niets, en hij vangt oude URL's uit de
 * Redis-cache af zolang die nog rondgaan.
 *
 * Meten doe je met GET + Range-header, nooit met HEAD: de proxy antwoordt
 * anders op HEAD, wat vals-negatieven geeft.
 */
function fotoUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return (
    value
      .replace(/\/s\/resizeinbox\/\d+x\d+\//, "/v7/")
      // Een plus in de bestandsnaam ("HOUTBOUT + MOER") wordt onderweg als
      // spatie gelezen en levert een 404 op; als %2B komt precies dezelfde
      // foto wél door. Raakt 388 artikelen, waarvan er geen enkele laadde.
      .replace(/\+/g, "%2B")
  );
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

/**
 * Specificatietabel.
 *
 * Zo volledig als de bron toelaat: klanten vergelijken hierop, en een lege
 * tabel maakt een productpagina waardeloos. Alleen velden die de feed ook
 * echt vult komen erin — een regel "Ondergrond: —" is erger dan geen regel.
 */
function buildSpecs(item: FeedItem, group: FeedItem[]): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  const gezien = new Set<string>();
  const add = (label: string, waarde: string | undefined) => {
    const tekst = waarde?.trim();
    if (!tekst || gezien.has(label)) return;
    gezien.add(label);
    specs.push({ label, value: tekst });
  };

  add("Merk", item.brand);
  add("Productlijn", item.productlijn);
  add("Type", item.subtitel);

  // Alle maten van de groep, niet alleen die van het eerste artikel: na het
  // samenvoegen van maatvarianten dekt "maat_range" de rest niet meer.
  const maten = [...new Set(group.map((entry) => entry.maat?.trim()).filter(Boolean))];
  add(
    maten.some((maat) => /\b(ml|l|liter)\b/i.test(maat!)) ? "Inhoud" : "Maten",
    maten.length > 1 ? maten.join(", ") : (maten[0] ?? item.maat_range),
  );

  // Verpakkingsaantallen: staan alleen in de titel, terwijl een klant er wel
  // op koopt ("krijg ik er één of tien?"). Oplopend, net als de maten.
  const verpakkingen = [...new Set(group.map((entry) => verpakkingUit(entry.title)).filter(Boolean))]
    .sort((a, b) => aantalUit(a!) - aantalUit(b!));
  add("Verpakking", verpakkingen.length > 0 ? verpakkingen.join(", ") : undefined);

  add("Kleur", item.kleur);
  add("Verfsoort", item.verfsoort);
  add("Glans", item.glans);
  add("Toepassing", item.toepassing || item.objectList?.replace(/\|/g, ", "));
  add("Ondergrond", item.ondergrondList?.replace(/\|/g, ", ") || item.ondergrond);
  add("Eigenschappen", item.eigenschappen?.replace(/\|/g, ", "));
  add("Kwaliteit", item.kwaliteit);
  add("Artikelnummer", item.id);

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
/** Maten die geen maat zijn: die zeggen alleen "dit artikel heeft er geen". */
const GEEN_MAAT = new Set(["1size", "one size", "n.v.t.", "nvt", "-"]);

function heeftEchteMaat(maat: string | undefined): boolean {
  const waarde = maat?.trim().toLowerCase();
  return Boolean(waarde) && !GEEN_MAAT.has(waarde!);
}

/**
 * De titel zonder maat- en aantalvermeldingen.
 *
 * Hiermee herkennen we artikelen die in werkelijkheid maten van hetzelfde
 * product zijn. Tilroy geeft elke maat een eigen group_id, dus zonder deze
 * stap staan er 103 losse "Mack Spaanplaatschroef PZ2" in de catalogus en
 * vier aparte blikken Histor Leliewit die alleen in inhoud verschillen.
 */
function titelRomp(titel: string, maat: string | undefined): string {
  let tekst = ` ${titel.toLowerCase()} `;
  if (maat) tekst = tekst.split(maat.toLowerCase()).join(" ");
  return tekst
    .replace(/\b\d+(?:[.,]\d+)?\s*(mm|cm|mtr|meter|ml|l|liter|gr|gram|kg|watt|w|volt|v|inch)\b/g, " ")
    .replace(/\bm\d+\s*x\s*\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/\b\d+\s*(st|stuks?|maal)\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Productnaam voor een groep samengevoegde maten.
 *
 * We knippen de titel af op het punt waar de maatvermelding begint, en
 * houden netjes hoofdletters en leestekens van het origineel aan. Levert
 * dat te weinig op, dan blijft de volledige titel staan — een half woord
 * als productnaam is erger dan een titel met een maat erin.
 */
function naamZonderMaat(titel: string, group: FeedItem[]): string {
  const kandidaten = group
    .map((item) => item.maat?.trim())
    .filter((maat): maat is string => Boolean(maat));

  let afkap = titel.length;
  for (const maat of [...kandidaten, ...MAAT_PATRONEN_BRON]) {
    const index = titel.toLowerCase().indexOf(maat.toLowerCase());
    if (index > 0) afkap = Math.min(afkap, index);
  }
  const patroon = titel.match(/\b\d+(?:[.,]\d+)?\s*(?:mm|cm|ml|l|liter|inch|st|stuks?|maal)\b/i);
  if (patroon?.index && patroon.index > 0) afkap = Math.min(afkap, patroon.index);

  const kort = titel.slice(0, afkap).replace(/[\s\-–,]+$/, "").trim();
  return kort.length >= 8 ? kort : titel;
}

/** Losse maataanduidingen die vaak los in een titel staan. */
const MAAT_PATRONEN_BRON: string[] = [];

/**
 * Ruimt de productnaam op.
 *
 * De brondata laat er soms magazijncodes in staan — "1SIZE" betekent alleen
 * "dit artikel heeft geen maat" en hoort niet op een productpagina. Ook
 * dubbele spaties en losse leestekens aan het eind gaan eruit.
 */
function schoneNaam(naam: string): string {
  return naam
    .replace(/\b1\s?size\b/gi, " ")
    .replace(/\s*\|\s*$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\s\-–,|]+$/g, "")
    .trim();
}

/** Zet de glansgraad achter de naam, als die er nog niet in staat. */
function metGlans(naam: string, glans: string | undefined): string {
  const waarde = glans?.trim();
  if (!waarde) return naam;
  return naam.toLowerCase().includes(waarde.toLowerCase()) ? naam : `${naam} ${waarde}`;
}

/**
 * De maat als getal, om varianten op te kunnen sorteren.
 *
 * Liters wegen zwaarder dan millimeters, zodat inhoud en lengte nooit door
 * elkaar sorteren binnen één product. `inhoud_liter` uit de feed gaat voor;
 * anders lezen we het getal uit het maatveld.
 */
function maatWaarde(item: FeedItem): number {
  const liter = Number(item.inhoud_liter ?? 0);
  if (Number.isFinite(liter) && liter > 0) return liter;
  const match = item.maat?.match(/([\d]+(?:[.,]\d+)?)/);
  if (!match) return 0;
  const waarde = Number(match[1].replace(",", "."));
  return Number.isFinite(waarde) ? waarde : 0;
}

/** Verpakkingsaantal als getal ("4 stuks" → 4, "1 maal" → 1). */
function aantalUit(titel: string | undefined): number {
  const match = titel?.match(/\b(\d+)\s*(?:stuks?|st\b|maal)/i);
  const waarde = match ? Number(match[1]) : 1;
  return Number.isFinite(waarde) ? waarde : 1;
}

/** "4 stuks", "1 maal", "200 ST" uit de titel — het verpakkingsaantal. */
function verpakkingUit(titel: string | undefined): string | undefined {
  const match = titel?.match(/\b(\d+)\s*(stuks?|st\b|maal)/i);
  if (!match) return undefined;
  const aantal = Number(match[1]);
  if (!Number.isFinite(aantal) || aantal < 1) return undefined;
  return aantal === 1 ? "per stuk" : `${aantal} stuks`;
}

function groupKeyFor(item: FeedItem): string {
  if (item.mengverf === "Ja" && item.productlijn && parseBase(item.mengbasis)) {
    return `meng:${[item.productlijn, item.glans, item.verfsoort]
      .filter(Boolean)
      .join("|")
      .toLowerCase()}`;
  }

  // Maatvarianten van hetzelfde artikel samen onder één product. Alleen als
  // er een échte maat staat: bij "1SIZE" zegt het veld niets, en dan zouden
  // bijvoorbeeld alle behangdessins van een serie op één hoop belanden.
  if (heeftEchteMaat(item.maat) && item.title) {
    const romp = titelRomp(item.title, item.maat);
    // Blijft er te weinig over, dan is de romp geen betrouwbaar kenmerk meer.
    if (romp.length >= 6) {
      return `maat:${(item.brand ?? "").toLowerCase()}|${romp}`;
    }
  }

  return item.group_id ?? item.id;
}

/**
 * Filterbare eigenschappen. Alleen velden waar genoeg artikelen een waarde
 * voor hebben — een filter met drie opties op vijfduizend producten helpt
 * niemand.
 */
function buildAttributes(leader: FeedItem, group: FeedItem[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  const add = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) attributes[key] = trimmed;
  };

  add("subcategorie", subcategoryOf(leader.categories));
  add("glans", leader.glans);
  add("verfsoort", leader.verfsoort);
  add("toepassing", leader.toepassing);
  add("ondergrond", leader.ondergrond);
  add("kwaliteit", leader.kwaliteit);
  add("kleur", leader.kleur);

  // Inhoud: alle maten van de groep, zodat filteren op "2,5 L" ook werkt bij
  // een product dat meerdere maten heeft.
  const maten = [...new Set(group.map((item) => item.maat?.trim()).filter(Boolean))];
  if (maten.length > 0) attributes.inhoud = maten.join("|");

  if (leader.mengverf === "Ja") attributes.mengverf = "Ja";
  if (leader.aanbieding === "Ja") attributes.aanbieding = "Ja";

  return attributes;
}

/** Zet de varianten van één groep om in één Product. */
function buildProduct(group: FeedItem[]): Product | null {
  const leader = group.find((item) => item.group_leader === "true") ?? group[0];
  if (!leader?.title) return null;

  // Op maat sorteren, van klein naar groot. Zonder dit staan 20, 120, 40 en
  // 180 mm door elkaar in de keuzelijst, wat er slordig uitziet en waarin de
  // klant zijn maat niet terugvindt. Bij gelijke maat het kleinste
  // verpakkingsaantal eerst.
  const sorted = [...group].sort((a, b) => {
    const verschil = maatWaarde(a) - maatWaarde(b);
    if (verschil !== 0) return verschil;
    return aantalUit(a.title) - aantalUit(b.title);
  });

  const variants: ProductVariant[] = sorted
    .filter((item) => item.maat)
    .map((item) => {
      const base = parseBase(item.mengbasis);
      // Staat dezelfde maat er meerdere keren in, dan verschillen die
      // artikelen op iets anders — meestal het aantal per verpakking. Dat
      // zetten we erbij, anders staan er twee identieke keuzes.
      const meerdereVerpakkingen =
        group.filter((ander) => ander.maat === item.maat).length > 1;
      const verpakking = meerdereVerpakkingen ? verpakkingUit(item.title) : undefined;
      return {
        id: item.id,
        name: verpakking ? `${item.maat} — ${verpakking}` : item.maat,
        price: toCents(item.sale_price ?? item.price),
        sku: item.id,
        size: item.maat,
        ...(verpakking ? { packaging: verpakking } : {}),
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
  const name = schoneNaam(
    isBaseFamily
    ? // De groepen lopen per glansgraad uiteen, maar de productlijn noemt die
      // niet: dan staan Mat, Zijdeglans en Hoogglans als drie regels met
      // exact dezelfde naam en verschillende prijzen in de lijst.
      metGlans(leader.productlijn || leader.title, leader.glans)
    : // Zijn er meerdere maten samengevoegd, dan mag de maat van de eerste
      // niet in de naam blijven staan: "Mack Houtbout M8 x 80 mm" met daaronder
      // ook 90, 100 en 120 leest als een fout.
      group.length > 1 && heeftEchteMaat(leader.maat)
      ? naamZonderMaat(leader.title, group)
      : leader.title,
  );

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
    specs: buildSpecs(leader, sorted),
    attributes: buildAttributes(leader, group),
    tags: (leader.zoektermen ?? "").split(/\s+/).filter(Boolean).slice(0, 24),
    // Pak de eerste variant die wél een foto heeft. Bij samengevoegde maten
    // is de "leider" willekeurig de eerste uit de feed; heeft juist die geen
    // foto, dan zou het hele product er geen tonen terwijl de andere maten
    // van hetzelfde artikel er een hebben.
    image: fotoUrl(
      leader.image_link || group.find((item) => item.image_link)?.image_link,
    ),
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

interface JsonFeedPage {
  total?: number;
  items?: Record<string, unknown>[];
  next?: string | null;
}

/**
 * Haal de catalogus op via de gepagineerde JSON-feed. Dat is de voorkeursweg:
 * kleine pagina's in plaats van één verzoek van ruim 6 MB, waar de
 * bot-mitigatie van het platform op aanslaat tijdens builds.
 *
 * `null` als het endpoint (nog) niet bestaat — dan gebruiken we de XML-feed.
 */
async function fetchJsonFeed(): Promise<FeedItem[] | null> {
  const items: FeedItem[] = [];
  let url: string | null = `${FEED_JSON_URL}?limit=${PAGE_SIZE}&offset=0`;
  let pagina = 0;

  while (url && pagina < 40) {
    const res: Response = await fetch(url, {
      signal: AbortSignal.timeout(45000),
      next: { revalidate: 3600 },
    });
    if (res.status === 404) return null; // endpoint bestaat nog niet
    if (!res.ok) throw new Error(`Productfeed (JSON) gaf status ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null; // krijgt XML terug

    const page = (await res.json()) as JsonFeedPage;
    if (!Array.isArray(page.items)) return null;

    for (const item of page.items) {
      // De JSON-variant levert arrays waar de XML een veld herhaalt; die
      // platten we tot dezelfde tekstvorm, zodat de rest van de parser
      // ongewijzigd blijft werken.
      const fields: FeedItem = {};
      for (const [key, value] of Object.entries(item)) {
        if (value == null) continue;
        fields[key] = Array.isArray(value) ? value.join("|") : String(value);
      }
      if (fields.id) items.push(fields);
    }

    url = page.next ?? null;
    pagina++;
  }

  return items.length > 0 ? items : null;
}

/**
 * Welke feed de laatst geladen catalogus opleverde.
 *
 * De terugval van JSON naar XML is stil — dat is met opzet, want de winkel
 * moet doordraaien. Maar dan moet je wel ergens kunnen zien welke bron actief
 * is, anders draai je maanden op de terugval zonder het te merken. Zie
 * /api/health.
 */
let laatsteBron: "json" | "xml" | "onbekend" = "onbekend";

export function catalogusBron(): "json" | "xml" | "onbekend" {
  return laatsteBron;
}

async function fetchFeed(): Promise<Product[]> {
  const viaJson = await fetchJsonFeed().catch((error) => {
    console.error("[catalogus] JSON-feed mislukt, val terug op XML:", error);
    return null;
  });

  let items: FeedItem[];
  if (viaJson) {
    items = viaJson;
    laatsteBron = "json";
  } else {
    const res = await fetchFeedResponse();
    if (!res.ok) throw new Error(`Productfeed gaf status ${res.status}`);
    items = parseItems(await res.text());
    laatsteBron = "xml";
  }

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
const KV_KEY = "catalog:products:v15";
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
  /** Welke feed deze catalogus opleverde; nodig voor de diagnose. */
  bron?: "json" | "xml";
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
    const payload: CachedCatalog = {
      at: Date.now(),
      bron: laatsteBron === "onbekend" ? undefined : laatsteBron,
      products,
    };
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
      // Elke serverless functie is een eigen proces: deze haalt de feed nooit
      // zelf op, dus zonder de bron uit de cache zou de diagnose altijd
      // "onbekend" melden en niets zeggen.
      if (stored.bron) laatsteBron = stored.bron;
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
        if (stored.bron) laatsteBron = stored.bron;
        return stored.products;
      }
      return cache?.products ?? [];
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
