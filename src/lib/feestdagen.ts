/**
 * Nederlandse feestdagen voor de bezorg- en afhaalklok.
 *
 * Twee soorten regels, met verschillende bronnen:
 *
 *  - WINKELTIJDEN op feestdagen komen uit "AANGEPASTE OPENINGSTIJDEN
 *    Feestdagen" (SharePoint, maart 2026): Goede Vrijdag normaal, 1e Paas- en
 *    Pinksterdag gesloten (vallen op zondag — het weekschema dekt dat al),
 *    2e Paas- en Pinksterdag verkort open, Koningsdag 8:00–14:00,
 *    Hemelvaartsdag 9:00–18:00. Voor 2e Paas-/Pinksterdag kent de PDF twee
 *    varianten (9:00 en 12:00 open, per filiaal); zolang niet vaststaat welk
 *    filiaal welke variant draait, rekenen we overal met 12:00 — een belofte
 *    die te laat is, is te verbeteren; een belofte die te vroeg is, is een
 *    klant voor een dichte deur. Kerst en oud/nieuw staan niet in die PDF;
 *    1 januari en 1e Kerstdag zijn als gesloten opgenomen (universeel in de
 *    Nederlandse retail), 2e Kerstdag conservatief ook — TODO: echte tijden
 *    bij Kevin opvragen vóór december.
 *
 *  - BEZORGDAGEN: DHL en PostNL bezorgen niet op officiële feestdagen
 *    (Nieuwjaarsdag, 2e Paasdag, Koningsdag, Hemelvaart, 2e Pinksterdag,
 *    beide Kerstdagen). 1e Paas-/Pinksterdag zijn zondagen en vallen al
 *    onder de bestaande zondagsregel. Goede Vrijdag en 5 mei rijden de
 *    vervoerders gewoon.
 *
 * Alles rekent, net als delivery.ts en pickup.ts, in lokale tijd en is puur.
 */

export interface FeestdagWinkelUren {
  /** Minuten na middernacht. */
  opens: number;
  closes: number;
}

export interface Feestdag {
  naam: string;
  /** "gesloten", afwijkende uren, of null = het gewone weekschema geldt. */
  winkel: "gesloten" | FeestdagWinkelUren | null;
  /** Bezorgen DHL/PostNL op deze dag? */
  bezorging: boolean;
}

/** Paaszondag (Gregoriaans, algoritme van Gauss/Meeus) — lokale datum. */
export function paaszondag(jaar: number): Date {
  const a = jaar % 19;
  const b = Math.floor(jaar / 100);
  const c = jaar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31); // 3 = maart, 4 = april
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jaar, maand - 1, dag);
}

const uren = (opens: string, closes: string): FeestdagWinkelUren => {
  const [oh, om] = opens.split(":").map(Number);
  const [ch, cm] = closes.split(":").map(Number);
  return { opens: oh * 60 + om, closes: ch * 60 + cm };
};

const zelfdeDag = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const plusDagen = (d: Date, n: number) => {
  const kopie = new Date(d);
  kopie.setDate(kopie.getDate() + n);
  return kopie;
};

/** De feestdag op deze datum, of null als het een gewone dag is. */
export function feestdagOp(datum: Date): Feestdag | null {
  const jaar = datum.getFullYear();
  const maand = datum.getMonth();
  const dag = datum.getDate();

  if (maand === 0 && dag === 1) {
    return { naam: "Nieuwjaarsdag", winkel: "gesloten", bezorging: false };
  }
  if (maand === 11 && dag === 25) {
    return { naam: "Eerste Kerstdag", winkel: "gesloten", bezorging: false };
  }
  if (maand === 11 && dag === 26) {
    // Winkeltijden onbekend (niet in de feestdagen-PDF); conservatief dicht.
    return { naam: "Tweede Kerstdag", winkel: "gesloten", bezorging: false };
  }

  // Koningsdag: 27 april, of 26 april wanneer de 27e een zondag is.
  const koningsdag = new Date(jaar, 3, 27);
  if (koningsdag.getDay() === 0) koningsdag.setDate(26);
  if (zelfdeDag(datum, koningsdag)) {
    return { naam: "Koningsdag", winkel: uren("8:00", "14:00"), bezorging: false };
  }

  const pasen = paaszondag(jaar);
  if (zelfdeDag(datum, pasen)) {
    // Zondag; het weekschema zegt al "gesloten", dit maakt het expliciet.
    return { naam: "Eerste Paasdag", winkel: "gesloten", bezorging: false };
  }
  if (zelfdeDag(datum, plusDagen(pasen, 1))) {
    return { naam: "Tweede Paasdag", winkel: uren("12:00", "18:00"), bezorging: false };
  }
  if (zelfdeDag(datum, plusDagen(pasen, 39))) {
    return { naam: "Hemelvaartsdag", winkel: uren("9:00", "18:00"), bezorging: false };
  }
  if (zelfdeDag(datum, plusDagen(pasen, 49))) {
    return { naam: "Eerste Pinksterdag", winkel: "gesloten", bezorging: false };
  }
  if (zelfdeDag(datum, plusDagen(pasen, 50))) {
    return { naam: "Tweede Pinksterdag", winkel: uren("12:00", "18:00"), bezorging: false };
  }

  return null;
}

/** Rijden DHL en PostNL op deze dag? (Zondag is hier bewust géén onderdeel
 *  van: die regel zit al in de klokken zelf.) */
export function bezorgdagMogelijk(datum: Date): boolean {
  return feestdagOp(datum)?.bezorging !== false;
}

/**
 * Winkeluren op deze datum volgens de feestdagregels:
 *  - null → geen feestdag, het gewone weekschema geldt;
 *  - "gesloten" → dicht;
 *  - uren → afwijkende openingstijden.
 */
export function feestdagWinkelUren(datum: Date): "gesloten" | FeestdagWinkelUren | null {
  return feestdagOp(datum)?.winkel ?? null;
}
