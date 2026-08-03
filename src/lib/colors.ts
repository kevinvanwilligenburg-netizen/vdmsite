import { ralColors } from "@/lib/ral";
import { DASHBOARD_API_URL } from "@/lib/site";
import type { PaintColor } from "@/lib/types";

/**
 * Kleurenbron van de kleurkiezer.
 *
 * Primair: de publieke kleurenfeed van het VDM-dashboard
 * (GET {DASHBOARD_API_URL}/api/kleurenkiezer/public-colors) met de daar
 * gesynchroniseerde merkenwaaiers. Beheer (synchroniseren, collecties)
 * gebeurt dus in het dashboard.
 *
 * Terugval: de ingebouwde RAL-waaier, zolang de feed leeg of onbereikbaar is.
 *
 * LET OP: de feed bevat tienduizenden kleuren. Die gaan nooit in één keer naar
 * de browser; de kiezer vraagt per collectie of zoekterm een beperkte set op
 * via /api/kleuren. Deze module cachet de feed server-side (revalidate 1 uur).
 */

interface HubColor {
  name: string;
  code: string;
  hex: string;
  collection: string;
  collectionId: string;
  provider: string;
}

export interface ColorCollection {
  id: string;
  name: string;
  count: number;
}

const RAL_COLLECTION_ID = "ral";

/**
 * "Populair": de kleuren waar klanten daadwerkelijk voor komen, als eigen
 * waaier voorin de kiezer — zoals Klus=r een "Populair"-collectie voert.
 *
 * Bewust zonder jaartal en gevuld uit VEELGEKOZEN in plaats van een
 * redactielijst: wit is met afstand de meestverkochte verf en de rest van dit
 * rijtje (antraciet voor kozijnen, gitzwart, dennengroen voor deuren) is waar
 * de mengmachine dagelijks op draait. Een verzonnen "trendcollectie 2026"
 * belooft een selectie die we niet gemaakt hebben.
 *
 * De kleuren zíjn de RAL-kleuren — zelfde sleutels (`ral:9010`), dus voor de
 * winkelwagen en resolvePaintColor bestaat deze waaier niet eens.
 */
const POPULAIR_COLLECTION_ID = "populair";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** De ingebouwde RAL-waaier in kleurkiezer-vorm (key `ral:<code>`). */
export function ralPaintColors(): PaintColor[] {
  return ralColors.map((color) => ({
    key: `ral:${color.code}`,
    code: `RAL ${color.code}`,
    name: color.name,
    hex: color.hex,
    group: `RAL Classic – ${color.group}`,
    collectionId: RAL_COLLECTION_ID,
  }));
}

