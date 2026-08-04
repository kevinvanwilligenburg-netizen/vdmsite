import { verstuurMail } from "@/lib/mail";
import { esc, MAIL_KLEUREN, mailKnop, openingstijdenKort, winkelRegels } from "@/lib/mailhuisstijl";
import { absoluteUrl, CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { getStore } from "@/lib/tilroy";
import type { Order, Store } from "@/lib/types";

/**
 * "Je bestelling ligt klaar", met de afhaalcode.
 *
 * Deze mail ontbrak, terwijl de site hem op acht plekken beloofde — inclusief
 * de algemene voorwaarden. Kevin vroeg bij de bevestigingsmail terecht "is dit
 * waar?", en het antwoord was nee: er was geen webhook, geen mail, en
 * `readyForPickupAt` werd nergens gezet. Wie afhaalt, wachtte dus op een
 * bericht dat nooit kwam, of reed te vroeg naar de winkel.
 *
 * Het moment zelf kennen wij niet — dat weet de winkel, via het dashboard.
 * Die roept /api/webhooks/klaar aan; deze functie maakt er de mail van, net
 * zoals stuurVerzendmail dat doet voor een verzendlabel.
 */

const { oranje, inkt, zacht, lijn, vlak } = MAIL_KLEUREN;

function artikelregels(order: Order): string {
  return order.items
    .map((item) => {
      const extra = [
        item.variantLabel,
        item.color ? [item.color.code, item.color.name].filter(Boolean).join(" ") : undefined,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
        <td style="padding:2px 0;font-size:14px;line-height:1.5;color:${inkt};">
          ${item.quantity}× ${esc(item.title)}${
            extra ? `<br><span style="color:${zacht};font-size:13px;">${esc(extra)}</span>` : ""
          }
        </td>
      </tr>`;
    })
    .join("");
}

export async function stuurAfhaalmail(order: Order): Promise<boolean> {
  if (order.fulfilment !== "pickup" || !order.store) {
    console.error(`[afhalen] ${order.reference} is geen afhaalbestelling; geen mail verstuurd.`);
    return false;
  }

  const winkel: Store | null = (await getStore(order.store.id).catch(() => undefined)) ?? null;
  const naam = order.customer.firstName || "";
  const orderUrl = absoluteUrl(`/bestelling/${order.reference}`);
  const plaats = order.store.city;

  const tekst = [
    naam ? `Hoi ${naam},` : "Hoi,",
    "",
    `Je bestelling ${order.reference} ligt klaar bij ${order.store.name}.`,
    "",
    ...(order.pickupCode ? [`Je afhaalcode: ${order.pickupCode}`, ""] : []),
    ...order.items.map(
      (item) => `- ${item.quantity}× ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ""}`,
    ),
    "",
    "Betalen hoeft niet meer; laat je afhaalcode zien aan de balie.",
    ...(winkel
      ? [
          "",
          `${winkel.address}, ${winkel.postalCode} ${winkel.city}`,
          `Telefoon: ${winkel.phone}`,
          `Open: ${openingstijdenKort(winkel).join(" · ")}`,
        ]
      : []),
    "",
    `Je bestelling bekijken: ${orderUrl}`,
    "",
    `Lukt het niet om langs te komen? Mail ${CONTACT_EMAIL}, dan zoeken we een oplossing.`,
    "",
    `Groet, ${SITE_NAME}`,
  ].join("\n");

  const html = `
    <p style="margin:0 0 4px 0;font-size:24px;line-height:1.25;font-weight:bold;color:${inkt};">
      ${naam ? `${esc(naam)}, je bestelling ligt klaar!` : "Je bestelling ligt klaar!"}
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${zacht};">
      Alles staat ingepakt voor je in ${esc(plaats)}. Betalen hoeft niet meer.
    </p>

    ${
      order.pickupCode
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${vlak};border-radius:10px;">
             <tr>
               <td align="center" style="padding:18px 16px;">
                 <span style="display:block;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${oranje};padding-bottom:8px;">Je afhaalcode</span>
                 <span style="display:inline-block;padding:10px 22px;background:#FFFFFF;border:2px dashed ${oranje};border-radius:8px;font-size:26px;font-weight:bold;letter-spacing:.1em;color:${inkt};">${esc(
                   order.pickupCode,
                 )}</span>
                 <span style="display:block;padding-top:8px;font-size:12px;color:${zacht};">Laat deze zien aan de balie</span>
               </td>
             </tr>
           </table>`
        : ""
    }

    ${
      winkel
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;border:1px solid ${lijn};border-radius:10px;">
             <tr>
               <td style="padding:14px 16px;font-size:13px;line-height:1.55;color:${zacht};">
                 <span style="display:block;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${oranje};padding-bottom:4px;">Waar en wanneer</span>
                 ${winkelRegels(winkel, { tijden: true, email: true })}
               </td>
             </tr>
           </table>`
        : ""
    }

    <p style="margin:22px 0 8px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${zacht};">
      Wat er voor je klaarstaat
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${artikelregels(order)}
    </table>

    <p style="margin:20px 0 0 0;">
      ${mailKnop({ href: orderUrl, label: "Bekijk je bestelling" })}
    </p>

    <p style="margin:18px 0 0 0;font-size:14px;line-height:1.6;color:${zacht};">
      Lukt het niet om langs te komen? Mail
      <a href="mailto:${CONTACT_EMAIL}" style="color:${oranje};font-weight:bold;">${CONTACT_EMAIL}</a>,
      dan zoeken we een oplossing.
    </p>
  `;

  const resultaat = await verstuurMail({
    aan: order.customer.email,
    onderwerp: `Je bestelling ${order.reference} ligt klaar in ${plaats}`,
    tekst,
    html,
  });

  if (!resultaat.ok) {
    console.error(`[afhalen] mail voor ${order.reference} mislukt: ${resultaat.reden}`);
  }
  return resultaat.ok;
}
