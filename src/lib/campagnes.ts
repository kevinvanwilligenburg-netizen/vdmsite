import { isKvEnabled, kvGetJSON } from "@/lib/kv";

/**
 * De lopende acties, zoals de winkel ze aankondigt.
 *
 * Kevin stuurde de augustuslijst door en vroeg om een actiepagina die er ook
 * visueel uitziet. Dit is de bron daarvoor.
 *
 * ⚠️ Dit zijn AANKONDIGINGEN, geen prijzen. De prijzen komen uit Tilroy via
 * `promo_prijs` in de productfeed; hier staat alleen wát er loopt en waar de
 * klant het vindt. Die scheiding is bewust: zou dit bestand percentages
 * toepassen, dan hadden we een tweede plek waar prijzen ontstaan — precies
 * waar vandaag de Profpas-stapeling en de kluspasverwisseling vandaan kwamen.
 *
 * Klopt een percentage hier niet met de feed, dan is de aankondiging fout en
 * niet de prijs. `/api/campagnecheck` legt ze naast elkaar.
 *
 * Het dashboard kan de lijst overschrijven via KV `campagnes` (zelfde vorm),
 * zodat Kevin ze straks zelf beheert zonder deploy.
 */

export interface Campagne {
  id: string;
  /** Wat er groot op de kaart staat: "50%", "1 + 1 gratis", "3 voor € 4,95". */
  kop: string;
  /** Waarop: "Alle Mack, Benson en Hofftech". */
  waarop: string;
  /** Eventuele nuance die de klant moet weten ("op = op"). */
  klein?: string;
  /** Merken waar dit over gaat; bepaalt de link en de producttelling. */
  merken?: string[];
  /**
   * Losse artikelen, als de actie niet op een heel merk slaat.
   *
   * Nodig omdat lang niet elke actie een merk ís. Sanicur staat in de feed
   * onder "No brand" en "Overige", dus een merkfilter vond nul artikelen — en
   * dan had de kaart geen knop, geen foto's en geen telling. Kevin: "werkt
   * niet", en terecht.
   */
  skus?: string[];
  /**
   * Kortingsfractie (0.5 = 50%), ALLEEN als noodbrug.
   *
   * ⚠️ Alleen invullen voor merken waarvan Tilroy de actie ÓÓK kent.
   *
   * De echte prijzen komen uit Tilroy via `promo_prijs` in de feed. Dit veld
   * is er omdat die feed op 6 augustus 2026 achterliep: Kevin zette Benson,
   * Parador en HG in Tilroy, de prijzen stonden er goed (gemeten: Benson
   * 3.25 → 1.63, 152.10 → 76.05, 24.85 → 12.43, exact de helft), maar de
   * promosync had ze nog niet opgepikt. De kassa gaf 50% en de webshop de
   * volle prijs.
   *
   * `prijzenVan` gebruikt dit UITSLUITEND als er geen `promo_prijs` in de feed
   * staat. Zodra die er wel is wint de feed en doet dit veld niets meer — een
   * brug, geen tweede prijzenbron.
   *
   * ⚠️⚠️ Vul dit NIET in voor een merk dat niet in Tilroy staat. Dan geeft de
   * webshop korting die de kassa niet kent: de klant betaalt online minder dan
   * in de winkel, en het ordertotaal wijkt af waardoor de bestelling als draft
   * strandt. Op 6 augustus gold dat voor Mack, Fitex, Drenth en Sam — die
   * staan daarom bewust zonder `procent`, hoe graag de aankondiging het ook
   * belooft. Eerst in Tilroy, dan hier.
   */
  procent?: number;
  /**
   * Beperkt `procent` tot deze merken, als de campagne meer merken noemt dan
   * Tilroy kent. "Alle Mack, Benson en Hofftech 50%" staat als één actie op de
   * pagina, maar alleen Benson heeft de prijs in Tilroy.
   */
  alleenMerken?: string[];
  /** Waar de knop heen gaat als er geen merk is (bv. een categorie). */
  href?: string;
  van: string;
  tot: string;
  /**
   * Aantal-actie (2+1 gratis en dergelijke) in plaats van een prijskorting.
   * Die lopen niet via `promo_prijs` maar via de staffelmotor, en zijn dus
   * pas écht actief als het Tilroy-kortingsartikel bestaat.
   */
  staffel?: boolean;
  /**
   * De aantallen achter `staffel`, zodat de motor er ook echt mee kan rekenen.
   *
   * ⚠️ Dit veld is er omdat `staffel: true` alléén niets deed. De kop is
   * mensentaal — "2 + 1 gratis", "5 halen, 3 betalen" — en daar kun je geen
   * korting op baseren; de staffelmotor las een KV-lijst die niemand vulde.
   * Gevolg: de winkel beloofde op de merkpagina 5 halen 3 betalen, en de
   * winkelwagen rekende vijf keer de volle prijs. Gemeten op Led's light,
   * 7 augustus 2026: 5 × € 3,05 = € 15,25, korting € 0,00.
   *
   * Bij "2 + 1 gratis" is dit koop 3, betaal 2 — je neemt er drie mee en
   * rekent er twee af.
   *
   * Alleen invullen als de actie op dezelfde artikelen slaat. "Gratis
   * metaalspons bij een spuitbus" is een ánder artikel gratis en past hier
   * niet in; die moet als cadeauregel, niet als staffel.
   */
  koop?: number;
  betaal?: number;
  /**
   * Vaste groepsprijs: "3 voor € 4,95", "5 voor € 1,-".
   *
   * Anders dan koop/betaal reken je hier niet een aantal stuks af maar één
   * bedrag voor de hele groep. `aantal` stuks samen voor `prijs` centen.
   */
  bundel?: { aantal: number; prijs: number };
  /**
   * Gratis artikel bij aankoop: "gratis metaalspons bij een spuitbus".
   *
   * ⚠️ Een ánder artikel dan wat de klant koopt, en dat is precies waarom dit
   * niet in de staffelmotor past — die rekent binnen dezelfde artikelen en zou
   * hier een spuitbus weggeven in plaats van een spons.
   *
   * `skus`/`merken` van de campagne bepalen wat ervoor in aanmerking komt;
   * `vanaf` is hoeveel daarvan er in het mandje moeten liggen (standaard één,
   * bij het behang drie). Het cadeau komt niet in de winkelwagen te liggen
   * maar gaat als regel van € 0,00 de order in — zo boekt de kassa de voorraad
   * af en weet de winkel dat hij hem moet inpakken.
   */
  cadeau?: { sku: string; naam: string; vanaf?: number };
  /**
   * Set: verschillende artikelen samen voor één prijs ("schoonmaakset € 9,95").
   *
   * Anders dan `bundel`, die `aantal` stuks van hetzelfde artikel groepeert.
   * Hier moet er van élk artikel in `skus` minstens één in het mandje liggen;
   * dan kost dat rijtje samen `prijs` centen en gaat het verschil er als
   * korting af. Ligt er één niet in, dan is het geen set en gebeurt er niets —
   * een halve set voor de setprijs zou weggeven zijn.
   *
   * Meerdere volledige sets in één mandje tellen los mee.
   */
  set?: { skus: string[]; prijs: number };
  /**
   * Vaste actieprijs per sku, in centen: "€ 6,95".
   *
   * ⚠️ Zelfde waarschuwing als bij `procent`: dit is een prijs die wij zelf
   * zetten. Vul hem alleen in als de kassa hem óók kent, anders is de webshop
   * goedkoper dan de winkel. Staat er een `promo_prijs` in de feed, dan wint
   * die en doet dit veld niets.
   */
  vastePrijzen?: Record<string, number>;
}

