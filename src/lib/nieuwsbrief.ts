import { randomBytes, createHash } from "node:crypto";

import { normaliseerEmail } from "@/lib/account";
import { isKvEnabled, kvDel, kvGetJSON, kvGetRaw, kvSetEx, kvSetJSON } from "@/lib/kv";
import { absoluteUrl } from "@/lib/site";

/**
 * Aanmelden voor de nieuwsbrief, met bevestiging per mail.
 *
 * Kevin wilde nieuwsbrieven kunnen sturen. De verzendkant werkte al (Resend,
 * domein `mail.devoordeelmarkt.nl` geverifieerd), maar er was geen lijst en
 * geen manier om er een op te bouwen.
 *
 * ⚠️ Het echte obstakel is nooit techniek geweest maar toestemming.
 * E-mailadressen uit bestellingen zijn géén nieuwsbriefaanmelding. Daarom:
 *
 *  - **Dubbele opt-in.** Iemand vult zijn adres in, krijgt een mail, en pas na
 *    de klik staat hij op de lijst. Dat is niet alleen netjes tegenover
 *    iemand die door een ander wordt opgegeven — het beschermt ook de
 *    bezorging. Eén spamklacht te veel en Resend zet het hele domein op slot,
 *    en dan komen de orderbevestigingen óók niet meer aan.
 *  - **Bewijs bewaren.** We leggen vast wannéér, vanaf welke pagina en met
 *    welke tekst iemand toestemming gaf. Zonder dat bewijs is toestemming bij
 *    een klacht juridisch waardeloos.
 *  - **Afmelden zonder inloggen**, met een link die in elke mail hoort te
 *    staan.
 *
 * Onze KV is de bron van waarheid voor de toestemming; Resend is alleen het
 * verzendgereedschap. Mislukt de synchronisatie, dan raken we een aanmelding
 * dus niet kwijt — hij staat hier en kan opnieuw worden doorgezet.
 */

/** Waar aanmeldingen vandaan komen; staat in het bewijs en in Resend. */
export type Aanmeldbron = "footer" | "checkout" | "account";

export interface Aanmelding {
  email: string;
  bevestigdOp?: string;
  aangemeldOp: string;
  bron: Aanmeldbron;
  /** De tekst die naast het vinkje stond; letterlijk, als bewijs. */
  toestemmingstekst: string;
  afgemeldOp?: string;
  /** Is hij ook in Resend gezet? Nee = opnieuw proberen kan geen kwaad. */
  inResend?: boolean;
}

/** De lijst in Resend. Aangemaakt op 6 augustus 2026; Klus=r heeft eigen lijsten. */
const SEGMENT_ID = process.env.RESEND_VDM_SEGMENT ?? "41bc1136-c5fc-4971-a9d8-475dc4c13de8";

/** Een openstaande bevestiging vervalt na twee dagen. */
const BEVESTIGING_TTL = 2 * 24 * 3600;

/**
 * De tekst waarmee iemand instemt. Letterlijk bewaard bij de aanmelding.
 *
 * Verander je hem, laat de oude dan staan bij bestaande aanmeldingen: het
 * bewijs is de tekst die er toen stond, niet die van vandaag.
 */
export const TOESTEMMINGSTEKST =
  "Ja, stuur mij de nieuwsbrief van De Voordeelmarkt met acties, klustips en " +
  "nieuwe producten. Afmelden kan met één klik in elke mail.";

const sleutel = {
  aanmelding: (email: string) => `nieuwsbrief:${normaliseerEmail(email)}`,
  bevestiging: (hash: string) => `nieuwsbrief:bevestig:${hash}`,
};

/** Tokens gehasht opslaan, net als de inlogcodes: de KV kent het token niet. */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function nieuwToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function aanmeldingVan(email: string): Promise<Aanmelding | null> {
  if (!isKvEnabled() || !email) return null;
  return kvGetJSON<Aanmelding>(sleutel.aanmelding(email));
}

/**
 * Stap 1: adres vastleggen als "nog niet bevestigd" en een token uitgeven.
 *
 * Geeft `null` als het adres al bevestigd op de lijst staat — dan sturen we
 * geen tweede bevestigingsmail. Iemand die zich twee keer aanmeldt hoort geen
 * tweede mail te krijgen, en het geeft ook niets prijs over wie er al op staat.
 */
