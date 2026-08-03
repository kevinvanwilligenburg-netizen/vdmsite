import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { Mark } from "@/components/Mark";
import { OrderClientActions } from "@/components/order/OrderClientActions";
import { ReorderColor, type SavedColor } from "@/components/order/ReorderColor";
import { euros } from "@/lib/format";
import { getOrderSynced } from "@/lib/orders";
import { volgUrl } from "@/lib/verzendmail";
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
  const isDelivery = order.fulfilment === "delivery";

  const shipped = order.paymentStatus === "shipped" || Boolean(order.shipment?.trackTrace);
  const delivered = order.paymentStatus === "delivered";
  const ready = Boolean(order.readyForPickupAt) || shipped;
  const pickedUp = Boolean(order.pickedUpAt) || delivered;

  const steps = isDelivery
    ? ["Besteld", "Betaald", "Onderweg", "Bezorgd"]
    : ["Besteld", "Betaald", "Klaar om af te halen", "Afgehaald"];
  const currentStep = isDelivery
    ? delivered
      ? 3
      : shipped
        ? 2
        : paid
          ? 1
          : 0
    : pickedUp
      ? 3
      : ready
        ? 2
        : paid
          ? 1
          : 0;

  const expectedDelivery = order.delivery?.expectedDate
    ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "full" }).format(
        new Date(order.delivery.expectedDate),
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="text-center">
        {paid ? (
          <>
            <span className="inline-flex text-green-600" aria-hidden>
              <Icon name="circle-check" className="h-14 w-14" strokeWidth={1.5} />
            </span>
            <h1 className="mt-2 text-3xl font-black text-ink">Bedankt voor je bestelling!</h1>
            <p className="mt-2 text-ink-soft">
              Je betaling is gelukt.{" "}
              {isDelivery
                ? "We pakken je bestelling in en DHL bezorgt hem bij je thuis."
                : "We zetten alles voor je klaar in de winkel."}{" "}
              Je krijgt bericht op{" "}
              <strong className="text-ink">{order.customer.email}</strong>.
            </p>
            <div className="mx-auto mt-4 w-44">
              <Mark pose="mengen" hoogte="h-28" />
            </div>
          </>
        ) : open ? (
          <>
            <span className="inline-flex text-brand" aria-hidden>
              <Icon name="clock" className="h-14 w-14" strokeWidth={1.5} />
            </span>
            <h1 className="mt-2 text-3xl font-black text-ink">We wachten op je betaling…</h1>
            <p className="mt-2 text-ink-soft">
              Heb je net betaald? Deze pagina wordt automatisch bijgewerkt.
            </p>
          </>
        ) : failed ? (
          <>
            <span className="inline-flex text-brand-dark" aria-hidden>
              <Icon name="circle-x" className="h-14 w-14" strokeWidth={1.5} />
            </span>
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
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    reached ? "bg-brand text-white" : "bg-ink/10 text-ink-soft"
                  }`}
                >
                  {reached ? (
                    <Icon name="check" className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <span className="text-sm font-black">{index + 1}</span>
                  )}
                </span>
                <span className={reached ? "text-ink" : "text-ink-soft"}>{label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Afhaal- of bezorginfo */}
      {paid && !isDelivery && order.store && (
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
                kassa en noem je afhaalcode. Betalen hoeft niet meer, dat is al
                gebeurd.
              </p>
            </div>
          </div>
        </section>
      )}

      {paid && isDelivery && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-center gap-3 bg-brand p-6 text-white">
            <Icon name="truck" className="h-8 w-8" aria-hidden />
            <p className="text-xl font-black">
              {order.delivery?.type === "same-day"
                ? "Wordt vandaag bezorgd"
                : order.delivery?.type === "next-day"
                  ? "Wordt morgen bezorgd"
                  : "Wordt binnen 1 werkdag bezorgd"}
            </p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <h2 className="font-black text-ink">Bezorgadres</h2>
              <p className="mt-1 text-ink-soft">
                {[
                  order.customer.street,
                  order.customer.houseNumber,
                  order.customer.houseNumberSuffix,
                ]
                  .filter(Boolean)
                  .join(" ")}
                <br />
                {order.customer.postalCode} {order.customer.city}
              </p>
              {expectedDelivery && (
                <p className="mt-2 text-sm font-semibold text-ink">
                  Verwacht: {expectedDelivery}
                </p>
              )}
            </div>
            <div>
              <h2 className="font-black text-ink">
                Track &amp; trace{" "}
                {order.delivery?.carrier && (
                  <span className="font-semibold text-ink-soft">
                    ({order.delivery.carrier === "dhl" ? "DHL" : "PostNL"})
                  </span>
                )}
              </h2>
              {order.shipment?.trackTrace ? (
                // Het dashboard stuurt meestal een kale barcode. Daar zelf een
                // volglink van maken scheelt de klant het knippen en plakken
                // op de site van de vervoerder.
                (() => {
                  const link = volgUrl(
                    order.delivery?.carrier,
                    order.shipment.trackTrace,
                    order.customer.postalCode,
                  );
                  return link ? (
                    <>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-2 font-bold text-brand hover:underline"
                      >
                        <Icon name="truck" className="h-4 w-4" /> Volg je pakket
                      </a>
                      <p className="mt-0.5 font-mono text-xs text-ink-soft">
                        {order.shipment.trackTrace}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 font-mono text-sm font-semibold text-ink">
                      {order.shipment.trackTrace}
                    </p>
                  );
                })()
              ) : (
                <p className="mt-1 text-sm text-ink-soft">
                  Je ontvangt de track &amp; trace-code per e-mail zodra DHL je
                  pakket heeft opgehaald.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* De verdiende staal-voucher: code groot in beeld, want de mail kan in
          de spam belanden en dit is de pagina die de klant nu voor zich heeft. */}
      {paid && order.staalVoucher && (
        <section className="card overflow-hidden">
          <div className="bg-ink p-6 text-center text-white">
            <p className="text-sm font-bold uppercase tracking-wide text-white/70">
              Jouw kleurvoucher · t.w.v. {euros(order.staalVoucher.bedrag)}
            </p>
            <p className="mt-1 text-3xl font-black tracking-[0.15em]">
              {order.staalVoucher.code}
            </p>
          </div>
          <div className="p-6 text-sm text-ink-soft">
            <p>
              Test je kleur rustig uit. Bestel je daarna de echte verf bij ons,
              vul dan deze code in bij het afrekenen, het testerbedrag gaat er
              direct af. We hebben de code ook gemaild naar{" "}
              <strong className="text-ink">{order.customer.email}</strong>.
            </p>
          </div>
        </section>
      )}

      {/* Gemengde kleuren bewaren voor bijbestellen */}
      {paid && (
        <ReorderColor
          colors={order.items
            .filter((item) => item.color)
            .map<SavedColor>((item) => ({
              key: item.color?.key,
              code: item.color?.code ?? "",
              name: item.color?.name ?? "",
              hex: item.color?.hex ?? "#CCCCCC",
              productSlug: item.slug ?? "",
              productName: item.title,
              orderedAt: order.createdAt,
              reference: order.reference,
            }))
            .filter((color) => color.productSlug)}
        />
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
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `linear-gradient(135deg, hsl(${item.hue ?? 25} 85% 94%), hsl(${item.hue ?? 25} 70% 86%))`,
                  color: `hsl(${item.hue ?? 25} 45% 38%)`,
                }}
                aria-hidden
              >
                <Icon name={item.icon ?? "box"} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{item.title}</p>
                <p className="text-sm text-ink-soft">
                  {item.quantity} stuks
                  {item.variantLabel && ` · ${item.variantLabel}`}
                </p>
                {/* Kleurcode én waaier voluit: daarmee mengt de winkel aan, en
                    de klant kan later dezelfde kleur bijbestellen. Alleen een
                    staaltje zegt niets — schermkleuren wijken af. */}
                {item.color && (
                  <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-ink/5 px-2 py-1 text-sm">
                    <span
                      className="inline-block h-4 w-4 shrink-0 rounded-sm ring-1 ring-black/10"
                      style={{ backgroundColor: item.color.hex }}
                      aria-hidden
                    />
                    <span className="font-bold text-ink">
                      {[item.color.code, item.color.name].filter(Boolean).join(" ")}
                    </span>
                    {item.color.collection && (
                      <span className="text-ink-soft">uit {item.color.collection}</span>
                    )}
                  </p>
                )}
              </div>
              <p className="font-black text-ink">{euros(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
          {order.voucherKorting ? (
            <div className="flex justify-between">
              <dt className="font-semibold text-green-700">
                Staal-voucher{order.voucherCode ? ` (${order.voucherCode})` : ""}
              </dt>
              <dd className="font-bold text-green-700">− {euros(order.voucherKorting)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              {isDelivery ? "Bezorging (DHL)" : "Afhalen in de winkel"}
            </dt>
            <dd className="font-bold text-green-700">
              {order.shipping > 0 ? euros(order.shipping) : "Gratis"}
            </dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">{euros(order.total)}</dd>
          </div>
        </dl>
      </section>

      {paid && (
        <p className="text-center">
          <Link
            href={`/bestelling/${order.reference}/factuur`}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-ink/10 px-4 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
          >
            <Icon name="mail" className="h-4 w-4" /> Bekijk je factuur
          </Link>
        </p>
      )}

      <p className="text-center text-sm text-ink-soft">
        Bewaar deze pagina of noteer je bestelnummer: <strong>{order.reference}</strong>
      </p>
    </div>
  );
}
