import { getProducts } from "@/lib/tilroy";
import { coveragePerLiter, sizesInLiters } from "@/lib/paint-bases";
import type { Product } from "@/lib/types";

/**
 * Klusadviseur.
 *
 * De klant beschrijft de klus in gewone taal ("slaapkamer van donkerblauw
 * naar wit, 4 bij 3 meter"). Daar rolt een compleet advies uit: het juiste
 * type verf, hoeveel liter, of er grondverf nodig is en welk gereedschap
 * erbij hoort — alles direct in het mandje te leggen.
 *
 * De taalverwerking (vrije tekst → parameters) doet Claude in de API-route.
 * Het rékenen gebeurt hier, deterministisch. Dat is bewust: een klant die
 * te weinig verf koopt komt terug met een half geverfde muur, dus de
 * hoeveelheid mag niet afhangen van wat een taalmodel toevallig uitrekent.
 * Zonder API-sleutel valt de route terug op `leesVraag()` hieronder en
 * blijft de adviseur gewoon werken.
 */

export type KlusSoort =
  | "muur-binnen"
  | "plafond"
  | "hout-binnen"
  | "hout-buiten"
  | "kozijn-buiten"
  | "radiator"
  | "vloer"
  | "metaal"
  | "onbekend";

export interface KlusVraag {
  klus: KlusSoort;
  /** Direct opgegeven te schilderen oppervlak in m². */
  oppervlakM2?: number;
  /** Kamermaten; hieruit rekenen we het wandoppervlak zelf uit. */
  kamer?: { lengte?: number; breedte?: number; hoogte?: number };
  /** Aantal deuren/kozijnen/radiatoren, als de klant die noemt. */
  aantal?: number;
  huidigeKleur?: string;
  nieuweKleur?: string;
  ondergrond?: "kaal-hout" | "geverfd" | "gestuukt" | "behang" | "metaal" | "onbekend";
  /** Vrije opmerkingen die het advies kleuren (vochtige ruimte, kinderkamer). */
  bijzonderheden?: string[];
}

export interface AdviesProduct {
  product: Product;
  rol: "verf" | "grondverf" | "gereedschap";
  waarom: string;
  /** Geadviseerd aantal stuks/blikken. */
  aantal: number;
  /** Op welke inhoud dat aantal gebaseerd is, bv. "2,5 L". */
  inhoud?: string;
}

export interface Advies {
  /** Korte samenvatting van wat we begrepen hebben. */
  samenvatting: string;
  oppervlakM2: number | null;
  /** Hoe we aan dat oppervlak komen — de klant mag ons kunnen narekenen. */
  berekening: string | null;
  lagen: number;
  litersNodig: number | null;
  grondverfNodig: boolean;
  grondverfReden: string | null;
  stappen: string[];
  producten: AdviesProduct[];
  /** Wat we níét zeker weten; nodigt uit tot een vervolgvraag. */
  aannames: string[];
}

/* ── Kennisbank per kluschsoort ───────────────────────────────────
 *
 * Rendement en laagdikte volgen de gangbare praktijkwaarden; staat het
 * rendement op het gekozen product zelf, dan wint dat (zie `litersVoor`).
 */

/**
 * Zoekopdracht in de catalogus.
 *
 * `verboden` is minstens zo belangrijk als `termen`: zonder die lijst vindt
 * "muurverf" ook "Muurverf Voorstrijk" (een grondlaag, geen muurverf) en
 * levert "grondverf" een metaalprimer op voor een houten schutting.
 */
interface Zoekopdracht {
  termen: string[];
  verboden?: string[];
}

interface KlusProfiel {
  label: string;
  verf: Zoekopdracht;
  grondverf: Zoekopdracht;
  /** m² per liter bij één laag, als de verf zelf niets zegt. */
  rendement: number;
  lagen: number;
  gereedschap: { termen: string[]; waarom: string }[];
  stappen: string[];
  /** Oppervlak per stuk, voor klussen die je per stuk telt. */
  m2PerStuk?: number;
  stukLabel?: string;
}

