import type { Order } from "@/lib/types";

/**
 * Mollie-betaallaag via de REST API (v2).
 *
 * Zonder MOLLIE_API_KEY draait de site in demomodus: de checkout stuurt de
 * klant dan naar een gesimuleerde betaalpagina (/betalen/demo/[reference]).
 */

const MOLLIE_API_URL = "https://api.mollie.com/v2";
const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY;

export function mollieEnabled(): boolean {
  return Boolean(MOLLIE_API_KEY);
}

/** Demomodus of Mollie-testsleutel → bestellingen tellen als test (isTest). */
export function mollieTestMode(): boolean {
  return !MOLLIE_API_KEY || MOLLIE_API_KEY.startsWith("test_");
}

export interface MolliePayment {
  id: string;
  status: string; // open | pending | paid | failed | canceled | expired
  method?: string | null;
  paidAt?: string | null;
  metadata?: { orderId?: string } | null;
}

async function mollieFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MOLLIE_API_URL}${path}`, {
    ...init,
    // Mollie antwoordt normaal binnen een seconde; zonder limiet hing de
    // hele bestelling op een stille verbinding, zonder foutmelding.
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${MOLLIE_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mollie API ${path} gaf status ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

function isPubliclyReachable(baseUrl: string): boolean {
  return !/localhost|127\.0\.0\.1|\[::1\]/.test(baseUrl);
}

/** Twee decimalen, zonder de afrondingsfouten van drijvende komma. */
function r2(bedrag: number): number {
  return Math.round(bedrag * 100) / 100;
}

/**
 * Orderregels voor Mollie.
 *
 * Hierop liep Klarna stuk. Achteraf betalen is een kredietbeoordeling: Klarna
 * wil weten wát iemand koopt, niet alleen voor hoeveel. Mollie eist daarvoor
 * `lines`, en zonder die regels weigert het de betaling met een 4xx — waarna
 * onze terugval de methode laat vallen en de klant op het keuzescherm belandt
 * zonder de methode die hij net koos. Precies wat Kevin meldde, en precies het
 * verschil met de Klus=r-checkout, die de regels wél meestuurt.
 *
 * De regels moeten tot op de cent optellen tot het totaal. Doen ze dat niet,
 * dan geven we niets terug: liever geen Klarna dan een iDEAL-betaling die
 * struikelt over een rekenfout van een cent.
 *
 * Btw: alles wat wij verkopen valt in het hoge tarief, en de prijzen in de
 * order zijn inclusief. Het btw-bedrag is dus het deel boven het kale bedrag.
 */
const BTW_TARIEF = 0.21;

function mollieRegels(order: Order): unknown[] | undefined {
  const btw = (bedrag: number) => r2(bedrag - r2(bedrag / (1 + BTW_TARIEF)));
  const regel = (
    type: string,
    omschrijving: string,
    aantal: number,
    stuk: number,
    totaal: number,
  ) => ({
    type,
    description: omschrijving.slice(0, 100) || "Artikel",
    quantity: aantal,
    unitPrice: { currency: "EUR", value: stuk.toFixed(2) },
    totalAmount: { currency: "EUR", value: totaal.toFixed(2) },
    vatRate: (BTW_TARIEF * 100).toFixed(2),
    vatAmount: { currency: "EUR", value: btw(totaal).toFixed(2) },
  });

  const regels: ReturnType<typeof regel>[] = order.items.map((item) => {
    const stuk = r2(item.price);
    return regel(
      "physical",
      [item.title, item.variantLabel].filter(Boolean).join(" · "),
      item.quantity,
      stuk,
      r2(stuk * item.quantity),
    );
  });

  // De staal-voucher als eigen regel met een negatief bedrag; anders tellen de
  // regels hoger uit dan er betaald wordt.
  if (order.voucherKorting && order.voucherKorting > 0) {
    const korting = -r2(order.voucherKorting);
    regels.push(
      regel(
        "discount",
        `Staal-voucher${order.voucherCode ? ` ${order.voucherCode}` : ""}`,
        1,
        korting,
        korting,
      ),
    );
  }

  if (order.shipping > 0) {
    const kosten = r2(order.shipping);
    regels.push(regel("shipping_fee", "Bezorgkosten", 1, kosten, kosten));
  }

  const som = r2(regels.reduce((totaal, r) => totaal + Number(r.totalAmount.value), 0));
  if (Math.abs(som - r2(order.total)) >= 0.005) {
    console.error(
      `[mollie] orderregels tellen op tot ${som.toFixed(2)} maar het totaal is ${order.total.toFixed(
        2,
      )}; regels niet meegestuurd (achteraf betalen valt dan af).`,
    );
    return undefined;
  }
  return regels;
}

/**
 * De Mollie-locale bij het factuurland.
 *
 * Niet vast op nl_NL zetten: bij achteraf betalen bepaalt de locale in welke
 * markt Klarna de aanvraag doet, en een Belgisch adres komt op de Nederlandse
 * markt niet door.
 */
function localeVoorLand(land: string | undefined): string {
  return (land ?? "NL").trim().toUpperCase().slice(0, 2) === "BE" ? "nl_BE" : "nl_NL";
}

export async function createMolliePayment(
  order: Order,
  baseUrl: string,
  /**
   * Vooraf gekozen betaalmethode. Geven we die mee, dan slaat Mollie zijn
   * eigen keuzescherm over en landt de klant direct bij zijn bank of Klarna.
   */
  method?: string,
): Promise<{ paymentId: string; checkoutUrl: string }> {
  // Google Pay is de uitzondering op het vooraf kiezen: Mollie kan die
  // betaling alleen starten vanaf een echte Google Pay-knop, en die staat op
  // Mollie's eigen betaalpagina. Method meesturen levert een betaling op die
  // nergens af te ronden is — gemeten bij Klus=r. Dus: zonder method, dan
  // toont Mollie zelf de knop.
  const gekozenMethod = method === "googlepay" ? undefined : method;

  /*
   * Factuuradres en orderregels: altijd meesturen als we ze compleet hebben.
   *
   * Dit stond eerst alleen aan bij Billie en Klarna, en dat was te krap. Mollie
   * negeert allebei bij methoden die er niets mee doen, maar zonder deze twee
   * ís er geen achteraf betalen: Klarna eist een factuuradres én de regels
   * waaruit blijkt wát er gekocht wordt. Zonder dat weigert Mollie met een
   * 4xx, valt onze code terug op het keuzescherm, en staat juist de methode
   * die de klant koos daar niet meer tussen.
   *
   * De Klus=r-checkout doet het al zo en daar werkt Klarna wél. Dit is dat
   * verschil, meer niet.
   */
  const zakelijk = gekozenMethod === "billie";
  const heeftAdres = Boolean(
    order.customer.street &&
      order.customer.postalCode &&
      order.customer.city &&
      (!zakelijk || order.customer.company),
  );
  const regels = mollieRegels(order);

  const body: Record<string, unknown> = {
    amount: {
      currency: "EUR",
      value: order.total.toFixed(2),
    },
    description: `De Voordeelmarkt bestelling ${order.reference}`,
    redirectUrl: `${baseUrl}/bestelling/${order.reference}`,
    locale: localeVoorLand(order.customer.country),
    metadata: { orderId: order.id },
    ...(gekozenMethod ? { method: gekozenMethod } : {}),
    ...(regels ? { lines: regels } : {}),
    ...(heeftAdres
      ? {
          billingAddress: {
            ...(order.customer.company
              ? { organizationName: order.customer.company }
              : {}),
            givenName: order.customer.firstName,
            familyName: order.customer.lastName,
            email: order.customer.email,
            streetAndNumber:
              `${order.customer.street} ${order.customer.houseNumber ?? ""}${order.customer.houseNumberSuffix ?? ""}`.trim(),
            postalCode: order.customer.postalCode,
            city: order.customer.city,
            country: order.customer.country ?? "NL",
          },
        }
      : {}),
  };
  // Mollie weigert webhooks naar localhost; lokaal synct de orderpagina
  // de betaalstatus zelf bij (zie getOrderSynced in lib/orders.ts).
  if (isPubliclyReachable(baseUrl)) {
    body.webhookUrl = `${baseUrl}/api/webhooks/mollie`;
  }

  let payment: MolliePayment & { _links: { checkout?: { href: string } } };
  try {
    payment = await mollieFetch<
      MolliePayment & { _links: { checkout?: { href: string } } }
    >("/payments", { method: "POST", body: JSON.stringify(body) });
  } catch (error) {
    // Methode niet actief in het Mollie-profiel (of tijdelijk niet
    // beschikbaar): de bestelling mag daar niet op stuklopen. Zonder method
    // krijgt de klant Mollie's keuzescherm — een extra klik, geen dode order.
    if (gekozenMethod && error instanceof Error && /status 4\d\d/.test(error.message)) {
      // Luid loggen. Dit terugvalpad is precies wat de klant ziet als "ik koos
      // iDEAL en moest bij Mollie alsnog kiezen", en het stond nergens in de
      // logboeken — dus een methode die in het Mollie-profiel uit staat bleef
      // maanden onopgemerkt. Eén regel per keer is genoeg om het te vinden.
      console.error(
        `[mollie] methode "${gekozenMethod}" geweigerd, klant krijgt het keuzescherm: ${error.message}`,
      );
      const { method: _weg, ...zonderMethode } = body as { method?: unknown } & Record<
        string,
        unknown
      >;
      payment = await mollieFetch<
        MolliePayment & { _links: { checkout?: { href: string } } }
      >("/payments", { method: "POST", body: JSON.stringify(zonderMethode) });
    } else {
      throw error;
    }
  }

  const checkoutUrl = payment._links.checkout?.href;
  if (!checkoutUrl) {
    throw new Error("Mollie gaf geen checkout-URL terug.");
  }
  return { paymentId: payment.id, checkoutUrl };
}

export async function getMolliePayment(paymentId: string): Promise<MolliePayment> {
  return mollieFetch<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/**
 * Welke betaalmethoden kan dít profiel op dít bedrag?
 *
 * Kevin klikte Klarna en belandde op Mollie's keuzescherm, waar Klarna óók
 * niet tussen stond. Onze tegels kwamen uit een vaste lijst in de code, en die
 * wist niets van wat er in het Mollie-profiel is aangezet. Een methode
 * aanbieden die geweigerd wordt kost precies één klant per keer, op het
 * duurste moment van het bezoek.
 *
 * Mollie kan dat gewoon vertellen, inclusief de drempels waar wij niets van
 * weten: Klarna heeft minimum- en maximumbedragen, en sommige methoden gelden
 * per land. Door het bedrag mee te geven krijgen we het antwoord voor dít
 * mandje, niet in het algemeen.
 *
 * Faalt de aanroep, dan geven we null terug en houdt de aanroeper zijn eigen
 * lijst aan: liever te veel keuze dan een lege betaalstap.
 */
export async function beschikbareMethoden(
  bedragInCenten: number,
  land: "NL" | "BE",
): Promise<string[] | null> {
  if (!mollieEnabled()) return null;
  const bedrag = Math.max(1, Math.round(bedragInCenten)) / 100;
  const query = new URLSearchParams({
    "amount[value]": bedrag.toFixed(2),
    "amount[currency]": "EUR",
    billingCountry: land,
    locale: land === "BE" ? "nl_BE" : "nl_NL",
  });
  try {
    const data = await mollieFetch<{ _embedded?: { methods?: { id: string }[] } }>(
      `/methods?${query.toString()}`,
    );
    const ids = (data._embedded?.methods ?? []).map((methode) => methode.id);
    return ids.length > 0 ? ids : null;
  } catch (error) {
    console.error("[mollie] methodenlijst ophalen mislukt:", error);
    return null;
  }
}
