import { euros } from "@/lib/format";
import { verstuurMail } from "@/lib/mail";
import { absoluteUrl, CONTACT_EMAIL, CONTACT_PHONE, SITE_NAME } from "@/lib/site";
import type { Order } from "@/lib/types";

/**
 * Orderbevestiging per mail, zodra de betaling binnen is.
 *
 * Het dashboard stuurt zelf geen ordermails (nagevraagd op 29 juli 2026), dus
 * dit is de enige bevestiging die de klant krijgt. Komt daar ooit een tweede
 * bij, dan hoort er één weg — twee bevestigingen voor dezelfde bestelling
 * lezen als een dubbele afschrijving.
 *
 * De inhoud is bewust compleet: wat is er besteld, in welke kleur, wat is
 * betaald, en waar het naartoe gaat. Dat scheelt telefoontjes naar de winkel,
 * en bij mengverf is de kleurcode het enige waarmee later precies dezelfde
 * kleur is bij te bestellen.
 */

function regel(order: Order): string[] {
  return order.items.map((item) => {
    const extra = [
      item.variantLabel,
      item.color ? [item.color.code, item.color.name].filter(Boolean).join(" ") : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${item.quantity}× ${item.title}${extra ? ` (${extra})` : ""} — ${euros(
      item.price * item.quantity,
    )}`;
  });
}

function levering(order: Order): string {
  if (order.fulfilment === "pickup" && order.store) {
    return [
      `Je haalt de bestelling op bij ${order.store.name} in ${order.store.city}.`,
      order.pickupCode ? `Je afhaalcode is ${order.pickupCode}.` : "",
      "Je krijgt bericht zodra alles voor je klaarstaat. Betalen hoeft niet meer.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const adres = [
    [order.customer.street, order.customer.houseNumber, order.customer.houseNumberSuffix]
      .filter(Boolean)
      .join(" "),
    [order.customer.postalCode, order.customer.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const wanneer =
    order.delivery?.type === "same-day"
      ? "Je bestelling wordt vandaag nog bezorgd."
      : order.delivery?.type === "next-day"
        ? "Je bestelling wordt morgen bezorgd."
        : "Je bestelling is binnen één werkdag bij je.";
  return `${wanneer} Bezorgadres: ${adres}. Zodra het pakket onderweg is krijg je de track & trace-code.`;
}

export async function stuurOrderbevestiging(order: Order): Promise<boolean> {
  const orderUrl = absoluteUrl(`/bestelling/${order.reference}`);
  const factuurUrl = absoluteUrl(`/bestelling/${order.reference}/factuur`);
  const naam = order.customer.firstName || "";

  const tekst = [
    naam ? `Hoi ${naam},` : "Hoi,",
    "",
    `Bedankt voor je bestelling bij ${SITE_NAME}. Je betaling is binnen.`,
    "",
    `Bestelnummer: ${order.reference}`,
    "",
    "Wat je hebt besteld:",
    ...regel(order).map((r) => `- ${r}`),
    "",
    `${order.fulfilment === "delivery" ? "Bezorging" : "Afhalen"}: ${
      order.shipping > 0 ? euros(order.shipping) : "gratis"
    }`,
    ...(order.voucherKorting
      ? [`Staal-voucher${order.voucherCode ? ` ${order.voucherCode}` : ""}: − ${euros(order.voucherKorting)}`]
      : []),
    `Totaal betaald: ${euros(order.total)} (incl. btw)`,
    "",
    levering(order),
    "",
    `Je bestelling volgen: ${orderUrl}`,
    `Je factuur: ${factuurUrl}`,
    "",
    `Vragen? Mail ${CONTACT_EMAIL} of bel ${CONTACT_PHONE}.`,
    "",
    `Groet, ${SITE_NAME}`,
  ].join("\n");

  const html = [
    `<p>${naam ? `Hoi ${naam},` : "Hoi,"}</p>`,
    `<p>Bedankt voor je bestelling bij ${SITE_NAME}. Je betaling is binnen.</p>`,
    `<p><strong>Bestelnummer ${order.reference}</strong></p>`,
    "<ul>",
    ...regel(order).map((r) => `<li>${r}</li>`),
    "</ul>",
    `<p>${order.fulfilment === "delivery" ? "Bezorging" : "Afhalen"}: ${
      order.shipping > 0 ? euros(order.shipping) : "gratis"
    }${
      order.voucherKorting
        ? `<br>Staal-voucher${order.voucherCode ? ` ${order.voucherCode}` : ""}: − ${euros(order.voucherKorting)}`
        : ""
    }<br><strong>Totaal betaald: ${euros(order.total)}</strong> (incl. btw)</p>`,
    `<p>${levering(order)}</p>`,
    `<p><a href="${orderUrl}">Volg je bestelling</a> · <a href="${factuurUrl}">Bekijk je factuur</a></p>`,
    `<p>Vragen? Mail <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> of bel ${CONTACT_PHONE}.</p>`,
    `<p>Groet,<br>${SITE_NAME}</p>`,
  ].join("");

  // Trustpilot leest de bevestiging mee via BCC en nodigt de klant uit voor
  // een review. Alleen op deze mail: een inlogcode of verzendmail met een
  // meelezer erop zou raar zijn. Zonder variabele gebeurt er niets.
  const reviewBcc = (process.env.TRUSTPILOT_BCC ?? "").trim();

  const resultaat = await verstuurMail({
    aan: order.customer.email,
    onderwerp: `Bestelling ${order.reference} — bedankt!`,
    tekst,
    html,
    ...(reviewBcc ? { bcc: reviewBcc } : {}),
  });

  if (!resultaat.ok) {
    console.error(
      `[order] bevestiging voor ${order.reference} niet verstuurd: ${resultaat.reden}`,
    );
  }
  return resultaat.ok;
}
