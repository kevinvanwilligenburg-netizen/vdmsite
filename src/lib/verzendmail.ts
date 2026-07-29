import { verstuurMail } from "@/lib/mail";
import { absoluteUrl, CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import type { Order } from "@/lib/types";

/**
 * "Je pakket is onderweg", met de track & trace-code.
 *
 * Het moment waarop een label wordt aangemaakt kennen wij niet — dat gebeurt
 * in het dashboard, bij de fulfilment. Die stuurt ons een seintje; deze
 * functie maakt daar de mail van.
 */

/**
 * Volglink bij de vervoerder.
 *
 * Het dashboard stuurt soms een kale barcode en soms een complete URL; die
 * eerste vorm maken we hier zelf klikbaar. Beide vervoerders willen de
 * postcode erbij om de zending te tonen — zonder die postcode komt de klant
 * op een zoekscherm uit in plaats van bij zijn pakket.
 */
export function volgUrl(
  carrier: string | undefined,
  code: string,
  postcode?: string,
): string | null {
  if (/^https?:\/\//i.test(code)) return code;
  const pc = (postcode ?? "").replace(/\s/g, "").toUpperCase();
  if (carrier === "dhl") {
    return `https://my.dhlecommerce.nl/home/tracktrace/${encodeURIComponent(code)}${
      pc ? `/${encodeURIComponent(pc)}` : ""
    }`;
  }
  if (carrier === "postnl") {
    return `https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(code)}-NL${
      pc ? `-${encodeURIComponent(pc)}` : ""
    }`;
  }
  return null;
}

export async function stuurVerzendmail(order: Order): Promise<boolean> {
  const code = order.shipment?.trackTrace ?? "";
  const carrier = order.delivery?.carrier;
  const link = code ? volgUrl(carrier, code, order.customer.postalCode) : null;
  const vervoerder = carrier === "postnl" ? "PostNL" : carrier === "dhl" ? "DHL" : "de vervoerder";
  const naam = order.customer.firstName || "";
  const orderUrl = absoluteUrl(`/bestelling/${order.reference}`);

  const artikelen = order.items
    .map((item) => `- ${item.quantity}× ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ""}`)
    .join("\n");

  const tekst = [
    naam ? `Hoi ${naam},` : "Hoi,",
    "",
    `Je bestelling ${order.reference} is onderweg. ${vervoerder} heeft het pakket opgehaald.`,
    "",
    artikelen,
    "",
    code ? `Track & trace: ${code}` : "",
    link ? `Volg je pakket: ${link}` : "",
    "",
    `Je bestelling bekijken: ${orderUrl}`,
    "",
    `Iets niet in orde? Mail ${CONTACT_EMAIL}, dan zoeken we het uit.`,
    "",
    `Groet, ${SITE_NAME}`,
  ]
    .filter((regel, index, alle) => !(regel === "" && alle[index - 1] === ""))
    .join("\n");

  const html = [
    `<p>${naam ? `Hoi ${naam},` : "Hoi,"}</p>`,
    `<p>Je bestelling <strong>${order.reference}</strong> is onderweg. ${vervoerder} heeft het pakket opgehaald.</p>`,
    "<ul>",
    ...order.items.map(
      (item) =>
        `<li>${item.quantity}× ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ""}</li>`,
    ),
    "</ul>",
    link
      ? `<p><a href="${link}">Volg je pakket bij ${vervoerder}</a><br><span style="color:#666">Track &amp; trace: ${code}</span></p>`
      : code
        ? `<p>Track &amp; trace: <strong>${code}</strong></p>`
        : "",
    `<p><a href="${orderUrl}">Bekijk je bestelling</a></p>`,
    `<p>Iets niet in orde? Mail <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>, dan zoeken we het uit.</p>`,
    `<p>Groet,<br>${SITE_NAME}</p>`,
  ].join("");

  const resultaat = await verstuurMail({
    aan: order.customer.email,
    onderwerp: `Je bestelling ${order.reference} is onderweg`,
    tekst,
    html,
  });

  if (!resultaat.ok) {
    console.error(`[order] verzendmail voor ${order.reference} mislukt: ${resultaat.reden}`);
  }
  return resultaat.ok;
}
