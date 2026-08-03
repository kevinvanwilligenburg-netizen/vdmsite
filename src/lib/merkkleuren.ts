import { DASHBOARD_API_URL } from "@/lib/site";

/**
 * De volledige merkenwaaiers, voor kleuren die de kleurkiezer niet kent.
 *
 * De kiezer draait op een selectie van 18.370 kleuren; daar zitten de
 * huiskleuren van de fabrikanten niet in. Een blik "Histor Hoornwit 6763"
 * bleef daardoor zonder kleurvlak, terwijl Histor die kleur gewoon publiceert.
 * Deze bron telt 54.222 kleuren, inclusief de "Ready Mixed"-waaiers — precies
 * de reeksen waaruit een voorgemengd blik komt.
 *
 * Alleen server-side en alleen voor het kleurvlak: het bestand is 10 MB, dus
 * we halen het hooguit een paar keer per uur op en houden er een compacte
 * index van over.
 */
export interface MerkKleur {
  naam: string;
  hex: string;
  waaier: string;
}

interface Bron {
  id?: string;
  name?: string;
  code?: string;
  hex?: string;
  collection?: string;
  collectionId?: string;
}

const CACHE_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; index: Map<string, MerkKleur> } | null = null;
let bezig: Promise<Map<string, MerkKleur>> | null = null;

/** "0601-R78B Hoornwit" en "Hoornwit" moeten allebei op "hoornwit" uitkomen. */
function naamSleutel(naam: string): string {
  return naam
    .toLowerCase()
    .replace(/^[0-9]{2,4}[a-z]?[- ]?[0-9a-z]*\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ready Mixed eerst: dat is de reeks kant-en-klare blikken. Staat dezelfde
 * naam ook in een mengwaaier van hetzelfde merk, dan is de kant-en-klare
 * variant de kleur die écht in dit blik zit.
 */
function voorrang(collectionId: string): number {
  const id = collectionId.toLowerCase();
  if (id.includes("ready")) return 0;
  if (id.includes("compleet") || id.includes("colour") || id.includes("color")) return 1;
  return 2;
}

async function bouwIndex(): Promise<Map<string, MerkKleur>> {
  const index = new Map<string, MerkKleur>();
  const rang = new Map<string, number>();
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/kleurenkiezer/feed`, {
      signal: AbortSignal.timeout(20_000),
      next: { revalidate: 21_600 },
    });
    if (!res.ok) return index;
    const ruw = (await res.json()) as Bron[] | { colors?: Bron[] };
    const lijst = Array.isArray(ruw) ? ruw : (ruw.colors ?? []);

    for (const kleur of lijst) {
      const hex = (kleur.hex ?? "").trim();
      const naam = (kleur.name ?? "").trim();
      const waaier = (kleur.collectionId ?? "").trim();
      if (!/^#[0-9a-f]{6}$/i.test(hex) || !naam || !waaier) continue;

      // Sleutel op waaier-voorvoegsel (het merk) plus de kale kleurnaam.
      const merk = waaier.split("-")[0];
      const sleutel = `${merk}|${naamSleutel(naam)}`;
      const nieuweRang = voorrang(waaier);
      if (index.has(sleutel) && (rang.get(sleutel) ?? 9) <= nieuweRang) continue;
      index.set(sleutel, { naam, hex: hex.toUpperCase(), waaier: kleur.collection ?? waaier });
      rang.set(sleutel, nieuweRang);
    }
  } catch {
    // Geen merkkleuren is geen ramp: dan blijft het vlak gewoon weg.
  }
  return index;
}

async function merkkleurenIndex(): Promise<Map<string, MerkKleur>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.index;
  if (bezig) return bezig;
  bezig = bouwIndex()
    .then((index) => {
      cache = { at: Date.now(), index };
      return index;
    })
    .finally(() => {
      bezig = null;
    });
  return bezig;
}

/**
 * De kleur van een voorgemengd blik, gezocht in de waaiers van het merk zelf.
 *
 * Merkbewust en niet zomaar op naam: "Wit" bestaat bij elke fabrikant in een
 * andere tint, en dan is een treffer bij een ander merk een gok. Histor
 * Leliewit zoeken we dus alleen bij Histor.
 */
export async function merkKleurVoor(
  merk: string,
  kleurwaarde: string,
): Promise<MerkKleur | undefined> {
  const merkSleutel = merk.trim().toLowerCase().split(/[\s.]/)[0];
  const naam = naamSleutel(kleurwaarde);
  if (!merkSleutel || !naam || naam.length < 3) return undefined;
  const index = await merkkleurenIndex();
  return index.get(`${merkSleutel}|${naam}`);
}
