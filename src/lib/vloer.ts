/**
 * Laminaat, vinyl en ondervloer: pakinhoud, decor en tint.
 *
 * Vloeren passen niet in de rest van het assortiment. Verf koop je per liter,
 * kit per koker, maar laminaat koop je per pak van een paar vierkante meter —
 * en wat een klant weet is de maat van zijn kamer, niet het aantal pakken.
 * Zonder rekenhulp moet hij zelf delen door 2,493 en naar boven afronden, en
 * dat gaat mis: één pak te weinig betekent een tweede rit naar de winkel met
 * een half gelegde vloer.
 *
 * Twee dingen komen hier vandaan: hoeveel vierkante meter er in een pak zit,
 * en welk decor het is. Allebei staan ze niet in een net veld.
 */
import type { Product } from "@/lib/types";

/* ── Pakinhoud in vierkante meters ─────────────────────────────── */

/**
 * Tilroy schrijft de pakinhoud op vier manieren in het maatveld:
 *
 *   "2,493 M2"   met komma en eenheid
 *   "2493 M2"    zonder komma, dezelfde 2,493 m²
 *   "2673"       kaal getal, ook duizendsten
 *   "15MX1M"     een rol ondervloer van 15 bij 1 meter
 *
 * Het kale getal is de lastigste: 2673 is 2,673 m² en niet 2.673 m². Dat is te
 * zien aan de orde van grootte — een pak laminaat is nooit groter dan een
 * vierkante meter of tien. Alles wat na omrekening buiten dat bereik valt
 * vertrouwen we niet en laten we liever leeg dan dat we een klant met een
 * verkeerd aantal pakken naar huis sturen.
 */
const AANNEMELIJK_MIN = 0.5;
const AANNEMELIJK_MAX = 25;

export function pakInhoudM2(maat: string | undefined): number | null {
  const tekst = (maat ?? "").toString().trim();
  if (!tekst || /^1SIZE$/i.test(tekst)) return null;

  // Rol: "15MX1M", "10M X 1M"
  const rol = tekst.match(/^(\d+(?:[.,]\d+)?)\s*M\s*X\s*(\d+(?:[.,]\d+)?)\s*M$/i);
  if (rol) {
    const lengte = parseFloat(rol[1].replace(",", "."));
    const breedte = parseFloat(rol[2].replace(",", "."));
    const opp = lengte * breedte;
    return aannemelijk(opp) ? opp : null;
  }

  // Met eenheid: "2,493 M2" of "2493 M2"
  const metEenheid = tekst.match(/^(\d+(?:[.,]\d+)?)\s*M2$/i);
  if (metEenheid) return aannemelijk(normaliseer(metEenheid[1]));

  // Kaal getal: "2673"
  const kaal = tekst.match(/^(\d{3,5})$/);
  if (kaal) return aannemelijk(normaliseer(kaal[1]));

  return null;
}

function normaliseer(ruw: string): number | null {
  const waarde = parseFloat(ruw.replace(",", "."));
  if (!Number.isFinite(waarde)) return null;
  // Zonder komma: duizendsten. 2493 → 2,493 en 8500 → 8,5.
  return waarde > 100 ? waarde / 1000 : waarde;
}

function aannemelijk(waarde: number | null): number | null {
  if (waarde === null) return null;
  return waarde >= AANNEMELIJK_MIN && waarde <= AANNEMELIJK_MAX ? waarde : null;
}

/* ── Hoeveel pakken heb je nodig ───────────────────────────────── */

/**
 * Snijverlies. Een rechthoekige kamer kost ongeveer 5%, een kamer met een
 * erker, een schuine wand of diagonaal gelegde planken al gauw 10%. We rekenen
 * met 10% als voorstel: te veel bestellen kost een pak, te weinig kost een
 * tweede rit en een vloer die een week openligt. De klant kan het zelf lager
 * zetten.
 */
export const SNIJVERLIES_STANDAARD = 0.1;

export interface VloerBerekening {
  /** Netto oppervlak dat de klant opgaf. */
  oppervlak: number;
  /** Inclusief snijverlies. */
  benodigd: number;
  pakken: number;
  /** Wat je werkelijk in huis hebt na afronding naar hele pakken. */
  geleverd: number;
  /** Wat je overhoudt; handig als reserve voor een beschadigde plank. */
  over: number;
}

