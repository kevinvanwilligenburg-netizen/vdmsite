import { isKvEnabled, kvGetJSON, kvSetEx } from "@/lib/kv";

/**
 * Curatie op zoekterm: synoniemen, uitsluitingen, merkvoorkeur, vastpinnen.
 *
 * Kevin: "zoekwoorden maken met daarbij resultaten (merk producten voorkeur)
 * zelfs als doofinder". Aanleiding was dat zoeken op "muurverf" een
 * werkhandschoen bovenaan gaf.
 *
 * De scoring zelf is daarna gerepareerd (synoniemen wegen minder, rubriek telt
 * mee), maar dat lost alleen de fóút op. Wat overblijft is smaak: welk merk wil
 * je bovenaan bij "muurverf", welk woord moet níét meetellen. Dat hoort niet in
 * code te staan waar alleen wij bij kunnen.
 *
 * ⚠️ EXTERN CONTRACT — het dashboard schrijft `zoekregels`, wij lezen.
 * Zij normaliseren `term`, `synoniemen` en `nietSynoniemen` naar kleine letters
 * en weigeren dubbele termen, regels zonder sturing, en woorden die zowel
 * synoniem als uitsluiting zijn. Wij hoeven dat dus niet nog eens te
 * verdedigen — maar we lezen wél defensief, want een lege of kapotte sleutel
 * mag het zoeken nooit stukmaken.
 */

export interface Zoekregel {
  id: string;
  /** Waar de klant op zoekt; kleine letters. */
  term: string;
  /** Ook laten matchen, met minder gewicht. */
  synoniemen?: string[];
  /**
   * Uitsluiten, ook als het een standaardsynoniem is.
   *
   * Dit veld is de kern van het probleem dat de tool oploste: `muurverf →
   * latex` staat in onze eigen lijst en haalde daarmee latex handschoenen
   * binnen. Kevin moet dat kunnen terugdraaien zonder ons.
   */
  nietSynoniemen?: string[];
  /** Dit merk hoger in de lijst. Kast doet er niet toe. */
  merkVoorkeur?: string[];
  /** Maximaal drie sku's, altijd bovenaan, in deze volgorde. */
  vastgepind?: string[];
  /** Resultaten in deze rubriek voorrang geven. */
  rubriek?: string;
  actief?: boolean;
}

function tekstlijst(waarde: unknown, max = 40): string[] {
  if (!Array.isArray(waarde)) return [];
  return waarde
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(Boolean)
    .slice(0, max);
}

function leesRegel(ruw: unknown): Zoekregel | null {
  if (!ruw || typeof ruw !== "object") return null;
  const bron = ruw as Record<string, unknown>;
  const term = typeof bron.term === "string" ? bron.term.trim().toLowerCase() : "";
  if (!term) return null;
  if (bron.actief === false) return null;
  return {
    id: typeof bron.id === "string" ? bron.id : term,
    term,
    synoniemen: tekstlijst(bron.synoniemen),
    nietSynoniemen: tekstlijst(bron.nietSynoniemen),
    // Merk en rubriek houden hun kast; wij vergelijken hoofdletterongevoelig.
    merkVoorkeur: Array.isArray(bron.merkVoorkeur)
      ? bron.merkVoorkeur.filter((m): m is string => typeof m === "string")
      : [],
    vastgepind: tekstlijst(bron.vastgepind, 3),
    ...(typeof bron.rubriek === "string" && bron.rubriek.trim()
      ? { rubriek: bron.rubriek.trim() }
      : {}),
    actief: true,
  };
}

/** Alle actieve regels, gesleuteld op term. Leeg bij storing — nooit stuk. */
export async function zoekregels(): Promise<Map<string, Zoekregel>> {
  const uit = new Map<string, Zoekregel>();
  if (!isKvEnabled()) return uit;
  try {
    const ruw = await kvGetJSON<unknown[]>("zoekregels");
    if (!Array.isArray(ruw)) return uit;
    for (const item of ruw) {
      const regel = leesRegel(item);
      if (regel) uit.set(regel.term, regel);
    }
  } catch (error) {
    console.error("[zoeken] zoekregels lezen mislukt:", error);
  }
  return uit;
}

/* ── werklijst voor curatie ────────────────────────────────────────────────── */

const MAGER_SLEUTEL = "zoek:magerehits";
/** Ringbuffer; genoeg om een werklijst te vullen, klein genoeg om te lezen. */
const MAGER_MAX = 200;
const MAGER_TTL = 30 * 24 * 3600;

export interface MagereHit {
  term: string;
  /** Hoe vaak deze term met te weinig resultaten is gezocht. */
  aantal: number;
  /** Aantal resultaten bij de laatste keer. */
  laatsteResultaten: number;
  laatstOp: string;
}

/**
 * Onthoudt zoektermen die niets of bijna niets opleveren.
 *
 * GA4 ziet alleen dát er gezocht is, niet hoevéél er gevonden werd — onze
 * zoeker is de enige plek waar die twee samenkomen. Zonder deze lijst is
 * curatie gokwerk: je verzint synoniemen voor woorden die niemand intypt,
 * terwijl de term waar dagelijks vijf mensen op stranden onopgemerkt blijft.
 *
 * Faalt stil en wordt niet afgewacht: een zoekopdracht mag hier nooit op
 * wachten of door omvallen.
 */
export async function noteerMagereHit(term: string, resultaten: number): Promise<void> {
  const schoon = term.trim().toLowerCase().slice(0, 60);
  if (!isKvEnabled() || schoon.length < 2 || resultaten >= 3) return;
  try {
    const bestaand = (await kvGetJSON<MagereHit[]>(MAGER_SLEUTEL)) ?? [];
    const lijst = Array.isArray(bestaand) ? bestaand : [];
    const gevonden = lijst.find((hit) => hit.term === schoon);
    if (gevonden) {
      gevonden.aantal += 1;
      gevonden.laatsteResultaten = resultaten;
      gevonden.laatstOp = new Date().toISOString();
    } else {
      lijst.push({
        term: schoon,
        aantal: 1,
        laatsteResultaten: resultaten,
        laatstOp: new Date().toISOString(),
      });
    }
    // Vaakst gezocht bovenaan; dat is de volgorde waarin je moet cureren.
    lijst.sort((a, b) => b.aantal - a.aantal);
    await kvSetEx(MAGER_SLEUTEL, JSON.stringify(lijst.slice(0, MAGER_MAX)), MAGER_TTL);
  } catch (error) {
    console.error("[zoeken] magere hit noteren mislukt:", error);
  }
}
