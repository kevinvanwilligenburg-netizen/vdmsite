import { NextResponse } from "next/server";

import { stuurAfhaalmail } from "@/lib/afhaalmail";
import { getOrder, updateOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Het dashboard meldt hier dat een afhaalbestelling klaarstaat in de winkel.
 *
 *   POST { reference: "VDM-123456" }
 *   Authorization: Bearer <SITE_API_KEY>
 *
 * We zetten `readyForPickupAt` op de bestelling en mailen de klant dat hij
 * langs kan komen, met zijn afhaalcode, het adres en de openingstijden.
 *
 * Waarom deze route er is: de site beloofde op acht plekken "je krijgt bericht
 * zodra je bestelling klaarstaat" — ook in de algemene voorwaarden — maar er
 * was niets dat dat bericht stuurde. Het veld `readyForPickupAt` werd alleen
 * uitgelezen op de bestelpagina en nooit gezet.
 *
 * ⚠️ Idempotent op `reference`, net als /api/webhooks/verzonden: het dashboard
 * mag het opnieuw proberen als wij even plat lagen, en dan mag dezelfde klant
 * niet twee keer horen dat zijn verf klaarstaat. Het stempel `readyMailSentAt`
 * bewaakt dat; is de mail al weg, dan antwoorden we alsnog met 200.
 */
export async function POST(request: Request) {
  const sleutel = process.env.SITE_API_KEY;
  if (!sleutel) {
    console.error("[klaar] SITE_API_KEY ontbreekt; webhook geweigerd.");
    return NextResponse.json({ error: "Niet geconfigureerd." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${sleutel}`) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  let body: { reference?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const reference = String(body.reference ?? "").trim().toUpperCase();
  if (!reference) {
    return NextResponse.json({ error: "reference ontbreekt." }, { status: 400 });
  }

  const order = await getOrder(reference);
  if (!order) {
    // 404 en niet 200: het dashboard mag weten dat deze bestelling hier niet
    // bestaat, anders zoekt niemand ooit uit waarom die mail uitbleef.
    return NextResponse.json({ error: "Bestelling onbekend." }, { status: 404 });
  }

  // Een bezorgorder heeft geen winkel om naartoe te komen. Duidelijk melden in
  // plaats van stilzwijgend een onzinmail sturen.
  if (order.fulfilment !== "pickup") {
    return NextResponse.json(
      { error: "Deze bestelling wordt bezorgd; gebruik /api/webhooks/verzonden." },
      { status: 409 },
    );
  }

  if (order.readyMailSentAt) {
    return NextResponse.json({ ok: true, alGemeld: true });
  }

  const nu = new Date().toISOString();
  const bijgewerkt = await updateOrder(order.id, {
    readyForPickupAt: order.readyForPickupAt ?? nu,
    readyMailSentAt: nu,
  });

  if (!bijgewerkt) {
    return NextResponse.json({ error: "Bijwerken mislukt." }, { status: 500 });
  }

  const gemaild = await stuurAfhaalmail(bijgewerkt);
  return NextResponse.json({ ok: true, gemaild });
}
