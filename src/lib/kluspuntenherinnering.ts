import { haalKluspunten } from "@/lib/account";
import { KORTING_BIJ_DREMPEL, PUNTEN_VOOR_KORTING } from "@/lib/kluspunten";
import { kvDel, kvGetJSON, kvSetJSON, kvSMembers } from "@/lib/kv";
import { verstuurMail } from "@/lib/mail";
import { getOrder } from "@/lib/orders";
import { absoluteUrl, DASHBOARD_API_URL, SITE_NAME } from "@/lib/site";

/**
 * "Je bent er bijna": een seintje aan wie vlak onder zijn voucher zit.
 *
 * Regels van Kevin (3 augustus 2026): bij 250 punten staat er € 12,50 korting
 * tegenover. Wie tussen de 200 en 250 zit krijgt één keer bericht — dat is de
 * groep die met één klus over de streep is, en precies de reden dat een
 * spaarsysteem werkt.
 *
 * ⚠️ ONLINE BESTELLINGEN LEVEREN OP DIT MOMENT GEEN PUNTEN OP. Het dashboard
 * mat 54 webshopbonnen over drie maanden: € 5.428 omzet, nul punten, terwijl
 * de kassa in diezelfde periode 640 bonnen mét punten boekte. Het ligt aan de
 * vestiging (shop 8934, kassa 15295), niet aan de klant of aan een actie. Dat
 * is een schakelaar in de Tilroy-backoffice. Zolang die uit staat mag nergens
 * in deze mail of op de site staan dat je online spaart — daarom "op elke
 * aankoop in de winkel".
 *
 * Het tarief is normaal 1 punt per euro (Kevin bevestigd, en het dashboard
 * mat een mediaan van exact 1,000). Vandaar "normaal": voor
 * dubbele-puntenacties bestaat er een vermenigvuldigingsfactor per verkoop,
 * dus als natuurwet brengen we het niet. Een concreet saldo komt altijd van
 * Tilroy, nooit uit een eigen som.
 *
 * En dit blijft herhalen doet het niet: er gaat één mail per spaarronde uit.
 * Pas als iemand zijn punten heeft ingewisseld en opnieuw de band in groeit,
 * mag het weer.
 */

/** Vanaf hier is het "bijna". */
export const HERINNER_VANAF = 200;

// De drempel en het bedrag komen uit lib/kluspunten, zodat de mail, de
// accountpagina en /kluspunten nooit uiteen kunnen lopen. Twee eigen
// constanten voor hetzelfde bedrag is hoe die duizend euro te veel kon ontstaan.
export const VOUCHER_VANAF = PUNTEN_VOOR_KORTING;
export const VOUCHER_WAARDE = KORTING_BIJ_DREMPEL;

interface Stempel {
  /** Hoeveel punten iemand had toen we mailden. */
  punten: number;
  op: string;
}

const stempelSleutel = (email: string) =>
  `kluspunten:herinnerd:${email.trim().toLowerCase()}`;

/**
 * De e-mailadressen van klanten die wij kennen.
 *
 * Alleen wie online besteld heeft. Wie uitsluitend in de winkel koopt staat
 * niet in onze opslag maar wel in Tilroy; die groep is groter en die mail
 * hoort daarom bij het dashboard thuis, niet hier.
 */
export async function bekendeKlanten(): Promise<string[]> {
  const ids = await kvSMembers("order:index");
  const adressen = new Set<string>();
  for (const id of ids) {
    const order = await getOrder(id);
    const email = order?.customer?.email?.trim().toLowerCase();
    // Alleen klanten met een Kluspas: zonder pas worden er geen punten
    // gespaard en is de mail onzin.
    if (email && order?.kluspasNumber) adressen.add(email);
  }
  return [...adressen];
}

export interface Kandidaat {
  email: string;
  punten: number;
  tekort: number;
}

