import { haalKluspunten } from "@/lib/account";
import { feestdagWinkelUren } from "@/lib/feestdagen";
import { euros } from "@/lib/format";
import {
  KLUSPUNTEN_ONLINE,
  KORTING_BIJ_DREMPEL,
  PUNTEN_VOOR_KORTING,
  puntenVoor,
} from "@/lib/kluspunten";
import { klusUitBestelling, type Klusblok } from "@/lib/klustips";
import { verstuurMail } from "@/lib/mail";
import {
  esc,
  MAIL_KLEUREN,
  mailKnop,
  openingstijdenKort,
  winkelRegels,
} from "@/lib/mailhuisstijl";
import {
  absoluteUrl,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  SITE_NAME,
  WHATSAPP_NUMMER,
  WHATSAPP_TIJDEN,
  WHATSAPP_WEERGAVE,
} from "@/lib/site";
import { pickupPromise } from "@/lib/pickup";
import { getStore } from "@/lib/tilroy";
import type { Order, OrderItem, Store } from "@/lib/types";

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
 *
 * Sinds 4 augustus 2026 ook om naar te kíjken: productfoto's, het kleurvlak
 * dat de klant heeft uitgezocht, en tips voor de klus die hij gaat doen.
 * Kevin: "moet veel beter visueel, foto van de producten en misschien ook de
 * kleur die ze gekozen hebben." Een bevestigingsmail wordt vaker geopend dan
 * welke nieuwsbrief ook; dat is de plek om iets terug te geven.
 */

/*
 * HIER STOND EEN REGEL OVER KLUSPUNTEN, EN DIE WAS ONWAAR.
 *
 * "Je kluspunten voor deze bestelling worden automatisch bijgeschreven" —
 * dat gebeurt niet. Het dashboard mat 54 webshopbonnen over drie maanden,
 * € 5.428 omzet, nul punten. Aan elke bon hing een klant en de
 * vermenigvuldigingsfactor stond gewoon op 1; het ligt aan de vestiging.
 * Webshoporders lopen op shop 8934 / kassa 15295 en daar raakt Tilroy het
 * puntensysteem niet aan. Zelfs het beginsaldo op de bon blijft nul.
 *
 * Dat is een schakelaar in de Tilroy-backoffice, niet iets wat wij vanuit de
 * Order API kunnen meesturen. Zolang die uit staat zeggen we hier niets over
 * punten: een belofte in een bevestigingsmail die de kassa niet waarmaakt,
 * levert een klant op die zich terecht bekocht voelt.
 *
 * Gaat de schakelaar aan, zet dan de regel terug (zonder aantal punten erbij:
 * het tarief loopt in de praktijk van 0,433 tot 1,334 punt per euro).
 */

const { oranje, oranjeLicht, inkt, zacht, lijn, vlak } = MAIL_KLEUREN;

function kleurLabel(item: OrderItem): string | undefined {
  if (!item.color) return undefined;
  return [item.color.code, item.color.name].filter(Boolean).join(" ") || undefined;
}

function regel(order: Order): string[] {
  return order.items.map((item) => {
    const extra = [item.variantLabel, kleurLabel(item)].filter(Boolean).join(" · ");
    return `${item.quantity}× ${item.title}${extra ? ` (${extra})` : ""}, ${euros(
      item.price * item.quantity,
    )}`;
  });
}