const TOT_AUGUSTUS = "2026-08-31";
const TOT_DECEMBER = "2026-12-31";

/**
 * De augustuscampagne zoals Kevin hem doorgaf (6 augustus 2026).
 *
 * Hofftech, Sanicur en Pastolex staan hier wél maar hebben in de feed geen
 * eigen merk — Pastolex valt volgens Kevin onder Drenth. Zolang dat zo is
 * tonen we ze in de tekst maar niet als aparte link; een knop naar een lege
 * merkpagina is erger dan geen knop.
 */
const STANDAARD: Campagne[] = [
  {
    id: "mack-benson-hofftech",
    kop: "50%",
    waarop: "Alle Mack, Benson en Hofftech",
    merken: ["Mack", "Benson", "Hofftech germany"],
    // Alleen Benson staat in Tilroy; Mack en Hofftech (nog) niet. Korting
    // geven die de kassa niet kent maakt de webshop goedkoper dan de winkel.
    procent: 0.5,
    
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
  },
  {
    id: "parador",
    kop: "50%",
    waarop: "Alles van Parador",
    merken: ["Parador"],
    procent: 0.5,
    van: "2026-08-06",
    // Tilroy heeft Parador tot en met 30 september, niet 31 augustus zoals in
    // de aankondiging stond. De kassa is maatgevend.
    tot: "2026-09-30",
  },
  {
    id: "fitex-lak",
    kop: "20%",
    waarop: "Alle Fitex lakken, beits en speciaalverf",
    merken: ["Fitex"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
  },
  {
    id: "hg",
    kop: "20%",
    waarop: "Alles van HG",
    merken: ["HG"],
    procent: 0.2,
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
  },
  {
    id: "drenth",
    kop: "50%",
    waarop: "Alle Drenth en Pastolex, ook muurverf",
    klein: "Drenth is uitlopend — op = op",
    merken: ["Drenth"],
    van: "2026-08-06",
    tot: TOT_DECEMBER,
  },
  {
    id: "sanicur",
    kop: "2 + 1 gratis",
    waarop: "Sanicur",
    klein: "Op = op",
    // Sanicur staat niet als merk in de feed; deze drie artikelen zijn het.
    skus: ["39974444", "39981703", "39981782"],
    van: "2026-08-06",
    tot: TOT_DECEMBER,
    staffel: true,
    koop: 3,
    betaal: 2,
  },
  {
    id: "sam-tape",
    kop: "1 + 1 gratis",
    waarop: "Sam dubbelzijdig tape en kleefband",
    // Alleen de dubbelzijdige, niet alle 53 Sam-artikelen.
    skus: ["39981298", "39981366"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    koop: 2,
    betaal: 1,
  },
  {
    id: "fitex-schilderstape",
    kop: "3 voor € 4,95",
    waarop: "Fitex schilderstape 19 en 25 mm",
    /*
     * De vier tapes uit de schilders-lijn in 19 en 25 mm.
     *
     * Bewust niet de brede (38/50 mm) en niet de Masking Tape Ruby: de
     * aankondiging noemt 19 en 25 mm, en op de Ruby van € 20,01 zou "3 voor
     * € 4,95" neerkomen op 88% korting. Op de duurste die hier wél in zit
     * (€ 3,70) is het 55%, en dat is voor tape nog te verdedigen.
     */
    skus: ["39974078", "39974646", "39974079", "39974680"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    bundel: { aantal: 3, prijs: 495 },
    /*
     * ⚠️ Deze actie gaat bij de goedkoopste tapes NIET af, en dat is geen bug.
     *
     * De Fitex-actie van 20% loopt al, waardoor de smalle schilderstape nu
     * € 1,20 kost: drie stuks is € 3,60, en "3 voor € 4,95" zou de klant
     * € 1,35 dúúrder uitkomen. `pasStaffelToe` weigert een bundel die boven de
     * losse prijs uitkomt — een aanbieding die geld kost is geen aanbieding.
     *
     * Bij de duurdere tape van € 1,70 scheelt het € 0,15, dus daar gaat hij
     * wel af, maar het stelt weinig voor.
     *
     * Gemeten 8 augustus 2026. Zolang de 20%-actie loopt is deze bundel dus
     * vooral een aankondiging. Zet de bundelprijs lager of laat hem vervallen
     * — maar haal deze regel niet weg in de veronderstelling dat er iets stuk
     * is.
     */
  },
  {
    id: "ledlights",
    kop: "5 halen, 3 betalen",
    waarop: "Led's light",
    // In de feed heet het merk "Led's light" (70 artikelen), niet "Led lights"
    // zoals in de aankondiging. Met de juiste spelling krijgt de kaart een
    // knop en klopt de telling.
    merken: ["Led's light"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    koop: 5,
    betaal: 3,
  },
  {
    id: "metaalspons",
    // Gratis Sam Schuurspons Metaal (39980843) bij deze spuitbussen.
    skus: ["39973535", "39973533", "39974202", "39974435", "39974436", "39974830", "39980429", "39980409", "39980484"],
    kop: "Gratis metaalspons",
    waarop: "Bij spuitlakken van BTC, Levis hittebestendig en Fitex metaallak",
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    cadeau: { sku: "39980843", naam: "Sam Schuurspons Metaal" },
  },
  /*
   * De acties die Melissa doorgaf en die niet in de mail stonden.
   *
   * Alleen wat met zekerheid op één artikel is terug te voeren staat hier met
   * sku's. De rest — de schoonmaakset, gratis behanglijmoplosser bij drie
   * rollen behang, emmer en spons bij de cementsluierverwijderaar, de
   * staalschuursponsjes en de Flexa radiatorlak — wacht op bevestiging welk
   * artikel bedoeld wordt; zie scratchpad/actie-artikelnummers.xlsx. Die staan
   * bewust nog niet in deze lijst: een actie op het verkeerde artikel is
   * duurder dan een actie die nog even niet loopt.
   */
  {
    id: "hg-vaatwasser",
    kop: "Gratis ontstopper",
    waarop: "Bij HG tegen stinkende vaatwassers",
    // Hetzelfde artikel staat onder twee nummers in de catalogus; allebei
    // nodig, anders mist de helft van de verkopen de actie.
    skus: ["39974875", "39975219"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    cadeau: { sku: "39972763", naam: "Fitex Vloeibare Ontstopper" },
  },
  {
    id: "olfa-mesjes",
    kop: "Gratis reservemesjes",
    waarop: "Bij een Sam afbreekmes 9 mm",
    // Alleen het Sam-mes. De twee Anza-messen van 9 mm zijn nog niet
    // bevestigd, en bij de goedkoopste (€ 0,69) is het cadeau van € 3,85 ruim
    // vijf keer duurder dan het artikel zelf — dat wil je niet per ongeluk.
    skus: ["39038342"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    cadeau: { sku: "39980994", naam: "Olfa reservemesjes 9 mm (10 st)" },
  },
  {
    id: "hg-bbq",
    kop: "Gratis metaalspons",
    waarop: "Bij HG barbecuereiniger",
    // De "Oven, Grill & Barbecue Reiniger + Gratis HG Vet" (39975093) laten we
    // eruit: die heeft zelf al een cadeau in de naam, en twee cadeaus op één
    // artikel is niet wat er bedoeld wordt.
    skus: ["39972566", "39981680"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    cadeau: { sku: "39980843", naam: "Sam Schuurspons Metaal" },
  },
  {
    id: "pattex-kit",
    kop: "1 + 1 gratis",
    waarop: "Pattex Schilderskit Premium en Acrylaatkit Regenvast",
    klein: "Op = op",
    skus: ["37905764", "37905823"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    koop: 2,
    betaal: 1,
  },
  {
    id: "fitex-tape-3plus1",
    kop: "3 + 1 gratis",
    waarop: "Fitex UV tape blauw 38 mm en masking tape Ruby 25 en 38 mm",
    skus: ["39974448", "39974032", "39974069"],
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
    staffel: true,
    koop: 4,
    betaal: 3,
  },
  {
    id: "handschoenen",
    // De vinyl M staat niet in de webshop; alleen de vitril XL bestaat.
    skus: ["39978094"],
    kop: "€ 4,95 en € 6,95",
    waarop: "Classic vinyl handschoen M (100 st.) en vitril poedervrij blauw XL (100 st.)",
    // De vitril XL stond op € 13,95 terwijl de folder € 6,95 belooft — Melissa:
    // "Vinyl handschoenen werkt ook niet". Als vaste actieprijs, want dit is
    // geen percentage maar een afgesproken bedrag.
    vastePrijzen: { "39978094": 695 },
    van: "2026-08-06",
    tot: TOT_AUGUSTUS,
  },
];

function leesCampagne(ruw: unknown): Campagne | null {
  if (!ruw || typeof ruw !== "object") return null;
  const bron = ruw as Record<string, unknown>;
  const tekst = (waarde: unknown, max: number) =>
    typeof waarde === "string" ? waarde.trim().slice(0, max) : "";
  const kop = tekst(bron.kop, 40);
  const waarop = tekst(bron.waarop, 160);
  const van = tekst(bron.van, 30);
  const tot = tekst(bron.tot, 30);
  if (!kop || !waarop || !tot) return null;
  return {
    id: tekst(bron.id, 60) || kop + waarop,
    kop,
    waarop,
    ...(tekst(bron.klein, 120) ? { klein: tekst(bron.klein, 120) } : {}),
    ...(Array.isArray(bron.merken)
      ? { merken: bron.merken.map((m) => tekst(m, 60)).filter(Boolean) }
      : {}),
    ...(Array.isArray(bron.skus)
      ? { skus: bron.skus.map((s) => tekst(s, 40)).filter(Boolean) }
      : {}),
    ...(tekst(bron.href, 200) ? { href: tekst(bron.href, 200) } : {}),
    van,
    tot,
    ...(bron.staffel === true ? { staffel: true } : {}),
    // Aantallen alleen overnemen als het paar klopt. Een halve staffel (koop
    // zonder betaal) uit een dashboardformulier mag geen korting worden die
    // niemand heeft bedoeld; `staffelUitCampagnes` weigert hem dan alsnog,
    // maar hier al stoppen scheelt een rare campagne in de lijst.
    ...(getal(bron.koop) && getal(bron.betaal)
      ? { koop: getal(bron.koop), betaal: getal(bron.betaal) }
      : {}),
    ...leesBundel(bron.bundel),
    ...leesCadeau(bron.cadeau),
    // `vastePrijzen` bewust NIET uit KV. Net als `procent` is dit een prijs,
    // en een prijs die uit een los te bewerken sleutel komt kan per ongeluk
    // wijzigen. Alleen de vaste lijst hierboven mag hem zetten.
  };
}

/** Groepsprijs uit het dashboard; beide velden moeten kloppen of geen van twee. */
function leesBundel(waarde: unknown): { bundel?: { aantal: number; prijs: number } } {
  if (!waarde || typeof waarde !== "object") return {};
  const bron = waarde as Record<string, unknown>;
  const aantal = getal(bron.aantal);
  const prijs = getal(bron.prijs);
  // Een bundel van één stuk is geen bundel, en een groepsprijs van nul is
  // weggeven — allebei eerder een typefout dan een bedoeling.
  if (aantal < 2 || prijs <= 0) return {};
  return { bundel: { aantal, prijs } };
}

/** Cadeau uit het dashboard; zonder sku valt er niets weg te geven. */
function leesCadeau(waarde: unknown): { cadeau?: { sku: string; naam: string; vanaf?: number } } {
  if (!waarde || typeof waarde !== "object") return {};
  const bron = waarde as Record<string, unknown>;
  const sku = typeof bron.sku === "string" ? bron.sku.trim().slice(0, 40) : "";
  const naam = typeof bron.naam === "string" ? bron.naam.trim().slice(0, 80) : "";
  if (!sku || !naam) return {};
  const vanaf = getal(bron.vanaf);
  return { cadeau: { sku, naam, ...(vanaf > 1 ? { vanaf } : {}) } };
}

/** Een positief geheel getal, of 0 als het dat niet is. */
function getal(waarde: unknown): number {
  const n = Math.floor(Number(waarde));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Kortingsfractie voor een merk, uit de vaste lijst hierboven.
 *
 * Bewust synchroon en bewust NIET uit KV: dit raakt prijzen, en een prijs die
 * uit een los te bewerken sleutel komt is een prijs die per ongeluk kan
 * wijzigen. De KV-override geldt alleen voor wat er op de actiepagina staat.
 *
 * Geeft 0 als er niets loopt. Zie het `procent`-veld voor waarom dit bestaat
 * en wanneer het weer weg mag.
 */
export function campagneKorting(merk: string | undefined, nu: number = Date.now()): number {
  if (!merk) return 0;
  const naam = merk.trim().toLowerCase();
  if (!naam) return 0;
  for (const campagne of STANDAARD) {
    if (!campagne.procent) continue;
    if (campagneStand(campagne, nu) !== "loopt") continue;
    // `alleenMerken` wint: de aankondiging noemt soms meer merken dan Tilroy
    // kent, en dan mag alleen het merk mét kassaprijs korting krijgen.
    const doel = campagne.alleenMerken ?? campagne.merken ?? [];
    if (doel.some((m) => m.toLowerCase() === naam)) return campagne.procent;
  }
  return 0;
}

/**
 * Vaste actieprijs voor een sku, in centen; 0 als er niets loopt.
 *
 * Zelfde afspraak als `campagneKorting`: synchroon, uit de vaste lijst, en
 * `prijzenVan` gebruikt hem alleen als de feed géén promoprijs levert. Zodra
 * Tilroy de actie zelf kent wint de feed en doet dit niets meer.
 */
export function campagneVastePrijs(sku: string | undefined, nu: number = Date.now()): number {
  if (!sku) return 0;
  for (const campagne of STANDAARD) {
    if (!campagne.vastePrijzen) continue;
    if (campagneStand(campagne, nu) !== "loopt") continue;
    const prijs = campagne.vastePrijzen[sku];
    if (typeof prijs === "number" && prijs > 0) return Math.round(prijs);
  }
  return 0;
}

/**
 * Het actielabel voor op een productkaart: "5 halen, 3 betalen".
 *
 * Kevin: "ik zie niet bij de giftacties iets van een icoontje bijv bij de
 * lampen 3+2 ofzo." Een aantal-actie, een bundel of een cadeau zie je niet
 * terug in de prijs — die staat gewoon op € 3,05 — dus zonder label lijkt er
 * niets aan de hand. Juist bij dít soort acties moet de klant weten dat er
 * meer te halen valt door er méér te nemen.
 *
 * Alleen voor acties die niet uit de prijs blijken. Een percentagekorting
 * heeft al een kortingsvlag; die er nóg een label bij geven is dubbelop.
 *
 * Synchroon en uit de vaste lijst, zodat een productkaart hem kan tonen zonder
 * de campagnes op te halen. Een KV-override werkt hier dus niet in mee — die
 * geldt voor de actiepagina.
 */
export function campagneLabel(
  product: { brand?: string; sku?: string; variants?: { sku: string }[] },
  nu: number = Date.now(),
): string | null {
  for (const campagne of STANDAARD) {
    if (!campagne.koop && !campagne.bundel && !campagne.cadeau) continue;
    if (campagneStand(campagne, nu) !== "loopt") continue;
    if (!campagneRaakt(campagne, product)) continue;
    return campagne.kop;
  }
  return null;
}

/**
 * Valt dit product onder deze campagne?
 *
 * Op merk óf op sku — een actie is niet altijd een merk. Sku's worden per
 * variant vergeleken, want de klant koopt een blik en niet een productgroep.
 */
export function campagneRaakt(
  campagne: Campagne,
  product: { brand?: string; sku?: string; variants?: { sku: string }[] },
): boolean {
  if (campagne.skus?.length) {
    const van = new Set(campagne.skus);
    if (product.sku && van.has(product.sku)) return true;
    return (product.variants ?? []).some((variant) => van.has(variant.sku));
  }
  const merk = (product.brand ?? "").trim().toLowerCase();
  return Boolean(merk) && (campagne.merken ?? []).some((m) => m.toLowerCase() === merk);
}

/** Loopt of staat gepland; verlopen campagnes verdwijnen vanzelf. */
export function campagneStand(
  campagne: Campagne,
  nu: number = Date.now(),
): "nog-niet" | "loopt" | "afgelopen" {
  const grens = (waarde: string) => {
    const tijd = Date.parse(waarde);
    return Number.isNaN(tijd) ? null : tijd;
  };
  const van = grens(campagne.van);
  const tot = grens(campagne.tot);
  if (van !== null && nu < van) return "nog-niet";
  if (tot !== null && nu > tot + 24 * 60 * 60 * 1000 - 1) return "afgelopen";
  return "loopt";
}

/**
 * De campagnes die de klant mag zien: wat loopt, en wat er binnenkort begint.
 *
 * Geplande acties tonen we bewust wél. Kevins lijst gaat maandag in en de
 * uitingen gaan eerder de deur uit; een klant die dan op de site kijkt en
 * niets ziet, denkt dat het niet klopt.
 */
export async function getCampagnes(): Promise<Campagne[]> {
  let lijst = STANDAARD;
  if (isKvEnabled()) {
    const eigen = await kvGetJSON<unknown[]>("campagnes");
    if (Array.isArray(eigen) && eigen.length > 0) {
      const gelezen = eigen.map(leesCampagne).filter((c): c is Campagne => c !== null);
      if (gelezen.length > 0) lijst = gelezen;
    }
  }
  return lijst
    .filter((campagne) => campagneStand(campagne) !== "afgelopen")
    .sort((a, b) => {
      // Wat loopt eerst, daarna wat begint; binnen elke groep de grootste
      // korting bovenaan (percentage uit de kop, anders achteraan).
      const stand = (c: Campagne) => (campagneStand(c) === "loopt" ? 0 : 1);
      if (stand(a) !== stand(b)) return stand(a) - stand(b);
      const pct = (c: Campagne) => Number(c.kop.match(/^(\d+)%/)?.[1] ?? 0);
      return pct(b) - pct(a);
    });
}