let cache: { at: number; colors: PaintColor[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

/** Alle kleuren (dashboard-feed + RAL), server-side gecachet. */
export async function loadAllColors(): Promise<PaintColor[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.colors;

  const ral = ralPaintColors();
  let colors = ral;

  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/kleurenkiezer/public-colors`, {
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { colors?: HubColor[] };
      if (Array.isArray(data.colors) && data.colors.length > 0) {
        const seen = new Set<string>();
        const mapped: PaintColor[] = [];
        for (const color of data.colors) {
          if (!color?.name || !color.hex) continue;
          const base = `hub:${color.collectionId}:${slugify(color.code || color.name)}`;
          let key = base;
          let n = 2;
          while (seen.has(key)) key = `${base}-${n++}`;
          seen.add(key);
          mapped.push({
            key,
            code: color.code || "",
            name: color.name,
            hex: color.hex,
            group: color.collection || "Overig",
            collectionId: color.collectionId,
          });
        }
        // RAL voorop: dat is waar klanten in de winkel op mengen.
        colors = [...ral, ...mapped];
      }
    }
  } catch (error) {
    console.error("[kleuren] dashboard-kleurenfeed niet bereikbaar, RAL-waaier actief:", error);
  }

  cache = { at: Date.now(), colors };
  return colors;
}

/** De Populair-waaier: VEELGEKOZEN, maar dan als volwaardige kleurenlijst. */
export function populairPaintColors(): PaintColor[] {
  const alle = ralPaintColors();
  return VEELGEKOZEN.map((code) =>
    alle.find((kleur) => kleur.key === `ral:${code}`),
  ).filter((kleur): kleur is PaintColor => Boolean(kleur));
}

/** Collecties met aantallen: Populair voorop, dan RAL, dan de rest op grootte. */
export async function getColorCollections(): Promise<ColorCollection[]> {
  const colors = await loadAllColors();
  const counts = new Map<string, { name: string; count: number }>();
  for (const color of colors) {
    const id = color.collectionId ?? "overig";
    const entry = counts.get(id);
    if (entry) entry.count++;
    else counts.set(id, { name: color.group, count: 1 });
  }
  const list = [...counts.entries()].map(([id, value]) => ({
    id,
    name: value.name,
    count: value.count,
  }));
  const gesorteerd = list.sort((a, b) => {
    if (a.id === RAL_COLLECTION_ID) return -1;
    if (b.id === RAL_COLLECTION_ID) return 1;
    return b.count - a.count || a.name.localeCompare(b.name, "nl");
  });
  return [
    { id: POPULAIR_COLLECTION_ID, name: "Populair", count: populairPaintColors().length },
    ...gesorteerd,
  ];
}

export interface WaaierOverzichtItem extends ColorCollection {
  /** Zes kleurstalen als voorproefje — een waaier herken je eerder aan zijn
   *  kleuren dan aan zijn naam. */
  preview: string[];
}

/**
 * Alle collecties mét kleurpreview, in één doorloop over de geladen kleuren.
 * Voor het bladeroverzicht op /kleurkiezer; volgorde gelijk aan
 * getColorCollections (Populair en RAL voorop, rest op grootte — het
 * alfabetiseren doet de bladcomponent zelf).
 */
export async function getWaaierOverzicht(): Promise<WaaierOverzichtItem[]> {
  const [collections, colors] = await Promise.all([
    getColorCollections(),
    loadAllColors(),
  ]);
  const previews = new Map<string, string[]>();
  for (const color of colors) {
    const id = color.collectionId ?? "overig";
    const lijst = previews.get(id);
    if (!lijst) previews.set(id, [color.hex]);
    else if (lijst.length < 6) lijst.push(color.hex);
  }
  // Populair bestaat niet als echte collectie; de preview komt uit de eigen
  // selectie.
  previews.set(
    POPULAIR_COLLECTION_ID,
    populairPaintColors().slice(0, 6).map((kleur) => kleur.hex),
  );
  return collections.map((collection) => ({
    ...collection,
    preview: previews.get(collection.id) ?? [],
  }));
}

export interface ColorQuery {
  q?: string;
  collectionId?: string;
  limit?: number;
}

/** Zoek kleuren op naam/code, eventueel binnen één collectie. */
export async function searchColors(
  query: ColorQuery,
): Promise<{ colors: PaintColor[]; total: number }> {
  const colors = await loadAllColors();
  const limit = Math.min(Math.max(query.limit ?? 240, 1), 600);
  const q = (query.q ?? "").trim().toLowerCase().replace(/^ral\s*/, "");
  const collectionId = query.collectionId;

  // Populair is geen echte collectie maar een selectie uit RAL; de kleuren
  // dragen hun eigen collectionId, dus het gewone filter zou niets vinden.
  const bron =
    collectionId === POPULAIR_COLLECTION_ID ? populairPaintColors() : colors;

  const matches = bron.filter((color) => {
    if (
      collectionId &&
      collectionId !== "alle" &&
      collectionId !== POPULAIR_COLLECTION_ID &&
      color.collectionId !== collectionId
    ) {
      return false;
    }
    if (!q) return true;
    return (
      color.name.toLowerCase().includes(q) ||
      color.code.toLowerCase().replace(/^ral\s*/, "").includes(q)
    );
  });

  return { colors: matches.slice(0, limit), total: matches.length };
}

/**
 * Zoek één kleur op key — server-side gebruikt bij de checkout, zodat naam en
 * hex altijd uit de eigen bron komen. Accepteert ook "9010" of "ral:9010".
 */
export async function resolvePaintColor(key: string): Promise<PaintColor | undefined> {
  const value = (key ?? "").trim();
  if (!value) return undefined;

  const ralMatch = value.match(/^(?:ral:)?(?:RAL\s*)?(\d{4})$/i);
  if (ralMatch) {
    return ralPaintColors().find((color) => color.key === `ral:${ralMatch[1]}`);
  }

  const colors = await loadAllColors();
  return colors.find((color) => color.key === value);
}

/**
 * De kleur van een voorgemengd artikel, uit het kleurveld van de kassa.
 *
 * Dat veld is rommelig: "6763", "6763 Hoornwit", "Ral 9001", "Wit",
 * "Monumenten Groen". Voorgemengde blikken hebben in de webshop maar één
 * foto — het blik — en die zegt niets over de kleur erin. Met deze functie
 * kunnen we er een echt kleurvlak naast zetten.
 *
 * Geeft niets terug bij "NoColour", "Transparant" en andere niet-kleuren:
 * een vlak tonen dat we niet kennen is erger dan geen vlak.
 */
const GEEN_KLEURWAARDE = /^(nocolour|no colour|transparant|blank|kleurloos|-|n\.v\.t\.)$/i;

export async function kleurUitKassaveld(waarde: string): Promise<PaintColor | undefined> {
  const tekst = (waarde ?? "").trim();
  if (!tekst || GEEN_KLEURWAARDE.test(tekst)) return undefined;

  // "Ral 9001" en "6763 Hoornwit" beginnen allebei met het nummer dat telt.
  const nummer = tekst.match(/(?:^|\s)(?:ral\s*)?(\d{4})(?:\s|$)/i)?.[1];
  if (nummer) {
    const opRal = await resolvePaintColor(nummer);
    if (opRal) return opRal;
    const colors = await loadAllColors();
    const opCode = colors.find(
      (color) => (color.code ?? "").replace(/\s/g, "").toLowerCase() === nummer,
    );
    if (opCode) return opCode;
  }

  // Anders op naam: "Monumenten Groen", "Grachtengroen".
  const colors = await loadAllColors();
  const genormaliseerd = tekst.toLowerCase().replace(/\s+/g, " ");
  return colors.find(
    (color) =>
      color.name.toLowerCase() === genormaliseerd ||
      `${color.code} ${color.name}`.toLowerCase() === genormaliseerd,
  );
}

/**
 * Kleuren die als eerste in de kiezer horen te staan.
 *
 * De RAL-waaier loopt op nummer, en dan begint hij bij de gelen (1000-serie)
 * en eindigt bij wit en zwart (9000-serie). Wit is verreweg de meestverkochte
 * kleur, en die stond dus onderaan: je moest langs alle gelen, oranjes en
 * roden scrollen voordat je bij zuiver wit kwam.
 *
 * Deze lijst zet de kleuren vooraan waar de meeste mensen voor komen. De rest
 * van de waaier blijft er gewoon achter staan, in de eigen volgorde.
 */
const VEELGEKOZEN = [
  "9010", // Zuiver wit
  "9016", // Verkeerswit
  "9003", // Signaalwit
  "9001", // Crèmewit
  "1013", // Parelwit
  "7016", // Antracietgrijs
  "7021", // Zwartgrijs
  "9005", // Gitzwart
  "7035", // Lichtgrijs
  "6009", // Dennengroen
];

/** Startset voor de kiezer: de RAL-waaier (compact genoeg voor de eerste render). */
export async function getInitialColors(): Promise<PaintColor[]> {
  const alle = ralPaintColors();
  const voorop = VEELGEKOZEN.map((code) =>
    alle.find((kleur) => kleur.key === `ral:${code}`),
  ).filter((kleur): kleur is PaintColor => Boolean(kleur));
  const rest = alle.filter((kleur) => !voorop.some((eerste) => eerste.key === kleur.key));
  return [...voorop, ...rest];
}