function levering(order: Order, winkel: Store | null): string {
  if (order.fulfilment === "pickup" && order.store) {
    const gegevens = winkel
      ? [
          `${winkel.address}, ${winkel.postalCode} ${winkel.city}`,
          `Telefoon: ${winkel.phone}`,
          ...(winkel.email ? [`Mail: ${winkel.email}`] : []),
          `Open: ${openingstijdenKort(winkel).join(" · ")}`,
        ].join("\n")
      : "";
    return [
      `Je haalt de bestelling op bij ${order.store.name} in ${order.store.city}.`,
      winkel ? `${pickupPromise(winkel, new Date(order.createdAt)).label}.` : "",
      order.pickupCode ? `Je afhaalcode is ${order.pickupCode}.` : "",
      "Neem die mee naar de balie; betalen hoeft niet meer.",
    ]
      .filter(Boolean)
      .join(" ")
      .concat(gegevens ? `\n${gegevens}` : "");
  }
  const adres = bezorgadres(order);
  const wanneer =
    order.delivery?.type === "same-day"
      ? "Je bestelling wordt vandaag nog bezorgd."
      : order.delivery?.type === "next-day"
        ? "Je bestelling wordt morgen bezorgd."
        : "Je bestelling is binnen één werkdag bij je.";
  return `${wanneer} Bezorgadres: ${adres}. Zodra het pakket onderweg is krijg je de track & trace-code.`;
}

