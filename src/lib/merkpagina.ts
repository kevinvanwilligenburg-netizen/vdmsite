import { euro } from "@/lib/format";
import { categorieWeergaveNaam } from "@/lib/product-feed";
import { isEchtMerk, merknaam, toonbareRubriek } from "@/lib/tilroy";
import type { Product } from "@/lib/types";

/**
 * De inhoud van een merkpagina, afgeleid uit het assortiment zelf.
 *
 * Een merkpagina die voor elk merk dezelfde zin toont ("X artikelen van <merk>
 * bij De Voordeelmarkt") is voor Google hetzelfde als geen pagina: veertig
 * URL's met één woord verschil. Wat een merkpagina wél onderscheidt is wat er
 * feitelijk ligt — in welke rubrieken, in welke maten, hoeveel ervan
 * mengbaar is, en wat het goedkoopste en duurste artikel is. Die cijfers
 * verschillen per merk vanzelf, en ze kloppen altijd omdat ze uit de catalogus
 * komen.
 */

export interface MerkRubriek {
  slug: string;
  naam: string;
  aantal: number;
  /**
   * De schrijfwijzen waaronder dit merk in deze rubriek in de kassa staat.
   *
   * Het merkfilter op de categoriepagina vergelijkt met het ruwe merkveld,
   * niet met de nette schrijfwijze. Tilroy kent hetzelfde merk in meerdere
   * vormen ("Hg" naast "HG", "HAMMERITE" naast "Hammerite"), dus een link met
   * alleen de weergavenaam laat een deel van de artikelen liggen — of alles,
   * zoals bij HG.
   */
  merkwaarden: string[];
}

export interface MerkFeiten {
  aantal: number;
  vanaf: number;
  tot: number;
  /** Rubrieken waarin dit merk zit, grootste eerst. */
  rubrieken: MerkRubriek[];
  /** Maten die vaak voorkomen; zegt bij verf meer dan bij schroeven. */
  maten: string[];
  mengbaar: number;
  inAanbieding: number;
  /** Grootste korting ten opzichte van de adviesprijs, in procenten. */
  hoogsteKorting: number;
}

/** De naam van de rubriek waarin dit artikel staat, zoals Tilroy hem schrijft. */
function rubriekNaam(product: Product): string {
  return (
    product.attributes?.hoofdgroep?.trim() ||
    product.attributes?.subcategorie?.split("|")[0]?.trim() ||
    ""
  );
}

/**
 * De schrijfwijze die het vaakst voorkomt; bij gelijkstand alfabetisch.
 *
 * Dezelfde rubriek staat in de feed als "Beits, olie en vernis" én "Beits,
 * Olie en Vernis". Zonder deze keuze hangt het label af van de volgorde
 * waarin de feed binnenkomt, en wisselt het per crawl.
 */
/**
 * Tilroy kent "Gereedschap" onder twee codes (5 en 8000). Twee knoppen met
 * hetzelfde woord en verschillende aantallen is een raadsel; de grootste
 * blijft staan, net als in het menu.
 */
