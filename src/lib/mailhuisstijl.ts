import {
  absoluteUrl,
  BEDRIJF,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  SITE_NAME,
  SITE_TAGLINE,
  WHATSAPP_NUMMER,
  WHATSAPP_TIJDEN,
  WHATSAPP_WEERGAVE,
} from "@/lib/site";
import { getStores } from "@/lib/tilroy";
import type { Store } from "@/lib/types";

/**
 * Eén huisstijl voor alle mail.
 *
 * De mails waren kale alinea's: geen logo, geen afzender die je herkent, geen
 * adres. Kevin: "zorg ervoor dat elke mail onze winkels bevat, adres in de
 * footer en klantenservicegegevens." Dat is niet alleen netter, het is ook
 * waar spamfilters naar kijken — een commerciële mail zonder afzenderadres
 * scoort slechter, en een klant die niet ziet van wie het komt, opent hem niet.
 *
 * Waarom tabellen en inline stijlen, en geen nette CSS: Outlook rendert met de
 * Word-engine. Flexbox, grid en een <style>-blok in de <head> overleven dat
 * niet. Dit is de saaie opmaak die overal aankomt.
 *
 * De vijf winkels staan er met adres en telefoonnummer in. Dat is voor deze
 * zaak geen bijzaak: het meeste wordt afgehaald, en de klant die zich afvraagt
 * "waar moet ik zijn" hoeft dan niet terug naar de site.
 */

/**
 * De huisstijlkleuren, ook los bruikbaar. Mails zetten hun eigen blokken in
 * elkaar (een orderbevestiging is geen inlogcode), en dan moet het oranje
 * overal hetzelfde oranje zijn.
 */
export const MAIL_KLEUREN = {
  oranje: "#F5821F",
  /** Zachte oranje ondergrond voor koppen en accentblokken. */
  oranjeLicht: "#FFF3E6",
  inkt: "#141414",
  zacht: "#5B6167",
  lijn: "#E4E7EA",
  vlak: "#F7F8FA",
} as const;

const ORANJE = MAIL_KLEUREN.oranje;
const INKT = MAIL_KLEUREN.inkt;
const ZACHT = MAIL_KLEUREN.zacht;
const LIJN = MAIL_KLEUREN.lijn;

