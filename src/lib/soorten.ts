/**
 * Soort-filters voor rubrieken waar Tilroy er geen heeft.
 *
 * De vier grootste niet-verfrubrieken — bevestigingsmaterialen (1.519
 * artikelen), schildersgereedschap (707), behang (456) en lijm/kit (275) —
 * hebben in de kassa geen onderverdeling. Wie een spaanplaatschroef zoekt
 * krijgt 1.519 artikelen en alleen een maatfilter. De soort stáát er wel,
 * maar alleen in de productnaam: "Mack Spaanplaatschroef Torx", "Wdh
 * Wallcoverings Unibehang".
 *
 * Deze regels lezen dat eruit. Ze zijn geijkt op de volledige catalogus
 * (meting 2026-07-30): bevestiging 91%, schilder 66%, behang 61% (plus een
 * apart dessinkenmerk), lijm/kit 66%, handgereedschap 57% van de artikelen
 * krijgt een soort. Wat geen soort krijgt, krijgt géén gok — een artikel
 * zonder filterwaarde is vindbaar via de andere filters, een artikel met een
 * verkeerde waarde is onvindbaar op precies het moment dat iemand ernaar
 * zoekt.
 *
 * Twee valkuilen uit die meting, voor wie hier later aan sleutelt:
 * - Nederlandse samenstellingen: "Gipsplaatplug" en "Veerringen" matchen niet
 *   op \bplug\b of \bring\b. Match daarom op achtervoegsel (plug\b, ringen\b).
 * - "Messing" bevat "mes"; mes\b is veilig omdat de s erachter de woordgrens
 *   breekt, maar een kale /mes/ was hier al één keer bijna doorgeglipt.
 *
 * De volgorde binnen een lijst telt: "schroefoog" is een oog en geen schroef,
 * "keilbout" een bout — de specifieke regel staat vóór de algemene.
 */

type Regel = [RegExp, string];

const BEVESTIGING: Regel[] = [
  [/\bassorti/i, "Assortimenten"],
  [
    /schroefoog|schroefhaak|plafondhaak|kapstokhaak|s-haak|haak\b|haken\b|\boog\b|ogenset|puntduim/i,
    "Haken & ogen",
  ],
  [/plug\b|pluggen\b|duopower|anker\b|ankers\b/i, "Pluggen & ankers"],
  [/moer\b|moeren\b/i, "Moeren"],
  [/ring\b(?!sleutel)|ringen\b/i, "Ringen"],
  [/spijker|nagel\b|nagels\b/i, "Spijkers & nagels"],
  [/bout\b|bouten\b|draadeind/i, "Bouten"],
  [/schroef|schroeven/i, "Schroeven"],
  [
    /ketting|touw\b|koord|draadspanner|spandraad|staaldraad|slangk?lem|klem\b|klemmen\b|spanband/i,
    "Ketting, klemmen & touw",
  ],
  [/magneet/i, "Magneten"],
];

const SCHILDER: Regel[] = [
  [/kwast|penseel|blokwitter/i, "Kwasten & penselen"],
  [/roller|vacht\b/i, "Rollers"],
  [/schuur|staalwol/i, "Schuurmiddelen"],
  [/afplak|tape\b/i, "Afplaktape"],
  [/afdek|stucloper|folie\b|zeil\b/i, "Afdekmateriaal"],
  [/verfbak|verfemmer|mengbeker|roerspaan|roerhout|zeefje/i, "Verfbakken & mengen"],
  [
    /afbrand|krabber|schraper|mes\b|messen\b/i,
    "Krabbers & messen",
  ],
  [/ladder|trap\b/i, "Trappen & ladders"],
];

