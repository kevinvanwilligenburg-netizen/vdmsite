import { normaliseerEmail } from "@/lib/account";
import { isKvEnabled, kvGetJSON, kvSetJSON } from "@/lib/kv";
import type { Adres } from "@/lib/types";

export type { Adres };

/**
 * Adresboek van een klant, en het factuuradres bij een bestelling.
 *
 * Kevin: *"graag meerdere adressen kunnen invoeren en ook een factuuradres."*
 *
 * Twee dingen die vaak door elkaar lopen:
 *
 *  - **Meerdere adressen** is gemak. Een schilder bestelt de ene week naar zijn
 *    loods en de andere naar het werkadres van een klant. Nu tikt hij dat elke
 *    keer opnieuw, en één cijfer verkeerd in de postcode is een pakket dat
 *    ergens anders staat.
 *  - **Een factuuradres** is administratie. Het bepaalt niet waar de doos heen
 *    gaat maar op wiens naam de factuur staat, en dat is bij een bouwbedrijf
 *    zelden hetzelfde. Zonder dat veld schrijven we het bezorgadres op de
 *    factuur, en dan klopt de boekhouding van de klant niet.
 *
 * Het factuuradres hangt daarom aan de BESTELLING (`Order.billing`) en het
 * adresboek aan het ACCOUNT. Een afhaalbestelling heeft geen bezorgadres maar
 * kan wel een factuur nodig hebben — nog een reden om die twee niet in één
 * veld te proppen.
 */

const MAX_ADRESSEN = 10;

/** Alles kort en zonder rare tekens; dit gaat op een pakketlabel en een factuur. */
function tekst(waarde: unknown, max: number): string {
  return typeof waarde === "string" ? waarde.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * Postcode netjes: "1234 AB" (NL) of "1234" (BE).
 *
 * Niet omdat het mooier staat, maar omdat een vervoerder een postcode zonder
 * spatie of met kleine letters soms niet herkent en het pakket dan handmatig
 * gesorteerd moet worden.
 */
export function normaliseerPostcode(waarde: string, land: string): string {
  const kaal = waarde.replace(/\s+/g, "").toUpperCase();
  if (land === "BE") return kaal.slice(0, 4);
  const nl = kaal.match(/^(\d{4})([A-Z]{2})$/);
  return nl ? `${nl[1]} ${nl[2]}` : waarde.trim().toUpperCase();
}

export function postcodeGeldig(waarde: string, land: string): boolean {
  const kaal = (waarde ?? "").replace(/\s+/g, "").toUpperCase();
  return land === "BE" ? /^\d{4}$/.test(kaal) : /^\d{4}[A-Z]{2}$/.test(kaal);
}

/**
 * Leest een adres uit onbetrouwbare invoer.
 *
 * Geeft `null` als het adres niet compleet is. Half opslaan heeft geen zin: een
 * adres zonder huisnummer is geen adres, en het duikt later op als bezorgkeuze
 * die het pakket nergens brengt.
 */
export function leesAdres(ruw: unknown): Adres | null {
  if (!ruw || typeof ruw !== "object") return null;
  const bron = ruw as Record<string, unknown>;
  const land = tekst(bron.land ?? bron.country, 2).toUpperCase() === "BE" ? "BE" : "NL";
  const adres: Adres = {
    ...(tekst(bron.label, 40) ? { label: tekst(bron.label, 40) } : {}),
    ...(tekst(bron.bedrijf ?? bron.company, 80) ? { bedrijf: tekst(bron.bedrijf ?? bron.company, 80) } : {}),
    ...(tekst(bron.voornaam ?? bron.firstName, 60) ? { voornaam: tekst(bron.voornaam ?? bron.firstName, 60) } : {}),
    ...(tekst(bron.achternaam ?? bron.lastName, 60) ? { achternaam: tekst(bron.achternaam ?? bron.lastName, 60) } : {}),
    straat: tekst(bron.straat ?? bron.street, 90),
    huisnummer: tekst(bron.huisnummer ?? bron.houseNumber, 10),
    ...(tekst(bron.toevoeging ?? bron.houseNumberSuffix, 10)
      ? { toevoeging: tekst(bron.toevoeging ?? bron.houseNumberSuffix, 10) }
      : {}),
    postcode: normaliseerPostcode(tekst(bron.postcode ?? bron.postalCode, 12), land),
    plaats: tekst(bron.plaats ?? bron.city, 60),
    land,
  };
  if (!adres.straat || !adres.huisnummer || !adres.plaats) return null;
  if (!postcodeGeldig(adres.postcode, land)) return null;
  return adres;
}

/** Eén regel, zoals op een envelop. Voor overzichten en mails. */
export function adresRegel(adres: Adres): string {
  const nummer = [adres.huisnummer, adres.toevoeging].filter(Boolean).join(" ");
  return `${adres.straat} ${nummer}, ${adres.postcode} ${adres.plaats}`;
}

/**
 * Zijn dit hetzelfde adres?
 *
 * Gebruikt om te voorkomen dat het adresboek volloopt met tien keer hetzelfde
 * omdat iemand een keer "Straat" en een keer "straat " typte.
 */
export function zelfdeAdres(a: Adres, b: Adres): boolean {
  const sleutel = (adres: Adres) =>
    [adres.straat, adres.huisnummer, adres.toevoeging ?? "", adres.postcode, adres.land]
      .join("|")
      .toLowerCase();
  return sleutel(a) === sleutel(b);
}

/* ── adresboek per account ─────────────────────────────────────────────────── */

function sleutelVan(email: string): string {
  return `account:adressen:${normaliseerEmail(email)}`;
}

export async function adressenVan(email: string): Promise<Adres[]> {
  if (!isKvEnabled() || !email) return [];
  const opgeslagen = await kvGetJSON<unknown[]>(sleutelVan(email));
  if (!Array.isArray(opgeslagen)) return [];
  return opgeslagen
    .map(leesAdres)
    .filter((adres): adres is Adres => adres !== null)
    .slice(0, MAX_ADRESSEN);
}

export async function bewaarAdressen(email: string, adressen: Adres[]): Promise<boolean> {
  if (!isKvEnabled() || !email) return false;
  return kvSetJSON(sleutelVan(email), adressen.slice(0, MAX_ADRESSEN));
}

/**
 * Adres erbij, of het bestaande bijwerken.
 *
 * Het nieuwste adres komt vooraan: dat is bijna altijd het adres dat de klant
 * de volgende keer weer wil. Zat het er al in, dan schuift het naar voren in
 * plaats van dat er een dubbele bijkomt.
 *
 * ⚠️ Stil falen is hier de bedoeling. Dit draait na een geslaagde bestelling;
 * een adresboek dat niet opslaat mag nooit een betaalde order laten klappen.
 */
export async function onthoudAdres(email: string, adres: Adres): Promise<void> {
  if (!isKvEnabled() || !email) return;
  try {
    const bestaand = await adressenVan(email);
    const zonder = bestaand.filter((ander) => !zelfdeAdres(ander, adres));
    const eerder = bestaand.find((ander) => zelfdeAdres(ander, adres));
    // Een label dat de klant zelf gaf niet overschrijven met niets.
    const samen: Adres = eerder?.label && !adres.label ? { ...adres, label: eerder.label } : adres;
    await bewaarAdressen(email, [samen, ...zonder]);
  } catch (error) {
    console.error("[adressen] onthouden mislukt:", error);
  }
}
