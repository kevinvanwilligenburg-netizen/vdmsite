import { NextResponse } from "next/server";

import { createMolliePayment, mollieEnabled } from "@/lib/mollie";
import { getOrder, updateOrder } from "@/lib/orders";
import { baseUrlFromRequest } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Start een nieuwe betaalpoging voor een openstaande of mislukte bestelling. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const order = await getOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }
  if (!["pending_payment", "payment_failed"].includes(order.status)) {
    return NextResponse.json(
      { error: "Deze bestelling is al betaald of geannuleerd." },
      { status: 409 },
    );
  }

  if (!mollieEnabled()) {
    await updateOrder(order.id, {
      status: "pending_payment",
      payment: { provider: "demo" },
    });
    return NextResponse.json({ checkoutUrl: `/betalen/demo/${order.id}` });
  }

  try {
    const baseUrl = baseUrlFromRequest(request);
    const { paymentId, checkoutUrl } = await createMolliePayment(order, baseUrl);
    await updateOrder(order.id, {
      status: "pending_payment",
      payment: { provider: "mollie", id: paymentId },
    });
    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error(`[mollie] nieuwe betaalpoging voor ${order.id} mislukt:`, error);
    return NextResponse.json(
      { error: "De betaling kon niet worden gestart. Probeer het later opnieuw." },
      { status: 502 },
    );
  }
}
