import { NextResponse } from "next/server";

import { mollieEnabled } from "@/lib/mollie";
import { applyPaymentResult, getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Rondt een gesimuleerde betaling af. Alleen beschikbaar in demomodus. */
export async function POST(request: Request) {
  if (mollieEnabled()) {
    return NextResponse.json(
      { error: "Demo-betalingen zijn uitgeschakeld omdat Mollie actief is." },
      { status: 400 },
    );
  }

  let body: { orderId?: string; outcome?: string };
  try {
    body = (await request.json()) as { orderId?: string; outcome?: string };
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const order = await getOrder(String(body.orderId ?? ""));
  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }
  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "Deze bestelling staat niet meer open." }, { status: 409 });
  }

  if (body.outcome === "paid") {
    const updated = await applyPaymentResult(order, "paid", {
      provider: "demo",
      method: "demo-ideal",
    });
    return NextResponse.json({ status: updated.status });
  }
  if (body.outcome === "failed") {
    const updated = await applyPaymentResult(order, "failed", { provider: "demo" });
    return NextResponse.json({ status: updated.status });
  }
  return NextResponse.json({ error: "Ongeldige uitkomst." }, { status: 400 });
}
