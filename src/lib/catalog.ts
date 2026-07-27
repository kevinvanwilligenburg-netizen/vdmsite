import type { Category, Product } from "@/lib/types";

// Demo-catalogus: wordt gebruikt zolang er geen TILROY_API_KEY is ingesteld
// of als de Tilroy API niet bereikbaar is (zie lib/tilroy.ts).

// Categorie-indeling in lijn met devoordeelmarkt.nl (verf voorop).
export const demoCategories: Category[] = [
  {
    slug: "verf",
    name: "Verf",
    description:
      "Muurverf, lak, grondverf en beits voor de laagste prijs. Mengverf maken we gratis in de winkel op elke gewenste RAL-kleur.",
    icon: "🎨",
    hue: 25,
  },
  {
    slug: "verfbenodigdheden",
    name: "Verfbenodigdheden",
    description:
      "Kwasten, rollers, afplaktape en al het andere schildersgereedschap voor een strak eindresultaat.",
    icon: "🖌️",
    hue: 45,
  },
  {
    slug: "gereedschap",
    name: "Gereedschap",
    description:
      "Elektrisch en handgereedschap voor de laagste prijs. Van accuboormachines tot complete gereedschapskoffers.",
    icon: "🛠️",
    hue: 215,
  },
  {
    slug: "elektra",
    name: "Elektra & Verlichting",
    description:
      "LED-lampen, verlengsnoeren en elektramateriaal. Energiezuinig en voordelig het hele huis verlicht.",
    icon: "💡",
    hue: 265,
  },
  {
    slug: "tuin-en-buiten",
    name: "Tuin & Buiten",
    description:
      "Alles voor tuin, terras en balkon. Tuingereedschap en buitenartikelen voor een voordeelprijs.",
    icon: "🌿",
    hue: 130,
  },
  {
    slug: "reinigen-en-huishouden",
    name: "Reinigen & Huishouden",
    description:
      "Schoonmaakproducten en handige huishoudartikelen. Elke dag lage prijzen op alles voor in huis.",
    icon: "🧽",
    hue: 190,
  },
];

