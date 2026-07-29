import { kvDel, kvGetJSON, kvSAdd, kvSetJSON, kvSMembers } from "@/lib/kv";

/**
 * "Mail mij zodra dit er weer is."
 *
 * Uitverkochte artikelen zijn bij ons niet te bestellen — dat is een bewuste
 * keuze, want een order die de winkel niet kan leveren kost meer dan hij
 * opbrengt. Maar een klant die er speciaal voor kwam moet dan wél iets kunnen
 * achterlaten, anders is hij weg en komt hij niet terug.
 *
 * Opslag in Redis:
 *   voorraadmelding:sku:<sku>   JSON met de aanmeldingen voor dit artikel
 *   voorraadmelding:index       SET met alle sku's waar iemand op wacht
 *
 * Het e-mailadres bewaren we niet langer dan nodig: bij het versturen wordt de
 * aanmelding verwijderd, en aanmeldingen ouder dan 90 dagen vervallen bij de
 * eerstvolgende controle. Wachten op iets dat een half jaar niet binnenkomt is
 * geen wachten meer, dat is een adressenbestand.
 */

const INDEX = "voorraadmelding:index";
const MAX_DAGEN = 90;
/** Meer aanmeldingen per artikel bewaren we niet; dat is geen echte vraag meer. */
const MAX_PER_ARTIKEL = 500;

export interface Aanmelding {
  email: string;
  /** ISO-datum van aanmelden. */
  op: string;
  productSlug: string;
  productNaam: string;
}

function sleutel(sku: string): string {
  return `voorraadmelding:sku:${sku}`;
}

/** Aanmelden. Bestaat het adres al voor deze sku, dan verandert er niets. */
export async function meldAan(sku: string, aanmelding: Aanmelding): Promise<void> {
  const bestaand = (await kvGetJSON<Aanmelding[]>(sleutel(sku))) ?? [];
  const adres = aanmelding.email.toLowerCase();
  if (bestaand.some((entry) => entry.email.toLowerCase() === adres)) return;
  if (bestaand.length >= MAX_PER_ARTIKEL) return;
  await kvSetJSON(sleutel(sku), [...bestaand, { ...aanmelding, email: adres }]);
  await kvSAdd(INDEX, sku);
}

/** Alle sku's waar iemand op wacht. */
export async function wachtlijstSkus(): Promise<string[]> {
  return kvSMembers(INDEX);
}

/** De aanmeldingen voor één sku, zonder de verlopen. */
export async function aanmeldingen(sku: string, nu = Date.now()): Promise<Aanmelding[]> {
  const alle = (await kvGetJSON<Aanmelding[]>(sleutel(sku))) ?? [];
  const grens = nu - MAX_DAGEN * 24 * 60 * 60 * 1000;
  return alle.filter((entry) => {
    const op = Date.parse(entry.op);
    return Number.isFinite(op) && op >= grens;
  });
}

/** Na het mailen: de aanmeldingen voor deze sku zijn afgehandeld. */
export async function wisWachtlijst(sku: string): Promise<void> {
  await kvDel(sleutel(sku));
  // De sku blijft in de index staan; die wordt bij de volgende controle
  // overgeslagen omdat er geen aanmeldingen meer zijn. Een SET-verwijdering
  // heeft de KV-laag niet, en een index van een paar honderd sku's is geen
  // probleem.
}
