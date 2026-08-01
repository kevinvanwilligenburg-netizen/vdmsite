import { euro } from "@/lib/format";
import { verstuurMail } from "@/lib/mail";
import { absoluteUrl, CONTACT_EMAIL, CONTACT_PHONE, SITE_NAME } from "@/lib/site";
import type { Order } from "@/lib/types";
import { VOUCHER_GELDIG_MAANDEN, type Voucher } from "@/lib/vouchers";

/**
 * De vouchermails. Twee stuks, allebei via het gewone mailkanaal (lib/mail.ts):
 *
 *  1. Bij de betaalde testerbestelling: hier is je code, dit is hij waard.
 *  2. Eén herinnering als de voucher na twee weken nog onbenut is
 *     (zie /api/vouchers/herinnering, draait op een cron).
 *
 * De code staat óók op de besteldpagina, dus een haperend mailkanaal maakt de
 * voucher niet onvindbaar — maar de mail is het exemplaar dat de klant over
 * drie weken nog terugvindt.
 */

function geldigTotTekst(voucher: Voucher): string {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "long" }).format(
    new Date(voucher.geldigTot),
  );
}

export async function stuurVoucherMail(order: Order, voucher: Voucher): Promise<boolean> {
  const naam = order.customer.firstName || "";
  const kleurenUrl = absoluteUrl("/kleurkiezer");
  const bedrag = euro(voucher.bedrag);

  const tekst = [
    naam ? `Hoi ${naam},` : "Hoi,",
    "",
    `Je kleurtesters zijn onderweg — en dit is je voucher ter waarde van ${bedrag}:`,
    "",
    `    ${voucher.code}`,
    "",
    `Zo werkt het: test je kleur rustig uit. Koop je daarna de echte verf bij ons,`,
    `vul dan deze code in bij het afrekenen. Het testerbedrag van ${bedrag} gaat er`,
    "direct af. Zo kost proberen je niets.",
    "",
    `De voucher is ${VOUCHER_GELDIG_MAANDEN} maanden geldig (tot ${geldigTotTekst(voucher)}) en geldt bij een bestelling met mengverf.`,
    "",
    `Kleur gekozen? Bestel je verf: ${kleurenUrl}`,
    "",
    `Vragen? Mail ${CONTACT_EMAIL} of bel ${CONTACT_PHONE}.`,
    "",
    `Groet, ${SITE_NAME}`,
  ].join("\n");

  const html = [
    `<p>${naam ? `Hoi ${naam},` : "Hoi,"}</p>`,
    `<p>Je kleurtesters zijn onderweg — en dit is je voucher ter waarde van <strong>${bedrag}</strong>:</p>`,
    `<p style="font-size:24px;font-weight:bold;letter-spacing:2px;background:#FFF3E6;padding:14px 18px;border-radius:10px;display:inline-block">${voucher.code}</p>`,
    `<p>Zo werkt het: test je kleur rustig uit. Koop je daarna de echte verf bij ons, vul dan deze code in bij het afrekenen — het testerbedrag van ${bedrag} gaat er direct af. Zo kost proberen je niets.</p>`,
    `<p>De voucher is ${VOUCHER_GELDIG_MAANDEN} maanden geldig (tot ${geldigTotTekst(voucher)}) en geldt bij een bestelling met mengverf.</p>`,
    `<p><a href="${kleurenUrl}">Kleur gekozen? Bestel je verf</a></p>`,
    `<p>Vragen? Mail <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> of bel ${CONTACT_PHONE}.</p>`,
    `<p>Groet,<br>${SITE_NAME}</p>`,
  ].join("");

  const resultaat = await verstuurMail({
    aan: order.customer.email,
    onderwerp: `Je kleurvoucher van ${bedrag} — ${voucher.code}`,
    tekst,
    html,
  });
  if (!resultaat.ok) {
    console.error(`[voucher] mail voor ${voucher.code} niet verstuurd: ${resultaat.reden}`);
  }
  return resultaat.ok;
}

export async function stuurVoucherHerinnering(voucher: Voucher): Promise<boolean> {
  const bedrag = euro(voucher.bedrag);
  const kleurenUrl = absoluteUrl("/kleurkiezer");

  const tekst = [
    "Hoi,",
    "",
    `Je hebt nog ${bedrag} tegoed bij ${SITE_NAME}.`,
    "",
    `Bij je kleurtesters (bestelling ${voucher.orderRef}) hoorde deze voucher:`,
    "",
    `    ${voucher.code}`,
    "",
    "Kleur gevonden die bevalt? Vul de code in bij het afrekenen en het",
    `testerbedrag gaat van je verf af. De voucher is geldig tot ${geldigTotTekst(voucher)}.`,
    "",
    `Verf bestellen: ${kleurenUrl}`,
    "",
    `Groet, ${SITE_NAME}`,
    "",
    "Je krijgt dit bericht één keer, omdat je voucher nog niet gebruikt is.",
  ].join("\n");

  const html = [
    "<p>Hoi,</p>",
    `<p>Je hebt nog <strong>${bedrag}</strong> tegoed bij ${SITE_NAME}.</p>`,
    `<p>Bij je kleurtesters (bestelling ${voucher.orderRef}) hoorde deze voucher:</p>`,
    `<p style="font-size:24px;font-weight:bold;letter-spacing:2px;background:#FFF3E6;padding:14px 18px;border-radius:10px;display:inline-block">${voucher.code}</p>`,
    `<p>Kleur gevonden die bevalt? Vul de code in bij het afrekenen en het testerbedrag gaat van je verf af. De voucher is geldig tot ${geldigTotTekst(voucher)}.</p>`,
    `<p><a href="${kleurenUrl}">Verf bestellen</a></p>`,
    `<p>Groet,<br>${SITE_NAME}</p>`,
    '<p style="color:#666;font-size:12px">Je krijgt dit bericht één keer, omdat je voucher nog niet gebruikt is.</p>',
  ].join("");

  const resultaat = await verstuurMail({
    aan: voucher.email,
    onderwerp: `Je hebt nog ${bedrag} kleurtegoed — ${voucher.code}`,
    tekst,
    html,
  });
  if (!resultaat.ok) {
    console.error(`[voucher] herinnering voor ${voucher.code} niet verstuurd: ${resultaat.reden}`);
  }
  return resultaat.ok;
}