const BEHANG_SOORT: Regel[] = [
  [
    /renovatievlies|barstoverbruggend|glasvlies|behanglijm|behangplaksel|perfax/i,
    "Werkbehang & lijm",
  ],
  [/fotobehang/i, "Fotobehang"],
  [/vliesbehang|vlies\b/i, "Vliesbehang"],
  [/vinyl/i, "Vinylbehang"],
  [/papierbehang|papier\b/i, "Papierbehang"],
];

/**
 * Uni of dessin is voor behang een eigen keuze naast de soort: wie een effen
 * muur wil, wil niet langs 219 dessins bladeren. Wdh zet het letterlijk in de
 * naam ("219705 Unibehang"), dus dit kenmerk is er ook als de soort ontbreekt.
 */
const BEHANG_DESSIN: Regel[] = [
  [/unibehang|\buni\b/i, "Uni (effen)"],
  [/dessin/i, "Met dessin"],
];

const LIJM_KIT: Regel[] = [
  [/pistool/i, "Kitpistolen"],
  [/purschuim|\bpur\b|pistoolschuim/i, "PUR-schuim"],
  [/kit\b|kitten\b/i, "Kit"],
  [
    /plamuur|vul(ler|middel|pasta)|kneedbaar|reparatie|filler|stopverf|profstop|houtrot|gatenvul|wondermix/i,
    "Plamuur & vulmiddel",
  ],
  [/lijm|plaksel/i, "Lijm"],
];

const GEREEDSCHAP: Regel[] = [
  [/hamer/i, "Hamers"],
  [/zaag|zagen\b/i, "Zagen"],
  [/schroevendraaier|bitset|\bbits?\b/i, "Schroevendraaiers & bits"],
  [/tang\b|tangen\b/i, "Tangen"],
  [/sleutel|inbus|dopset|doppen\b/i, "Sleutels & doppen"],
  [/rolmaat|duimstok|waterpas|meetlint|winkelhaak/i, "Meetgereedschap"],
  [/beitel|vijl\b|rasp\b/i, "Beitels & vijlen"],
  [/mes\b|messen\b/i, "Messen"],
  [/boor\b|boren\b/i, "Boren"],
];

/**
 * Materiaal is bij bevestigingsmateriaal een echte koopreden: buiten wil je
 * RVS, binnen volstaat verzinkt. Gemeten: RVS 192, verzinkt 67, messing 51,
 * kunststof 23 artikelen.
 */
const MATERIAAL: Regel[] = [
  [/\brvs\b|inox/i, "RVS"],
  [/verzinkt/i, "Verzinkt"],
  [/messing/i, "Messing"],
  [/\bnylon\b|kunststof/i, "Kunststof"],
];

function eerste(titel: string, regels: Regel[]): string | undefined {
  for (const [patroon, label] of regels) {
    if (patroon.test(titel)) return label;
  }
  return undefined;
}

/** Welke regelset hoort bij deze rubriek? Op rubrieknaam, niet op productnaam. */
const RUBRIEK_REGELS: [RegExp, Regel[]][] = [
  [/bevestigingsmaterialen/i, BEVESTIGING],
  [/schildersger/i, SCHILDER],
  [/^behang$/i, BEHANG_SOORT],
  [/lijmen, kitten/i, LIJM_KIT],
  [/^handgereedschap$/i, GEREEDSCHAP],
];

export interface SoortKenmerken {
  soort?: string;
  dessin?: string;
  materiaal?: string;
}

export function soortKenmerken(rubriek: string, titel: string): SoortKenmerken {
  const schoon = rubriek.trim();
  const uitkomst: SoortKenmerken = {};

  const regels = RUBRIEK_REGELS.find(([patroon]) => patroon.test(schoon))?.[1];
  if (regels) uitkomst.soort = eerste(titel, regels);

  if (/^behang$/i.test(schoon)) uitkomst.dessin = eerste(titel, BEHANG_DESSIN);
  if (/bevestigingsmaterialen/i.test(schoon)) {
    uitkomst.materiaal = eerste(titel, MATERIAAL);
  }

  return uitkomst;
}
