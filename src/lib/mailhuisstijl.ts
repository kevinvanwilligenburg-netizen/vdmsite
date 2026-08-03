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

const ORANJE = "#F5821F";
const INKT = "#141414";
const ZACHT = "#5B6167";
const LIJN = "#E4E7EA";

/** Tekst veilig in HTML zetten. Namen en plaatsnamen kunnen alles bevatten. */
function esc(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
          <strong style="color:${INKT};">${esc(winkel.city)}</strong><br>
          ${esc(winkel.address)}<br>
          ${esc(winkel.postalCode)} ${esc(winkel.city)}<br>
          ${esc(winkel.phone)}
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
  // Het logo als gewone afbeelding: mailclients kennen geen SVG en geen
  // next/image. Blokkeert de client afbeeldingen, dan valt hij terug op de
  // alt-tekst, en die leest gewoon als onze naam.
  const logo = absoluteUrl("/logo/logo-vdm.png");

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
        <tr>
          <td style="padding:22px 24px 14px 24px;">
            <img src="${logo}" alt="${esc(SITE_NAME)}" width="150" height="82"
                 style="display:block;border:0;width:150px;height:auto;">
            <p style="margin:10px 0 0 0;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:${ORANJE};">
              ${esc(SITE_TAGLINE)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 24px 20px 24px;font-size:15px;line-height:1.6;color:${INKT};">
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
