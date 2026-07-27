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

/** Collecties met aantallen, RAL bovenaan. */
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
  return list.sort((a, b) => {
    if (a.id === RAL_COLLECTION_ID) return -1;
    if (b.id === RAL_COLLECTION_ID) return 1;
    return b.count - a.count || a.name.localeCompare(b.name, "nl");
  });
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

  const matches = colors.filter((color) => {
    if (collectionId && collectionId !== "alle" && color.collectionId !== collectionId) {
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

/** Startset voor de kiezer: de RAL-waaier (compact genoeg voor de eerste render). */
export async function getInitialColors(): Promise<PaintColor[]> {
  return ralPaintColors();
}
