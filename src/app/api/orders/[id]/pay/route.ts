import { NextResponse } from "next/server";

import { createMolliePayment, mollieEnabled } from "@/lib/mollie";
import { getOrder, updateOrder } from "@/lib/orders";
import { baseUrlFromRequest } from "@/lib/site";
import { isFailedStatus, isOpenStatus } from "@/lib/types";

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
  if (!isOpenStatus(order.paymentStatus) && !isFailedStatus(order.paymentStatus)) {
    return NextResponse.json(
      { error: "Deze bestelling is al betaald." },
      { status: 409 },
    );
  }

  if (!mollieEnabled()) {
    await updateOrder(order.id, { paymentStatus: "open" });
    return NextResponse.json({ checkoutUrl: `/betalen/demo/${order.reference}` });
  }

  try {
    const baseUrl = baseUrlFromRequest(request);
    const { paymentId, checkoutUrl } = await createMolliePayment(order, baseUrl);
    await updateOrder(order.id, { paymentStatus: "open", molliePaymentId: paymentId });
    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error(`[mollie] nieuwe betaalpoging voor ${order.reference} mislukt:`, error);
    return NextResponse.json(
      { error: "De betaling kon niet worden gestart. Probeer het later opnieuw." },
      { status: 502 },
    );
  }
}