const PROFIELEN: Record<Exclude<KlusSoort, "onbekend">, KlusProfiel> = {
  "muur-binnen": {
    label: "muren binnen",
    verf: {
      termen: ["muurverf", "latex", "wandverf"],
      verboden: ["voorstrijk", "primer", "grondverf", "grondlak", "beits", "buiten"],
    },
    grondverf: {
      termen: ["voorstrijk", "primer muur", "grondverf muur"],
      verboden: ["metaal", "roest", "hout"],
    },
    rendement: 8,
    lagen: 2,
    gereedschap: [
      { termen: ["verfroller", "muurroller", "roller"], waarom: "Groot vlak snel en streeploos" },
      { termen: ["verfbak", "roosterbak"], waarom: "Verdeelt de verf gelijkmatig over de roller" },
      { termen: ["afplaktape", "schilderstape"], waarom: "Strakke randen langs plinten en kozijnen" },
      { termen: ["afdekfolie", "afdekzeil"], waarom: "Beschermt vloer en meubels" },
    ],
    stappen: [
      "Ruimte leeghalen, vloer en plinten afdekken.",
      "Muren stofvrij maken; vette plekken ontvetten.",
      "Gaatjes vullen, laten drogen en licht schuren.",
      "Randen langs plafond en kozijnen eerst met de kwast.",
      "Vlak in banen rollen, laag voor laag, nat-in-nat.",
    ],
  },
  plafond: {
    label: "het plafond",
    verf: {
      termen: ["plafondverf", "muurverf", "latex"],
      verboden: ["voorstrijk", "primer", "grondverf", "grondlak", "beits", "buiten"],
    },
    grondverf: {
      termen: ["voorstrijk", "primer muur"],
      verboden: ["metaal", "roest", "hout"],
    },
    rendement: 8,
    lagen: 2,
    gereedschap: [
      { termen: ["verfroller", "roller"], waarom: "Boven je hoofd werk je het snelst met een roller" },
      { termen: ["verlengsteel", "telescoopsteel"], waarom: "Schilderen zonder trap verzetten" },
      { termen: ["afdekfolie", "afdekzeil"], waarom: "Plafondverf spat altijd" },
    ],
    stappen: [
      "Vloer volledig afdekken, plafondverf spat.",
      "Plafond stofvrij maken.",
      "Randen langs de muur voorsnijden met de kwast.",
      "In banen rollen, haaks op het licht van het raam.",
    ],
  },
  "hout-binnen": {
    label: "houtwerk binnen",
    verf: {
      termen: ["lakverf", "aflak", "binnenlak", "zijdeglans lak"],
      verboden: ["grond", "primer", "voorstrijk", "beits", "muurverf", "buiten"],
    },
    grondverf: {
      termen: ["grondverf hout", "grondlak", "grondverf"],
      verboden: ["metaal", "roest"],
    },
    rendement: 12,
    lagen: 2,
    gereedschap: [
      { termen: ["lakkwast", "kwast"], waarom: "Voor een strak lakresultaat" },
      { termen: ["lakroller", "vachtroller"], waarom: "Grote vlakken zoals deuren, zonder strepen" },
      { termen: ["schuurpapier", "schuurspons"], waarom: "Hechting: altijd licht opruwen" },
      { termen: ["afplaktape", "schilderstape"], waarom: "Strakke overgang naar de muur" },
    ],
    stappen: [
      "Schoonmaken en ontvetten.",
      "Licht schuren tot de glans weg is, daarna stofvrij maken.",
      "Kale of doorgeschuurde plekken gronden.",
      "Eerste laklaag dun aanbrengen.",
      "Tussenschuren, afstoffen en de tweede laag lakken.",
    ],
  },
  "hout-buiten": {
    label: "buitenhoutwerk",
    verf: {
      termen: ["buitenlak", "buitenverf", "beits", "aflak"],
      verboden: ["grond", "primer", "voorstrijk", "muurverf"],
    },
    grondverf: {
      termen: ["grondverf hout", "grondlak", "grondverf"],
      verboden: ["metaal", "roest", "muur"],
    },
    rendement: 10,
    lagen: 2,
    gereedschap: [
      { termen: ["lakkwast", "kwast"], waarom: "Buitenwerk vraagt om een stevige kwast" },
      { termen: ["schuurpapier", "schuurspons"], waarom: "Losse verf en verweerde lagen weg" },
      { termen: ["plamuur", "houtreparatie"], waarom: "Rotte plekken eerst herstellen" },
      { termen: ["afplaktape", "schilderstape"], waarom: "Glas en beslag vrijhouden" },
    ],
    stappen: [
      "Losse verf verwijderen en houtrot herstellen.",
      "Grondig schuren en stofvrij maken.",
      "Kale plekken gronden, buiten altijd.",
      "Twee laklagen, met droogtijd ertussen.",
      "Schilder niet in de volle zon of bij kans op regen.",
    ],
  },
  "kozijn-buiten": {
    label: "de kozijnen",
    verf: {
      termen: ["buitenlak", "aflak", "buitenverf"],
      verboden: ["grond", "primer", "voorstrijk", "beits", "muurverf"],
    },
    grondverf: {
      termen: ["grondverf hout", "grondlak", "grondverf"],
      verboden: ["metaal", "roest", "muur"],
    },
    rendement: 10,
    lagen: 2,
    m2PerStuk: 3,
    stukLabel: "kozijn",
    gereedschap: [
      { termen: ["lakkwast", "kwast"], waarom: "Precies werken langs het glas" },
      { termen: ["schuurpapier", "schuurspons"], waarom: "Hechting op oude lagen" },
      // Specifiek eerst, anders levert "kit" een kitspuit op in plaats van kit.
      {
        termen: ["acrylaatkit", "afdichtingskit", "schilderskit", "voegkit"],
        waarom: "Naden dicht houden tegen vocht",
      },
      { termen: ["afplaktape", "schilderstape"], waarom: "Glas afplakken werkt sneller dan afsnijden" },
    ],
    stappen: [
      "Kitranden en naden controleren en zo nodig vernieuwen.",
      "Losse verf weghalen, schuren, stofvrij maken.",
      "Kale plekken gronden.",
      "Twee laklagen aanbrengen.",
    ],
  },
  radiator: {
    label: "de radiator",
    verf: {
      termen: ["radiatorlak", "radiatorverf", "lakverf"],
      verboden: ["grond", "primer", "voorstrijk", "beits", "muurverf"],
    },
    grondverf: {
      termen: ["metaalprimer", "grondverf metaal", "primer metaal", "grondverf"],
      verboden: ["muur", "voorstrijk"],
    },
    rendement: 12,
    lagen: 2,
    m2PerStuk: 2,
    stukLabel: "radiator",
    gereedschap: [
      { termen: ["radiatorroller", "lakroller"], waarom: "Komt achter en tussen de ribben" },
      { termen: ["kwast", "lakkwast"], waarom: "Voor de randen en de aansluitingen" },
      { termen: ["schuurpapier", "schuurspons"], waarom: "Roest en glans weg voor je begint" },
    ],
    stappen: [
      "Radiator uitzetten en volledig laten afkoelen.",
      "Ontvetten en licht schuren; roest helemaal wegnemen.",
      "Kale plekken gronden met een metaalprimer.",
      "Twee dunne lagen radiatorlak, dik smeren geeft zakkers.",
    ],
  },
  vloer: {
    label: "de vloer",
    verf: {
      termen: ["vloerverf", "betonverf", "vloercoating"],
      verboden: ["grond", "primer", "voorstrijk"],
    },
    grondverf: {
      termen: ["vloerprimer", "primer beton", "voorstrijk"],
      verboden: ["metaal", "roest"],
    },
    rendement: 7,
    lagen: 2,
    gereedschap: [
      { termen: ["verfroller", "vloerroller", "roller"], waarom: "Gelijkmatige laag over het hele vlak" },
      { termen: ["verlengsteel", "telescoopsteel"], waarom: "Rechtop werken scheelt je rug" },
      // Alleen "ontvetter": "reiniger" levert een glasreiniger op.
      { termen: ["ontvetter"], waarom: "Vloerverf hecht alleen op een vetvrije vloer" },
    ],
    stappen: [
      "Vloer volledig leeghalen en grondig reinigen.",
      "Ontvetten en laten drogen.",
      "Poreuze vloeren eerst voorstrijken.",
      "Twee lagen aanbrengen, werk naar de deur toe.",
    ],
  },
  metaal: {
    label: "het metaalwerk",
    verf: {
      termen: ["metaallak", "lakverf", "aflak"],
      verboden: ["grond", "primer", "voorstrijk", "beits", "muurverf"],
    },
    grondverf: {
      termen: ["metaalprimer", "grondverf metaal", "roestwerende primer", "grondverf"],
      verboden: ["muur", "voorstrijk"],
    },
    rendement: 12,
    lagen: 2,
    gereedschap: [
      { termen: ["lakkwast", "kwast"], waarom: "Voor hoeken en profielen" },
      { termen: ["staalborstel", "schuurpapier"], waarom: "Roest eerst helemaal weg" },
      { termen: ["ontvetter"], waarom: "Metaal is vaak vettig; zonder ontvetten laat de lak los" },
    ],
    stappen: [
      "Roest wegborstelen tot op het gezonde metaal.",
      "Ontvetten en droogmaken.",
      "Roestwerende primer aanbrengen.",
      "Twee laklagen aanbrengen.",
    ],
  },
};

