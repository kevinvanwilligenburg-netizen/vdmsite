/**
 * Zakelijk bestellen: de zuivere regels, zonder server-afhankelijkheden.
 *
 * Bewust los van lib/vies.ts: dat bestand praat met Redis (cache) en dus met
 * node-modules die niet in een browserbundel kunnen. Het afrekenformulier is
 * een client component en heeft alleen deze constanten en formaatregels
 * nodig — één import verkeerd om en elke pagina geeft een 500 ("Can't
 * resolve 'net'"). Dat is hier al eens eerder gebeurd met de catalogus.
 */

/** "nl 8555.28618-b01" → "NL855528618B01" */
export function normaliseerBtw(ruw: string): string {
  return (ruw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Landen die we bedienen; de rest heeft geen bezorgtarief en dus geen Profpas. */
const FORMATEN: Record<string, RegExp> = {
  NL: /^NL[0-9]{9}B[0-9]{2}$/,
  BE: /^BE0[0-9]{9}$/,
};

export function btwFormaatGeldig(btw: string): boolean {
  const land = btw.slice(0, 2);
  const formaat = FORMATEN[land];
  return Boolean(formaat && formaat.test(btw));
}

/** KvK: acht cijfers, meer smoel heeft het register niet nodig. */
export function kvkGeldig(ruw: string): boolean {
  return /^[0-9]{8}$/.test((ruw ?? "").replace(/[^0-9]/g, ""));
}

/**
 * Waar we zakelijk aan leveren, voor de checkout, het dashboard en de
 * accountpagina. Kevin: "jij vult zelf in welke soort" — dit is de indeling
 * van de balie.
 */
export const BEDRIJFSTYPEN = [
  "Schildersbedrijf",
  "Klusbedrijf",
  "Stukadoor",
  "Aannemer / bouwbedrijf",
  "Installatiebedrijf",
  "Hovenier",
  "Vastgoed / VvE-beheer",
  "Kantoor",
  "Anders",
] as const;

export type BedrijfsType = (typeof BEDRIJFSTYPEN)[number];

export function isBedrijfsType(waarde: unknown): waarde is BedrijfsType {
  return typeof waarde === "string" && (BEDRIJFSTYPEN as readonly string[]).includes(waarde);
}
