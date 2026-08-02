import { verstuurMail } from "@/lib/mail";
import { euros } from "@/lib/format";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import type { Order } from "@/lib/types";

/**
 * "Je bestelling is geannuleerd", met wat er met het geld gebeurt.
 *
 * Annuleren gebeurt in het dashboard; dat meldt zich bij onze webhook en die
 * roept deze mail aan. Belangrijk detail in de formulering: op het moment van
 * deze mail is de terugbetaling bij Mollie nog niet uitgevoerd — het dashboard
 * licht ons eerst in en betaalt daarna pas terug, omdat de terugbetaling de
 * enige onomkeerbare stap is. Dus "wordt teruggestort", nooit "staat weer op
 * je rekening".
 */
export async function stuurAnnuleermail(
  order: Order,
  opties: {
    /** Bedrag (euro's) dat het dashboard bij Mollie terugzet. */
    terugbetaald?: number;
    /** De in deze bestelling ingewisselde voucher is weer bruikbaar gemaakt. */
    voucherHersteld?: boolean;
    /** De met deze bestelling verdiende tegoedbon is ingetrokken. */
    staalIngetrokken?: boolean;
  },
): Promise<boolean> {
  const naam = order.customer.firstName || "";
  const bedrag =
    typeof opties.terugbetaald === "number" && opties.terugbetaald > 0
      ? euros(opties.terugbetaald)
      : null;

  const artikelen = order.items
    .map(
      (item) =>
        `- ${item.quantity}× ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ""}`,
    )
    .join("\n");

  const geldRegel = bedrag
    ? `Het bedrag van ${bedrag} wordt teruggestort via de betaalmethode waarmee je afrekende. Afhankelijk van je bank staat het er meestal binnen een paar werkdagen weer op.`
    : "Er stond geen betaling open voor deze bestelling, dus er hoeft niets te worden teruggestort.";

  const voucherRegels: string[] = [];
  if (opties.voucherHersteld && order.voucherCode) {
    voucherRegels.push(
      `Je voucher ${order.voucherCode} is weer bruikbaar — de korting uit deze bestelling is immers niet doorgegaan.`,
    );
  }
  if (opties.staalIngetrokken && order.staalVoucher?.code) {
    voucherRegels.push(
      `De tegoedbon ${order.staalVoucher.code} uit deze bestelling vervalt: het testerbedrag krijg je nu gewoon terug.`,
    );
  }

  const tekst = [
    naam ? `Hoi ${naam},` : "Hoi,",
    "",
    `Je bestelling ${order.reference} is geannuleerd.`,
    "",
    artikelen,
    "",
    geldRegel,
    ...voucherRegels.flatMap((regel) => ["", regel]),
    "",
    `Was dit niet de bedoeling, of wil je iets anders bestellen? Mail ${CONTACT_EMAIL}, dan regelen we het.`,
    "",
    `Groet, ${SITE_NAME}`,
  ]
    .filter((regel, index, alle) => !(regel === "" && alle[index - 1] === ""))
    .join("\n");

  const html = [
    `<p>${naam ? `Hoi ${naam},` : "Hoi,"}</p>`,
    `<p>Je bestelling <strong>${order.reference}</strong> is geannuleerd.</p>`,
    "<ul>",
    ...order.items.map(
      (item) =>
        `<li>${item.quantity}× ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ""}</li>`,
    ),
    "</ul>",
    `<p>${geldRegel}</p>`,
    ...voucherRegels.map((regel) => `<p>${regel}</p>`),
    `<p>Was dit niet de bedoeling, of wil je iets anders bestellen? Mail <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>, dan regelen we het.</p>`,
    `<p>Groet,<br>${SITE_NAME}</p>`,
  ].join("");

  const resultaat = await verstuurMail({
    aan: order.customer.email,
    onderwerp: `Je bestelling ${order.reference} is geannuleerd`,
    tekst,
    html,
  });

  if (!resultaat.ok) {
    console.error(`[order] annuleringsmail voor ${order.reference} mislukt: ${resultaat.reden}`);
  }
  return resultaat.ok;
}
