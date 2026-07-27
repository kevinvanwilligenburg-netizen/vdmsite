import { getMolliePayment } from "@/lib/mollie";
import { applyPaymentResult, getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Mollie webhook: ontvangt een payment-id, haalt de status bij Mollie op en
 * werkt de bijbehorende bestelling bij. Antwoordt altijd 200 zodat Mollie
 * niet onnodig blijft herhalen; fouten worden gelogd.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const paymentId = form.get("id");
    if (typeof paymentId !== "string" || paymentId.length === 0) {
      return new Response("ok");
    }

    const payment = await getMolliePayment(paymentId);
    const orderId = payment.metadata?.orderId;
    if (!orderId) return new Response("ok");

    const order = await getOrder(orderId);
    if (!order) return new Response("ok");

    if (payment.status === "paid") {
      await applyPaymentResult(order, "paid", {
        provider: "mollie",
        id: payment.id,
        method: payment.method ?? undefined,
        paidAt: payment.paidAt ?? undefined,
      });
    } else if (["failed", "canceled", "expired"].includes(payment.status)) {
      await applyPaymentResult(order, "failed", { provider: "mollie", id: payment.id });
    }
  } catch (error) {
    console.error("[mollie] webhook verwerken mislukt:", error);
  }
  return new Response("ok");
}
