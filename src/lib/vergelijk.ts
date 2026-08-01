import type { Product } from "@/lib/types";

/**
 * Merkvergelijkingspagina's (/vergelijk/…).
 *
 * Sigma en Wijzonol zijn twee van de vijf kernmerken van grote online
 * verfconcurrenten; wij voeren ze niet. Wie op "sigma allure" zoekt is dus
 * geen klant — tenzij hij hier landt en ziet dat hetzelfde segment (A-merk
 * professionele lak of muurverf) bij ons in het schap staat, gratis gemengd
 * en scherper geprijsd.
 *
 * Spelregels voor de teksten (vergelijkende reclame is toegestaan zolang hij
 * eerlijk is): concurrentmerken worden met respect en zonder verzonnen
 * productclaims genoemd. We zeggen "vergelijkbaar segment", nooit "beter dan"
 * — behalve waar het aantoonbaar over ónze dienstverlening gaat (gratis
 * mengen, franco Sikkens, advies in vijf winkels).
 */

export interface VergelijkSectie {
  kop: string;
  tekst: string;
  /** Welke artikelen uit onze catalogus horen hier als alternatief? */
  matcher: (product: Product) => boolean;
  limit?: number;
}

export interface Vergelijking {
  slug: string;
  titel: string;
  metaTitel: string;
  metaOmschrijving: string;
  intro: string[];
  secties: VergelijkSectie[];
  faqs: { q: string; a: string }[];
}

function naam(product: Product): string {
  return `${product.name} ${product.attributes?.subcategorie ?? ""}`.toLowerCase();
}

const isRubbol = (product: Product) => /rubbol/.test(naam(product));
const isMuurverf = (product: Product) =>
  /muurverf|latex/.test(naam(product)) && !/roller|kwast|tape|bak/.test(naam(product));
const isBeits = (product: Product) => /beits/.test(naam(product)) && !/kwast/.test(naam(product));