/** Tekst veilig in HTML zetten. Namen en plaatsnamen kunnen alles bevatten. */
export function esc(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DAG_KORT: Record<string, string> = {
  maandag: "ma",
  dinsdag: "di",
  woensdag: "wo",
  donderdag: "do",
  vrijdag: "vr",
  zaterdag: "za",
  zondag: "zo",
};

/**
 * Zeven regels openingstijden samengevat tot drie.
 *
 * "Maandag 08:00 – 18:00 / Dinsdag 08:00 – 18:00 / …" is zeven keer hetzelfde
 * en leest niemand. Dit maakt er "ma t/m vr 08:00 – 18:00 · za 08:00 – 17:00 ·
 * zo gesloten" van, door dagen met gelijke tijden samen te nemen.
 */
export function openingstijdenKort(store: Store): string[] {
  const reeksen: { van: string; tot: string; uren: string }[] = [];
  for (const dag of store.openingHours) {
    const kort = DAG_KORT[dag.day.toLocaleLowerCase("nl")] ?? dag.day.slice(0, 2).toLowerCase();
    const laatste = reeksen[reeksen.length - 1];
    if (laatste && laatste.uren === dag.hours) laatste.tot = kort;
    else reeksen.push({ van: kort, tot: kort, uren: dag.hours });
  }
  return reeksen.map(
    ({ van, tot, uren }) =>
      `${van === tot ? van : `${van} t/m ${tot}`} ${uren.toLocaleLowerCase("nl") === "gesloten" ? "gesloten" : uren}`,
  );
}

/**
 * Eén winkel, overal op dezelfde manier.
 *
 * Kevin: "in beide de winkels op dezelfde manier tonen." Stond de afhaalwinkel
 * eerst met alleen zijn naam in de mail terwijl de voet van diezelfde mail
 * vijf keer een compleet adres liet zien, nu komt allebei uit deze functie.
 */
export function winkelRegels(
  store: Store,
  opties: { tijden?: boolean; email?: boolean } = {},
): string {
  const tijden = opties.tijden
    ? `<br><span style="color:${ZACHT};">${openingstijdenKort(store)
        .map((regel) => esc(regel))
        .join("<br>")}</span>`
    : "";
  const email =
    opties.email && store.email
      ? `<br><a href="mailto:${esc(store.email)}" style="color:${ORANJE};">${esc(store.email)}</a>`
      : "";
  return `<strong style="color:${INKT};">${esc(store.city)}</strong><br>
    ${esc(store.address)}<br>
    ${esc(store.postalCode)} ${esc(store.city)}<br>
    ${esc(store.phone)}${email}${tijden}`;
}

async function winkelblok(): Promise<string> {
  let winkels;
  try {
    winkels = await getStores();
  } catch {
    // Liever een mail zonder winkellijst dan geen mail.
    return "";
  }
  if (winkels.length === 0) return "";

  const cellen = winkels
    .map(
      (winkel) => `
        <td style="padding:0 12px 12px 0;vertical-align:top;font-size:12px;line-height:1.5;color:${ZACHT};">
          ${winkelRegels(winkel)}
        </td>`,
    )
    .join("");

  return `
    <tr>
      <td style="padding:20px 24px 4px 24px;border-top:1px solid ${LIJN};">
        <p style="margin:0 0 10px 0;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:${INKT};">
          Onze winkels
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>${cellen}</tr>
        </table>
      </td>
    </tr>`;
}

function klantenservice(): string {
  const whatsapp = WHATSAPP_NUMMER
    ? `<br>WhatsApp: <a href="https://wa.me/${WHATSAPP_NUMMER}" style="color:${ORANJE};">${esc(
        WHATSAPP_WEERGAVE(WHATSAPP_NUMMER),
      )}</a> (${esc(WHATSAPP_TIJDEN)})`
    : "";
  return `
    <tr>
      <td style="padding:16px 24px;border-top:1px solid ${LIJN};font-size:12px;line-height:1.6;color:${ZACHT};">
        <p style="margin:0 0 6px 0;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:${INKT};">
          Klantenservice
        </p>
        Mail: <a href="mailto:${CONTACT_EMAIL}" style="color:${ORANJE};">${CONTACT_EMAIL}</a><br>
        Telefoon: ${esc(CONTACT_PHONE)}${whatsapp}
      </td>
    </tr>`;
}

function bedrijfsregel(): string {
  return `
    <tr>
      <td style="padding:14px 24px 22px 24px;border-top:1px solid ${LIJN};font-size:11px;line-height:1.6;color:${ZACHT};">
        ${esc(BEDRIJF.naam)} · ${esc(BEDRIJF.adres)} · ${esc(BEDRIJF.postcode)} ${esc(
          BEDRIJF.plaats,
        )}<br>
        KvK ${esc(BEDRIJF.kvk)} · btw ${esc(BEDRIJF.btw)} ·
        <a href="${absoluteUrl("/")}" style="color:${ORANJE};">devoordeelmarkt.nl</a>
      </td>
    </tr>`;
}

/**
 * Waar het logo in de mail vandaan komt.
 *
 * Van ons eigen domein, sinds de omzetting op 3 augustus 2026. Daarvóór stond
 * hier het vercel.app-adres, omdat devoordeelmarkt.nl toen nog de oude site
 * serveerde en het plaatje dus een 404 gaf.
 *
 * Dat het nu van het eigen domein komt is niet alleen netter: de
 * deliverability-controle van Resend waarschuwt ervoor. Een afbeelding van een
 * ander domein dan de afzender oogt voor Gmail verdacht, en bij mail wil je
 * geen enkele reden geven om je in de spammap te zetten.
 *
 * Mailclients kennen geen SVG en geen next/image, dus een gewone PNG. Wie het
 * wil verzetten, zet `MAIL_LOGO_URL`.
 */
function mailLogoUrl(): string {
  const eigen = process.env.MAIL_LOGO_URL?.trim();
  if (eigen) return eigen;
  return absoluteUrl("/logo/logo-vdm.png");
}

/**
 * Een knop die ook in Outlook een knop blijft.
 *
 * Een `<a>` met padding en een achtergrond wordt door de Word-engine als
 * gewone link getekend: geen vlak, geen vorm, alleen blauwe onderstreepte
 * tekst. Een tabelcel met een achtergrondkleur overleeft dat wél, dus staat
 * de knop hier als tabel van één cel.
 */
export function mailKnop({
  href,
  label,
  soort = "vol",
}: {
  href: string;
  label: string;
  soort?: "vol" | "leeg";
}): string {
  const vol = soort === "vol";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:0 8px 8px 0;">
    <tr>
      <td align="center" style="border-radius:8px;background:${vol ? ORANJE : "#FFFFFF"};border:1px solid ${
        vol ? ORANJE : LIJN
      };">
        <a href="${href}" style="display:inline-block;padding:11px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;line-height:1;color:${
          vol ? "#FFFFFF" : INKT
        };text-decoration:none;">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

/**
 * Zet een stuk mail-HTML in de huisstijl.
 *
 * `inhoud` is de kern van het bericht; kop en voet komen hiervandaan. Geef
 * `voorbeeldtekst` mee: dat is het regeltje dat de inbox naast het onderwerp
 * toont, en zonder die regel pakt de mailclient de eerste woorden uit de
 * kop — bij ons dus altijd "De Voordeelmarkt".
 */
export async function mailInHuisstijl({
  inhoud,
  voorbeeldtekst,
}: {
  inhoud: string;
  voorbeeldtekst?: string;
}): Promise<string> {
  const winkels = await winkelblok();
  const logo = mailLogoUrl();

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(SITE_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F8;">
${
  voorbeeldtekst
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
        voorbeeldtekst,
      )}</div>`
    : ""
}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F6F8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <!-- Oranje streep bovenlangs: geeft de mail meteen een gezicht, ook
             als de mailclient afbeeldingen blokkeert. -->
        <tr>
          <td style="height:5px;line-height:5px;font-size:0;background:${ORANJE};">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:20px 24px 16px 24px;border-bottom:1px solid ${LIJN};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logo}" alt="${esc(SITE_NAME)}" width="132"
                       style="display:block;border:0;width:132px;max-width:132px;height:auto;">
                </td>
                <td align="right" style="vertical-align:middle;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:${ORANJE};line-height:1.4;">
                  ${esc(SITE_TAGLINE)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;font-size:15px;line-height:1.6;color:${INKT};">
            ${inhoud}
          </td>
        </tr>
        ${winkels}
        ${klantenservice()}
        ${bedrijfsregel()}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
