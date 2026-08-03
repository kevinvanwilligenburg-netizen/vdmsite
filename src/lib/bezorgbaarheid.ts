/**
 * Welke artikelen kunnen niet met een pakketdienst mee?
 *
 * Zulke artikelen bieden we alleen op afhalen aan. Beter dat vooraf zeggen
 * dan een order aannemen die de winkel daarna moet terugbellen.
 *
 * ⚠️ Deze regels zijn opgezet ná een telling op de echte feed (6.132 regels),
 * en dat was leerzaam: een eerste versie die op productnamen zocht ("ladder",
 * "kruiwagen", "25 kg") gaf 82 treffers waarvan er drie klopten. De rest was
 * een Vladder (een kwast), een kruiwagenwíel, Steigerhoutbeits in een blik van
 * 2,5 liter, en een kettingtakel van "2000 kg" — dat is het hefvermogen, niet
 * het gewicht. Vandaar de twee waarborgen hieronder:
 *
 *  1. Getallen met een eenheid worden genegeerd als er een draagvermogen-woord
 *     bij staat (takel, krik, bok, spanband, "max").
 *  2. Volume telt alleen bij vloeistof. Een speciekuip van 90 liter is een
 *     lege plastic bak van drie kilo; 90 liter verf zou 120 kilo zijn.
 *
 * Wat er in dit assortiment daadwerkelijk overblijft, is klein: twee
 * kruiwagens en een zak strooizout van 25 kg. Het grootste verfgebinte is
 * 12,5 liter (~17 kg) en gaat gewoon met DHL mee. De regels zijn er dus vooral
 * om het goed te houden als er zwaardere artikelen bijkomen.
 */

/** Vanaf dit gewicht (in kilo's) gaat het artikel niet meer met de post. */
const MAX_PAKKETGEWICHT_KG = 20;

/** Vanaf deze inhoud (in liters) idem — 20 liter verf weegt ruim 25 kilo. */
const MAX_VLOEISTOF_L = 15;

/** Vanaf dit volume is de verpakking zelf te lomp voor een pakket. */
const MAX_VOLUME_L = 80;

/**
 * Woorden waarbij een getal het draagvermogen aangeeft en niet het gewicht:
 * een kettingtakel "2000 kg" weegt zelf een paar kilo.
 */
const DRAAGVERMOGEN = /takel|krik|bok|kruk|spangordel|spanband|ratelspanner|\bmax\b/i;

/** Subcategorieën waarin de inhoud een vloeistof is (en dus weegt). */
const VLOEISTOF = /verf|lak|beits|olie|vernis|verdunning|lijm|mengpasta|plamuur/i;

const GEWICHT = /(\d+(?:[.,]\d+)?)\s*kg\b/i;

function getalUit(tekst: string, patroon: RegExp): number | null {
  const match = tekst.match(patroon);
  if (!match) return null;
  const waarde = Number(match[1].replace(",", "."));
  return Number.isFinite(waarde) ? waarde : null;
}

/** Eén artikel zoals de klant het bestelt. */
export interface TeBezorgenArtikel {
  name: string;
  /** De gekozen maat of variant ("25 KG", "10 L"), als die er is. */
  variantName?: string;
  /** Inhoud in liters uit de feed — betrouwbaarder dan de naam uitlezen. */
  liters?: number;
  /** Subcategorie uit de feed, om vloeistof van lege bakken te scheiden. */
  subcategorie?: string;
}

export interface Bezorgbaarheid {
  verzendbaar: boolean;
  /** Waarom niet — om aan de klant te tonen. */
  reden?: string;
}

const WEL: Bezorgbaarheid = { verzendbaar: true };

export function bezorgbaarheid(artikel: TeBezorgenArtikel): Bezorgbaarheid {
  const tekst = `${artikel.name} ${artikel.variantName ?? ""}`;

  // Gewicht uit de naam of de maat, tenzij het een draagvermogen is.
  if (!DRAAGVERMOGEN.test(tekst)) {
    const kilo = getalUit(tekst, GEWICHT);
    if (kilo !== null && kilo >= MAX_PAKKETGEWICHT_KG) {
      return {
        verzendbaar: false,
        reden: `Dit artikel weegt ${String(kilo).replace(".", ",")} kg en gaat niet met de pakketdienst mee, je haalt het op in de winkel.`,
      };
    }
  }

  const liters = artikel.liters ?? 0;
  if (liters > 0) {
    // Vloeistof weegt ruim een kilo per liter; een lege emmer of kuip niet.
    if (liters > MAX_VLOEISTOF_L && VLOEISTOF.test(artikel.subcategorie ?? "")) {
      return {
        verzendbaar: false,
        reden: `${String(liters).replace(".", ",")} liter is te zwaar voor een pakket, dit formaat haal je op in de winkel.`,
      };
    }
    if (liters >= MAX_VOLUME_L) {
      return {
        verzendbaar: false,
        reden: "Dit artikel is te groot voor een pakket, je haalt het op in de winkel.",
      };
    }
  }

  return WEL;
}