export const VERGELIJKINGEN: Vergelijking[] = [
  {
    slug: "sigma-alternatief",
    titel: "Op zoek naar Sigma? Dit staat er bij ons in het schap",
    metaTitel: "Sigma verf kopen? Bekijk het alternatief in hetzelfde segment",
    metaOmschrijving:
      "Wij voeren geen Sigma, wél hetzelfde professionele segment: Sikkens lakken en A-merk muurverf, gratis gemengd in elke kleur en met advies in vijf winkels.",
    intro: [
      "Sigma is een prima professioneel verfmerk — maar het staat niet in ons schap. Wat er wél staat: Sikkens, al generaties lang hét A-merk waar schilders hun kozijnen en deuren mee lakken, en muurverf uit hetzelfde professionele segment.",
      "Wie Sigma overweegt, zoekt meestal geen merk maar een resultaat: een strakke, weerbestendige laklaag of een muur die egaal dekt. Hieronder zie je per klus wat wij daarvoor in huis hebben — gratis gemengd in elke kleur (ook alle RAL-kleuren), en Sikkens bezorgen we altijd gratis, ongeacht het bedrag.",
    ],
    secties: [
      {
        kop: "In plaats van Sigma S2U Allure of S2U Gloss: Sikkens Rubbol",
        tekst:
          "Voor buitenlakwerk aan kozijnen, deuren en geveltimmerwerk is Sikkens Rubbol bij ons het professionele antwoord: hoogglans, zijdeglans of mat, in elke kleur gemengd. Met een gratis account betaal je bovendien de Kluspas-prijs, en Sikkens versturen we altijd zonder verzendkosten.",
        matcher: isRubbol,
        limit: 4,
      },
      {
        kop: "In plaats van Sigmatex of Sigma Pearl Clean: onze muurverf",
        tekst:
          "Voor wanden en plafonds voeren we muurverf van A-merken in hetzelfde segment — van hoogdekkend mat tot afwasbaar voor gang en keuken. Elke mengbare muurverf mengen we gratis in ruim 18.000 kleuren.",
        matcher: isMuurverf,
        limit: 4,
      },
    ],
    faqs: [
      {
        q: "Waarom verkopen jullie geen Sigma?",
        a: "We kiezen voor een compact assortiment A-merken dat we door en door kennen en scherp kunnen inkopen — met Sikkens als professionele kern. Zo blijft de prijs laag en het advies concreet.",
      },
      {
        q: "Is Sikkens Rubbol vergelijkbaar met Sigma S2U?",
        a: "Beide zijn professionele laksystemen van gerenommeerde fabrikanten, bedoeld voor hoogwaardig binnen- en buitenlakwerk. Welke lak bij jouw klus past hangt af van ondergrond en gewenste afwerking; onze verfspecialist adviseert je er gratis over, in de winkel of via de klusadviseur.",
      },
      {
        q: "Kan ik een Sigma-kleur bij jullie laten mengen?",
        a: "Vrijwel altijd: we mengen uit ruim 140 waaiers met meer dan 18.000 kleuren, waaronder alle RAL-kleuren. Neem je kleurcode mee of zoek hem op in de kleurkiezer; twijfel je, dan is er de kleurtester van € 2,99 — dat bedrag krijg je terug als voucher bij je verf.",
      },
    ],
  },
  {
    slug: "wijzonol-alternatief",
    titel: "Op zoek naar Wijzonol? Dit staat er bij ons in het schap",
    metaTitel: "Wijzonol kopen? Bekijk het alternatief in hetzelfde segment",
    metaOmschrijving:
      "Wij voeren geen Wijzonol, wél hetzelfde segment: Sikkens lakken, A-merk muurverf en dekkende beits — gratis gemengd in elke kleur, met advies in vijf winkels.",
    intro: [
      "Wijzonol is een degelijk Nederlands verfmerk, maar wij hebben ons schap anders ingericht: met Sikkens als professionele lak-kern en A-merk muurverf en beits daaromheen — tegen discountprijzen.",
      "Zoek je een lak voor kozijnen, een muurverf die in één keer dekt of een dekkende beits voor de schutting? Hieronder staat per klus ons alternatief, gratis gemengd in elke kleur.",
    ],
    secties: [
      {
        kop: "In plaats van Wijzonol LBH-lakken: Sikkens Rubbol",
        tekst:
          "Voor duurzaam buitenlakwerk is Sikkens Rubbol ons professionele antwoord — hoogglans of zijdeglans, gemengd in elke kleur, en altijd gratis bezorgd.",
        matcher: isRubbol,
        limit: 4,
      },
      {
        kop: "In plaats van Wijzonol muurverf: onze muurverf",
        tekst:
          "Van hoogdekkend mat tot afwasbaar: onze A-merk muurverf komt uit hetzelfde segment en gaat gratis door de mengmachine in de kleur die jij kiest.",
        matcher: isMuurverf,
        limit: 4,
      },
      {
        kop: "In plaats van Wijzonol tuinbeits: onze beits",
        tekst:
          "Voor schutting, blokhut en tuinhout voeren we transparante en dekkende beits van bekende merken — ook op kleur te mengen.",
        matcher: isBeits,
        limit: 4,
      },
    ],
    faqs: [
      {
        q: "Waarom verkopen jullie geen Wijzonol?",
        a: "We houden het assortiment bewust compact: een aantal A-merken dat we scherp kunnen inkopen en waar onze verfspecialisten alles van weten. Daardoor kunnen we de laagste prijs en concreet advies combineren.",
      },
      {
        q: "Kan ik een Wijzonol-kleur bij jullie laten mengen?",
        a: "Vrijwel altijd: we mengen meer dan 18.000 kleuren uit ruim 140 waaiers, waaronder alle RAL-kleuren. Twijfel je over de exacte tint, bestel dan eerst een kleurtester van € 2,99 — het bedrag krijg je terug als voucher bij je verf.",
      },
    ],
  },
  {
    slug: "sigma-s2u-allure-vs-sikkens-rubbol-xd",
    titel: "Sigma S2U Allure of Sikkens Rubbol XD?",
    metaTitel: "Sigma S2U Allure vs Sikkens Rubbol XD — welke buitenlak kies je?",
    metaOmschrijving:
      "Twee professionele hoogglanslakken voor buiten vergeleken. Bij ons koop je Sikkens Rubbol XD: gratis gemengd in elke kleur, altijd gratis bezorgd en met Kluspas-korting.",
    intro: [
      "Sigma S2U Allure en Sikkens Rubbol XD zijn allebei professionele hoogglanslakken voor buitenhoutwerk — het segment waar schilders hun kozijnen, deuren en geveltimmerwerk mee lakken. Beide fabrikanten horen tot de top; met geen van beide sla je de plank mis.",
      "Het verschil zit voor jou vooral in waar je hem koopt. Bij ons staat Sikkens Rubbol XD in het schap: gratis gemengd in elke kleur (ook alle RAL-kleuren), altijd gratis bezorgd — Sikkens gaat bij ons franco de deur uit, ongeacht het bedrag — en met Kluspas-korting via een gratis account. En loop je vast, dan staat er in vijf winkels een verfspecialist die je klus met je doorneemt.",
    ],
    secties: [
      {
        kop: "Sikkens Rubbol bij De Voordeelmarkt",
        tekst:
          "Rubbol XD voor hoogglans buitenwerk, en daaromheen de Rubbol-familie voor zijdeglans, grondwerk en binnenlakken. Kies je maat en kleur op de productpagina; de rekenhulp vertelt hoeveel blikken je nodig hebt.",
        matcher: isRubbol,
        limit: 4,
      },
    ],
    faqs: [
      {
        q: "Is Sikkens Rubbol XD geschikt voor mijn kozijnen?",
        a: "Rubbol XD is gemaakt voor buitenhoutwerk zoals kozijnen, deuren en geveltimmerwerk. De verwerkingsgegevens (droogtijd, rendement, ondergrond) staan per artikel in de specificaties op de productpagina.",
      },
      {
        q: "Kan ik de kleur van mijn oude Sigma-lak laten namengen?",
        a: "Vrijwel altijd: neem de kleurcode of een gelakt deel mee naar de winkel, of zoek de kleur op in onze kleurkiezer met ruim 18.000 kleuren. Bij twijfel bestel je eerst een kleurtester van € 2,99 — dat bedrag krijg je terug als voucher bij je verf.",
      },
      {
        q: "Wat kost verzenden?",
        a: "Sikkens bezorgen we altijd gratis, ongeacht het orderbedrag. Voor de rest van het assortiment is bezorgen gratis vanaf € 59; afhalen in de winkel is altijd gratis en kan binnen 2 uur.",
      },
    ],
  },
];

export function getVergelijking(slug: string): Vergelijking | undefined {
  return VERGELIJKINGEN.find((vergelijking) => vergelijking.slug === slug);
}

/** De alternatieven voor een sectie: leverbaar en met foto eerst. */
export function sectieProducten(sectie: VergelijkSectie, products: Product[]): Product[] {
  return products
    .filter((product) => sectie.matcher(product))
    .sort((a, b) => {
      const aScore = (a.inStock !== false ? 2 : 0) + (a.image ? 1 : 0);
      const bScore = (b.inStock !== false ? 2 : 0) + (b.image ? 1 : 0);
      return bScore - aScore || a.price - b.price;
    })
    .slice(0, sectie.limit ?? 4);
}
