import { NextResponse } from "next/server";

import { stuurAnnuleermail } from "@/lib/annuleermail";
import { getOrder, updateOrder } from "@/lib/orders";
import { isPaidStatus } from "@/lib/types";
import { herstelVoucher, trekVoucherIn } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

/**
 * Het dashboard meldt hier dat een bestelling is geannuleerd.
 *
 *   POST { reference: "VDM-123456", reden: "…", terugbetaald: 33.26 }
 *   Authorization: Bearer <SITE_API_KEY>
 *
 * Volgorde aan hun kant: Tilroy annuleren → ons inlichten → Mollie
 * terugbetalen. Als wij worden aangeroepen is het geld dus nog niet terug —
 * de mail zegt "wordt teruggestort". De terugbetaling en de voorraad doen wij
 * hier bewust niets mee: dat is dashboardwerk, dubbel is erger dan niks.
 *
 * ⚠️ Idempotent op `reference`, met het stempel pas ná een geslaagde mail
 * (Klus=r-patroon): mislukt de mail, dan blijft de webhook herhaalbaar en
 * doet een volgende poging alleen de mail opnieuw; is het stempel gezet, dan
 * antwoorden we met 200 zonder de klant nog eens te storen.
 *
 * Statuskeuze: was de bestelling betaald, dan wordt hij "refunded" (er komt
 * geld terug — dat is wat de klant wil weten); was er nog niets betaald, dan
 * "canceled".
 */
export async function POST(request: Request) {
  const sleutel = process.env.SITE_API_KEY;
  if (!sleutel) {
    console.error("[geannuleerd] SITE_API_KEY ontbreekt; webhook geweigerd.");
    return NextResponse.json({ error: "Niet geconfigureerd." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${sleutel}`) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  let body: { reference?: string; reden?: string; terugbetaald?: number };
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
    return NextResponse.json({ error: "Bestelling onbekend." }, { status: 404 });
  }

  if (order.canceledMailSentAt) {
    return NextResponse.json({ ok: true, alGemeld: true, status: order.paymentStatus });
  }

  const terugbetaald =
    typeof body.terugbetaald === "number" && Number.isFinite(body.terugbetaald)
      ? body.terugbetaald
      : undefined;
  const reden = String(body.reden ?? "").trim();

  // "refunded" alleen als er echt iets terug te betalen valt; ook een order
  // die al op refunded stond (herhaalde aanroep na mailstoring) blijft dat.
  const nieuweStatus =
    isPaidStatus(order.paymentStatus) || order.paymentStatus === "refunded"
      ? ("refunded" as const)
      : ("canceled" as const);

  // Vouchers vóór de mail afhandelen, zodat de mail de uitkomst kan melden.
  // Beide bewerkingen zijn idempotent: bij een herhaalde aanroep is er niets
  // meer te herstellen of in te trekken en melden ze dat stilletjes.
  let voucherHersteld = false;
  if (order.voucherCode) {
    voucherHersteld = await herstelVoucher(order.voucherCode, order.reference);
  }
  let staalIngetrokken = false;
  if (order.staalVoucher?.code) {
    const uitkomst = await trekVoucherIn(order.staalVoucher.code);
    staalIngetrokken = uitkomst === "ingetrokken";
    if (uitkomst === "al-gebruikt") {
      // Terugbetalen én een verzilverde tegoedbon: dat kan alleen een mens
      // wegen. Luid loggen zodat het niet onopgemerkt blijft.
      console.error(
        `[geannuleerd] ${order.reference}: staal-voucher ${order.staalVoucher.code} is al verzilverd; handmatig beoordelen.`,
      );
    }
  }

  const bijgewerkt = await updateOrder(order.id, {
    paymentStatus: nieuweStatus,
    ...(terugbetaald !== undefined ? { refundedAmount: terugbetaald } : {}),
    ...(reden ? { cancelReason: reden } : {}),
  });
  if (!bijgewerkt) {
    return NextResponse.json({ error: "Bijwerken mislukt." }, { status: 500 });
  }

  const gemaild = await stuurAnnuleermail(bijgewerkt, {
    terugbetaald,
    voucherHersteld,
    staalIngetrokken,
  });
  if (gemaild) {
    await updateOrder(order.id, { canceledMailSentAt: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true, status: nieuweStatus, gemaild });
}