export const demoProducts: Product[] = [
  // ── Verf ──────────────────────────────────────────────────────
  {
    id: "vdm-verf-001",
    slug: "muurverf-mat-wit",
    name: "Muurverf Mat Wit",
    brand: "VDM Basics",
    sku: "VDM-VERF-001",
    category: "verf",
    shortDescription:
      "Dekkende matte muurverf voor binnen in helder wit (RAL 9010). Reukarm en makkelijk aan te brengen.",
    description:
      "Deze matte muurverf van VDM Basics dekt uitstekend in één tot twee lagen en geeft wanden en plafonds een strak, helder wit resultaat. De verf is reukarm, spatvrij aan te brengen met roller of kwast en binnen een uur stofdroog. Ideaal voor woonkamer, slaapkamer en hal.",
    price: 1495,
    compareAtPrice: 2495,
    unit: "per emmer",
    variants: [
      { id: "5l", name: "5 liter", price: 1495, sku: "VDM-VERF-001-5" },
      { id: "10l", name: "10 liter", price: 2495, sku: "VDM-VERF-001-10" },
    ],
    specs: [
      { label: "Kleur", value: "Wit (RAL 9010)" },
      { label: "Glansgraad", value: "Mat" },
      { label: "Rendement", value: "Ca. 8 m² per liter" },
      { label: "Droogtijd", value: "1 uur stofdroog, 4 uur overschilderbaar" },
      { label: "Toepassing", value: "Binnen, muur en plafond" },
    ],
    tags: ["muurverf", "wit", "binnen", "latex"],
    art: { icon: "🪣", hue: 25 },
  },
  {
    id: "vdm-verf-002",
    slug: "mengverf-muurverf-mat",
    name: "Mengverf Muurverf Mat – elke RAL-kleur",
    brand: "VDM Kleurmix",
    sku: "VDM-VERF-002",
    category: "verf",
    shortDescription:
      "Matte muurverf, in de winkel gratis gemengd op elke gewenste RAL-kleur. Kies je kleur met de kleurkiezer.",
    description:
      "Onze populairste muurverf, op kleur gemaakt terwijl je wacht. Kies online uit meer dan 140 RAL-kleuren met de kleurkiezer; wij mengen de verf gratis in de winkel en zetten hem klaar bij je bestelling. De matte uitstraling verbergt kleine oneffenheden en is geschikt voor alle wanden binnenshuis.",
    price: 1295,
    unit: "vanaf 1 liter",
    colorMixable: true,
    variants: [
      { id: "1l", name: "1 liter", price: 1295, sku: "VDM-VERF-002-1" },
      { id: "2-5l", name: "2,5 liter", price: 2495, sku: "VDM-VERF-002-25" },
      { id: "5l", name: "5 liter", price: 4495, sku: "VDM-VERF-002-5" },
    ],
    specs: [
      { label: "Kleur", value: "Naar keuze (RAL), gratis gemengd" },
      { label: "Glansgraad", value: "Mat" },
      { label: "Rendement", value: "Ca. 8 m² per liter" },
      { label: "Droogtijd", value: "1 uur stofdroog, 4 uur overschilderbaar" },
      { label: "Toepassing", value: "Binnen, muur en plafond" },
    ],
    tags: ["mengverf", "muurverf", "ral", "kleur", "binnen"],
    art: { icon: "🎨", hue: 205 },
  },
  {
    id: "vdm-verf-003",
    slug: "mengverf-lak-zijdeglans",
    name: "Mengverf Lak Zijdeglans – elke RAL-kleur",
    brand: "VDM Kleurmix",
    sku: "VDM-VERF-003",
    category: "verf",
    shortDescription:
      "Slijtvaste zijdeglanslak op waterbasis, gemengd op elke RAL-kleur. Voor deuren, kozijnen en meubels.",
    description:
      "Deze zijdeglanslak op waterbasis is perfect voor deuren, kozijnen, plinten en meubels, binnen en buiten. Kies je kleur met de kleurkiezer en wij mengen de lak gratis in de winkel. De lak vergeelt niet, is goed reinigbaar en heeft een mooie, gelijkmatige glans.",
    price: 1695,
    unit: "vanaf 750 ml",
    colorMixable: true,
    variants: [
      { id: "750ml", name: "750 ml", price: 1695, sku: "VDM-VERF-003-075" },
      { id: "2-5l", name: "2,5 liter", price: 4495, sku: "VDM-VERF-003-25" },
    ],
    specs: [
      { label: "Kleur", value: "Naar keuze (RAL), gratis gemengd" },
      { label: "Glansgraad", value: "Zijdeglans" },
      { label: "Basis", value: "Waterbasis (acryl)" },
      { label: "Rendement", value: "Ca. 12 m² per liter" },
      { label: "Toepassing", value: "Binnen en buiten, hout en metaal" },
    ],
    tags: ["mengverf", "lak", "ral", "kleur", "zijdeglans"],
    art: { icon: "🖌️", hue: 262 },
  },
  {
    id: "vdm-verf-004",
    slug: "grondverf-universeel-750ml",
    name: "Grondverf Universeel 750 ml",
    brand: "VDM Basics",
    sku: "VDM-VERF-004",
    category: "verf",
    shortDescription:
      "Universele grondverf op waterbasis voor hout, metaal en kunststof. Sneldrogend en goed schuurbaar.",
    description:
      "Een goede grondlaag is het halve werk. Deze universele grondverf hecht op vrijwel elke ondergrond, droogt snel en is uitstekend schuurbaar. Zo krijgt je aflak een strak en duurzaam resultaat.",
    price: 995,
    unit: "750 ml",
    specs: [
      { label: "Kleur", value: "Wit" },
      { label: "Basis", value: "Waterbasis" },
      { label: "Droogtijd", value: "30 min. stofdroog" },
      { label: "Toepassing", value: "Hout, metaal, kunststof" },
    ],
    tags: ["grondverf", "primer"],
    art: { icon: "🥫", hue: 210 },
  },
  {
    id: "vdm-tuin-002",
    slug: "tuinbeits-douglas-2-5l",
    name: "Tuinbeits Douglas 2,5 L",
    brand: "GreenGarden",
    sku: "VDM-TUIN-002",
    category: "verf",
    shortDescription:
      "Beschermende tuinbeits op waterbasis in warme douglas-tint. Voor schutting, schuur en tuinhout.",
    description:
      "Deze tuinbeits beschermt schuttingen, schuren en ander tuinhout tegen weer en wind, en geeft het hout een warme douglas-uitstraling. Op waterbasis, dus reukarm en snel droog. Eén laag gaat tot drie jaar mee.",
    price: 2295,
    unit: "2,5 liter",
    specs: [
      { label: "Kleur", value: "Douglas (transparant)" },
      { label: "Basis", value: "Waterbasis" },
      { label: "Rendement", value: "Ca. 10 m² per liter" },
      { label: "Bescherming", value: "UV- en waterwerend" },
    ],
    tags: ["beits", "tuinhout", "houtbescherming", "buiten"],
    art: { icon: "🪵", hue: 28 },
  },

  // ── Verfbenodigdheden ─────────────────────────────────────────
  {
    id: "vdm-verf-005",
    slug: "kwastenset-5-delig",
    name: "Kwastenset 5-delig",
    brand: "VDM Pro",
    sku: "VDM-VERF-005",
    category: "verfbenodigdheden",
    shortDescription:
      "Complete kwastenset met vijf maten voor lak- en muurverfklussen. Verliest geen haren.",
    description:
      "Vijf kwaliteitskwasten in de meest gebruikte maten: van fijne radiatorkwast tot brede blokkwast. De synthetische vezels nemen veel verf op, strijken glad uit en laten geen haren achter in je verfwerk.",
    price: 695,
    compareAtPrice: 1295,
    unit: "per set",
    specs: [
      { label: "Inhoud", value: "5 kwasten (10–75 mm)" },
      { label: "Vezels", value: "Synthetisch" },
      { label: "Geschikt voor", value: "Alle verfsoorten" },
    ],
    tags: ["kwasten", "schilderen"],
    art: { icon: "🖌️", hue: 30 },
  },
  {
    id: "vdm-verf-006",
    slug: "afplaktape-2-rollen-50m",
    name: "Afplaktape 2 rollen à 50 m",
    brand: "VDM Pro",
    sku: "VDM-VERF-006",
    category: "verfbenodigdheden",
    shortDescription:
      "Scherpe verflijnen zonder doorbloeden. Twee rollen professionele afplaktape van elk 50 meter.",
    description:
      "Deze professionele afplaktape zorgt voor haarscherpe verflijnen en laat geen lijmresten achter, ook na dagen plakken. Geschikt voor gladde en licht gestructureerde ondergronden, binnen en buiten.",
    price: 449,
    unit: "2 rollen",
    specs: [
      { label: "Breedte", value: "25 mm" },
      { label: "Lengte", value: "2 × 50 meter" },
      { label: "Verwijderbaar", value: "Tot 7 dagen residuvrij" },
    ],
    tags: ["afplaktape", "schilderen"],
    art: { icon: "📏", hue: 48 },
  },

  // ── Gereedschap ───────────────────────────────────────────────
  {
    id: "vdm-ger-001",
    slug: "accuboormachine-20v-set",
    name: "Accuboormachine 20V incl. 2 accu's",
    brand: "PowerToolz",
    sku: "VDM-GER-001",
    category: "gereedschap",
    shortDescription:
      "Krachtige 20V accuboormachine met 2 accu's, lader en koffer. Boren en schroeven in één machine.",
    description:
      "Deze 20V accuboor/schroefmachine heeft een koppel van 45 Nm, 2 versnellingen en LED-werklicht. Inclusief twee 2.0 Ah accu's zodat je altijd door kunt werken, een snellader en een stevige opbergkoffer. Dé voordeeldeal voor elke klusser.",
    price: 7995,
    compareAtPrice: 12900,
    unit: "per set",
    specs: [
      { label: "Spanning", value: "20 V" },
      { label: "Koppel", value: "45 Nm, 21 standen" },
      { label: "Accu's", value: "2 × 2.0 Ah incl. snellader" },
      { label: "Boorhouder", value: "13 mm snelspan" },
      { label: "Inclusief", value: "Koffer + 13-delige bitset" },
    ],
    tags: ["accuboormachine", "boren", "schroeven"],
    art: { icon: "🔋", hue: 215 },
  },
  {
    id: "vdm-ger-002",
    slug: "gereedschapskoffer-108-delig",
    name: "Gereedschapskoffer 108-delig",
    brand: "VDM Pro",
    sku: "VDM-GER-002",
    category: "gereedschap",
    shortDescription:
      "Complete gereedschapskoffer met 108 delen: van hamer en zaag tot dopsleutels en schroevendraaiers.",
    description:
      "Alles wat je in huis wilt hebben, in één overzichtelijke koffer: hamer, zagen, tangen, schroevendraaiers, dopsleutelset, rolmaat, waterpas en veel meer. Chroom-vanadium kwaliteit met een comfortabele softgrip.",
    price: 4995,
    compareAtPrice: 8995,
    unit: "per koffer",
    specs: [
      { label: "Aantal delen", value: "108" },
      { label: "Materiaal", value: "Chroom-vanadium staal" },
      { label: "Koffer", value: "Slagvast met kliksluiting" },
    ],
    tags: ["gereedschap", "koffer"],
    art: { icon: "🧰", hue: 18 },
  },
  {
    id: "vdm-ger-003",
    slug: "waterpas-60cm",
    name: "Waterpas 60 cm aluminium",
    brand: "VDM Pro",
    sku: "VDM-GER-003",
    category: "gereedschap",
    shortDescription:
      "Aluminium waterpas van 60 cm met drie libellen en anti-slip eindkappen. Nauwkeurig tot 0,5 mm/m.",
    description:
      "Stevige aluminium waterpas met drie goed afleesbare libellen (horizontaal, verticaal en 45°). De gefreesde meetzijde en anti-slip eindkappen zorgen voor nauwkeurig werken bij elke klus.",
    price: 895,
    unit: "per stuk",
    specs: [
      { label: "Lengte", value: "60 cm" },
      { label: "Nauwkeurigheid", value: "0,5 mm/m" },
      { label: "Libellen", value: "3 (0°, 90°, 45°)" },
    ],
    tags: ["waterpas", "meten"],
    art: { icon: "📐", hue: 100 },
  },
  {
    id: "vdm-klus-001",
    slug: "schroevenassortiment-1000-delig",
    name: "Schroevenassortiment 1000-delig",
    brand: "VDM Pro",
    sku: "VDM-KLUS-001",
    category: "gereedschap",
    shortDescription:
      "Duizend spaanplaatschroeven in de acht meest gebruikte maten, overzichtelijk in een assortimentsdoos.",
    description:
      "Nooit meer zonder de juiste schroef. Deze assortimentsdoos bevat duizend verzinkte spaanplaatschroeven (PZ2) in acht gangbare maten, van 3×16 tot 5×70 mm. De doos heeft uitneembare vakken en een klikdeksel.",
    price: 1295,
    unit: "1000 stuks",
    specs: [
      { label: "Aantal", value: "1000 schroeven, 8 maten" },
      { label: "Type", value: "Spaanplaatschroef, verzinkt" },
      { label: "Aandrijving", value: "Pozidriv PZ2" },
    ],
    tags: ["schroeven", "bevestiging"],
    art: { icon: "🪛", hue: 220 },
  },
  {
    id: "vdm-klus-002",
    slug: "huishoudtrap-aluminium-8-treden",
    name: "Huishoudtrap aluminium 8 treden",
    brand: "VDM Pro",
    sku: "VDM-KLUS-002",
    category: "gereedschap",
    shortDescription:
      "Lichtgewicht aluminium trap met acht brede treden, veiligheidsbeugel en anti-slip voeten.",
    description:
      "Stabiele huishoudtrap van licht aluminium met acht extra brede treden met anti-slip profiel. De veiligheidsbeugel geeft extra houvast en het gereedschapsplateau houdt je spullen binnen handbereik. Gecertificeerd tot 150 kg.",
    price: 8995,
    compareAtPrice: 13900,
    unit: "per stuk",
    specs: [
      { label: "Treden", value: "8, extra breed" },
      { label: "Sta-hoogte", value: "1,70 m" },
      { label: "Max. belasting", value: "150 kg (EN 131)" },
      { label: "Gewicht", value: "6,8 kg" },
    ],
    tags: ["trap", "ladder", "klussen"],
    art: { icon: "🪜", hue: 170 },
  },

  // ── Elektra & Verlichting ─────────────────────────────────────
  {
    id: "vdm-lamp-001",
    slug: "led-lampen-e27-6-pack",
    name: "LED-lampen E27 6-pack",
    brand: "BrightHome",
    sku: "VDM-LAMP-001",
    category: "elektra",
    shortDescription:
      "Zes energiezuinige LED-lampen met grote fitting (E27), warm wit licht en 15.000 branduren.",
    description:
      "Vervang al je oude gloeilampen in één keer met dit voordelige 6-pack. De lampen geven direct warm wit licht (2700K), verbruiken slechts 4,9 watt en gaan tot 15.000 branduren mee. Vergelijkbaar met een 40W gloeilamp.",
    price: 995,
    compareAtPrice: 1995,
    unit: "6 stuks",
    specs: [
      { label: "Fitting", value: "E27 (grote fitting)" },
      { label: "Lichtkleur", value: "2700K warm wit" },
      { label: "Vermogen", value: "4,9 W (≈ 40 W gloeilamp)" },
      { label: "Levensduur", value: "15.000 uur" },
    ],
    tags: ["led", "lampen", "verlichting"],
    art: { icon: "💡", hue: 50 },
  },
  {
    id: "vdm-lamp-002",
    slug: "verlengsnoer-3-voudig-5m",
    name: "Verlengsnoer 3-voudig 5 m",
    brand: "VDM Basics",
    sku: "VDM-LAMP-002",
    category: "elektra",
    shortDescription:
      "Verlengsnoer met drie geaarde stopcontacten en vijf meter kabel. Met kinderbeveiliging.",
    description:
      "Handig verlengsnoer met drie geaarde contacten en vijf meter snoer. Voorzien van kinderbeveiliging en een ophangoog. Geschikt voor binnen, tot 3680 watt.",
    price: 795,
    unit: "per stuk",
    specs: [
      { label: "Contacten", value: "3 × geaard" },
      { label: "Kabellengte", value: "5 meter" },
      { label: "Max. vermogen", value: "3680 W" },
    ],
    tags: ["verlengsnoer", "elektra"],
    art: { icon: "🔌", hue: 0 },
  },

  // ── Tuin & Buiten ─────────────────────────────────────────────
  {
    id: "vdm-tuin-001",
    slug: "tuinslang-25m-spuitpistool",
    name: "Tuinslang 25 m met spuitpistool",
    brand: "GreenGarden",
    sku: "VDM-TUIN-001",
    category: "tuin-en-buiten",
    shortDescription:
      "Knikvrije tuinslang van 25 meter, compleet met koppelingen en verstelbaar spuitpistool.",
    description:
      "Complete tuinslangset: 25 meter knik- en kronkelvrije slang, universele kraankoppelingen en een spuitpistool met zeven sproeistanden. Direct aan te sluiten en klaar voor gebruik.",
    price: 1995,
    compareAtPrice: 3495,
    unit: "per set",
    specs: [
      { label: "Lengte", value: "25 meter" },
      { label: "Diameter", value: "1/2\" (13 mm)" },
      { label: "Inclusief", value: "Spuitpistool + koppelingen" },
    ],
    tags: ["tuinslang", "tuin", "water"],
    art: { icon: "🚿", hue: 190 },
  },
  {
    id: "vdm-tuin-003",
    slug: "werkhandschoenen-3-paar",
    name: "Werkhandschoenen 3 paar",
    brand: "VDM Pro",
    sku: "VDM-TUIN-003",
    category: "tuin-en-buiten",
    shortDescription:
      "Drie paar stevige werkhandschoenen met grip-coating. Voor tuinieren, klussen en verhuizen.",
    description:
      "Set van drie paar werkhandschoenen met ademende bovenzijde en latex grip-coating in de handpalm. Beschermt je handen bij tuinwerk, klussen en sjouwen, terwijl je gevoel in je vingers houdt.",
    price: 595,
    unit: "3 paar",
    specs: [
      { label: "Maat", value: "9/L (ook in 10/XL in de winkel)" },
      { label: "Coating", value: "Latex anti-slip" },
      { label: "Wasbaar", value: "Ja, 30 °C" },
    ],
    tags: ["handschoenen", "tuin", "klussen"],
    art: { icon: "🧤", hue: 140 },
  },

  // ── Reinigen & Huishouden ─────────────────────────────────────
  {
    id: "vdm-huis-001",
    slug: "schoonmaakset-8-delig",
    name: "Schoonmaakset 8-delig",
    brand: "BrightHome",
    sku: "VDM-HUIS-001",
    category: "reinigen-en-huishouden",
    shortDescription:
      "Complete schoonmaakset met emmer, mop, trekker en doeken. Alles om je huis te laten blinken.",
    description:
      "Achtdelige schoonmaakset met een stevige emmer met wringer, vlakmop met telescoopsteel, raamtrekker, plumeau en vier microvezeldoeken. Alles wat je nodig hebt voor de grote schoonmaak, in één voordeelpakket.",
    price: 1495,
    unit: "per set",
    specs: [
      { label: "Inhoud", value: "8 delen" },
      { label: "Steel", value: "Telescopisch tot 130 cm" },
      { label: "Doeken", value: "4 × microvezel" },
    ],
    tags: ["schoonmaak", "huishouden"],
    art: { icon: "🧽", hue: 55 },
  },
  {
    id: "vdm-huis-002",
    slug: "wasrek-rvs-tower",
    name: "Wasrek RVS Tower",
    brand: "BrightHome",
    sku: "VDM-HUIS-002",
    category: "reinigen-en-huishouden",
    shortDescription:
      "Ruim inklapbaar droogrek van roestvrij staal met 20 meter drooglengte en wieltjes.",
    description:
      "Dit torenwasrek biedt maar liefst 20 meter drooglengte op een klein oppervlak. De roestvrijstalen buizen kunnen ook natte handdoeken moeiteloos aan, en dankzij de wieltjes rol je het rek makkelijk naar de beste droogplek. Plat inklapbaar voor opslag.",
    price: 2495,
    compareAtPrice: 3995,
    unit: "per stuk",
    specs: [
      { label: "Drooglengte", value: "20 meter" },
      { label: "Materiaal", value: "RVS / kunststof" },
      { label: "Afmetingen", value: "71 × 68 × 130 cm (opgezet)" },
    ],
    tags: ["wasrek", "huishouden"],
    art: { icon: "🧺", hue: 240 },
  },
];

/** Deterministische demo-voorraad per product per winkel (0–8 stuks). */
export function demoStockFor(productId: string, storeId: string): number {
  const seed = `${productId}:${storeId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 9;
}
