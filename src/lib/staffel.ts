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
  // KORTINGWEBSHOP, mét de P. De barcode in Kevins bericht was afgekapt tot
  // "KORTINGWEBSHO"; één teken verschil en de kassa kent de regel niet — zelfde
  // valkuil als de kleurtester, die bij ons een streepje te veel had.
  return process.env.TILROY_KORTING_SKU ?? "KORTINGWEBSHOP";
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
  const betaal = Math.floor(Number(bron.betaal));
  // Koop 3 betaal 2 mag; koop 2 betaal 2 is geen korting en koop 2 betaal 3 is
  // een prijsverhoging. Allebei weigeren in plaats van uitrekenen.
  if (!Number.isFinite(koop) || !Number.isFinite(betaal)) return null;
  if (koop < 2 || betaal < 1 || betaal >= koop) return null;

  const skus = Array.isArray(bron.skus)
    ? bron.skus.map((s) => tekst(s, 40)).filter(Boolean)
    : undefined;
  const merk = tekst(bron.merk, 60) || undefined;
  const categorie = tekst(bron.categorie, 60) || undefined;
  if (!skus?.length && !merk && !categorie) return null;

  const naam = tekst(bron.naam, 80) || `${koop} halen, ${betaal} betalen`;
  return {
    id: tekst(bron.id, 60) || naam,
    naam,
    koop,
    betaal,
    ...(tekst(bron.bron, 40) ? { bron: tekst(bron.bron, 40) } : {}),
    ...(skus?.length ? { skus } : {}),
    ...(merk ? { merk } : {}),
    ...(categorie ? { categorie } : {}),
    ...(tekst(bron.van, 30) ? { van: tekst(bron.van, 30) } : {}),
    ...(tekst(bron.tot, 30) ? { tot: tekst(bron.tot, 30) } : {}),
    actief: bron.actief !== false,
  };
}

export async function staffelregels(): Promise<Staffelregel[]> {
  if (!isKvEnabled() || !staffelSku()) return [];
  const ruw = await kvGetJSON<unknown[]>("staffel:regels");
  if (!Array.isArray(ruw)) return [];
  return ruw
    .map(leesRegel)
    .filter((regel): regel is Staffelregel => regel !== null)
    .filter((regel) => staffelLoopt(regel));
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
  const aandeelGratis = (regel: Staffelregel) => (regel.koop - regel.betaal) / regel.koop;
  const gesorteerd = [...regels].sort((a, b) => aandeelGratis(b) - aandeelGratis(a));

  for (const regel of gesorteerd) {
    // Elk stuk als losse prijs, zodat we de goedkoopste gratis kunnen geven.
    const stuks: number[] = [];
    regelsInMandje.forEach((mandje, index) => {
      if (alGebruikt.has(index)) return;
      if (!regelGeldtVoor(regel, mandje)) return;
      for (let n = 0; n < mandje.aantal; n++) stuks.push(mandje.prijs);
      alGebruikt.add(index);
    });
    if (stuks.length < regel.koop) continue;

    const groepen = Math.floor(stuks.length / regel.koop);
    const gratis = groepen * (regel.koop - regel.betaal);
    if (gratis <= 0) continue;

    stuks.sort((a, b) => a - b);
    const korting = stuks.slice(0, gratis).reduce((som, prijs) => som + prijs, 0);
    toepassingen.push({ regel, gratis, korting });
  }

  return {
    toepassingen,
    totaleKorting: toepassingen.reduce((som, t) => som + t.korting, 0),
  };
}