function bezorgadres(order: Order): string {
  return [
    [order.customer.street, order.customer.houseNumber, order.customer.houseNumberSuffix]
      .filter(Boolean)
      .join(" "),
    [order.customer.postalCode, order.customer.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

/* ── HTML-onderdelen ──────────────────────────────────────────────── */

/**
 * Het plaatje naast een artikel.
 *
 * Eerst de echte productfoto. Is die er niet — bij een kleurtester bestaat
 * hij niet eens — dan tekenen we de gekozen kleur als vlak. Geen SVG: onze
 * eigen /api/kleurplaatje maakt er een, maar Gmail en Outlook tonen geen SVG
 * in een mail. Een tabelcel met een achtergrondkleur komt overal door.
 */
function artikelPlaatje(item: OrderItem): string {
  const rand = `border:1px solid ${lijn};border-radius:10px;`;
  if (item.image) {
    return `<img src="${esc(item.image)}" alt="${esc(item.title)}" width="64" height="64"
      style="display:block;width:64px;height:64px;object-fit:contain;background:#FFFFFF;${rand}">`;
  }
  const hex = item.color?.hex;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="64" style="width:64px;">
      <tr>
        <td height="64" style="height:64px;background:${hex ? esc(hex) : vlak};${rand}">&nbsp;</td>
      </tr>
    </table>`;
}

/** Het kleurvlakje met code en naam, zoals de klant hem heeft uitgezocht. */
function kleurRegel(item: OrderItem): string {
  const label = kleurLabel(item);
  if (!label) return "";
  const hex = item.color?.hex ?? "#FFFFFF";
  const herkomst = item.color?.collection ? ` <span style="color:${zacht};">uit ${esc(item.color.collection)}</span>` : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:5px;">
      <tr>
        <td width="16" style="width:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="16" style="width:16px;">
            <tr><td height="16" style="height:16px;background:${esc(hex)};border:1px solid rgba(0,0,0,.18);border-radius:4px;">&nbsp;</td></tr>
          </table>
        </td>
        <td style="padding-left:7px;font-size:13px;line-height:16px;color:${inkt};font-weight:bold;">
          ${esc(label)}${herkomst}
        </td>
      </tr>
    </table>`;
}

function artikelrijen(order: Order): string {
  return order.items
    .map((item, index) => {
      const variant = item.variantLabel
        ? // De kleur staat al in het variantlabel én los eronder; hier weglaten,
          // anders leest de klant zijn kleurcode twee keer in dezelfde regel.
          item.variantLabel
            .split(" · ")
            .filter((deel) => deel !== kleurLabel(item))
            .join(" · ")
        : "";
      return `<tr>
        <td width="76" style="width:76px;padding:${index === 0 ? "0" : "14px"} 12px 14px 0;vertical-align:top;">
          ${artikelPlaatje(item)}
        </td>
        <td style="padding:${index === 0 ? "0" : "14px"} 8px 14px 0;vertical-align:top;font-size:14px;line-height:1.45;color:${inkt};border-bottom:1px solid ${lijn};">
          <strong>${esc(item.title)}</strong>
          ${variant ? `<br><span style="color:${zacht};font-size:13px;">${esc(variant)}</span>` : ""}
          ${kleurRegel(item)}
          <br><span style="color:${zacht};font-size:13px;">${item.quantity} × ${euros(item.price)}</span>
        </td>
        <td align="right" style="padding:${index === 0 ? "0" : "14px"} 0 14px 0;vertical-align:top;font-size:14px;font-weight:bold;color:${inkt};border-bottom:1px solid ${lijn};white-space:nowrap;">
          ${euros(item.price * item.quantity)}
        </td>
      </tr>`;
    })
    .join("");
}

function totaalregel(
  label: string,
  bedrag: string,
  opties: { dik?: boolean; groen?: boolean; groot?: boolean } = {},
): string {
  const kleur = opties.groen ? "#1B7F3B" : opties.dik ? inkt : zacht;
  const grootte = opties.groot ? "17px" : "14px";
  return `<tr>
      <td style="padding:3px 0;font-size:${grootte};line-height:1.5;color:${kleur};${
        opties.dik ? "font-weight:bold;" : ""
      }">${label}</td>
      <td align="right" style="padding:3px 0;font-size:${grootte};line-height:1.5;color:${kleur};font-weight:bold;white-space:nowrap;">${bedrag}</td>
    </tr>`;
}

function totalen(order: Order): string {
  const kluspas = order.kluspasSavings ?? 0;
  const rijen = [
    // Met Kluspas rekenen we de korting al in de regelprijzen. Toch apart
    // tonen: wie niet ziet wat zijn pas oplevert, gaat hem niet gebruiken.
    // De adviesprijs erboven maakt het bedrag na te rekenen.
    kluspas > 0
      ? totaalregel("Artikelen (adviesprijs)", euros(order.subtotal + kluspas))
      : totaalregel("Artikelen", euros(order.subtotal)),
    kluspas > 0 ? totaalregel("Kluspas-korting", `− ${euros(kluspas)}`, { groen: true }) : "",
    /*
     * De actiekorting en de staal-voucher staan hier niet meer als eigen
     * totaalregel: ze zijn sinds de conceptorder-fix echte orderregels met een
     * negatief bedrag, en staan dus al in de artikellijst hierboven. Twee keer
     * tonen leest als twee keer korting.
     */
    totaalregel(
      order.fulfilment === "delivery" ? "Bezorging" : "Afhalen in de winkel",
      order.shipping > 0 ? euros(order.shipping) : "Gratis",
      order.shipping > 0 ? {} : { groen: true },
    ),
  ]
    .filter(Boolean)
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;">
      ${rijen}
      <tr><td colspan="2" style="padding-top:8px;border-top:2px solid ${inkt};font-size:0;line-height:0;">&nbsp;</td></tr>
      ${totaalregel("Totaal betaald", euros(order.total), { dik: true, groot: true })}
      <tr>
        <td colspan="2" style="padding-top:2px;font-size:12px;color:${zacht};">Inclusief btw</td>
      </tr>
    </table>`;
}

/**
 * Waarschuwing als er binnen een week een feestdag valt waarop de winkel
 * dicht is of korter open. De openingstijden hierboven zijn het weekschema;
 * wie op Hemelvaart voor een dichte deur staat omdat onze mail "ma t/m vr
 * 08:00 – 18:00" beloofde, belt terecht.
 */
function feestdagWaarschuwing(vanaf: Date): string | null {
  for (let dagen = 0; dagen < 8; dagen++) {
    const dag = new Date(vanaf);
    dag.setDate(dag.getDate() + dagen);
    const dagnaam = new Intl.DateTimeFormat("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dag);
    const uren = feestdagWinkelUren(dag);
    if (uren === "gesloten") return `Let op: ${dagnaam} zijn onze winkels gesloten.`;
    if (uren) {
      const klok = (minuten: number) =>
        `${String(Math.floor(minuten / 60)).padStart(2, "0")}:${String(minuten % 60).padStart(2, "0")}`;
      return `Let op: ${dagnaam} zijn we van ${klok(uren.opens)} tot ${klok(uren.closes)} open.`;
    }
  }
  return null;
}

/** Het blok "waar gaat het heen", met de afhaalcode als die er is. */
function leveringBlok(order: Order, winkel: Store | null): string {
  const afhalen = order.fulfilment === "pickup" && order.store;
  const kop = afhalen ? "Afhalen in de winkel" : "Wordt bezorgd";

  // De winkelgegevens komen uit dezelfde functie als de winkellijst onderin
  // de mail, zodat adres en telefoon er overal hetzelfde uitzien.
  const winkelgegevens =
    afhalen && winkel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
           <tr>
             <td style="font-size:13px;line-height:1.55;color:${zacht};">
               ${winkelRegels(winkel, { tijden: true, email: true })}
             </td>
           </tr>
         </table>`
      : "";

  const waarschuwing = afhalen ? feestdagWaarschuwing(new Date()) : null;

  /*
   * WAT HIER NIET MEER STAAT: "Je krijgt bericht zodra alles voor je
   * klaarstaat."
   *
   * Kevin vroeg: is dit waar? Nee. Er is geen afhaalmelding — de webhooks
   * gaan over betalen, verzenden en annuleren, en `readyForPickupAt` wordt
   * nergens gezet. Dus beloofden we een bericht dat nooit komt, en dan zit er
   * iemand thuis te wachten terwijl zijn verf al klaarstaat.
   *
   * Wat er nu staat is wél waar: de afhaalbelofte die de checkout ook al
   * rekent (twee uur binnen openingstijden), en de code die de klant in deze
   * mail al heeft. Komt die melding er ooit, dan mag de zin terug.
   */
  const belofte = afhalen && winkel ? pickupPromise(winkel, new Date(order.createdAt)) : null;

  const inhoud = afhalen
    ? `<strong>${esc(order.store!.name)}</strong>${
        belofte ? `<br><strong style="color:${oranje};">${esc(belofte.label)}</strong>` : ""
      }<br>
       Neem je afhaalcode mee, dan pakken we het aan de balie meteen voor je. Betalen hoeft niet meer.
       ${winkelgegevens}
       ${
         waarschuwing
           ? `<p style="margin:8px 0 0 0;font-size:13px;font-weight:bold;color:${oranje};">${esc(waarschuwing)}</p>`
           : ""
       }`
    : `${esc(bezorgadres(order))}<br>
       ${esc(
         order.delivery?.type === "same-day"
           ? "Vandaag nog bezorgd."
           : order.delivery?.type === "next-day"
             ? "Morgen bezorgd."
             : "Binnen één werkdag bij je.",
       )} Je krijgt de track &amp; trace-code zodra het pakket onderweg is.`;

  const code =
    afhalen && order.pickupCode
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
           <tr>
             <td style="padding:8px 14px;background:#FFFFFF;border:2px dashed ${oranje};border-radius:8px;font-size:18px;font-weight:bold;letter-spacing:.08em;color:${inkt};">
               ${esc(order.pickupCode)}
             </td>
             <td style="padding-left:10px;font-size:12px;color:${zacht};">Je afhaalcode</td>
           </tr>
         </table>`
      : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px 0;background:${vlak};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;line-height:1.55;color:${inkt};">
          <span style="display:block;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${oranje};padding-bottom:4px;">${kop}</span>
          ${inhoud}
          ${code}
        </td>
      </tr>
    </table>`;
}

/** Tips voor de klus die we in de bestelling herkennen. */
function tipsBlok(klus: Klusblok | null): string {
  if (!klus) return "";
  const tips = klus.tips
    .map(
      (tip, index) => `<tr>
        <td width="26" style="width:26px;vertical-align:top;padding:${index === 0 ? "0" : "10px"} 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="20" style="width:20px;">
            <tr>
              <td align="center" height="20" style="height:20px;background:${oranje};border-radius:10px;font-size:12px;font-weight:bold;color:#FFFFFF;line-height:20px;">${index + 1}</td>
            </tr>
          </table>
        </td>
        <td style="vertical-align:top;padding:${index === 0 ? "0" : "10px"} 0 0 0;font-size:14px;line-height:1.5;color:${inkt};">
          <strong>${esc(tip.kop)}</strong><br>
          <span style="color:${zacht};">${esc(tip.tekst)}</span>
        </td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;background:${oranjeLicht};border-radius:12px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 2px 0;font-size:17px;font-weight:bold;color:${inkt};">${esc(klus.titel)}</p>
          <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:${zacht};">${esc(klus.intro)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${tips}
          </table>
          <p style="margin:14px 0 0 0;font-size:13px;">
            <a href="${absoluteUrl(klus.meerHref)}" style="color:${oranje};font-weight:bold;">${esc(klus.meerLabel)} →</a>
          </p>
        </td>
      </tr>
    </table>`;
}

/**
 * Kluspunten: wat deze bestelling oplevert en waar de klant staat.
 *
 * Kevin: "misschien in de mail ook de kluspunten laten zien, gespaard en
 * totaal?" Kan — maar alleen als het waar is. Webshopbonnen boekten nul
 * punten (54 bonnen, € 5.428, gemeten door het dashboard) omdat ze op
 * vestiging 8934 staan, waar Tilroy het puntensysteem niet aanraakt. Daarom
 * hangt dit blok aan `KLUSPUNTEN_ONLINE`: staat die vlag uit, dan schrijft
 * deze functie niets. Gaat de schakelaar in de Tilroy-backoffice om, dan
 * zet je NEXT_PUBLIC_KLUSPUNTEN_ONLINE=1 in Vercel en staat het er meteen.
 *
 * Het saldo is het saldo van vóór deze bestelling — de punten hiervan zijn
 * op het moment van mailen nog niet geboekt. Dat staat er ook zo bij; een
 * totaal dat niet klopt met de kassabon is erger dan geen totaal.
 */
function kluspuntenBlok(
  order: Order,
  saldo: { punten: number; waarde: number } | null,
): string {
  if (!KLUSPUNTEN_ONLINE) return "";
  // ProfPas krijgt 10% korting maar spaart niet; en zonder pas valt er niets
  // te sparen.
  if (order.profpas || !order.kluspasNumber) return "";

  const verdiend = puntenVoor(Math.round(order.total * 100));
  if (verdiend <= 0) return "";

  const straks = (saldo?.punten ?? 0) + verdiend;
  const tekort = Math.max(0, PUNTEN_VOOR_KORTING - (straks % PUNTEN_VOOR_KORTING));
  const bijna = straks >= PUNTEN_VOOR_KORTING;

  const regels = [
    `<tr>
       <td style="padding:2px 0;font-size:14px;color:${zacht};">Deze bestelling</td>
       <td align="right" style="padding:2px 0;font-size:14px;font-weight:bold;color:#1B7F3B;">+ ${verdiend} punten</td>
     </tr>`,
    saldo
      ? `<tr>
           <td style="padding:2px 0;font-size:14px;color:${zacht};">Je saldo hiervoor</td>
           <td align="right" style="padding:2px 0;font-size:14px;font-weight:bold;color:${inkt};">${saldo.punten} punten</td>
         </tr>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const slot = bijna
    ? `Je hebt genoeg voor ${euros(KORTING_BIJ_DREMPEL)} korting. Laat je Kluspas zien aan de kassa, dan verzilveren we hem.`
    : `Nog ${tekort} punten tot ${euros(KORTING_BIJ_DREMPEL)} korting.`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;background:${vlak};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;">
          <span style="display:block;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${oranje};padding-bottom:6px;">Kluspunten</span>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${regels}</table>
          <p style="margin:8px 0 0 0;font-size:13px;line-height:1.5;color:${zacht};">
            ${esc(slot)} <a href="${absoluteUrl("/kluspunten")}" style="color:${oranje};font-weight:bold;">Hoe het werkt</a>
          </p>
        </td>
      </tr>
    </table>`;
}

/**
 * Hulp bij deze bestelling.
 *
 * Stond eerst als losse zin onderaan ("Vragen over je bestelling? Mail …");
 * Kevin: "dit kan mooier, en ook contactgegevens". Nu een blok met drie
 * gelijkwaardige manieren om ons te bereiken, zodat de klant kiest wat bij
 * hem past in plaats van door een alinea te moeten lezen.
 */
function hulpBlok(order: Order): string {
  const manieren = [
    {
      wat: "Mail ons",
      waarde: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Bestelling ${order.reference}`)}`,
      onder: "Antwoord binnen één werkdag",
    },
    {
      wat: "Bel ons",
      waarde: CONTACT_PHONE,
      href: `tel:${CONTACT_PHONE.replace(/\s/g, "")}`,
      onder: WHATSAPP_TIJDEN,
    },
    ...(WHATSAPP_NUMMER
      ? [
          {
            wat: "WhatsApp",
            waarde: WHATSAPP_WEERGAVE(WHATSAPP_NUMMER),
            href: `https://wa.me/${WHATSAPP_NUMMER}?text=${encodeURIComponent(
              `Hoi, ik heb een vraag over bestelling ${order.reference}`,
            )}`,
            onder: "Vaak het snelst",
          },
        ]
      : []),
  ];

  const rijen = manieren
    .map(
      (manier, index) => `<tr>
        <td style="padding:${index === 0 ? "0" : "10px"} 0 0 0;font-size:14px;line-height:1.45;">
          <span style="color:${zacht};font-size:12px;">${esc(manier.wat)}</span><br>
          <a href="${manier.href}" style="color:${oranje};font-weight:bold;text-decoration:none;">${esc(manier.waarde)}</a>
          <span style="color:${zacht};font-size:12px;"> · ${esc(manier.onder)}</span>
        </td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;border:1px solid ${lijn};border-radius:12px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 3px 0;font-size:16px;font-weight:bold;color:${inkt};">Ergens hulp bij nodig?</p>
          <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:${zacht};">
            Noem je bestelnummer <strong style="color:${inkt};">${esc(order.reference)}</strong>, dan hebben we het meteen voor ons.
            Advies over je klus mag ook — daar zijn onze verfspecialisten voor.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rijen}
          </table>
        </td>
      </tr>
    </table>`;
}

const datumOpmaak = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function besteldOp(order: Order): string {
  const datum = new Date(order.createdAt);
  return Number.isNaN(datum.getTime()) ? "" : datumOpmaak.format(datum);
}

/* ── De mail ──────────────────────────────────────────────────────── */

/**
 * De kern van de bevestiging. Los van het versturen, zodat de opmaak te
 * bekijken is zonder dat er een mail de deur uit hoeft.
 */
export function bevestigingsHtml(
  order: Order,
  klus: Klusblok | null,
  winkel: Store | null = null,
  puntensaldo: { punten: number; waarde: number } | null = null,
): string {
  const orderUrl = absoluteUrl(`/bestelling/${order.reference}`);
  const factuurUrl = absoluteUrl(`/bestelling/${order.reference}/factuur`);
  const naam = order.customer.firstName || "";
  const datum = besteldOp(order);

  return `
    <p style="margin:0 0 4px 0;font-size:24px;line-height:1.25;font-weight:bold;color:${inkt};">
      ${naam ? `Bedankt, ${esc(naam)}!` : "Bedankt voor je bestelling!"}
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${zacht};">
      Je betaling is binnen en we gaan voor je aan de slag.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${oranjeLicht};border-radius:10px;">
      <tr>
        <td style="padding:12px 16px;font-size:14px;line-height:1.5;color:${inkt};">
          <span style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${oranje};">Bestelnummer</span><br>
          <strong style="font-size:19px;letter-spacing:.02em;">${esc(order.reference)}</strong>
          ${datum ? `<span style="color:${zacht};font-size:13px;"> · besteld op ${esc(datum)}</span>` : ""}
        </td>
      </tr>
    </table>

    ${leveringBlok(order, winkel)}

    <p style="margin:22px 0 10px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${zacht};">
      Wat je hebt besteld
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${artikelrijen(order)}
    </table>
    ${totalen(order)}
    ${kluspuntenBlok(order, puntensaldo)}

    <p style="margin:22px 0 0 0;">
      ${mailKnop({ href: orderUrl, label: "Volg je bestelling" })}
      ${mailKnop({ href: factuurUrl, label: "Bekijk je factuur", soort: "leeg" })}
    </p>

    ${tipsBlok(klus)}

    ${hulpBlok(order)}
  `;
}

export async function stuurOrderbevestiging(order: Order): Promise<boolean> {
  const orderUrl = absoluteUrl(`/bestelling/${order.reference}`);
  const factuurUrl = absoluteUrl(`/bestelling/${order.reference}/factuur`);
  const naam = order.customer.firstName || "";

  // De klus herkennen mag de mail niet ophouden; kan het niet, dan gaat hij
  // zonder tips de deur uit.
  let klus: Klusblok | null = null;
  try {
    klus = await klusUitBestelling(order.items);
  } catch (error) {
    console.error("[order] klusherkenning mislukt:", error);
  }

  // De volledige afhaalwinkel: in de order staan alleen id, naam en plaats,
  // maar de klant wil adres, telefoon en openingstijden zien.
  let winkel: Store | null = null;
  if (order.fulfilment === "pickup" && order.store) {
    winkel = (await getStore(order.store.id).catch(() => undefined)) ?? null;
  }

  // Het puntensaldo alleen ophalen als we het ook gaan tonen; anders is het
  // een dashboard-aanroep voor niets, midden in de betaalafhandeling.
  let puntensaldo: { punten: number; waarde: number } | null = null;
  if (KLUSPUNTEN_ONLINE && order.kluspasNumber && !order.profpas) {
    puntensaldo = await haalKluspunten(order.customer.email).catch(() => null);
  }

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
    ...(order.kluspasSavings
      ? [`Kluspas-korting: − ${euros(order.kluspasSavings)}`]
      : []),
    `${order.fulfilment === "delivery" ? "Bezorging" : "Afhalen"}: ${
      order.shipping > 0 ? euros(order.shipping) : "gratis"
    }`,
    // Ook hier geen aparte kortingsregels: ze staan al in de artikellijst.
    `Totaal betaald: ${euros(order.total)} (incl. btw)`,
    "",
    ...(KLUSPUNTEN_ONLINE && order.kluspasNumber && !order.profpas
      ? [
          `Kluspunten met deze bestelling: + ${puntenVoor(Math.round(order.total * 100))}`,
          ...(puntensaldo ? [`Je saldo hiervoor: ${puntensaldo.punten} punten`] : []),
          "",
        ]
      : []),
    levering(order, winkel),
    "",
    ...(klus
      ? [
          klus.titel,
          ...klus.tips.map((tip) => `- ${tip.kop}: ${tip.tekst}`),
          "",
        ]
      : []),
    `Je bestelling volgen: ${orderUrl}`,
    `Je factuur: ${factuurUrl}`,
    "",
    `Vragen? Mail ${CONTACT_EMAIL} of bel ${CONTACT_PHONE}.`,
    "",
    `Groet, ${SITE_NAME}`,
  ].join("\n");

  const html = bevestigingsHtml(order, klus, winkel, puntensaldo);

  // Trustpilot leest de bevestiging mee via BCC en nodigt de klant uit voor
  // een review. Alleen op deze mail: een inlogcode of verzendmail met een
  // meelezer erop zou raar zijn. Zonder variabele gebeurt er niets.
  const reviewBcc = (process.env.TRUSTPILOT_BCC ?? "").trim();

  const resultaat = await verstuurMail({
    aan: order.customer.email,
    onderwerp: `Bestelling ${order.reference}, bedankt!`,
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