/* ── Vrije tekst begrijpen zonder AI (terugval) ───────────────────── */

const KLUS_WOORDEN: { soort: KlusSoort; woorden: string[] }[] = [
  { soort: "plafond", woorden: ["plafond", "zoldering"] },
  { soort: "radiator", woorden: ["radiator", "verwarming", "cv-radiator"] },
  { soort: "vloer", woorden: ["vloer", "beton", "garagevloer"] },
  { soort: "kozijn-buiten", woorden: ["kozijn", "raamkozijn", "buitenkozijn"] },
  {
    soort: "hout-buiten",
    woorden: ["schutting", "tuinhuis", "buitendeur", "dakkapel", "boeidel", "buitenhout"],
  },
  { soort: "metaal", woorden: ["hek", "poort", "metaal", "staal", "leuning"] },
  {
    soort: "hout-binnen",
    woorden: ["deur", "trap", "plint", "traphek", "binnendeur", "houtwerk", "lambrisering"],
  },
  {
    soort: "muur-binnen",
    woorden: ["muur", "wand", "kamer", "slaapkamer", "woonkamer", "badkamer", "hal", "gang", "keuken"],
  },
];

const DONKERE_KLEUREN = [
  "zwart",
  "donkerblauw",
  "donkergroen",
  "donkerrood",
  "donkerbruin",
  "donkergrijs",
  "antraciet",
  "bordeaux",
  "marine",
  "petrol",
  "aubergine",
  "diepblauw",
];

