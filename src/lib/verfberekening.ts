import { coveragePerLiter } from "@/lib/paint-bases";
import type { Product, ProductVariant } from "@/lib/types";

/**
 * Wat kost deze verf voor jouw klus?
 *
 * De aanleiding (Kevin): in "Kies je verf" stonden € 12,54 voor een liter en
 * € 52,30 voor vijf liter onder elkaar alsof je die kon vergelijken. De
 * goedkoopste regel was dat meestal niet — hij was gewoon het kleinste blik.
 * Wat een klant wil weten is wat zijn muur kost, en dan pas welke verf
 * voordeliger is.
 *
 * Daarvoor zijn drie dingen nodig: hoeveel vierkante meter, hoeveel liter dat
 * kost (rendement), en welke blikken je dan het slimst koopt. Die laatste
 * stap is niet "deel en rond af": voor 8 liter is 3 × 2,5 L + 1 × 1 L soms
 * goedkoper dan 2 × 5 L, en soms precies andersom.
 */

/** Vuistregels per verfsoort, voor als de fabrikant geen rendement opgeeft. */
const VUISTREGEL_M2_PER_LITER: { match: RegExp; m2: number }[] = [
  { match: /(muurverf|latex|sausklaar|wandverf)/i, m2: 8 },
  { match: /(grondverf|primer|voorstrijk|hechtprimer)/i, m2: 10 },
  { match: /(beits|olie|impregneer)/i, m2: 12 },
  { match: /(lak|hoogglans|zijdeglans|zijdemat)/i, m2: 12 },
];

export interface KlusInvoer {
  /** Te verven oppervlak in vierkante meters. */
  vierkanteMeter: number;
  /** Aantal lagen; twee is de norm bij dekkend werk. */
  lagen: number;
}

export interface BlikKeuze {
  /** Inhoud van dit blik in liters. */
  liters: number;
  /** Hoe het op de knop staat ("2,5 L"). */
  label: string;
  aantal: number;
  stukprijs: number;
}

export interface VerfBerekening {
  /** Liters die de klus vraagt, naar boven op twee decimalen. */
  benodigdeLiters: number;
  /** Rendement waarmee gerekend is, in m² per liter. */
  rendement: number;
  /** Komt dat rendement van de fabrikant of uit onze vuistregel? */
  rendementBron: "opgave" | "vuistregel";
  /** De blikken die je dan koopt, grootste eerst. */
  blikken: BlikKeuze[];
  /** Wat je in totaal betaalt, in centen. */
  totaal: number;
  /** Wat je per vierkante meter betaalt, in centen. */
  perM2: number;
  /** Liters die je overhoudt; helemaal op de meter kopen kan zelden. */
  overschot: number;
}

/** Het rendement van dit product, of een vuistregel op basis van de soort. */
export function rendementVan(product: Product): { m2: number; bron: "opgave" | "vuistregel" } {
  const opgave = coveragePerLiter(product);
  if (opgave) return { m2: opgave, bron: "opgave" };

  const tekst = `${product.name} ${product.attributes?.subcategorie ?? ""}`;
  const vuistregel = VUISTREGEL_M2_PER_LITER.find((regel) => regel.match.test(tekst));
  return { m2: vuistregel?.m2 ?? 10, bron: "vuistregel" };
}

/** De koopbare blikken van een product: inhoud in liters plus de prijs. */
interface Blik {
  liters: number;
  label: string;
  prijs: number;
}

function blikkenVan(product: Product): Blik[] {
  const uit: Blik[] = [];
  for (const variant of product.variants ?? []) {
    const liters = litersUit(variant);
    if (!liters) continue;
    const prijs = variant.kluspasPrice ?? variant.price;
    if (!prijs || prijs <= 0) continue;
    const label = variant.size ?? variant.name;
    // Dezelfde inhoud kan in meerdere basissen voorkomen; de goedkoopste telt.
    const bestaand = uit.find((blik) => blik.liters === liters);
    if (bestaand) {
      if (prijs < bestaand.prijs) bestaand.prijs = prijs;
      continue;
    }
    uit.push({ liters, label, prijs });
  }
  return uit.sort((a, b) => a.liters - b.liters);
}

function litersUit(variant: ProductVariant): number | null {
  const label = (variant.size ?? variant.name ?? "").toLowerCase();
  const ml = label.match(/([\d.,]+)\s*ml\b/);
  if (ml) {
    const waarde = Number(ml[1].replace(",", ".")) / 1000;
    return Number.isFinite(waarde) && waarde > 0 ? waarde : null;
  }
  const l = label.match(/([\d.,]+)\s*l\b/);
  if (l) {
    const waarde = Number(l[1].replace(",", "."));
    return Number.isFinite(waarde) && waarde > 0 ? waarde : null;
  }
  return null;
}

