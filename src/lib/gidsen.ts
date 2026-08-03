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
    product.attributes?.subcategorie?.split("|")[0] ?? "",
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
  {
    slug: "beste-beits",
    titel: "De beste beits",
    metaTitel: "Beste beits kopen — onze top 10",
    metaOmschrijving:
      "Welke beits kies je voor je schutting, schuur of tuinhuis? Onze top 10 beits met het hoogste voordeel — transparant of dekkend, ook op kleur gemengd.",
    intro: [
      "Beits beschermt tuinhout tegen zon en regen en bepaalt meteen de uitstraling: van naturel steigerhout tot een diep zwarte schutting. Dit zijn de toppers uit ons beitsassortiment, met het voordeel van dit moment.",
      "Dekkende beits mengen we net als verf in vrijwel elke kleur — dezelfde waaiers, gratis gemengd.",
    ],
    hoortErbij: (product) => {
      const tekst = tekstVan(product);
      return /beits/.test(tekst) && !/kwast|roller|set\b|schuur/.test(tekst);
    },
    secties: [
      {
        kop: "Transparant of dekkend?",
        tekst:
          "Transparante beits laat de houtnerf zien en geeft een naturel resultaat, maar biedt minder bescherming tegen zonlicht en moet vaker worden bijgehouden. Dekkende beits werkt als een dunne verflaag: meer kleur, langere bescherming. Vuistregel: hoe meer pigment, hoe langer je ervan af bent.",
      },
      {
        kop: "Hoe vaak moet je beitsen?",
        tekst:
          "Dat hangt af van het product en de ligging: een schutting op de zon heeft het zwaarder dan een schuurwand op het noorden. Kijk in de specificaties op de productpagina naar de onderhoudscyclus, en beits bij droog weer op schoon, droog hout.",
      },
      {
        kop: "Ondergrond voorbereiden",
        tekst:
          "Vergrijsd of kaal hout eerst schoonmaken en licht opschuren; oude, loszittende lagen verwijderen. Nieuw geïmpregneerd hout laat je enkele maanden uitwerken voordat je beitst. Een schone, droge ondergrond scheelt jaren in de levensduur van de laag.",
      },
    ],
    faqs: [
      {
        q: "Wat is het verschil tussen beits en verf?",
        a: "Beits trekt in het hout en laat het ademen; verf vormt een gesloten laag óp het hout. Voor tuinhout dat werkt (schuttingen, blokhutten) is beits daarom meestal de betere keuze.",
      },
      {
        q: "Kan ik beits op kleur laten mengen?",
        a: "Dekkende beits mengen we in vrijwel elke kleur uit onze waaiers, gratis. Transparante beits is er in vaste houttinten — die vind je op de productpagina.",
      },
      {
        q: "Hoeveel beits heb ik nodig voor een schutting?",
        a: "Meet de oppervlakte (lengte × hoogte, beide zijden als je ze allebei doet) en reken op twee lagen. Het rendement per liter staat in de specificaties; de rekenhulp op de productpagina rekent het voor je uit.",
      },
    ],
  },
  {
    slug: "beste-grondverf",
    titel: "De beste grondverf",
    metaTitel: "Beste grondverf en primer kopen — onze top 10",
    metaOmschrijving:
      "Grondverf is het halve schilderwerk: betere hechting, minder lagen aflak. Onze top 10 grondverf en primer met het hoogste voordeel.",
    intro: [
      "Goed schilderwerk begint onder de aflak: grondverf zorgt dat de laklaag hecht, vult kleine oneffenheden en voorkomt doorslaan van houtinhoudsstoffen. Wie de grondlaag overslaat, ziet dat binnen een paar seizoenen terug. Dit zijn de toppers uit ons grondverfassortiment.",
      "Twijfel je welke primer bij jouw ondergrond past? Onze verfspecialist denkt gratis mee — in de winkel of via de klusadviseur.",
    ],
    hoortErbij: (product) => {
      const tekst = tekstVan(product);
      return /grondverf|primer|voorstrijk|grondlak/.test(tekst) && !/kwast|roller|set\b/.test(tekst);
    },
    secties: [
      {
        kop: "Wanneer heb je grondverf nodig?",
        tekst:
          "Altijd op kaal hout en kaal metaal, en bij grote kleurverschillen (van donker naar licht). Op een bestaande, goed hechtende verflaag volstaat meestal schuren en ontvetten. Voor muren geldt hetzelfde principe met voorstrijk: nieuwe of sterk zuigende ondergronden eerst voorstrijken.",
      },
      {
        kop: "Welke grondverf bij welke ondergrond?",
        tekst:
          "Hout binnen, hout buiten, metaal en kunststof vragen elk hun eigen primer — de toepassing staat per product in de specificaties. Kies bij een donkere eindkleur een grondverf in een aansluitende tint; dat scheelt vaak een hele aflaklaag.",
      },
      {
        kop: "Watergedragen of terpentinegedragen?",
        tekst:
          "Watergedragen grondverf droogt snel, ruikt nauwelijks en is zo weer overschilderbaar; terpentinegedragen vloeit lang uit en is de klassieke keuze voor buitenwerk. Kijk vooral naar wat de aflak vraagt: systeem bij systeem houden geeft het beste resultaat.",
      },
    ],
    faqs: [
      {
        q: "Kan ik grondverf overslaan?",
        a: "Op kaal hout of metaal niet — dan hecht de aflak slecht en werkt vocht onder de laag. Op een gezonde bestaande verflaag kan het wel: schuren, ontvetten en direct aflakken.",
      },
      {
        q: "Kan grondverf op kleur gemengd worden?",
        a: "Veel grondverven mengen we op kleur, net als aflak. Onder een donkere eindkleur scheelt een getinte grondlaag zichtbaar in dekking.",
      },
      {
        q: "Hoe lang moet grondverf drogen voor ik kan aflakken?",
        a: "Dat verschilt per product en staat in de specificaties op de productpagina. Te vroeg aflakken is zonde van beide lagen; houd de opgegeven overschildertijd aan.",
      },
    ],
  },
  {
    slug: "beste-kozijnlak",
    titel: "De beste lak voor kozijnen",
    metaTitel: "Beste kozijnlak kopen — onze top 10 buitenlakken",
    metaOmschrijving:
      "De beste lak voor kozijnen en buitendeuren: professionele hoogglans- en zijdeglanslakken met het hoogste voordeel, gemengd in elke kleur — ook RAL 9010.",
    intro: [
      "Kozijnen zijn het zwaarste schilderwerk van het huis: volle zon, slagregen en elke dag krimpend en werkend hout. Een professionele buitenlak beschermt jaren — en dat scheelt schilderbeurten. Dit zijn onze toppers voor kozijnen en buitendeuren.",
      "Alle mengbare lakken hieronder mengen we gratis in elke kleur, van klassiek RAL 9010 tot antraciet of grachtengroen.",
    ],
    hoortErbij: (product) => {
      const tekst = tekstVan(product);
      return (
        /\blak\b|lakverf|rubbol|hoogglans|zijdeglans/.test(tekst) &&
        !/muurverf|latex|roller|kwast|tape|schuur|spuitbus|binnenlak/.test(tekst)
      );
    },
    secties: [
      {
        kop: "Hoogglans of zijdeglans?",
        tekst:
          "Hoogglans is de klassieke keuze voor buiten: het strakst, het best reinigbaar en het langst kleurvast. Zijdeglans oogt zachter en vergeeft kleine oneffenheden meer. Voor kozijnen op de zon is glansbehoud het sleutelwoord — kijk daarvoor in de specificaties.",
      },
      {
        kop: "Het systeem maakt de klus",
        tekst:
          "Kaal hout eerst gronden, bestaand werk schuren en ontvetten, en dan pas aflakken — reken bij kaal hout op grondverf plus twee aflaklagen. Blijf binnen één systeem (dezelfde lijn grondverf en aflak): dat is waar fabrikanten hun levensduur op baseren.",
      },
      {
        kop: "Wanneer schilder je kozijnen?",
        tekst:
          "Bij droog weer tussen ruwweg 10 en 25 graden, niet in de volle zon op heet hout en niet vlak voor regen. Sommige moderne lakken zijn geschikt voor vier-seizoenenonderhoud en kunnen ook bij lagere temperaturen — check de verwerkingsgegevens op de productpagina.",
      },
    ],
    faqs: [
      {
        q: "Welke kleur lak voor kozijnen is het populairst?",
        a: "Wit voert de lijst aan — RAL 9010 en RAL 9016 zijn de klassiekers — gevolgd door antracietgrijs (RAL 7016) en zwartgrijs (RAL 7021). Elke kleur mengen we gratis; op de RAL-kleurpagina's zie je per kleur de passende lakken.",
      },
      {
        q: "Hoe lang gaat kozijnlak mee?",
        a: "Professionele buitenlakken halen bij goede voorbereiding doorgaans jaren voordat onderhoud nodig is; de onderhoudscyclus per product staat in de specificaties. Een kozijn op het zuiden slijt sneller dan een op het noorden.",
      },
      {
        q: "Kan ik over oude lak heen schilderen?",
        a: "Ja, als de oude laag goed vastzit: schuren voor hechting, ontvetten en aflakken. Bladdert of barst de oude laag, verwijder die dan eerst en werk kale plekken bij met grondverf.",
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