const LICHTE_KLEUREN = ["wit", "gebroken wit", "crème", "creme", "ivoor", "lichtgrijs", "beige", "zand"];

/** Mensen schrijven "twee deuren", niet "2 deuren". */
const TELWOORDEN: Record<string, number> = {
  een: 1,
  één: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vijf: 5,
  zes: 6,
  zeven: 7,
  acht: 8,
  negen: 9,
  tien: 10,
};

/**
 * Haal de kleur uit een stukje zin. "wit schilderen" is de kleur wit; het
 * werkwoord hoort er niet bij, anders leest de samenvatting als onzin.
 */
function schoonKleur(fragment: string): string | undefined {
  const tekst = fragment.trim().toLowerCase();
  const bekend = [...DONKERE_KLEUREN, ...LICHTE_KLEUREN]
    // Langste eerst, zodat "donkerblauw" wint van "blauw".
    .sort((a, b) => b.length - a.length)
    .find((kleur) => tekst.includes(kleur));
  if (bekend) return bekend;

  const woorden = tekst.split(/\s+/).filter(Boolean);
  const eerste = woorden[0];
  if (!eerste || eerste.length < 3) return undefined;
  // Alleen als het geen werkwoord is; anders weten we het gewoon niet.
  if (/(en|ren)$/.test(eerste) && eerste.length > 5) return undefined;
  return eerste;
}

