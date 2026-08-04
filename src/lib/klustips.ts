import type { KlusSoort } from "@/lib/klusadvies";
import { getProducts } from "@/lib/tilroy";
import type { OrderItem } from "@/lib/types";

/**
 * Wat gaat deze klant doen, en wat moet hij daarbij weten?
 *
 * Kevin: "eventueel wat tips en trucs over de klus die ze gaan doen (herken je
 * die)". Ja, dat kan — maar niet op de productnaam alleen. De namen in de
 * kassa zetten je juist op het verkeerde been: "Anza Radiatorkwast" bevat
 * radiator, "Copenhagen Gold Muurverfroller" bevat muurverf, en de mooiste
 * binnenlak die we verkopen heet "Histor Perfect Finish Acryl Zijdeglans" —
 * zonder het woord lak erin.
 *
 * Daarom kijken we naar het artikel in de catalogus: de rubriek waar de kassa
 * hem in heeft staan, of hij voor binnen of buiten is, en pas dáárna naar de
 * naam. Alleen verf telt mee; gereedschap heet naar de klus waarvoor het
 * gemaakt is en zou de herkenning overstemmen.
 *
 * Bij twijfel geven we niets. Een tip over buitenhout bij iemand die zijn
 * slaapkamer wit verft is erger dan geen tip.
 */

export interface Klustip {
  kop: string;
  tekst: string;
}

export interface Klusblok {
  soort: Exclude<KlusSoort, "onbekend">;
  titel: string;
  intro: string;
  tips: Klustip[];
  meerHref: string;
  meerLabel: string;
}

/**
 * Rubrieken die verf zijn. "Voorbewerken" (grondverf, plamuur, voorstrijk)
 * staat er bewust niet bij: dat hoort bij elke klus en wijst dus niets aan.
 */
const VERFRUBRIEK = /(muurverf|lakken|beits, olie en vernis|speciaalverven)/;

function klusVanArtikel(
  titel: string,
  subcategorie: string,
  toepassing: string,
): Exclude<KlusSoort, "onbekend"> | null {
  const naam = titel.toLocaleLowerCase("nl");
  const sub = subcategorie.toLocaleLowerCase("nl");
  if (!VERFRUBRIEK.test(sub)) return null;

  if (/plafond/.test(naam)) return "plafond";
  if (/(vloerverf|garagevloerverf|betonverf|vloercoating)/.test(naam)) return "vloer";
  if (/(radiatorlak|radiatorverf)/.test(naam)) return "radiator";
  if (/(metaallak|metaalverf|hamerslag|hammerite|roestwerend|roestwerende)/.test(naam)) {
    return "metaal";
  }
  if (/kozijn/.test(naam)) return "kozijn-buiten";
  if (/(muurverf|latex|sausklaar|wandverf)/.test(naam) || sub.includes("muurverf")) {
    return "muur-binnen";
  }
  if (sub.includes("beits")) return "hout-buiten";
  if (sub.includes("lakken")) {
    return toepassing.toLocaleLowerCase("nl").includes("buiten") ? "hout-buiten" : "hout-binnen";
  }
  return null;
}

const TIPS: Record<
  Exclude<KlusSoort, "onbekend">,
  { titel: string; intro: string; tips: Klustip[]; href: string; label: string }
