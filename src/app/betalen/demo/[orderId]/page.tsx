import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DemoPayButtons } from "@/components/order/DemoPayButtons";
import { euro } from "@/lib/format";
import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo-betaling",
  robots: { index: false, follow: false },
};

export default async function DemoPaymentPage({
  params,
}: {
  params: { orderId: string };
}) {
  const order = await getOrder(params.orderId);
  if (!order) notFound();
  if (order.status !== "pending_payment") {
    redirect(`/bestelling/${order.id}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card overflow-hidden">
        <div className="bg-ink p-6 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
            Gesimuleerde betaalomgeving
          </p>
          <p className="mt-2 text-3xl font-black">{euro(order.totals.total)}</p>
          <p className="mt-1 text-sm text-white/70">
            De Voordeelmarkt · bestelling {order.id}
          </p>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm text-ink-soft">
            De site draait in <strong className="text-ink">demomodus</strong>{" "}
            (er is geen Mollie API-sleutel ingesteld). Kies hieronder de uitkomst
            van de betaling om de volledige bestelflow te testen.
          </p>
          <DemoPayButtons orderId={order.id} />
          <p className="text-center text-xs text-ink-soft">
            In productie staat hier de echte betaalpagina van Mollie met iDEAL,
            Bancontact, creditcard en Apple Pay.
          </p>
        </div>
      </div>
    </div>
  );
}