/** Losse getallen uit "4 bij 3", "4x3", "4 m x 3 m", "20 m2". */
function getallenUit(text: string): number[] {
  const treffers = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|meter|m\b)?/gi) ?? [];
  return treffers
    .map((t) => Number(t.replace(/[^\d.,]/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1000);
}

/**
 * Trefwoord-analyse van de vraag. Dit is de terugval als er geen
 * Anthropic-sleutel is ingesteld; hij haalt de belangrijkste zaken eruit
 * (soort klus, maten, kleuren) zodat het advies ook dan bruikbaar is.
 */
export function leesVraag(tekst: string): KlusVraag {
  const text = tekst.toLowerCase();

  let klus: KlusSoort = "onbekend";
  for (const regel of KLUS_WOORDEN) {
    if (regel.woorden.some((woord) => text.includes(woord))) {
      klus = regel.soort;
      break;
    }
  }
  // "deur buiten" / "schutting" is ander werk dan binnenhout.
  if (klus === "hout-binnen" && /(buiten|tuin|schuur|garage)/.test(text)) klus = "hout-buiten";

  const vraag: KlusVraag = { klus };

  const directM2 = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|vierkante meter)/i);
  if (directM2) {
    vraag.oppervlakM2 = Number(directM2[1].replace(",", "."));
  } else {
    const maten = text.match(/(\d+(?:[.,]\d+)?)\s*(?:bij|x|\*)\s*(\d+(?:[.,]\d+)?)/i);
    if (maten) {
      vraag.kamer = {
        lengte: Number(maten[1].replace(",", ".")),
        breedte: Number(maten[2].replace(",", ".")),
      };
      const hoogte = text.match(/(?:hoog|hoogte)\D{0,10}(\d+(?:[.,]\d+)?)/i);
      if (hoogte) vraag.kamer.hoogte = Number(hoogte[1].replace(",", "."));
    }
  }

  const stuks = text.match(
    /(\d+|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\s*(?:oude\s+|houten\s+|binnen|buiten)?(deuren|deur|kozijnen|kozijn|radiatoren|radiator)/i,
  );
  if (stuks) vraag.aantal = TELWOORDEN[stuks[1]] ?? Number(stuks[1]);
  else if (!vraag.oppervlakM2 && !vraag.kamer && ["kozijn-buiten", "radiator"].includes(klus)) {
    const losse = getallenUit(text);
    if (losse.length === 1) vraag.aantal = losse[0];
  }

  const van = text.match(/van\s+([a-zà-ü\s]{3,20}?)\s+(?:naar|in)\s+([a-zà-ü\s]{3,20})/i);
  if (van) {
    vraag.huidigeKleur = schoonKleur(van[1]);
    vraag.nieuweKleur = schoonKleur(van[2]);
  }
  if (!vraag.huidigeKleur) {
    const donker = DONKERE_KLEUREN.find((kleur) => text.includes(kleur));
    if (donker) vraag.huidigeKleur = donker;
  }
  if (!vraag.nieuweKleur) {
    const licht = LICHTE_KLEUREN.find((kleur) => text.includes(kleur));
    if (licht) vraag.nieuweKleur = licht;
  }

  if (/kaal hout|onbehandeld|nieuw hout|blank hout/.test(text)) vraag.ondergrond = "kaal-hout";
  else if (/gestuukt|stucwerk|nieuw stuc/.test(text)) vraag.ondergrond = "gestuukt";
  else if (/behang/.test(text)) vraag.ondergrond = "behang";
  else if (/geverfd|geschilderd|oude verf/.test(text)) vraag.ondergrond = "geverfd";

  const bijzonder: string[] = [];
  if (/badkamer|douche|vochtig|keuken/.test(text)) bijzonder.push("vochtige ruimte");
  if (/kinderkamer|kinderen|babykamer/.test(text)) bijzonder.push("kinderkamer");
  if (/afwasbaar|schoonmaken|reinigbaar/.test(text)) bijzonder.push("afwasbaar");
  if (bijzonder.length > 0) vraag.bijzonderheden = bijzonder;

  return vraag;
}

/* ── Rekenen ──────────────────────────────────────────────────────── */

interface Oppervlak {
  m2: number | null;
  uitleg: string | null;
  aannames: string[];
}

const STANDAARD_HOOGTE = 2.6;

function oppervlakVan(vraag: KlusVraag, profiel: KlusProfiel | null): Oppervlak {
  const aannames: string[] = [];

  if (vraag.oppervlakM2 && vraag.oppervlakM2 > 0) {
    return { m2: vraag.oppervlakM2, uitleg: `${fmt(vraag.oppervlakM2)} m² zoals opgegeven`, aannames };
  }

  const kamer = vraag.kamer;
  if (kamer?.lengte && kamer.breedte) {
    if (vraag.klus === "plafond" || vraag.klus === "vloer") {
      const m2 = kamer.lengte * kamer.breedte;
      return {
        m2,
        uitleg: `${fmt(kamer.lengte)} × ${fmt(kamer.breedte)} m = ${fmt(m2)} m²`,
        aannames,
      };
    }
    const hoogte = kamer.hoogte ?? STANDAARD_HOOGTE;
    if (!kamer.hoogte) aannames.push(`We rekenen met een plafondhoogte van ${fmt(STANDAARD_HOOGTE)} m.`);
    // Omtrek × hoogte, min een ruime aftrek voor deur en raam.
    const bruto = 2 * (kamer.lengte + kamer.breedte) * hoogte;
    const m2 = Math.max(bruto - 5, bruto * 0.8);
    aannames.push("Er is 5 m² afgetrokken voor deur en raam.");
    return {
      m2,
      uitleg: `2 × (${fmt(kamer.lengte)} + ${fmt(kamer.breedte)}) × ${fmt(hoogte)} m − 5 m² = ${fmt(m2)} m² wand`,
      aannames,
    };
  }

  if (profiel?.m2PerStuk) {
    // Noemt de klant geen aantal, dan gaan we uit van één stuk. Dat geeft een
    // concreet advies in plaats van "geef je maten door", en de klant ziet in
    // de aannames waar het op gebaseerd is.
    const aantal = vraag.aantal ?? 1;
    const label = profiel.stukLabel ?? "stuk";
    if (!vraag.aantal) aannames.push(`We rekenen met één ${label}.`);
    const m2 = aantal * profiel.m2PerStuk;
    return {
      m2,
      uitleg: `${aantal} × ${fmt(profiel.m2PerStuk)} m² per ${label} = ${fmt(m2)} m²`,
      aannames,
    };
  }

  if (vraag.aantal && vraag.klus === "hout-binnen") {
    // Een binnendeur is aan twee kanten ongeveer 2 × 2 m².
    const m2 = vraag.aantal * 4;
    return {
      m2,
      uitleg: `${vraag.aantal} × 4 m² per deur (beide zijden) = ${fmt(m2)} m²`,
      aannames: [...aannames, "We rekenen 4 m² per deur, beide zijden meegerekend."],
    };
  }

  return { m2: null, uitleg: null, aannames };
}