/**
 * Mag deze klant reclame van ons krijgen?
 *
 * De toestemming staat in Tilroy onder `customer.notifications.newsletter` en
 * het dashboard ontsluit hem op `/api/klanten/toestemming`. Dat veld is geen
 * formaliteit: in hun steekproef stond het bij 7 van de 25 klanten op false.
 * Ruim een kwart wil dit niet, en dit is een commerciële mail, geen
 * orderbevestiging.
 *
 * Alleen `ok` is groen. Bij `onbekende-klant` sturen we bewust NIET: deze
 * campagne gaat per definitie over bestaande klanten, dus als Tilroy hem niet
 * kent klopt er iets anders niet. Bij `fout` ook niet — dan weten we het
 * gewoon niet, en dat is geen grond om toch te mailen.
 */
async function magMailen(email: string): Promise<boolean> {
  const sleutel = process.env.SITE_API_KEY;
  if (!sleutel) return false;
  try {
    const res = await fetch(
      `${DASHBOARD_API_URL}/api/klanten/toestemming?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${sleutel}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { magMailen?: boolean; reden?: string };
    return data.magMailen === true && data.reden === "ok";
  } catch {
    return false;
  }
}

export async function kandidaten(): Promise<Kandidaat[]> {
  const uit: Kandidaat[] = [];
  for (const email of await bekendeKlanten()) {
    const saldo = await haalKluspunten(email);
    // `null` betekent "onbekend bij Tilroy", niet "nul punten" — zie
    // haalKluspunten. Daar mailen we dus niet op.
    if (!saldo) continue;

    const stempel = await kvGetJSON<Stempel>(stempelSleutel(email));

    if (saldo.punten < HERINNER_VANAF) {
      // Onder de band: de spaarronde is voorbij (ingewisseld) of nog niet
      // begonnen. Stempel weg, zodat de volgende ronde weer een mail mag.
      if (stempel) await kvDel(stempelSleutel(email));
      continue;
    }
    if (saldo.punten >= VOUCHER_VANAF) continue;
    // Al gemaild in deze ronde: alleen opnieuw als hij ondertussen onder de
    // band is geweest, en dat zien we aan het verdwenen stempel.
    if (stempel) continue;

    // De toestemming als laatste: die kost een aanroep per adres, dus we
    // vragen hem alleen voor wie er verder al doorheen is.
    if (!(await magMailen(email))) continue;

    uit.push({
      email,
      punten: saldo.punten,
      tekort: Math.round((VOUCHER_VANAF - saldo.punten) * 10) / 10,
    });
  }
  return uit;
}

export async function stuurBijnaVoucherMail(kandidaat: Kandidaat): Promise<boolean> {
  const puntenTekst = kandidaat.punten.toLocaleString("nl-NL");
  const tekortTekst = kandidaat.tekort.toLocaleString("nl-NL");
  const waarde = VOUCHER_WAARDE.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
  const accountUrl = absoluteUrl("/account");

  const tekst = [
    "Hoi,",
    "",
    `Je staat op ${puntenTekst} kluspunten. Nog ${tekortTekst} te gaan en je hebt ${waarde} korting te besteden.`,
    "",
    `Je saldo bekijken: ${accountUrl}`,
    "",
    "Normaal spaar je 1 punt per euro op elke aankoop in de winkel. Inwisselen doe je aan de kassa.",
    "",
    `Groet, ${SITE_NAME}`,
  ].join("\n");

  const html = [
    "<p>Hoi,</p>",
    `<p>Je staat op <strong>${puntenTekst} kluspunten</strong>. Nog ${tekortTekst} te gaan en je hebt <strong>${waarde} korting</strong> te besteden.</p>`,
    `<p><a href="${accountUrl}">Bekijk je saldo</a></p>`,
    "<p>Normaal spaar je 1 punt per euro op elke aankoop in de winkel. Inwisselen doe je aan de kassa.</p>",
    `<p>Groet,<br>${SITE_NAME}</p>`,
  ].join("");

  const resultaat = await verstuurMail({
    aan: kandidaat.email,
    onderwerp: `Nog ${tekortTekst} kluspunten tot ${waarde} korting`,
    tekst,
    html,
  });
  return resultaat.ok;
}

export async function markeerHerinnerd(email: string, punten: number): Promise<void> {
  await kvSetJSON(stempelSleutel(email), {
    punten,
    op: new Date().toISOString(),
  } satisfies Stempel);
}