export async function startAanmelding(
  email: string,
  bron: Aanmeldbron,
): Promise<{ token: string } | null> {
  if (!isKvEnabled()) return null;
  const bestaand = await aanmeldingVan(email);
  if (bestaand?.bevestigdOp && !bestaand.afgemeldOp) return null;

  const aanmelding: Aanmelding = {
    email: normaliseerEmail(email),
    aangemeldOp: new Date().toISOString(),
    bron,
    toestemmingstekst: TOESTEMMINGSTEKST,
  };
  await kvSetJSON(sleutel.aanmelding(email), aanmelding);

  const token = nieuwToken();
  await kvSetEx(
    sleutel.bevestiging(hash(token)),
    normaliseerEmail(email),
    BEVESTIGING_TTL,
  );
  return { token };
}

/** Stap 2: de klik uit de mail. Zet hem op de lijst en in Resend. */
export async function bevestigAanmelding(token: string): Promise<Aanmelding | null> {
  if (!isKvEnabled() || !token) return null;
  // Rauw lezen: `kvSetEx` schrijft een kale string, geen JSON. Met kvGetJSON
  // zou dit stil op null uitkomen en leek elke bevestigingslink verlopen.
  const adres = await kvGetRaw(sleutel.bevestiging(hash(token)));
  if (!adres) return null;

  const bestaand = (await aanmeldingVan(adres)) ?? {
    email: adres,
    aangemeldOp: new Date().toISOString(),
    bron: "footer" as Aanmeldbron,
    toestemmingstekst: TOESTEMMINGSTEKST,
  };
  const bevestigd: Aanmelding = {
    ...bestaand,
    bevestigdOp: new Date().toISOString(),
    afgemeldOp: undefined,
    inResend: await zetInResend(adres),
  };
  await kvSetJSON(sleutel.aanmelding(adres), bevestigd);
  // Token is eenmalig.
  await kvDel(sleutel.bevestiging(hash(token)));
  return bevestigd;
}

/** Afmelden. Blijft als record staan, met datum — dat is ook bewijs. */
export async function meldAf(email: string): Promise<boolean> {
  if (!isKvEnabled()) return false;
  const bestaand = await aanmeldingVan(email);
  if (!bestaand) return false;
  await kvSetJSON(sleutel.aanmelding(email), {
    ...bestaand,
    afgemeldOp: new Date().toISOString(),
  });
  await zetUitResend(email);
  return true;
}

/**
 * De afmeldlink. Geen token maar het adres zelf, ondertekend met een hash.
 *
 * Een afmeldlink moet werken zonder inloggen en zonder dat we per mail een
 * token hoeven te bewaren. De ondertekening voorkomt dat iemand anderen kan
 * afmelden door adressen in de URL te proberen.
 */
export function afmeldHandtekening(email: string): string {
  const geheim = process.env.CRON_SECRET ?? process.env.SITE_API_KEY ?? "";
  return createHash("sha256")
    .update(`${normaliseerEmail(email)}:${geheim}`)
    .digest("hex")
    .slice(0, 32);
}

export function afmeldUrl(email: string): string {
  const adres = encodeURIComponent(normaliseerEmail(email));
  return absoluteUrl(`/nieuwsbrief/afmelden?e=${adres}&s=${afmeldHandtekening(email)}`);
}

/* ── Resend ────────────────────────────────────────────────────────────────── */

/**
 * Contact in Resend zetten.
 *
 * Best effort: mislukt het, dan staat de bevestigde aanmelding nog steeds in
 * onze KV en kan hij later opnieuw worden doorgezet. Een klant die net op
 * "bevestigen" klikte mag geen foutmelding zien omdat een externe dienst
 * hapert.
 */
async function zetInResend(email: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/contacts", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normaliseerEmail(email),
        unsubscribed: false,
        segment_ids: [SEGMENT_ID],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      // Luid loggen mét de reden: het contract van Resend kan wijzigen, en
      // dan willen we dat in de logs zien in plaats van een lijst die stil
      // leeg blijft.
      console.error(
        `[nieuwsbrief] Resend weigerde ${normaliseerEmail(email)} (${res.status}): ${(
          await res.text()
        ).slice(0, 200)}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("[nieuwsbrief] Resend onbereikbaar:", error);
    return false;
  }
}

async function zetUitResend(email: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch(`https://api.resend.com/contacts/${encodeURIComponent(normaliseerEmail(email))}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribed: true }),
      signal: AbortSignal.timeout(6000),
    });
  } catch (error) {
    // Afmelden moet bij ons altijd lukken; Resend mag daarna nog volgen.
    console.error("[nieuwsbrief] afmelden bij Resend mislukt:", error);
  }
}