function fmt(value: number): string {
  return value
    .toFixed(value % 1 === 0 ? 0 : 1)
    .replace(".", ",");
}

/** Grondverf nodig? Met de reden erbij, want dat is waar klanten op afhaken. */
function grondverfCheck(vraag: KlusVraag): { nodig: boolean; reden: string | null } {
  if (vraag.ondergrond === "kaal-hout") {
    return { nodig: true, reden: "Kaal hout zuigt de verf op; zonder grondlaag krijg je een vlekkerig resultaat." };
  }
  if (vraag.ondergrond === "gestuukt") {
    return { nodig: true, reden: "Vers stucwerk is poreus, eerst voorstrijken, anders trekt de muurverf ongelijk in." };
  }
  if (vraag.ondergrond === "metaal" || vraag.klus === "metaal" || vraag.klus === "radiator") {
    return { nodig: true, reden: "Op metaal hecht lak alleen goed met een primer, en die houdt roest buiten." };
  }
  if (vraag.klus === "hout-buiten" || vraag.klus === "kozijn-buiten") {
    return { nodig: true, reden: "Buitenwerk: kale en doorgeschuurde plekken altijd gronden voor je lakt." };
  }
  if (vraag.huidigeKleur && vraag.nieuweKleur) {
    const donkerNaarLicht =
      DONKERE_KLEUREN.some((kleur) => vraag.huidigeKleur!.includes(kleur)) &&
      LICHTE_KLEUREN.some((kleur) => vraag.nieuweKleur!.includes(kleur));
    if (donkerNaarLicht) {
      return {
        nodig: true,
        reden: "Van donker naar licht dekt zelden in twee lagen, met een grondlaag ben je sneller klaar en gebruik je minder verf.",
      };
    }
  }
  return { nodig: false, reden: null };
}

/** Extra laag bij een lastige kleurovergang. */
function lagenVoor(vraag: KlusVraag, profiel: KlusProfiel, gegrond: boolean): number {
  if (gegrond) return profiel.lagen;
  if (vraag.huidigeKleur && DONKERE_KLEUREN.some((kleur) => vraag.huidigeKleur!.includes(kleur))) {
    return profiel.lagen + 1;
  }
  return profiel.lagen;
}

/* ── Producten uit de echte catalogus zoeken ──────────────────────── */

/**
 * Categorieën waarin we per rol zoeken.
 *
 * Zonder deze grens levert "muurverf" een múúrverfroller op van € 2,15 — de
 * naam bevat het woord, maar het is geen verf. De categorie-indeling uit de
 * feed is hier de betrouwbare scheidslijn.
 */
const CATEGORIE_PER_ROL: Record<AdviesProduct["rol"], string[]> = {
  verf: ["verf"],
  grondverf: ["verf"],
  gereedschap: ["verfbenodigdheden", "gereedschap", "huishouden"],
};

/**
 * Huishoudelijke artikelen die op een klustermijn matchen maar er niets mee
 * te maken hebben — een afzuigkapfilter-ontvetter is geen schildersontvetter.
 */
const GEEN_GEREEDSCHAP = ["afzuigkap", "wc-", "toilet", "vaatwas", "wasmachine", "bbq", "oven"];

/** Vangnet voor het geval een blik in de verkeerde categorie staat. */
const GEEN_VERF = [
  "roller",
  "kwast",
  "borstel",
  "tape",
  "bak",
  "spaan",
  "afdek",
  "steel",
  "papier",
  "spons",
  "doek",
  "handschoen",
  "mengstok",
];

/**
 * Bevat de naam alle woorden van de zoekterm?
 *
 * Bewust een gewone deelwoord-match, zodat "vloerverf" ook
 * "Garagevloerverf" vindt en "latex" ook "Latexverf". Verkeerde treffers
 * (Muurverf*roller*, Muurverf *Voorstrijk*) worden niet hier maar door de
 * categorie en de verbodslijst afgevangen — die kennen het verschil tussen
 * een blik en een borstel, een woordgrens niet.
 */