function ontdubbeldOpNaam<T extends { naam: string }>(rubrieken: T[]): T[] {
  const gezien = new Set<string>();
  return rubrieken.filter((rubriek) => {
    const sleutel = rubriek.naam.trim().toLocaleLowerCase("nl");
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
}

function vaakstGeschreven(namen: Map<string, number>): string {
  return [...namen.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"),
  )[0][0];
}

export function merkFeiten(products: Product[]): MerkFeiten {
  const perRubriek = new Map<
    string,
    { namen: Map<string, number>; aantal: number; merkwaarden: Set<string> }
  >();
  const maatTeller = new Map<string, number>();
  let mengbaar = 0;
  let inAanbieding = 0;
  let hoogsteKorting = 0;

  for (const product of products) {
    const naam = rubriekNaam(product);
    if (naam) {
      const bestaand = perRubriek.get(product.category) ?? {
        namen: new Map<string, number>(),
        aantal: 0,
        merkwaarden: new Set<string>(),
      };
      bestaand.aantal++;
      bestaand.namen.set(naam, (bestaand.namen.get(naam) ?? 0) + 1);
      if (product.brand?.trim()) bestaand.merkwaarden.add(product.brand.trim());
      perRubriek.set(product.category, bestaand);
    }
    for (const maat of (product.attributes?.inhoud ?? "").split("|")) {
      const schoon = maat.trim();
      if (schoon) maatTeller.set(schoon, (maatTeller.get(schoon) ?? 0) + 1);
    }
    if (product.colorMixable) mengbaar++;
    if (product.compareAtPrice && product.compareAtPrice > product.price) {
      inAanbieding++;
      const korting = Math.round((1 - product.price / product.compareAtPrice) * 100);
      if (korting > hoogsteKorting) hoogsteKorting = korting;
    }
  }

  const prijzen = products.map((product) => product.price);

  return {
    aantal: products.length,
    vanaf: Math.min(...prijzen),
    tot: Math.max(...prijzen),
    rubrieken: ontdubbeldOpNaam(
      [...perRubriek.entries()]
        .map(([slug, { namen, aantal, merkwaarden }]) => ({
          slug,
          naam: categorieWeergaveNaam(slug, vaakstGeschreven(namen)),
          aantal,
          merkwaarden: [...merkwaarden],
        }))
        // Zelfde regel als het menu: het restgroepje "Verf" (code 1, met bij
        // Sikkens precies één artikel) hoort ook hier niet als knop.
        .filter((rubriek) => toonbareRubriek(rubriek.naam))
        .sort((a, b) => b.aantal - a.aantal),
    ),
    maten: [...maatTeller.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([maat]) => maat),
    mengbaar,
    inAanbieding,
    hoogsteKorting,
  };
}

/**
 * De openingsalinea. Bewust opgebouwd uit de feiten hierboven, zodat hij per
 * merk verschilt zonder dat er iets verzonnen wordt.
 */
export function merkInleiding(naam: string, feiten: MerkFeiten): string {
  const rubriek = feiten.rubrieken[0];
  const delen: string[] = [];

  delen.push(
    feiten.rubrieken.length === 1 && rubriek
      ? `${naam} bij De Voordeelmarkt: ${feiten.aantal} ${
          feiten.aantal === 1 ? "artikel" : "artikelen"
        } in ${rubriek.naam.toLowerCase()}.`
      : `${naam} bij De Voordeelmarkt: ${feiten.aantal} artikelen, verdeeld over ${feiten.rubrieken.length} rubrieken.`,
  );

  delen.push(
    feiten.vanaf === feiten.tot
      ? `De prijs is ${euro(feiten.vanaf)}.`
      : `Prijzen lopen van ${euro(feiten.vanaf)} tot ${euro(feiten.tot)}.`,
  );

  if (feiten.mengbaar > 0) {
    delen.push(
      feiten.mengbaar === feiten.aantal
        ? "Alles is mengbaar in elke kleur; onze verfspecialist maakt hem gratis aan."
        : `Daarvan ${feiten.mengbaar === 1 ? "is er één" : `zijn er ${feiten.mengbaar}`} mengbaar in elke kleur, gratis aangemaakt door onze verfspecialist.`,
    );
  }

  if (feiten.inAanbieding > 0 && feiten.hoogsteKorting >= 10) {
    delen.push(
      `${feiten.inAanbieding} ${
        feiten.inAanbieding === 1 ? "artikel staat" : "artikelen staan"
      } in de aanbieding, met kortingen tot ${feiten.hoogsteKorting}% op de adviesprijs.`,
    );
  }

  return delen.join(" ");
}

/** Vragen die bij dit merk horen, met antwoorden uit de eigen gegevens. */
export function merkVragen(
  naam: string,
  feiten: MerkFeiten,
): { q: string; a: string }[] {
  const vragen: { q: string; a: string }[] = [
    {
      q: `Wat kost ${naam} bij De Voordeelmarkt?`,
      a:
        feiten.vanaf === feiten.tot
          ? `Elk artikel van ${naam} kost hier ${euro(feiten.vanaf)}.`
          : `${naam} begint bij ${euro(feiten.vanaf)} en loopt tot ${euro(
              feiten.tot,
            )}. Met een account krijg je daar nog korting op.`,
    },
    {
      q: `Welke ${naam}-artikelen hebben jullie?`,
      a:
        feiten.rubrieken.length === 0
          ? `We voeren ${feiten.aantal} artikelen van ${naam}.`
          : `We voeren ${feiten.aantal} artikelen van ${naam}, vooral in ${feiten.rubrieken
              .slice(0, 3)
              .map((rubriek) => `${rubriek.naam.toLowerCase()} (${rubriek.aantal})`)
              .join(", ")}.`,
    },
    {
      q: `Kan ik ${naam} vandaag nog ophalen?`,
      a: "Ligt het artikel in een van onze vijf winkels op voorraad, dan staat je bestelling er binnen twee uur klaar. Op de productpagina zie je per winkel wat er ligt.",
    },
  ];

  if (feiten.mengbaar > 0) {
    vragen.splice(2, 0, {
      q: `Mengen jullie ${naam} in elke kleur?`,
      a: `Ja. ${feiten.mengbaar} van onze ${naam}-artikelen zijn mengbaar in meer dan 18.000 kleuren. Aanmengen kost niets; onze verfspecialist kiest automatisch de juiste basis bij jouw kleur.`,
    });
  }

  return vragen;
}

/* ── Wie is een verfmerk? ──────────────────────────────────────────
 *
 * Hier stond dit als `getBrands(24, { categorySlug: "verf" })`: één slug die
 * moest bestaan. Sinds we de indeling van Tilroy volgen bestaat "verf" niet
 * meer als rubriek — er zijn lakken, muurverf, beits en speciaalverven — en
 * viel de hele sectie Verfmerken stil weg. Niemand zag het, want een lege
 * lijst geeft geen foutmelding.
 *
 * Daarom nu geen enkele vaste rubrieknaam meer als voorwaarde, maar drie
 * routes die elkaar opvangen. Twee ervan lezen het artikel zelf, en de derde
 * leidt uit de catalogus af welke rubrieken verfrubrieken zijn. Wisselt
 * Tilroy morgen van rubrieknaam, dan verandert er niets aan de uitkomst.
 * ────────────────────────────────────────────────────────────────── */

/**
 * Inhoud in liters of milliliters. Verf wordt per volume verkocht; een kwast
 * of een schroef niet. Nodig als tegenwicht bij de glansgraad, want die staat
 * in de feed ook bij kwasten "voor watergedragen verf".
 */
const INHOUD_PER_VOLUME = /(^|[^a-z])\d+(?:[.,]\d+)?\s*(?:l|lt|ltr|liter|ml|cl)\b/i;

/**
 * Woorden waarmee een rubriek zichzelf als verf aankondigt. Bewust op woord
 * en niet op slug: "Lakken" mag morgen "Lakverf" heten zonder dat er iets
 * omvalt. Gecontroleerd tegen alle 58 rubrieken uit de feed — alleen Lakken,
 * Muurverf, Speciaalverven, Beits/olie/vernis, Partij Verf, Alkydverf en
 * Alabastine muurverf komen erdoor.
 */
const VERFWOORD = /verf|verv|lak|beits|vernis|primer|glazuur/i;

/**
 * Vanaf welk deel harde verfsignalen een rubriek een verfrubriek is.
 *
 * Gemeten over de 3.352 online artikelen loopt dit niet geleidelijk op:
 * Lakken 50%, Speciaalverven 52%, Voorbewerken 36%, Muurverf 23%, Beits/olie/
 * vernis 19% — en daarna nul. Elke grens tussen 1% en 19% geeft dezelfde vijf
 * rubrieken, dus de keuze is niet gevoelig.
 */
const AANDEEL_VERFRUBRIEK = 0.15;

/** Onder dit aantal zegt een percentage niets; die rubrieken lopen via de naam. */
const MIN_ARTIKELEN_VOOR_AANDEEL = 10;

/**
 * Vanaf welk deel verf een merk een verfmerk is.
 *
 * Ook hier is de verdeling tweetoppig: Fitex is met 55% het laagste verfmerk,
 * Veba (schuurmateriaal, wat lak ernaast) met 27% het hoogste niet-verfmerk.
 * Daartussen zit niets, dus elke grens van 30% tot 55% levert dezelfde 22
 * merken op. Een derde ligt midden in dat gat.
 */
const AANDEEL_VERFMERK = 1 / 3;

/** Wordt dit artikel per volume verkocht? */
function perVolume(product: Product): boolean {
  return (product.attributes?.inhoud ?? "")
    .split("|")
    .some((maat) => INHOUD_PER_VOLUME.test(maat.trim()));
}

/**
 * Zegt het artikel zélf dat het verf is?
 *
 * Mengverf is onbetwistbaar: dat vlaggetje zet de kassa alleen bij verf die
 * op de machine gaat. Een glansgraad hoort bij een verflaag, maar staat in de
 * feed ook bij kwasten — samen met een inhoud in liters blijft alleen de verf
 * over.
 */
function heeftVerfsignaal(product: Product): boolean {
  if (product.colorMixable) return true;
  return Boolean(product.attributes?.glans) && perVolume(product);
}

/**
 * De rubrieken die verf verkopen, afgeleid uit de catalogus zelf.
 *
 * Twee routes: de naam noemt verf, óf een noemenswaardig deel van de
 * artikelen draagt een hard verfsignaal. Die tweede route vangt rubrieken op
 * waarvan de naam niets prijsgeeft — "Voorbewerken" (grondverf, voorstrijk)
 * is er zo een: 29 van de 80 artikelen zijn mengbaar of hebben een glansgraad.
 */
export function verfrubrieken(products: Product[]): Set<string> {
  const perRubriek = new Map<string, { aantal: number; signalen: number; namen: Set<string> }>();
  for (const product of products) {
    const entry = perRubriek.get(product.category) ?? {
      aantal: 0,
      signalen: 0,
      namen: new Set<string>(),
    };
    entry.aantal++;
    if (heeftVerfsignaal(product)) entry.signalen++;
    const naam = rubriekNaam(product);
    if (naam) entry.namen.add(naam);
    perRubriek.set(product.category, entry);
  }

  const gevonden = new Set<string>();
  for (const [slug, entry] of perRubriek) {
    const viaNaam = [...entry.namen].some((naam) => VERFWOORD.test(naam));
    const viaAandeel =
      entry.aantal >= MIN_ARTIKELEN_VOOR_AANDEEL &&
      entry.signalen / entry.aantal >= AANDEEL_VERFRUBRIEK;
    if (viaNaam || viaAandeel) gevonden.add(slug);
  }
  return gevonden;
}

/** Is dit artikel verf? */
function isVerfArtikel(product: Product, rubrieken: Set<string>): boolean {
  return heeftVerfsignaal(product) || rubrieken.has(product.category);
}

/**
 * Sleutel om een merk op te zoeken, ongevoelig voor schrijfwijze.
 *
 * Tilroy schrijft hetzelfde merk als "Trae lyx" én "TRAE LYX"; `merknaam()`
 * maakt daar "Trae lyx" en "Trae Lyx" van, en dat zijn twee sleutels waar er
 * één hoort te zijn. Beide kanten van de vergelijking lopen door deze functie,
 * dus ze kunnen nooit uit elkaar lopen.
 */
export function merkSleutel(naam: string): string {
  return naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * De merken waarvan een noemenswaardig deel van het assortiment verf is.
 * Levert sleutels op; vergelijk met `merkSleutel(brand.name)`.
 */
export function verfmerken(products: Product[]): Set<string> {
  const rubrieken = verfrubrieken(products);
  const perMerk = new Map<string, { aantal: number; verf: number }>();

  for (const product of products) {
    if (!isEchtMerk(product.brand)) continue;
    const sleutel = merkSleutel(merknaam(product.brand));
    if (!sleutel) continue;
    const entry = perMerk.get(sleutel) ?? { aantal: 0, verf: 0 };
    entry.aantal++;
    if (isVerfArtikel(product, rubrieken)) entry.verf++;
    perMerk.set(sleutel, entry);
  }

  const gevonden = new Set<string>();
  for (const [sleutel, entry] of perMerk) {
    if (entry.verf / entry.aantal >= AANDEEL_VERFMERK) gevonden.add(sleutel);
  }
  return gevonden;
}

/** Staat dit merk in de verfsectie? */
export function isVerfmerk(merken: Set<string>, naam: string): boolean {
  return merken.has(merkSleutel(naam));
}
