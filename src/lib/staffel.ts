import { campagneStand, getCampagnes } from "@/lib/campagnes";
import { isKvEnabled, kvGetJSON } from "@/lib/kv";

/**
 * Staffelkortingen: "2 halen 1 betalen", "3 voor € 2,50", "10% vanaf 4 stuks".
 *
 * Kevin vroeg of we deze in de site kunnen maken. Ja — maar met twee dingen
 * die je moet weten, en die staan hier omdat ze de vorm van deze code bepalen.
 *
 * ⚠️ **De regel staat op twee plekken.** Tilroy kent deze acties (Buy and Gets,
 * Sets) maar geeft ze niet uit: de promotie-exportfeed staat voor deze tenant
 * uit, en de Price API draagt alleen berekende stuksprijzen. Een aantal-actie
 * pást niet in een stuksprijs. Dus tot Tilroy die export aanzet moet elke
 * regel hier én in de kassa staan, en dat is precies het soort dubbeling waar
 * prijzen uit elkaar gaan lopen. Daarom: één beheerplek, een verplichte
 * einddatum, en een `bron`-veld zodat je het Tilroy-actienummer erbij kunt
 * zetten en ze naast elkaar te leggen zijn.
 *
 * ⚠️ **De kassa telt anders.** Tilroy rekent bij het inboeken van een order
 * gewoon de stuksprijzen op; onze staffelkorting kent hij niet. Zonder
 * compensatie wijkt het ordertotaal af en strandt de bestelling als draft —
 * hetzelfde als bij de Sikkens-franco. Het dashboard heeft gemeten dat
 * negatieve artikelregels wél worden geaccepteerd, dus de korting gaat als
 * eigen regel mee. Zolang dat kortingsartikel niet in Tilroy bestaat, staat
 * `staffelSku()` leeg en past `pasStaffelToe` niets toe — dan liever geen
 * korting dan een order die niemand kan verwerken.
 *
 * EXTERN CONTRACT — het dashboard schrijft, de site leest:
 *   `staffel:regels` → Staffelregel[]
 */

export interface Staffelregel {
  id: string;
  /** Wat de klant leest: "2 halen, 1 betalen". */
  naam: string;
  /** Tilroy-actienummer, zodat je ze naast elkaar kunt leggen. */
  bron?: string;
  /** Koop dit aantal… */
  koop: number;
  /** …en betaal er zoveel. Bij "2+1 gratis": koop 3, betaal 2. */
  betaal: number;
  /**
   * Vaste groepsprijs in centen: "3 voor € 4,95".
   *
   * Staat dit erin, dan telt `betaal` niet mee — je rekent niet een aantal
   * stuks af maar één bedrag voor de hele groep. Nodig voor de
   * schilderstape-actie, die Melissa terecht als "werkt nog niet" doorgaf:
   * er was geen enkele manier om een groepsprijs uit te drukken.
   */
  bundelPrijs?: number;
  /** Op welke artikelen. Minstens één van deze drie moet gevuld zijn. */
  skus?: string[];
  merk?: string;
  categorie?: string;
  /** Looptijd, "JJJJ-MM-DD". `tot` telt inclusief die dag, net als bij acties. */
  van?: string;
  tot?: string;
  actief?: boolean;
}

/**
 * Het Tilroy-artikel waarop de kortingsregel wordt geboekt.
 *
 * Leeg = geen staffelkorting. Dat is bewust: zonder dit artikel kan de kassa
 * de order niet kloppend krijgen, en een klant die online minder betaalt dan
 * de bon zegt is een probleem dat je met de hand moet oplossen.
 */