function bevatTerm(naam: string, term: string): boolean {
  return term
    .toLowerCase()
    .split(" ")
    .every((deel) => naam.includes(deel));
}

function zoek(
  producten: Product[],
  opdracht: Zoekopdracht,
  rol: AdviesProduct["rol"],
  gebruikt: Set<string>,
  /** Ruwe schatting van de benodigde liters, om een passend blik te kiezen. */
  litersNodig?: number | null,
): Product | undefined {
  const categorieën = CATEGORIE_PER_ROL[rol];
  const isVerf = rol === "verf" || rol === "grondverf";
  const verboden = [
    ...(opdracht.verboden ?? []),
    ...(isVerf ? GEEN_VERF : GEEN_GEREEDSCHAP),
  ];

  for (const term of opdracht.termen) {
    const treffers = producten.filter((product) => {
      if (gebruikt.has(product.id)) return false;
      if (product.inStock === false) return false;
      if (!categorieën.includes(product.category)) return false;
      const naam = product.name.toLowerCase();
      if (verboden.some((woord) => naam.includes(woord))) return false;
      // Alleen op de productnaam zoeken. De omschrijving noemt vaak
      // verwante producten ("ook geschikt onder lakverf") en levert dan
      // treffers op die de klant niet als antwoord herkent.
      return bevatTerm(naam, term);
    });
    if (treffers.length === 0) continue;

    // Bij verf laten we monsterpotjes van 250 ml buiten beschouwing: dat is
    // geen bruikbare hoeveelheid voor een klus.
    const bruikbaar = isVerf
      ? treffers.filter((product) => inhoudInLiters(product).some((liter) => liter >= 0.5))
      : treffers;
    const lijst = bruikbaar.length > 0 ? bruikbaar : treffers;

    return lijst.sort((a, b) => {
      // Bij verf telt het blikformaat zwaarder dan een mooie foto: zes
      // blikken van 0,8 L voor één schutting oogt als een rekenfout, ook al
      // klopt het aantal liters.
      if (isVerf && litersNodig) {
        const blikken = (product: Product) => {
          const maten = inhoudInLiters(product);
          if (maten.length === 0) return 99;
          return Math.ceil(litersNodig / Math.max(...maten));
        };
        const verschil = blikken(a) - blikken(b);
        if (verschil !== 0) return verschil;
      }
      const foto = Number(Boolean(b.image)) - Number(Boolean(a.image));
      if (foto !== 0) return foto;
      return a.price - b.price;
    })[0];
  }
  return undefined;
}

