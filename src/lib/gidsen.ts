import type { Product } from "@/lib/types";

/**
 * Koopgidsen ("Beste muurverf", "Beste buitenverf"): landingspagina's voor de
 * zoekwoorden waar concurrenten Top 10-pagina's voor voeren.
 *
 * De productkeuze komt live uit de catalogus — leverbaar, met foto, hoogste
 * voordeel eerst — zodat de gids nooit artikelen aanprijst die er niet meer
 * zijn. De adviesteksten zijn algemene schilderskennis (welke glans waar,
 * afwasbaar of niet); ze noemen bewust géén productclaims die niet uit de
 * feed komen.
 */

export interface Gids {
  slug: string;
  titel: string;
  metaTitel: string;
  metaOmschrijving: string;
  intro: string[];
  /** Welke artikelen horen in deze gids thuis? */
  hoortErbij: (product: Product) => boolean;
  secties: { kop: string; tekst: string }[];
  faqs: { q: string; a: string }[];
}

function tekstVan(product: Product): string {
  return [
    product.name,
    product.attributes?.subcategorie ?? "",
    product.attributes?.toepassing ?? "",
    product.attributes?.verfsoort ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export const GIDSEN: Gids[] = [
  {
    slug: "beste-muurverf",
    titel: "De beste muurverf",
    metaTitel: "Beste muurverf kopen — onze top 10",
    metaOmschrijving:
      "Welke muurverf kies je voor je woonkamer, slaapkamer of plafond? Onze top 10 muurverf met het hoogste voordeel, gratis gemengd in elke kleur.",
    intro: [
      "Muurverf is de snelste manier om een kamer een ander gezicht te geven — maar in het schap staan tientallen bussen die allemaal wit lijken. Deze gids zet de toppers uit ons assortiment op een rij, met het voordeel van dit moment, en legt uit waar je op let bij het kiezen.",
      "Alles hieronder mengen we gratis in elke kleur die je wilt: RAL, Sikkens, Flexa of een van de andere waaiers.",
    ],
    hoortErbij: (product) => {
      const tekst = tekstVan(product);
      return /muurverf|latex/.test(tekst) && !/roller|kwast|tape|bak|set\b/.test(tekst);
    },
    secties: [
      {
        kop: "Mat, zijdeglans of afwasbaar?",
        tekst:
          "Mat oogt rustig en verdoezelt kleine oneffenheden — ideaal voor plafonds en muren waar je niet dagelijks tegenaan zit. In een gang, keuken of kinderkamer is een afwasbare of zijdeglans muurverf praktischer: vingerafdrukken en spatten veeg je er zo af. Vuistregel: hoe meer glans, hoe beter schoon te maken, maar hoe meer je van de ondergrond ziet.",
      },
      {
        kop: "Hoeveel muurverf heb je nodig?",
        tekst:
          "Meet de muren op (lengte × hoogte, ramen en deuren eraf) en reken op twee lagen voor een egaal resultaat. Op elke productpagina staat een rekenhulp die het aantal blikken voor je uitrekent op basis van het rendement van die verf. Ga je van donker naar licht, houd dan rekening met een extra laag of een voorstrijk.",
      },
      {
        kop: "Eerst voorstrijken?",
        tekst:
          "Op nieuw stucwerk, gips of sterk zuigende ondergronden hoort eerst een voorstrijkmiddel: dat voorkomt dat de muur de verf ongelijk opzuigt en je vlekken blijft zien. Op een eerder geverfde, stevige ondergrond volstaat schoonmaken en eventueel licht schuren.",
      },
    ],
    faqs: [
      {
        q: "Welke muurverf is het beste voor een plafond?",
        a: "Een matte muurverf: die reflecteert nauwelijks licht, waardoor banen en kleine oneffenheden wegvallen. Kies bij een badkamerplafond een verf die tegen vocht kan.",
      },
      {
        q: "Kan ik muurverf in elke kleur krijgen?",
        a: "Ja — alle mengbare muurverf in deze gids mengen we gratis in ruim 18.000 kleuren, van RAL tot de merkenwaaiers van Sikkens, Flexa en Histor. Je kiest de kleur op de productpagina.",
      },
      {
        q: "Hoe lang moet muurverf drogen tussen twee lagen?",
        a: "Dat verschilt per verf; het staat in de specificaties op de productpagina. Houd als vuistregel enkele uren aan en verf niet in de volle zon of bij hoge luchtvochtigheid.",
      },
    ],
  },
  {
    slug: "beste-buitenverf",
    titel: "De beste buitenverf",
    metaTitel: "Beste buitenverf kopen — onze top 10",
    metaOmschrijving:
      "De beste verf voor kozijnen, deuren en houtwerk buiten: onze top 10 buitenverf en buitenbeits met het hoogste voordeel, gratis gemengd in elke kleur.",
    intro: [
      "Buiten vraagt meer van verf dan binnen: zon, regen en vorst werken het hele jaar op je kozijnen en deuren in. Goede buitenverf beschermt het hout jarenlang — en dat scheelt je schilderbeurten. Dit zijn de toppers uit ons buitenassortiment, met het voordeel van dit moment.",
      "Ook buitenverf mengen we gratis in elke kleur. Klassiek grachtengroen, RAL 9010 voor de kozijnen of een antracietgrijze voordeur: jij kiest, wij mengen.",
    ],
    hoortErbij: (product) => {
      const tekst = tekstVan(product);
      return (
        /buiten|tuinbeits|gevel/.test(tekst) &&
        !/roller|kwast|tape|bak|ladder|zeil/.test(tekst)
      );
    },
    secties: [
      {
        kop: "Dekkend of transparant?",
        tekst:
          "Dekkende verf en beits geven kleur én de langste bescherming tegen zon; transparante beits laat de houtnerf zien maar moet vaker worden bijgehouden. Voor kozijnen en deuren kiezen de meeste mensen een dekkende hoogglans- of zijdeglanslak; voor schuttingen en tuinhout is beits het gangbare product.",
      },
      {
        kop: "Wanneer schilder je buiten?",
        tekst:
          "Bij droog weer, weinig wind en temperaturen ruwweg tussen 10 en 25 graden. Verf niet in de volle zon op heet hout (de verf droogt dan te snel) en niet vlak voor regen. Het voor- en najaar zijn de klassieke schilderseizoenen; sommige moderne lakken zijn ook bij lagere temperaturen te verwerken — check daarvoor de specificaties op de productpagina.",
      },
      {
        kop: "Goed voorbereiden is het halve werk",
        tekst:
          "Buiten schilderwerk gaat pas lang mee als de ondergrond klopt: kaal of beschadigd hout eerst gronden, glanzende oude lagen licht opschuren, en alles vet- en stofvrij maken. Reken bij kaal hout op grondverf plus twee aflaklagen.",
      },
    ],
    faqs: [
      {
        q: "Hoe lang gaat buitenverf mee?",
        a: "Dat hangt af van de verf, de kleur en de ligging: een donkere deur op de zon heeft het zwaarder dan een kozijn op het noorden. De onderhoudscyclus per product vind je in de specificaties op de productpagina.",
      },
      {
        q: "Kan ik buitenverf in elke RAL-kleur krijgen?",
        a: "Ja. Alle mengbare buitenverf mengen we gratis in elke RAL-kleur en in de merkenwaaiers. Let op: op kleur gemengde verf is maatwerk en kan niet retour — bestel bij twijfel eerst een kleurtester.",
      },
      {
        q: "Heb ik grondverf nodig?",
        a: "Op kaal hout altijd; op een bestaande, goed hechtende verflaag meestal niet — licht schuren en ontvetten volstaat dan. Bij twijfel helpt onze verfspecialist je in de winkel of via de klusadviseur.",
      },
    ],
  },
];

export function getGids(slug: string): Gids | undefined {
  return GIDSEN.find((gids) => gids.slug === slug);
}

/** De top-N voor een gids: leverbaar en met foto eerst, hoogste voordeel bovenaan. */
export function gidsProducten(gids: Gids, products: Product[], limit = 10): Product[] {
  const voordeel = (product: Product) =>
    product.compareAtPrice && product.compareAtPrice > product.price
      ? (product.compareAtPrice - product.price) / product.compareAtPrice
      : 0;
  return products
    .filter((product) => gids.hoortErbij(product))
    .sort((a, b) => {
      const aScore = (a.inStock !== false ? 2 : 0) + (a.image ? 1 : 0);
      const bScore = (b.inStock !== false ? 2 : 0) + (b.image ? 1 : 0);
      return bScore - aScore || voordeel(b) - voordeel(a) || a.price - b.price;
    })
    .slice(0, limit);
}