export function staffelSku(): string {
  /*
   * ⚠️ Leeg tot Kevin het ARTIKELNUMMER invult, niet de barcode.
   *
   * Hier stond "KORTINGWEBSHOP" als terugval, en dat is de barcode die Kevin
   * doorgaf. Maar de orderregels die naar Tilroy gaan dragen een numeriek
   * artikel-id (39972657 en dergelijke), en het dashboard zet onze sku
   * ongewijzigd in `sku: { tilroyId }`. Een barcode op die plek herkent Tilroy
   * niet, en dan faalt niet alleen de kortingsregel maar de hele push — de
   * order komt dan hélemaal niet aan, wat erger is dan een concept.
   *
   * Zolang dit leeg is worden er geen aantal-acties toegepast en gaat er geen
   * kortingsregel mee. Dat is dezelfde afweging als hiervoor: liever geen
   * korting dan een bestelling die niemand kan verwerken. Zet
   * TILROY_KORTING_SKU op het artikelnummer en alles werkt.
   */
  return process.env.TILROY_KORTING_SKU ?? "";
}

/**
 * Het Tilroy-artikel voor een verzendkorting.
 *
 * Apart van `staffelSku()` omdat het twee verschillende dingen zijn en de
 * boekhouding dat verschil wil zien: dit heft Tilroys eigen DELIVERYCOST op
 * (Sikkens gaat franco de deur uit, de kassa rekent toch € 4,95), terwijl
 * KORTINGWEBSHO korting op de artikelen zelf is.
 *
 * Zet ze op hetzelfde artikel als Kevin dat liever heeft — dan is dit één
 * regel veranderen in plaats van overal.
 */
export function verzendkortingSku(): string {
  return process.env.TILROY_VERZENDKORTING_SKU ?? "VERZENDKORTING";
}

/**
 * Het Tilroy-artikel voor de spoedtoeslag (same-day, € 1,25).
 *
 * Waarom dit een artikelregel moet zijn en geen verzendregel: de Order API
 * weigert elke verzendvariant en rekent uitsluitend zijn eigen DELIVERYCOST.
 * Onze toeslag bereikte Tilroy dus nooit en élke spoedorder week € 1,25 af —
 * de klant had méér betaald dan de bon zei. Productregels tellen wél gewoon
 * op, dus zo klopt het totaal.
 */
export function spoedSku(): string {
  return process.env.TILROY_SPOED_SKU ?? "SPOEDLEVERING";
}

export interface Staffelregel_Toepassing {
  regel: Staffelregel;
  /** Hoeveel stuks gratis zijn. */
  gratis: number;
  /** Kortingsbedrag in centen. */
  korting: number;
  /**
   * Welke mandjeregels hieronder vielen.
   *
   * Nodig om te voorkomen dat er twee kortingen op hetzelfde artikel komen:
   * een aantal-actie geldt voor iedereen, en daar hoort net als bij een
   * Tilroy-actie geen pasvoordeel bovenop. Zie `kluspas.ts`.
   */
  indices: number[];
}