> = {
  "muur-binnen": {
    titel: "Zo krijg je die muren strak",
    intro: "Drie dingen waar het bij muurverf op vastloopt — en hoe je ze voor bent.",
    tips: [
      {
        kop: "Snijd eerst de randen voor",
        tekst:
          "Zet met de kwast een baan van vijf centimeter langs plafond, plinten en kozijnen. Rol daarna het vlak tot tegen die baan aan; dan zie je de overgang niet.",
      },
      {
        kop: "Maak een muur in één keer af",
        tekst:
          "Stop niet halverwege voor koffie. Een rand die alvast opdroogt, blijft als streep zichtbaar — ook na de tweede laag.",
      },
      {
        kop: "Haal de tape er klam af",
        tekst:
          "Trek het afplakband weg als de verf nog net vochtig is. Bij droge verf scheurt de rand mee en mag je bijwerken.",
      },
    ],
    href: "/gids/beste-muurverf",
    label: "Alles over muurverf kiezen",
  },
  plafond: {
    titel: "Zo hou je het plafond netjes",
    intro: "Boven je hoofd werken is een ander vak. Drie tips van de winkel.",
    tips: [
      {
        kop: "Rol de laatste banen naar het raam toe",
        tekst:
          "Licht dat langs het plafond strijkt laat elke rolbaan zien. Eindig in de richting van het raam, dan vallen ze weg.",
      },
      {
        kop: "Dek alles af, ook wat je niet raakt",
        tekst: "Plafondverf spat. Altijd. Vloer, meubels en de bovenkant van de deurposten.",
      },
      {
        kop: "Werk met een verlengsteel",
        tekst:
          "Scheelt je nek en je hoeft de trap niet om de meter te verzetten. Je houdt zo ook makkelijker gelijke druk op de roller.",
      },
    ],
    href: "/gids/beste-muurverf",
    label: "Alles over muurverf kiezen",
  },
  "hout-binnen": {
    titel: "Zo wordt je lakwerk spiegelglad",
    intro: "Lakken is negentig procent voorwerk. Drie dingen die het verschil maken.",
    tips: [
      {
        kop: "Schuren tot de glans weg is",
        tekst:
          "Lak hecht op ruw, niet op glad. Korrel 180 tot 220, daarna stofvrij maken met een licht vochtige doek.",
      },
      {
        kop: "Twee dunne lagen, geen dikke",
        tekst:
          "Dik smeren geeft zakkers en gordijnen. Twee dunne lagen drogen harder uit en blijven jaren strak.",
      },
      {
        kop: "Tussenschuren met korrel 240",
        tekst:
          "Even licht over de eerste laag voordat je de tweede aanbrengt. Dat haalt de stofjes eruit die er altijd in vallen.",
      },
    ],
    href: "/gids/beste-grondverf",
    label: "Wanneer heb je grondverf nodig?",
  },
  "hout-buiten": {
    titel: "Zo hou je het buitenwerk jaren goed",
    intro: "Buiten telt het weer mee. Drie tips voordat je begint.",
    tips: [
      {
        kop: "Niet in de volle zon",
        tekst:
          "De bovenkant droogt dan sneller dan de laag eronder; dat geeft blaasjes. Werk met de schaduw mee om het huis heen.",
      },
      {
        kop: "Kale plekken eerst gronden",
        tekst:
          "Onbehandeld hout zuigt de aflak zo op en laat vocht door. Een grondlaag op elk kaal plekje scheelt je een seizoen.",
      },
      {
        kop: "Kijk naar de kitranden",
        tekst:
          "Eén scheurtje in de kit langs het glas laat water achter de verf lopen. Vernieuwen vóór je schildert, niet erna.",
      },
    ],
    href: "/gids/beste-buitenverf",
    label: "Alles over buitenverf kiezen",
  },
  "kozijn-buiten": {
    titel: "Zo krijg je de kozijnen strak",
    intro: "Precisiewerk langs glas en beslag. Drie tips van de winkel.",
    tips: [
      {
        kop: "Plak het glas af",
        tekst:
          "Afplakken en daarna langs de tape snijden gaat sneller dan strak schilderen op de gok — en het staat beter.",
      },
      {
        kop: "Controleer eerst de kit en de naden",
        tekst:
          "Water dat achter het kozijn komt, duwt de verf er vanzelf weer af. Losse kit eruit, nieuwe erin, dan pas verven.",
      },
      {
        kop: "Twee laklagen met droogtijd ertussen",
        tekst:
          "Kijk op het blik hoe lang. Een tweede laag op nog niet droge lak blijft plakken en trekt rimpels.",
      },
    ],
    href: "/gids/beste-kozijnlak",
    label: "De beste lak voor kozijnen",
  },
  radiator: {
    titel: "Zo lak je een radiator zonder strepen",
    intro: "Warm metaal en lak gaan niet samen. Drie tips.",
    tips: [
      {
        kop: "Zet hem uit en laat hem koud worden",
        tekst:
          "Op een warme radiator trekt de lak meteen aan en krijg je strepen die er niet meer uit gaan.",
      },
      {
        kop: "Eerst ontvetten, dan pas schuren",
        tekst: "Andersom wrijf je het vet juist de krassen in en laat de lak later los.",
      },
      {
        kop: "Tussen de ribben met een radiatorroller",
        tekst:
          "Een smalle roller aan een lange beugel komt achter de ribben. De randen en aansluitingen doe je met de kwast.",
      },
    ],
    href: "/klusadvies?vraag=radiator%20schilderen",
    label: "Vraag het klusadvies",
  },
  vloer: {
    titel: "Zo blijft je vloerverf zitten",
    intro: "Vloerverf laat maar om één reden los: de ondergrond. Drie tips.",
    tips: [
      {
        kop: "Ontvetten is het halve werk",
        tekst:
          "Olie- en wasresten zie je niet, maar de verf voelt ze wel. Grondig ontvetten en helemaal laten drogen.",
      },
      {
        kop: "Poreus beton eerst voorstrijken",
        tekst:
          "Anders zuigt de vloer je eerste laag helemaal op en dekt hij nooit. Twijfel je? Druppel water op de vloer: trekt het weg, dan voorstrijken.",
      },
      {
        kop: "Werk naar de deur toe",
        tekst: "Klinkt logisch, gaat het vaakst mis. Begin in de verste hoek.",
      },
    ],
    href: "/klusadvies?vraag=vloer%20verven",
    label: "Vraag het klusadvies",
  },
  metaal: {
    titel: "Zo hou je roest onder de duim",
    intro: "Metaal verf je niet mooi, je verft het dicht. Drie tips.",
    tips: [
      {
        kop: "Roest helemaal weg",
        tekst:
          "Roest die je overschildert, gaat eronder gewoon door. Borstel of schuur tot op het gezonde metaal.",
      },
      {
        kop: "Roestwerende primer op elk kaal plekje",
        tekst: "Ook op het randje dat je net hebt schoongemaakt. Daar begint het anders opnieuw.",
      },
      {
        kop: "Twee dunne lagen, rondom",
        tekst:
          "Vergeet de onderkant van leuningen en profielen niet — daar blijft het vocht hangen en daar begint de roest.",
      },
    ],
    href: "/klusadvies?vraag=metaal%20schilderen",
    label: "Vraag het klusadvies",
  },
};

