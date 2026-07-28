import { leesVraag, type KlusSoort } from "@/lib/klusadvies";

/**
 * Herkent of een zoekopdracht een klus beschrijft in plaats van een artikel.
 *
 * Iemand die "trap verven" intypt zoekt geen product met dat woord erin — die
 * wil weten wat hij nodig heeft. Een gewone zoekmachine geeft daarop niets of
 * iets willekeurigs; wij sturen hem naar het klusadvies én naar het juiste
 * deel van het assortiment.
 *
 * De klusherkenning komt uit de klusadviseur, zodat er één plek is waar staat
 * dat een trap binnenhoutwerk is en een schutting buitenhout.
 */

/**
 * Werkwoorden die verraden dat iemand een klus beschrijft.
 *
 * Bewust géén los "verf": dat zit in muurverf, lakverf en grondverf, en dan
 * zou elke gewone productzoekopdracht als klusvraag worden opgevat.
 */
const KLUS_WERKWOORDEN = [
  "verven",
  "schilderen",
  "schilder",
  "lakken",
  "beitsen",
  "behangen",
  "sausen",
  "witten",
  "opknappen",
  "afwerken",
  "overschilderen",
  "bijwerken",
];

export interface KlusSuggestie {
  /** Wat we denken dat de klant gaat doen. */
  klus: KlusSoort;
  titel: string;
  /** Link naar het klusadvies met de vraag al ingevuld. */
  adviesHref: string;
  /** Het deel van het assortiment dat erbij hoort. */
  assortimentHref: string;
  assortimentLabel: string;
  /** Zoekterm die de bijbehorende artikelen oplevert. */
  zoekterm: string;
}

const LABELS: Record<Exclude<KlusSoort, "onbekend">, { titel: string; zoek: string; label: string }> = {
  "muur-binnen": {
    titel: "Muren schilderen",
    zoek: "muurverf",
    label: "muurverf",
  },
  // Eén woord per zoekterm: een term van twee woorden moet in dezelfde
  // productnaam voorkomen en levert dan vaak niets op.
  plafond: { titel: "Plafond schilderen", zoek: "muurverf", label: "muurverf" },
  "hout-binnen": { titel: "Binnenhoutwerk lakken", zoek: "binnenlak", label: "lak voor binnen" },
  "hout-buiten": { titel: "Buitenhoutwerk behandelen", zoek: "beits", label: "beits en buitenlak" },
  "kozijn-buiten": { titel: "Kozijnen schilderen", zoek: "buitenlak", label: "buitenlak" },
  radiator: { titel: "Radiator schilderen", zoek: "radiatorlak", label: "radiatorlak" },
  vloer: { titel: "Vloer verven", zoek: "vloerverf", label: "vloerverf" },
  metaal: { titel: "Metaal schilderen", zoek: "metaallak", label: "metaallak" },
};

export function klusIntentie(query: string): KlusSuggestie | null {
  const tekst = query.toLowerCase();

  // Als heel woord, niet als deel ervan: "lakken" mag matchen, maar niet
  // binnen "plakken" of "aflakken van een merknaam".
  const isKlus = KLUS_WERKWOORDEN.some((woord) =>
    new RegExp(`\\b${woord}\\b`, "i").test(tekst),
  );
  if (!isKlus) return null;

  const vraag = leesVraag(query);
  if (vraag.klus === "onbekend") return null;

  const labels = LABELS[vraag.klus];
  return {
    klus: vraag.klus,
    titel: labels.titel,
    adviesHref: `/klusadvies?vraag=${encodeURIComponent(query)}`,
    assortimentHref: `/zoeken?q=${encodeURIComponent(labels.zoek)}`,
    assortimentLabel: labels.label,
    zoekterm: labels.zoek,
  };
}