export function berekenPakken(
  oppervlak: number,
  perPak: number,
  snijverlies = SNIJVERLIES_STANDAARD,
): VloerBerekening | null {
  if (!(oppervlak > 0) || !(perPak > 0)) return null;
  const benodigd = oppervlak * (1 + snijverlies);
  const pakken = Math.ceil(benodigd / perPak);
  const geleverd = pakken * perPak;
  return {
    oppervlak,
    benodigd,
    pakken,
    geleverd,
    over: geleverd - oppervlak,
  };
}

/* ── Decor en tint uit de titel ────────────────────────────────── */

/**
 * Het kleurveld uit de kassa is hier onbruikbaar: 25 van de 27 vloerartikelen
 * staan op "Transparant", want dat veld is voor verf bedoeld. Wat een klant
 * zoekt — eiken of noten, licht of donker — staat alleen in de productnaam:
 * "Parador Laminaat Basic 400 Eiken Monterey Licht Gebleekt".
 *
 * Daarom lezen we het daaruit. Bewust op hele woorden, zodat "Eik" niet in
 * "Eikenhouten" of "Beikleurig" aanslaat, en bewust een korte lijst: liever
 * geen filterwaarde dan een verkeerde.
 */
const HOUTSOORTEN: [RegExp, string][] = [
  // "Eik Valere", "Eiken Monterey" en "Oak Horizont" zijn alle drie eiken;
  // let op dat een kaal "Eik" ook telt.
  [/\b(eik(en)?|oak)\b/i, "Eiken"],
  [/\b(noten|walnut|walnoot)\b/i, "Noten"],
  [/\b(beuken?|buche|beech)\b/i, "Beuken"],
  [/\b(essen?|ash)\b/i, "Essen"],
  [/\b(grenen|pine|vuren)\b/i, "Grenen"],
  [/\b(kersen?|cherry)\b/i, "Kersen"],
  [/\b(perelaar|peer)\b/i, "Perelaar"],
  [/\b(esdoorn|maple)\b/i, "Esdoorn"],
  [/\b(beton|concrete)\b/i, "Beton"],
  [/\b(steen|stone|tegel)\b/i, "Steen"],
];

const TINTEN: [RegExp, string][] = [
  [/\bgebleekt|gewit|whitewash\b/i, "Gebleekt"],
  [/\bdonker|dark|gedämpft|gedampt\b/i, "Donker"],
  [/\blicht|light|hell\b/i, "Licht"],
  [/\bgrijs|grey|gray|parelgrijs\b/i, "Grijs"],
  [/\bwit\b|\bwhite\b/i, "Wit"],
  [/\bzwart|black\b/i, "Zwart"],
  [/\bnatuur|natural|natur\b/i, "Naturel"],
  [/\bbruin|brown\b/i, "Bruin"],
];

function eersteTreffer(bron: string, regels: [RegExp, string][]): string | undefined {
  for (const [patroon, label] of regels) {
    if (patroon.test(bron)) return label;
  }
  return undefined;
}

export function houtsoortUit(titel: string): string | undefined {
  return eersteTreffer(titel, HOUTSOORTEN);
}

export function tintUit(titel: string): string | undefined {
  return eersteTreffer(titel, TINTEN);
}

/* ── Is dit een vloerartikel? ──────────────────────────────────── */

/**
 * We kijken naar de rubriek en niet naar de naam: "laminaatzaag" is geen
 * vloer, en "Parador Perelaar licht" is dat wél zonder dat het woord laminaat
 * erin staat.
 */
const VLOER_RUBRIEKEN = /laminaat|ondervloer|vloer|plint/i;

export function isVloerArtikel(product: Product): boolean {
  const rubriek = `${product.attributes?.subcategorie ?? ""} ${product.category}`;
  return VLOER_RUBRIEKEN.test(rubriek);
}

/** Pakinhoud van het product of van de gekozen variant. */
export function pakInhoudVan(
  product: Pick<Product, "attributes">,
  variantNaam?: string,
): number | null {
  // pakM2 is ons eigen veld uit de feedbouwer ("2.673", punt als scheider) —
  // dat lezen we rechtstreeks. pakInhoudM2() is voor de Tilroy-schrijfwijzen
  // en herkent onze eigen genormaliseerde vorm juist niet.
  const eigen = parseFloat(product.attributes?.pakM2 ?? "");
  if (Number.isFinite(eigen) && eigen > 0) return eigen;
  return pakInhoudM2(variantNaam);
}