/**
 * Welke klus hoort bij deze bestelling?
 *
 * We wegen op besteed bedrag, niet op aantal regels: wie voor € 120 muurverf
 * koopt en één blikje lak voor de deurpost, is met zijn muren bezig.
 *
 * Lukt de catalogus niet, dan geven we null terug en blijft de mail gewoon
 * werken — zonder tips.
 */
export async function klusUitBestelling(items: OrderItem[]): Promise<Klusblok | null> {
  let producten;
  try {
    producten = await getProducts();
  } catch {
    return null;
  }
  const perId = new Map(producten.map((product) => [product.id, product]));

  const punten = new Map<Exclude<KlusSoort, "onbekend">, number>();
  for (const item of items) {
    const product = perId.get(item.productId);
    if (!product) continue;
    const soort = klusVanArtikel(
      product.name,
      product.attributes?.subcategorie ?? "",
      product.attributes?.toepassing ?? "",
    );
    if (!soort) continue;
    punten.set(soort, (punten.get(soort) ?? 0) + item.price * item.quantity);
  }

  let beste: Exclude<KlusSoort, "onbekend"> | null = null;
  let hoogste = 0;
  for (const [soort, bedrag] of punten) {
    if (bedrag > hoogste) {
      hoogste = bedrag;
      beste = soort;
    }
  }
  if (!beste) return null;

  const blok = TIPS[beste];
  return {
    soort: beste,
    titel: blok.titel,
    intro: blok.intro,
    tips: blok.tips,
    meerHref: blok.href,
    meerLabel: blok.label,
  };
}
