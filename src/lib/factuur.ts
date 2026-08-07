import type { Order } from "@/lib/types";

/**
 * Factuurgegevens bij een bestelling.
 *
 * De prijzen in een order zijn inclusief btw — dat is wat de klant afrekent en
 * wat het kassasysteem hanteert. Voor een factuur moet het bedrag gesplitst:
 * exclusief btw, het btw-bedrag, en het totaal. Dat rekenen we hier terug uit
 * het bedrag inclusief, en niet andersom, zodat het eindtotaal op de factuur
 * altijd exact gelijk is aan wat er is afgeschreven. Rekenden we van exclusief
 * naar inclusief, dan loopt het door afronding een cent uit de pas met de
 * betaling — precies het soort verschil waar een boekhouder over belt.
 *
 * ⚠️ Eén tarief voor het hele assortiment: 21%. Dat klopt voor verf,
 * gereedschap, ijzerwaren en huishoudelijke artikelen. Komt er ooit iets bij
 * dat onder het lage tarief valt, dan hoort het tarief per orderregel uit de
 * bron te komen en niet hier vast te staan.
 */

export const BTW_TARIEF = 0.21;

/** Bedragen in euro's, zoals ze in een Order staan. */
export interface BtwSplitsing {
  exclusief: number;
  btw: number;
  inclusief: number;
}

function centen(bedrag: number): number {
  return Math.round(bedrag * 100);
}

/** Splitst een bedrag inclusief btw. Rekent in centen om afrondruis te voorkomen. */
export function splitsBtw(inclusief: number): BtwSplitsing {
  const inc = centen(inclusief);
  const exc = Math.round(inc / (1 + BTW_TARIEF));
  return {
    exclusief: exc / 100,
    btw: (inc - exc) / 100,
    inclusief: inc / 100,
  };
}

export interface Factuurregel {
  omschrijving: string;
  toelichting?: string;
  aantal: number;
  stukprijsExcl: number;
  totaalExcl: number;
}

export interface Factuur {
  nummer: string;
  datum: string;
  regels: Factuurregel[];
  subtotaalExcl: number;
  btw: number;
  totaalIncl: number;
  /** Alleen gevuld als er met een Kluspas is besteld. */
  kluspasNummer?: string;
}

/**
 * Het factuurnummer volgt de bestelling: VDM-123456 wordt F-VDM-123456. Eén
 * bestelling, één factuur, en de klant kan de twee zonder uitleg aan elkaar
 * knopen. Een eigen doorlopende nummering zou een teller nodig hebben die
 * over meerdere serverless processen heen klopt, en dat is een bron van
 * dubbele nummers die we hier niet nodig hebben.
 */
export function factuurNummer(order: Order): string {
  return `F-${order.reference}`;
}

export function maakFactuur(order: Order): Factuur {
  const regels: Factuurregel[] = order.items.map((item) => {
    const stuk = splitsBtw(item.price);
    return {
      omschrijving: item.title,
      toelichting: [
        item.variantLabel,
        item.color ? `kleur ${[item.color.code, item.color.name].filter(Boolean).join(" ")}` : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      aantal: item.quantity,
      stukprijsExcl: stuk.exclusief,
      // Per regel het totaal inclusief splitsen, niet de stukprijs × aantal:
      // bij 3 × € 4,35 scheelt dat een cent, en die cent hoort bij de klant.
      totaalExcl: splitsBtw(item.price * item.quantity).exclusief,
    };
  });

  if (order.shipping > 0) {
    const verzending = splitsBtw(order.shipping);
    regels.push({
      omschrijving: order.fulfilment === "delivery" ? "Bezorgkosten" : "Verzendkosten",
      aantal: 1,
      stukprijsExcl: verzending.exclusief,
      totaalExcl: verzending.exclusief,
    });
  }

  // Een aantal-actie ("5 halen, 3 betalen") gaat er niet per stuk af maar over
  // de groep, dus hij past niet in de artikelregels en hoort hier als eigen
  // minregel. Zonder deze regel is de factuur hoger dan wat er is afgeschreven.
  if (order.staffelKorting) {
    const korting = splitsBtw(-order.staffelKorting);
    regels.push({
      omschrijving: order.staffelNamen?.length
        ? order.staffelNamen.join(" · ")
        : "Actiekorting",
      aantal: 1,
      stukprijsExcl: korting.exclusief,
      totaalExcl: korting.exclusief,
    });
  }

  // Een verzilverde staal-voucher staat als minregel op de factuur; zonder die
  // regel telt de kolom niet op tot het afgeschreven bedrag.
  if (order.voucherKorting) {
    const korting = splitsBtw(-order.voucherKorting);
    regels.push({
      omschrijving: `Staal-voucher${order.voucherCode ? ` ${order.voucherCode}` : ""}`,
      aantal: 1,
      stukprijsExcl: korting.exclusief,
      totaalExcl: korting.exclusief,
    });
  }

  const totaal = splitsBtw(order.total);
  const subtotaalExcl = regels.reduce((som, regel) => som + regel.totaalExcl, 0);

  return {
    nummer: factuurNummer(order),
    datum: order.createdAt,
    regels,
    subtotaalExcl,
    // Het btw-bedrag leiden we af van het eindtotaal, zodat excl + btw altijd
    // precies op het betaalde bedrag uitkomt, ook als de regels een cent
    // afrondingsverschil geven.
    btw: Math.round((order.total - subtotaalExcl) * 100) / 100,
    totaalIncl: totaal.inclusief,
    ...(order.kluspasNumber ? { kluspasNummer: order.kluspasNumber } : {}),
  };
}
