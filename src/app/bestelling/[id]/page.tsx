import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderClientActions } from "@/components/order/OrderClientActions";
import { euros } from "@/lib/format";
import { getOrderSynced } from "@/lib/orders";
import { isFailedStatus, isOpenStatus, isPaidStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jouw bestelling",
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: { id: string } }) {
  const order = await getOrderSynced(params.id);
  if (!order) notFound();

  const paid = isPaidStatus(order.paymentStatus);
  const open = isOpenStatus(order.paymentStatus);
  const failed = isFailedStatus(order.paymentStatus);

  const ready = Boolean(order.readyForPickupAt) || order.paymentStatus === "shipped";
  const pickedUp = Boolean(order.pickedUpAt) || order.paymentStatus === "delivered";
  const currentStep = pickedUp ? 3 : ready ? 2 : paid ? 1 : 0;
  const steps = ["Besteld", "Betaald", "Klaar om af te halen", "Afgehaald"];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="text-center">
        {paid ? (
          <>
            <p className="text-5xl" aria-hidden>
              🎉
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">Bedankt voor je bestelling!</h1>
            <p className="mt-2 text-ink-soft">
              Je betaling is gelukt. We zetten alles voor je klaar en je krijgt
              bericht op <strong className="text-ink">{order.customer.email}</strong>{" "}
              zodra je bestelling klaarligt.
            </p>
          </>
        ) : open ? (
          <>
            <p className="text-5xl" aria-hidden>
              ⏳
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">We wachten op je betaling…</h1>
            <p className="mt-2 text-ink-soft">
              Heb je net betaald? Deze pagina wordt automatisch bijgewerkt.
            </p>
          </>
        ) : failed ? (
          <>
            <p className="text-5xl" aria-hidden>
              😕
            </p>
            <h1 className="mt-2 text-3xl font-black text-ink">De betaling is niet gelukt</h1>
            <p className="mt-2 text-ink-soft">
              Er is niets afgeschreven. Probeer het gerust nog een keer.
            </p>
          </>
        ) : (
          <h1 className="text-3xl font-black text-ink">Bestelling {order.reference}</h1>
        )}
      </header>

      <div className="flex justify-center">
        <OrderClientActions reference={order.reference} status={order.paymentStatus} />
      </div>

      {/* Statusbalk */}
      {!failed && (
        <ol className="card flex items-center justify-between gap-2 p-5 text-center text-xs font-bold sm:text-sm">
          {steps.map((label, index) => {
            const reached = index <= currentStep;
            return (
              <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  aria-hidden
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                    reached ? "bg-brand text-white" : "bg-ink/10 text-ink-soft"
                  }`}
                >
                  {reached ? "✓" : index + 1}
                </span>
                <span className={reached ? "text-ink" : "text-ink-soft"}>{label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Afhaalinfo */}
      {paid && (
        <section className="card overflow-hidden">
          <div className="bg-brand p-6 text-center text-white">
            <p className="text-sm font-bold uppercase tracking-wide text-white/80">
              Jouw afhaalcode
            </p>
            <p className="mt-1 text-4xl font-black tracking-[0.3em]">
              {order.pickupCode}
            </p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <h2 className="font-black text-ink">Afhalen bij</h2>
              <p className="mt-1 text-ink-soft">
                {order.store.name}
                <br />
                {order.store.city}
              </p>
            </div>
            <div>
              <h2 className="font-black text-ink">Zo werkt het</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Wacht op het bericht dat je bestelling klaarligt, kom naar de
                kassa en noem je afhaalcode. Betalen hoeft niet meer — dat is al
                gebeurd.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Besteloverzicht */}
      <section className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-black text-ink">Bestelling {order.reference}</h2>
          <p className="text-sm text-ink-soft">
            Geplaatst op{" "}
            {new Intl.DateTimeFormat("nl-NL", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(order.createdAt))}
          </p>
        </div>
        <ul className="mt-4 divide-y divide-ink/5">
          {order.items.map((item) => (
            <li key={item.key} className="flex items-center gap-4 py-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl"
                style={{
                  background: `linear-gradient(135deg, hsl(${item.hue ?? 25} 85% 94%), hsl(${item.hue ?? 25} 70% 86%))`,
                }}
                aria-hidden
              >
                {item.icon ?? "🛒"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{item.title}</p>
                <p className="text-sm text-ink-soft">
                  {item.quantity} stuks
                  {item.variantLabel && ` · ${item.variantLabel}`}
                  {item.color && (
                    <span className="ml-1 inline-flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-3 rounded-sm ring-1 ring-black/10"
                        style={{ backgroundColor: item.color.hex }}
                        aria-hidden
                      />
                    </span>
                  )}
                </p>
              </div>
              <p className="font-black text-ink">{euros(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Afhalen in de winkel</dt>
            <dd className="font-bold text-green-700">Gratis</dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">{euros(order.total)}</dd>
          </div>
        </dl>
      </section>

      <p className="text-center text-sm text-ink-soft">
        Bewaar deze pagina of noteer je bestelnummer: <strong>{order.reference}</strong>
      </p>
    </div>
  );
}