/**
 * De goedkoopste stapel blikken die samen genoeg verf leveren.
 *
 * Een gulzige aanpak (steeds het grootste blik dat nog past) gaat mis bij de
 * laatste liters: die vult hij aan met dure kleine blikken, terwijl één maat
 * groter vaak goedkoper is én genoeg. Daarom rekenen we in stappen van een
 * kwart liter alle mogelijkheden door en houden per hoeveelheid de goedkoopste
 * over — hetzelfde principe als een muntenprobleem, en met hooguit een paar
 * honderd stappen zo klaar.
 */
function goedkoopsteStapel(blikken: Blik[], nodig: number): BlikKeuze[] | null {
  if (blikken.length === 0 || nodig <= 0) return null;

  const STAP = 0.25;
  const doel = Math.ceil(nodig / STAP);
  // Ruimte om over te kopen: het grootste blik erbij, want de laatste druppel
  // vraagt soms een heel blik extra.
  const grootste = Math.ceil(blikken[blikken.length - 1].liters / STAP);
  const max = doel + grootste;

  const kosten = new Array<number>(max + 1).fill(Infinity);
  const vorige = new Array<number>(max + 1).fill(-1);
  kosten[0] = 0;

  for (let hoeveelheid = 1; hoeveelheid <= max; hoeveelheid++) {
    for (let index = 0; index < blikken.length; index++) {
      const stappen = Math.round(blikken[index].liters / STAP);
      if (stappen <= 0) continue;
      const vanaf = Math.max(0, hoeveelheid - stappen);
      if (kosten[vanaf] === Infinity) continue;
      const prijs = kosten[vanaf] + blikken[index].prijs;
      if (prijs < kosten[hoeveelheid]) {
        kosten[hoeveelheid] = prijs;
        vorige[hoeveelheid] = index;
      }
    }
  }

  // De goedkoopste optie die genoeg verf oplevert — niet per se precies genoeg.
  let beste = -1;
  for (let hoeveelheid = doel; hoeveelheid <= max; hoeveelheid++) {
    if (kosten[hoeveelheid] < (beste === -1 ? Infinity : kosten[beste])) beste = hoeveelheid;
  }
  if (beste === -1) return null;

  const aantallen = new Map<number, number>();
  let loop = beste;
  while (loop > 0 && vorige[loop] !== -1) {
    const index = vorige[loop];
    aantallen.set(index, (aantallen.get(index) ?? 0) + 1);
    loop = Math.max(0, loop - Math.round(blikken[index].liters / STAP));
  }

  return [...aantallen.entries()]
    .map(([index, aantal]) => ({
      liters: blikken[index].liters,
      label: blikken[index].label,
      aantal,
      stukprijs: blikken[index].prijs,
    }))
    .sort((a, b) => b.liters - a.liters);
}

/** Bereken wat dit product kost voor deze klus. */
export function berekenVoorKlus(
  product: Product,
  klus: KlusInvoer,
): VerfBerekening | null {
  if (!Number.isFinite(klus.vierkanteMeter) || klus.vierkanteMeter <= 0) return null;
  const lagen = Math.max(1, Math.min(4, Math.round(klus.lagen)));

  const { m2, bron } = rendementVan(product);
  const benodigdeLiters = (klus.vierkanteMeter * lagen) / m2;

  const blikken = blikkenVan(product);
  const stapel = goedkoopsteStapel(blikken, benodigdeLiters);
  if (!stapel) return null;

  const totaal = stapel.reduce((som, blik) => som + blik.aantal * blik.stukprijs, 0);
  const gekochteLiters = stapel.reduce((som, blik) => som + blik.aantal * blik.liters, 0);

  return {
    benodigdeLiters: Math.round(benodigdeLiters * 100) / 100,
    rendement: m2,
    rendementBron: bron,
    blikken: stapel,
    totaal,
    perM2: Math.round(totaal / klus.vierkanteMeter),
    overschot: Math.round((gekochteLiters - benodigdeLiters) * 100) / 100,
  };
}

/** "3 × 2,5 L + 1 × 1 L" — wat je in je mandje legt. */
export function stapelTekst(blikken: BlikKeuze[]): string {
  return blikken
    .map((blik) => `${blik.aantal} × ${blik.label}`)
    .join(" + ");
}
