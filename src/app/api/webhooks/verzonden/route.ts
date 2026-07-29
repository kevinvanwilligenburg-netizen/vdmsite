import { NextResponse } from "next/server";

import { getOrder, updateOrder } from "@/lib/orders";
import { isPaidStatus } from "@/lib/types";
import { stuurVerzendmail } from "@/lib/verzendmail";

export const dynamic = "force-dynamic";

/**
 * Het dashboard meldt hier dat er een verzendlabel is aangemaakt.
 *
 *   POST { reference: "VDM-123456", carrier: "dhl", trackTrace: "3S..." }
 *   Authorization: Bearer <SITE_API_KEY>
 *
 * We zetten de code op de bestelling, zetten de status op verzonden en mailen
 * de klant.
 *
 * ⚠️ Bewust idempotent op `reference`. Het dashboard roept ons aan en gaat
 * daarna gewoon door — een zending die al bij DHL bestaat mag niet stranden
 * op onze mail. Dat betekent ook dat ze het opnieuw kunnen proberen als wij
 * even plat lagen, en dan mag dezelfde klant niet voor de tweede keer horen
 * dat zijn pakket onderweg is. Vandaar het stempel `shippedMailSentAt`: is de
 * code ongewijzigd en de mail al weg, dan doen we niets en antwoorden we
 * alsnog met 200.
 */
export async function POST(request: Request) {
  const sleutel = process.env.SITE_API_KEY;
  if (!sleutel) {
    console.error("[verzonden] SITE_API_KEY ontbreekt; webhook geweigerd.");
    return NextResponse.json({ error: "Niet geconfigureerd." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${sleutel}`) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  let body: { reference?: string; carrier?: string; trackTrace?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const reference = String(body.reference ?? "").trim().toUpperCase();
  const trackTrace = String(body.trackTrace ?? "").trim();
  const carrier = body.carrier === "postnl" ? "postnl" : "dhl";

  if (!reference) {
    return NextResponse.json({ error: "reference ontbreekt." }, { status: 400 });
  }

  const order = await getOrder(reference);
  if (!order) {
    // 404 en niet 200: het dashboard mag weten dat deze bestelling hier niet
    // bestaat, anders zoekt niemand ooit uit waarom die mail uitbleef.
    return NextResponse.json({ error: "Bestelling onbekend." }, { status: 404 });
  }

  const zelfdeCode = (order.shipment?.trackTrace ?? "") === trackTrace;
  if (order.shippedMailSentAt && zelfdeCode) {
    return NextResponse.json({ ok: true, alGemeld: true });
  }

  const bijgewerkt = await updateOrder(order.id, {
    ...(trackTrace ? { shipment: { ...order.shipment, trackTrace } } : {}),
    // Alleen de status opschuiven bij een betaalde bestelling; een label bij
    // een openstaande betaling is een fout die we niet moeten wegpoetsen.
    ...(isPaidStatus(order.paymentStatus) ? { paymentStatus: "shipped" as const } : {}),
    ...(order.delivery ? { delivery: { ...order.delivery, carrier } } : {}),
    shippedMailSentAt: new Date().toISOString(),
  });

  if (!bijgewerkt) {
    return NextResponse.json({ error: "Bijwerken mislukt." }, { status: 500 });
  }

  const gemaild = await stuurVerzendmail(bijgewerkt);
  return NextResponse.json({ ok: true, gemaild });
}