/** Regel geldig op deze dag? `tot` telt inclusief. */
export function staffelLoopt(regel: Staffelregel, nu: number = Date.now()): boolean {
  if (regel.actief === false) return false;
  const grens = (waarde?: string) => {
    const tijd = waarde ? Date.parse(waarde) : Number.NaN;
    return Number.isNaN(tijd) ? null : tijd;
  };
  const van = grens(regel.van);
  const tot = grens(regel.tot);
  if (van !== null && nu < van) return false;
  if (tot !== null && nu > tot + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

function tekst(waarde: unknown, max: number): string {
  return typeof waarde === "string" ? waarde.trim().slice(0, max) : "";
}

/** Leest en controleert wat het dashboard heeft weggeschreven. */
export function leesRegel(ruw: unknown): Staffelregel | null {
  if (!ruw || typeof ruw !== "object") return null;
  const bron = ruw as Record<string, unknown>;
  const koop = Math.floor(Number(bron.koop));
  if (!Number.isFinite(koop) || koop < 2) return null;

  // Een bundelprijs vervangt `betaal`: je rekent één bedrag voor de groep af
  // in plaats van een aantal stuks.
  const bundelRuw = Math.round(Number(bron.bundelPrijs));
  const bundelPrijs = Number.isFinite(bundelRuw) && bundelRuw > 0 ? bundelRuw : 0;

  const betaal = Math.floor(Number(bron.betaal));
  if (!bundelPrijs) {
    // Koop 3 betaal 2 mag; koop 2 betaal 2 is geen korting en koop 2 betaal 3
    // is een prijsverhoging. Allebei weigeren in plaats van uitrekenen.
    if (!Number.isFinite(betaal)) return null;
    if (betaal < 1 || betaal >= koop) return null;
  }

  const skus = Array.isArray(bron.skus)
    ? bron.skus.map((s) => tekst(s, 40)).filter(Boolean)
    : undefined;
  const merk = tekst(bron.merk, 60) || undefined;
  const categorie = tekst(bron.categorie, 60) || undefined;
  if (!skus?.length && !merk && !categorie) return null;

  const naam =
    tekst(bron.naam, 80) ||
    (bundelPrijs
      ? `${koop} voor € ${(bundelPrijs / 100).toFixed(2).replace(".", ",")}`
      : `${koop} halen, ${betaal} betalen`);
  return {
    id: tekst(bron.id, 60) || naam,
    naam,
    koop,
    // Bij een bundel telt `betaal` niet mee; nul houdt de vorm heel zonder
    // dat er ergens per ongeluk mee gerekend wordt.
    betaal: bundelPrijs ? 0 : betaal,
    ...(bundelPrijs ? { bundelPrijs } : {}),
    ...(tekst(bron.bron, 40) ? { bron: tekst(bron.bron, 40) } : {}),
    ...(skus?.length ? { skus } : {}),
    ...(merk ? { merk } : {}),
    ...(categorie ? { categorie } : {}),
    ...(tekst(bron.van, 30) ? { van: tekst(bron.van, 30) } : {}),
    ...(tekst(bron.tot, 30) ? { tot: tekst(bron.tot, 30) } : {}),
    actief: bron.actief !== false,
  };
}

/**
 * De aantal-acties uit de campagnelijst, als staffelregels.
 *
 * ⚠️ Dit is de reparatie van een gat waar de klant doorheen viel. De
 * augustuscampagne kondigt "5 halen, 3 betalen" aan op Led's light, en die
 * aankondiging stond netjes op de actiepagina — maar de motor las uitsluitend
 * `staffel:regels` uit KV, een sleutel die niemand vulde. Vijf lampen in het
 * mandje kostten vijf keer € 3,05. De belofte stond op de site, de korting
 * nergens.
 *
 * Door de campagne zélf de bron te maken staat de regel op één plek: wat de
 * klant leest en wat hij betaalt komen uit hetzelfde bestand. Kevin kan de
 * lijst via KV `campagnes` overschrijven, en dan verhuizen de aantallen
 * vanzelf mee.
 *
 * `staffel:regels` blijft bestaan voor acties die géén publieke aankondiging
 * hebben; bij dezelfde id wint die sleutel, zodat je vanuit het dashboard kunt
 * bijsturen zonder deploy.
 */
export async function staffelUitCampagnes(nu: number = Date.now()): Promise<Staffelregel[]> {
  const campagnes = await getCampagnes();
  const regels: Staffelregel[] = [];
  for (const campagne of campagnes) {
    // Twee vormen: koop/betaal ("2 + 1 gratis") of een groepsprijs ("3 voor
    // € 4,95"). Een campagne zonder allebei is alleen een aankondiging.
    const heeftAantallen = Boolean(campagne.koop && campagne.betaal);
    const heeftBundel = Boolean(campagne.bundel?.aantal && campagne.bundel?.prijs);
    if (!heeftAantallen && !heeftBundel) continue;
    if (campagneStand(campagne, nu) !== "loopt") continue;
    const regel = leesRegel({
      id: `campagne:${campagne.id}`,
      naam: campagne.kop,
      koop: heeftBundel ? campagne.bundel!.aantal : campagne.koop,
      betaal: campagne.betaal,
      ...(heeftBundel ? { bundelPrijs: campagne.bundel!.prijs } : {}),
      skus: campagne.skus,
      // Eén merk per staffelregel; `regelGeldtVoor` vergelijkt op één naam.
      // Alle huidige aantal-acties slaan op één merk of op een sku-lijst.
      merk: campagne.skus?.length ? undefined : campagne.merken?.[0],
      van: campagne.van,
      tot: campagne.tot,
    });
    if (regel) regels.push(regel);
  }
  return regels;
}

export async function staffelregels(nu: number = Date.now()): Promise<Staffelregel[]> {
  // Zonder kortingsartikel geen staffel — zie de kop van dit bestand.
  if (!staffelSku()) return [];

  const uitKv: Staffelregel[] = [];
  if (isKvEnabled()) {
    try {
      const ruw = await kvGetJSON<unknown[]>("staffel:regels");
      if (Array.isArray(ruw)) {
        for (const item of ruw) {
          const regel = leesRegel(item);
          if (regel && staffelLoopt(regel, nu)) uitKv.push(regel);
        }
      }
    } catch (error) {
      // Een storing in KV mag geen prijzen veranderen, maar hem stil laten
      // vallen zou de campagneregels ook meenemen. Alleen deze bron overslaan.
      console.error("[staffel] regels uit KV lezen mislukt:", error);
    }
  }

  const bekend = new Set(uitKv.map((regel) => regel.id));
  const uitCampagnes = (await staffelUitCampagnes(nu)).filter(
    (regel) => !bekend.has(regel.id),
  );
  return [...uitKv, ...uitCampagnes];
}

/**
 * Bundelprijs uit Tilroy toepassen: "3 voor € 4,95".
 *
 * Wat dit kost bij `aantal` stuks, gegeven de gewone stuksprijs. Geeft de
 * korting in centen (0 = geen bundel van toepassing).
 *
 * ⚠️ Anders dan de regels hierboven is hiervoor GEEN kortingsartikel nodig:
 * deze bundel staat in Tilroy, dus de kassa rekent hem zelf ook en het
 * ordertotaal klopt vanzelf. Vandaar dat deze functie niet op `staffelSku()`
 * hangt.
 *
 * De klant krijgt altijd het gunstigste. Ligt de stuksprijs door een lopende
 * actie al lager dan de bundel (drie stuks à € 1,50 tegenover "3 voor
 * € 4,95"), dan blijft de stuksprijs staan. Dat is ook waarom hier `Math.max`
 * met nul staat: een "bundel" die duurder uitvalt is geen korting.
 */
export function bundelKorting(
  stuksprijs: number,
  aantal: number,
  staffels: { aantal: number; prijs: number }[] | undefined,
): number {
  if (!staffels?.length || aantal < 2 || stuksprijs <= 0) return 0;

  // Grootste bundel eerst, dan blijft er zo min mogelijk los over.
  const oplopend = [...staffels].sort((a, b) => b.aantal - a.aantal);
  let over = aantal;
  let kosten = 0;
  for (const staffel of oplopend) {
    if (staffel.aantal < 2) continue;
    const groepen = Math.floor(over / staffel.aantal);
    if (groepen <= 0) continue;
    kosten += groepen * staffel.prijs;
    over -= groepen * staffel.aantal;
  }
  kosten += over * stuksprijs;

  return Math.max(0, aantal * stuksprijs - kosten);
}

/** Waar een regel op slaat. */
export function regelGeldtVoor(
  regel: Staffelregel,
  artikel: { sku?: string; merk?: string; categorie?: string },
): boolean {
  if (regel.skus?.length) return Boolean(artikel.sku && regel.skus.includes(artikel.sku));
  const gelijk = (a: string | undefined, b: string) =>
    (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
  if (regel.merk && !gelijk(artikel.merk, regel.merk)) return false;
  if (regel.categorie && !gelijk(artikel.categorie, regel.categorie)) return false;
  return Boolean(regel.merk || regel.categorie);
}

/**
 * Rekent de staffelkorting uit over een mandje.
 *
 * Werkwijze per regel: alle stuks die eronder vallen op één hoop, en per
 * volledige groep van `koop` stuks gaan er `koop - betaal` gratis mee. Welke
 * stuks gratis zijn, maakt uit: bij "2 halen 1 betalen" op een merk met
 * blikken van € 12 en € 60 verwacht een klant dat het góédkope blik gratis is,
 * niet het dure. Dat is ook hoe een kassa het doet.
 *
 * Eén regel per artikel: valt iets onder twee acties, dan wint de duurste
 * korting. Stapelen levert bedragen op die niemand kan navertellen en die de
 * kassa zeker niet reproduceert.
 */
export function pasStaffelToe(
  regels: Staffelregel[],
  regelsInMandje: { sku?: string; merk?: string; categorie?: string; prijs: number; aantal: number }[],
): { toepassingen: Staffelregel_Toepassing[]; totaleKorting: number } {
  if (!staffelSku()) return { toepassingen: [], totaleKorting: 0 };

  const alGebruikt = new Set<number>();
  const toepassingen: Staffelregel_Toepassing[] = [];

  /*
   * Gunstigste actie eerst, zodat een artikel daar terechtkomt.
   *
   * Sorteren op het aantal gratis stuks per groep is fout: bij "2 halen 1
   * betalen" en "3 halen 2 betalen" is dat allebei één, terwijl de eerste
   * twee keer zo gunstig is. Het gaat om de verhouding — de helft gratis
   * tegenover een derde.
   */
  const aandeelGratis = (regel: Staffelregel) =>
    // Bij een bundel weten we de verhouding nog niet — die hangt van de
    // prijzen af. Achteraan zetten dus; in de praktijk overlappen een bundel
    // en een aantal-actie niet op hetzelfde artikel.
    regel.bundelPrijs ? -1 : (regel.koop - regel.betaal) / regel.koop;
  const gesorteerd = [...regels].sort((a, b) => aandeelGratis(b) - aandeelGratis(a));

  for (const regel of gesorteerd) {
    // Elk stuk als losse prijs, zodat we de goedkoopste gratis kunnen geven.
    const stuks: number[] = [];
    const raakt: number[] = [];
    regelsInMandje.forEach((mandje, index) => {
      if (alGebruikt.has(index)) return;
      if (!regelGeldtVoor(regel, mandje)) return;
      for (let n = 0; n < mandje.aantal; n++) stuks.push(mandje.prijs);
      raakt.push(index);
    });
    if (stuks.length < regel.koop) continue;

    const groepen = Math.floor(stuks.length / regel.koop);
    if (groepen <= 0) continue;

    /*
     * Bundelprijs: elke volle groep kost samen `bundelPrijs`.
     *
     * De duurste stuks eerst in de groep. Bij "3 voor € 4,95" op tapes van
     * € 2,64 en € 3,70 levert dat de klant het meeste op, en dat is ook wat
     * een kassa doet. Valt een groep goedkoper uit dan de bundelprijs, dan is
     * er geen korting — een "bundel" die duurder is dan los is geen aanbieding.
     */
    if (regel.bundelPrijs) {
      const aflopend = [...stuks].sort((a, b) => b - a);
      let korting = 0;
      for (let groep = 0; groep < groepen; groep++) {
        const inGroep = aflopend.slice(groep * regel.koop, (groep + 1) * regel.koop);
        korting += Math.max(0, inGroep.reduce((som, prijs) => som + prijs, 0) - regel.bundelPrijs);
      }
      if (korting <= 0) continue;
      for (const index of raakt) alGebruikt.add(index);
      toepassingen.push({ regel, gratis: 0, korting, indices: raakt });
      continue;
    }

    const gratis = groepen * (regel.koop - regel.betaal);
    if (gratis <= 0) continue;

    // Pas hier vastleggen dat deze artikelen vergeven zijn, en niet al bij het
    // verzamelen. Anders houdt een regel die níét afgaat — twee Sanicur in het
    // mandje bij "2 + 1 gratis" — de artikelen bezet, en kan een volgende
    // regel er niets meer mee. Dan verdwijnt er korting door een actie die
    // helemaal niet van toepassing was.
    for (const index of raakt) alGebruikt.add(index);

    stuks.sort((a, b) => a - b);
    const korting = stuks.slice(0, gratis).reduce((som, prijs) => som + prijs, 0);
    toepassingen.push({ regel, gratis, korting, indices: raakt });
  }

  return {
    toepassingen,
    totaleKorting: toepassingen.reduce((som, t) => som + t.korting, 0),
  };
}

export interface Setkorting {
  naam: string;
  /** Hoeveel volledige sets er in het mandje liggen. */
  sets: number;
  /** Kortingsbedrag in centen. */
  korting: number;
}

/**
 * Sets: verschillende artikelen samen voor één prijs ("schoonmaakset € 9,95").
 *
 * Anders dan een bundel, die stuks van hetzelfde artikel groepeert. Hier moet
 * er van élk artikel minstens één in het mandje liggen. Ligt er één niet in,
 * dan is het geen set en gebeurt er niets — een halve set voor de setprijs zou
 * weggeven zijn.
 *
 * Het aantal volledige sets is het laagste aantal over de artikelen heen: drie
 * flessen azijn en één spons is één set, niet drie.
 *
 * Levert de set niets op omdat de losse prijzen al lager liggen, dan geen
 * korting — zelfde regel als bij een bundel. Zonder kortingsartikel ook niet;
 * dan is er geen regel om het op te boeken en zou de order in Tilroy stranden.
 */
export async function setKortingenVoor(
  mandje: { sku?: string; prijs: number; aantal: number }[],
  nu: number = Date.now(),
): Promise<Setkorting[]> {
  if (mandje.length === 0 || !staffelSku()) return [];
  const campagnes = await getCampagnes();
  const uit: Setkorting[] = [];

  for (const campagne of campagnes) {
    const set = campagne.set;
    if (!set?.skus?.length || !(set.prijs > 0)) continue;
    if (campagneStand(campagne, nu) !== "loopt") continue;

    // Per set-artikel de goedkoopste regel die erbij hoort, en hoeveel er zijn.
    const perSku = set.skus.map((sku) => {
      const regels = mandje.filter((regel) => regel.sku === sku);
      const aantal = regels.reduce((som, regel) => som + regel.aantal, 0);
      const prijs = regels.length ? Math.min(...regels.map((regel) => regel.prijs)) : 0;
      return { aantal, prijs };
    });
    if (perSku.some((regel) => regel.aantal === 0)) continue;

    const sets = Math.min(...perSku.map((regel) => regel.aantal));
    const losPerSet = perSku.reduce((som, regel) => som + regel.prijs, 0);
    const korting = Math.max(0, (losPerSet - set.prijs) * sets);
    if (korting <= 0) continue;

    uit.push({ naam: campagne.kop, sets, korting });
  }
  return uit;
}

export interface Cadeau {
  /** Tilroy-sku van het artikel dat gratis meegaat. */
  sku: string;
  naam: string;
  /** Hoeveel stuks; nu altijd één, maar de order wil een aantal. */
  aantal: number;
  /** Waar het vandaan komt, voor de tekst bij de klant. */
  campagne: string;
}

/**
 * Welke cadeaus dit mandje verdient: "gratis metaalspons bij een spuitbus".
 *
 * ⚠️ Bewust géén staffelregel. Een staffel rekent binnen dezelfde artikelen —
 * bij "5 halen, 3 betalen" zijn de gratis stuks van hetzelfde soort. Hier is
 * het cadeau een ánder artikel, en die twee door elkaar halen zou bij de
 * spuitbusactie een spuitbus weggeven in plaats van een spons van € 1,77.
 *
 * Het cadeau komt niet in de winkelwagen te liggen. Dat zou betekenen dat we
 * ongevraagd iets aan andermans mandje toevoegen, en het verdwijnt weer zodra
 * het koopartikel eruit gaat. In plaats daarvan rekenen we het hier uit, tonen
 * we het als belofte, en zet de checkout het als regel van € 0,00 op de order
 * — dan boekt de kassa de voorraad af en weet de winkel dat hij hem inpakt.
 *
 * Eén cadeau per campagne, hoeveel spuitbussen er ook in het mandje liggen.
 * Twee sponzen bij twee bussen is niet wat er staat, en "op = op" hoort bij
 * dit soort acties.
 */
export async function cadeausVoor(
  mandje: { sku?: string; merk?: string }[],
  nu: number = Date.now(),
): Promise<Cadeau[]> {
  if (mandje.length === 0) return [];
  const campagnes = await getCampagnes();
  const cadeaus: Cadeau[] = [];
  for (const campagne of campagnes) {
    if (!campagne.cadeau) continue;
    if (campagneStand(campagne, nu) !== "loopt") continue;
    const drempel = Math.max(1, campagne.cadeau.vanaf ?? 1);

    const raakt = mandje.filter((regel) => {
      if (campagne.skus?.length) return Boolean(regel.sku && campagne.skus.includes(regel.sku));
      const merk = (regel.merk ?? "").trim().toLowerCase();
      return Boolean(merk) && (campagne.merken ?? []).some((m) => m.toLowerCase() === merk);
    });
    if (raakt.length < drempel) continue;

    // Niet het cadeau weggeven als de klant het artikel zélf al koopt: dan
    // rekent hij ervoor en krijgt hij er een tweede gratis bij, en dat is een
    // andere actie dan hier staat.
    if (mandje.some((regel) => regel.sku === campagne.cadeau!.sku)) continue;

    cadeaus.push({
      sku: campagne.cadeau.sku,
      naam: campagne.cadeau.naam,
      aantal: 1,
      campagne: campagne.kop,
    });
  }
  // Eén exemplaar per artikel, ook als twee acties hetzelfde cadeau geven —
  // de metaalspons zit zowel bij de spuitbussen als bij de bbq-reiniger.
  const gezien = new Set<string>();
  return cadeaus.filter((c) => (gezien.has(c.sku) ? false : gezien.add(c.sku) !== undefined));
}

export interface MandjeRegel {
  sku?: string;
  merk?: string;
  categorie?: string;
  /** Normale stuksprijs in centen, inclusief een lopende Tilroy-actie. */
  prijs: number;
  /** Stuksprijs mét pasvoordeel. Zonder pas gewoon gelijk aan `prijs`. */
  pasPrijs: number;
  aantal: number;
}

/**
 * Wat er van dit mandje af gaat: de staffel óf het pasvoordeel, niet allebei.
 *
 * Kevin over de actieprijzen: "extra kortingen is altijd voor iedereen … je
 * krijgt daar dan ook geen extra kluspaskorting op." Een aantal-actie is
 * precies zo'n korting voor iedereen, dus geldt dezelfde regel — anders is de
 * webshop goedkoper dan de kassa en klopt de bon niet.
 *
 * Maar niet ten koste van de klant. Ligt er één Sanicur in het mandje bij
 * "2 + 1 gratis", dan gaat die actie niet af en moet het pasvoordeel gewoon
 * blijven staan. En valt het pasvoordeel op de betrokken artikelen hóger uit
 * dan de staffel, dan wint het pasvoordeel. Per artikelgroep het gunstigste,
 * nooit gestapeld.
 *
 * Rekent uitsluitend met wat er in dit mandje ligt; de aanroeper haalt de
 * prijzen uit de catalogus en niet uit het verzoek.
 */
export function kiesVoordeligste(
  regels: Staffelregel[],
  mandje: MandjeRegel[],
): {
  toepassingen: Staffelregel_Toepassing[];
  staffelKorting: number;
  paskorting: number;
} {
  const pasOp = (index: number) => {
    const regel = mandje[index];
    return Math.max(0, regel.prijs - regel.pasPrijs) * regel.aantal;
  };

  const { toepassingen } = pasStaffelToe(regels, mandje);

  // Per toepassing kiezen, niet over het hele mandje: twee acties in één
  // mandje hoeven niet dezelfde kant op te vallen.
  const gehouden = toepassingen.filter((toepassing) => {
    const pas = toepassing.indices.reduce((som, index) => som + pasOp(index), 0);
    return toepassing.korting >= pas;
  });

  const gedekt = new Set(gehouden.flatMap((toepassing) => toepassing.indices));
  let paskorting = 0;
  mandje.forEach((_, index) => {
    if (!gedekt.has(index)) paskorting += pasOp(index);
  });

  return {
    toepassingen: gehouden,
    staffelKorting: gehouden.reduce((som, toepassing) => som + toepassing.korting, 0),
    paskorting,
  };
}
