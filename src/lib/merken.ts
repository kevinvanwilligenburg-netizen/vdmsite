/**
 * Merknamen uit de kassa: wat is een echt merk, en hoe schrijf je het?
 *
 * Losse module zonder serverafhankelijkheden, want ook de filterlaag
 * (facets.ts) heeft dit nodig en die wordt in een client component
 * geïmporteerd. tilroy.ts hierin trekken zou node-only code het
 * browserbundel in slepen.
 */

/**
 * Wat in het merkveld van de kassa staat maar geen merk is.
 *
 * Tilroy gebruikt dat veld ook als restbak: 139 artikelen staan onder
 * "Overige" en 44 onder "Merk". Een merkpagina daarvoor is een pagina zonder
 * onderwerp, en als filteroptie belooft "Overige" een keuze die er geen is.
 */
const GEEN_MERK = new Set([
  "overige",
  "overig",
  "merk",
  "merken",
  "diversen",
  "partijhandel",
  "partij",
  "mengpasta",
  "de voordeelmarkt",
  "essentieel overige",
  "verzendkosten",
  "administratie",
  "geen",
  "onbekend",
  "no brand",
  "nobrand",
]);

/**
 * De schrijfwijze uit de kassa is niet consequent: "Hg", "RASCH", "DULUX",
 * "DEN BRAVEN" en "Hofftech germany" staan er door elkaar. Naast elkaar in
 * een filterkolom ziet dat er slordig uit, en op een merkpagina staat de
 * merknaam in de titel — dan wil je hem goed hebben.
 */
const MERKNAAM: Record<string, string> = {
  hg: "HG",
  rasch: "Rasch",
  dulux: "Dulux",
  multiblade: "MultiBlade",
  "den braven": "Den Braven",
  "wdh behang": "WDH Behang",
  "hofftech germany": "Hofftech Germany",
  "led's light": "Led's Light",
  ppg: "PPG",
  osb: "OSB",
};

/** Merknaam zoals hij getoond hoort te worden. */
export function merknaam(raw: string): string {
  const schoon = raw.trim().replace(/\s+/g, " ");
  const sleutel = schoon.toLowerCase();
  if (MERKNAAM[sleutel]) return MERKNAAM[sleutel];
  // Volledig hoofdletters of volledig kleine letters is bijna altijd de kassa
  // en niet het merk; gemengde schrijfwijzen laten we staan.
  if (schoon === schoon.toUpperCase() || schoon === schoon.toLowerCase()) {
    return schoon
      .split(" ")
      .map((woord) => woord.charAt(0).toUpperCase() + woord.slice(1).toLowerCase())
      .join(" ");
  }
  return schoon;
}

/** Is dit een echt merk, of een restbak uit het kassasysteem? */
export function isEchtMerk(raw: string | undefined): boolean {
  const schoon = (raw ?? "").trim().toLowerCase();
  return schoon.length > 0 && !GEEN_MERK.has(schoon);
}
