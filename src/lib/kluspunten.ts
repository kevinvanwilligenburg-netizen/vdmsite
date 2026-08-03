/**
 * Kluspunten: één plek voor de rekenregels.
 *
 * Kevin (3 augustus 2026): normaal 1 punt per euro, 250 punten is € 12,50
 * korting. Het dashboard mat op duizend bonnen een mediaan van exact 1,000
 * punt per euro, dus die twee komen overeen. 250 × € 0,05 = € 12,50, en dat
 * is 5% terug.
 *
 * "Normaal", want Tilroy kent per verkoop een vermenigvuldigingsfactor voor
 * dubbele-puntenacties (gemeten spreiding 0,433 tot 1,334 punt per euro). Wat
 * hier wordt uitgerekend is dus een verwachting voor een mandje dat nog niet
 * is afgerekend — nooit een saldo. Een echt saldo komt altijd van Tilroy, via
 * haalKluspunten.
 *
 * ⚠️ ONLINE SPAREN IS NIET BEVESTIGD. Het dashboard mat 54 webshopbonnen over
 * drie maanden: € 5.428 omzet, nul punten, terwijl de kassa in dezelfde
 * periode 640 bonnen mét punten boekte. Die bonnen stonden op vestiging 8934
 * ("Webshop"), en daar raakt Tilroy het puntensysteem niet aan. Kevin denkt
 * dat webshoporders op Nijverdal worden geschreven; dat spreekt de meting
 * tegen en moet aan de kassa worden nagekeken. Zolang dat niet rond is, staat
 * `KLUSPUNTEN_ONLINE` op de env-vlag: uit = we tonen nergens een belofte over
 * online sparen.
 */

/** Punten per euro, bij een normale aankoop zonder actie. */
export const PUNTEN_PER_EURO = 1;

/** Wat één punt waard is aan de kassa. */
export const EURO_PER_PUNT = 0.05;

/** Bij dit saldo staat er een volle korting klaar. */
export const PUNTEN_VOOR_KORTING = 250;

/** Wat die korting is, in centen. */
export const KORTING_BIJ_DREMPEL = Math.round(PUNTEN_VOOR_KORTING * EURO_PER_PUNT * 100);

/**
 * Sparen webshopbestellingen punten?
 *
 * Standaard uit tot iemand aan de kassa heeft gezien dat het klopt. Zet
 * `NEXT_PUBLIC_KLUSPUNTEN_ONLINE=1` in Vercel om het aan te zetten; dan
 * verschijnen de punten op de productpagina, bij het afrekenen en in de
 * bevestigingsmail.
 */
export const KLUSPUNTEN_ONLINE = process.env.NEXT_PUBLIC_KLUSPUNTEN_ONLINE === "1";

/**
 * Hoeveel punten levert dit bedrag op?
 *
 * Bedrag in centen erin, hele punten eruit. Naar beneden afgerond: een klant
 * die 199 punten verwachtte en er 198 krijgt, voelt zich tekortgedaan; andersom
 * valt het mee.
 */
export function puntenVoor(bedragInCenten: number): number {
  if (!Number.isFinite(bedragInCenten) || bedragInCenten <= 0) return 0;
  return Math.floor((bedragInCenten / 100) * PUNTEN_PER_EURO);
}

/** Wat een saldo waard is, in centen. */
export function puntenInCenten(punten: number): number {
  if (!Number.isFinite(punten) || punten <= 0) return 0;
  return Math.round(punten * EURO_PER_PUNT * 100);
}
