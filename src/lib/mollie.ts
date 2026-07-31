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

  // Billie is betalen op rekening voor bedrijven; Mollie eist daarvoor het
  // volledige factuuradres mét bedrijfsnaam.
  const zakelijk = gekozenMethod === "billie";

  const body: Record<string, unknown> = {
    amount: {
      currency: "EUR",
      value: order.total.toFixed(2),
    },
    description: `De Voordeelmarkt bestelling ${order.reference}`,
    redirectUrl: `${baseUrl}/bestelling/${order.reference}`,
    locale: "nl_NL",
    metadata: { orderId: order.id },
    ...(gekozenMethod ? { method: gekozenMethod } : {}),
    ...(zakelijk &&
    order.customer.company &&
    order.customer.street &&
    order.customer.postalCode &&
    order.customer.city
      ? {
          billingAddress: {
            organizationName: order.customer.company,
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