/** Liters uit een maatlabel: "2,5 L", "750 ml", "5L". */
function literUit(label: string): number | null {
  const ml = label.match(/([\d,.]+)\s*ml\b/i);
  if (ml) {
    const value = Number(ml[1].replace(",", ".")) / 1000;
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const l = label.match(/([\d,.]+)\s*l(?:iter)?\b/i);
  if (l) {
    const value = Number(l[1].replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return null;
}

/**
 * De inhoudsmaten van een product in liters.
 *
 * Producten met echte varianten leveren die via `sizesInLiters`. Heeft een
 * product één maat, dan staat die alleen in het inhoud-attribuut uit de feed
 * ("2,5 L") — zonder die tweede bron adviseren we één blik voor een klus die
 * er vier nodig heeft.
 */
function inhoudInLiters(product: Product): number[] {
  const uitVarianten = sizesInLiters(product);
  if (uitVarianten.length > 0) return uitVarianten;

  const attribuut = product.attributes?.inhoud;
  if (!attribuut) return [];
  return attribuut
    .split("|")
    .map((deel) => literUit(deel.trim()))
    .filter((liter): liter is number => liter !== null)
    .sort((a, b) => a - b);
}

/**
 * Hoeveel blikken van dit product heb je nodig, en van welke maat?
 *
 * We rekenen met de grootste maat die er is: vier blikken van 2,5 L is
 * goedkoper en handiger dan tien van 1 L.
 */
function blikkenVoor(product: Product, liters: number): { aantal: number; inhoud?: string } {
  const maten = inhoudInLiters(product);
  if (maten.length === 0) return { aantal: 1 };
  const grootste = Math.max(...maten);
  return {
    aantal: Math.max(1, Math.ceil(liters / grootste)),
    inhoud: `${fmt(grootste)} L`,
  };
}

export async function maakAdvies(vraag: KlusVraag): Promise<Advies> {
  const profiel = vraag.klus === "onbekend" ? null : PROFIELEN[vraag.klus];
  const { m2, uitleg, aannames } = oppervlakVan(vraag, profiel);
  const grond = grondverfCheck(vraag);

  if (!profiel) {
    return {
      samenvatting:
        "We hebben niet helemaal scherp wat je gaat schilderen. Noem het onderdeel (muur, plafond, deur, kozijn, radiator) en de maten, dan rekenen we het precies uit.",
      oppervlakM2: m2,
      berekening: uitleg,
      lagen: 2,
      litersNodig: null,
      grondverfNodig: grond.nodig,
      grondverfReden: grond.reden,
      stappen: [],
      producten: [],
      aannames,
    };
  }

  const lagen = lagenVoor(vraag, profiel, grond.nodig);
  const producten = await getProducts();
  const gebruikt = new Set<string>();

  // Eerst een ruwe schatting met het profielrendement, zodat we meteen een
  // blik van de juiste maat kunnen kiezen. Zodra de verf bekend is, rekenen
  // we exact met het rendement dat op dat product staat.
  const ruweLiters = m2 ? (m2 * profiel.lagen) / profiel.rendement : null;
  const verf = zoek(producten, profiel.verf, "verf", gebruikt, ruweLiters);
  if (verf) gebruikt.add(verf.id);

  // Rendement van het gekozen product wint van de vuistregel.
  const rendement = (verf ? coveragePerLiter(verf) : null) ?? profiel.rendement;
  const liters = m2 ? Math.ceil(((m2 * lagen) / rendement) * 10) / 10 : null;

  const adviezen: AdviesProduct[] = [];
  if (verf) {
    adviezen.push({
      product: verf,
      rol: "verf",
      waarom: `De juiste verf voor ${profiel.label}${verf.colorMixable ? ", in elke kleur te mengen" : ""}.`,
      ...(liters ? blikkenVoor(verf, liters) : { aantal: 1 }),
    });
  }

  if (grond.nodig) {
    // Grondverf gaat in één laag; daar is dus minder van nodig.
    const grondLiters = m2 ? Math.ceil((m2 / rendement) * 10) / 10 : null;
    const grondverf = zoek(producten, profiel.grondverf, "grondverf", gebruikt, grondLiters);
    if (grondverf) {
      gebruikt.add(grondverf.id);
      adviezen.push({
        product: grondverf,
        rol: "grondverf",
        waarom: grond.reden ?? "Voor een goede hechting.",
        ...(grondLiters ? blikkenVoor(grondverf, grondLiters) : { aantal: 1 }),
      });
    }
  }

  for (const stuk of profiel.gereedschap) {
    const item = zoek(producten, { termen: stuk.termen }, "gereedschap", gebruikt);
    if (!item) continue;
    gebruikt.add(item.id);
    adviezen.push({ product: item, rol: "gereedschap", waarom: stuk.waarom, aantal: 1 });
  }

  const extraAannames = [...aannames];
  if (!m2) {
    extraAannames.push("Zonder maten kunnen we niet uitrekenen hoeveel verf je nodig hebt.");
  }
  if (verf && !coveragePerLiter(verf)) {
    extraAannames.push(`We rekenen met ${fmt(rendement)} m² per liter per laag.`);
  }
  if (vraag.bijzonderheden?.includes("vochtige ruimte")) {
    extraAannames.push("Voor een badkamer of keuken adviseren we een vochtbestendige, afwasbare verf, vraag er even naar in de winkel.");
  }

  const stappen = [...profiel.stappen];
  if (grond.nodig && !stappen.some((stap) => /grond|voorstrijk/i.test(stap))) {
    stappen.splice(Math.min(2, stappen.length), 0, "Eerst gronden en goed laten drogen.");
  }

  return {
    samenvatting: samenvatting(vraag, profiel, m2, liters, lagen),
    oppervlakM2: m2,
    berekening: uitleg,
    lagen,
    litersNodig: liters,
    grondverfNodig: grond.nodig,
    grondverfReden: grond.reden,
    stappen,
    producten: adviezen,
    aannames: extraAannames,
  };
}

function samenvatting(
  vraag: KlusVraag,
  profiel: KlusProfiel,
  m2: number | null,
  liters: number | null,
  lagen: number,
): string {
  const delen: string[] = [`Je gaat ${profiel.label} schilderen`];
  if (m2) delen.push(`ongeveer ${fmt(m2)} m²`);
  if (vraag.nieuweKleur) delen.push(`in ${vraag.nieuweKleur}`);
  const eerste = `${delen.join(", ")}.`;
  if (!liters) return `${eerste} Geef de maten door, dan rekenen we uit hoeveel verf je nodig hebt.`;
  return `${eerste} Daar heb je ongeveer ${fmt(liters)} liter voor nodig, verdeeld over ${lagen} lagen.`;
}
