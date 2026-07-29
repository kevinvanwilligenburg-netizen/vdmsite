import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintKnop } from "@/components/order/PrintKnop";
import { euros } from "@/lib/format";
import { BTW_TARIEF, maakFactuur } from "@/lib/factuur";
import { getOrder } from "@/lib/orders";
import { BEDRIJF } from "@/lib/site";
import { isPaidStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Factuur",
  robots: { index: false, follow: false },
};

const datum = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { dateStyle: "long" }).format(new Date(iso));

/**
 * Factuur bij een bestelling, om te bekijken en af te drukken (of via de
 * printdialoog op te slaan als pdf).
 *
 * Bewust geen pdf-generator in de bundel: die kost megabytes en een eigen
 * lettertype-afhandeling, terwijl elke browser al een nette pdf maakt van een
 * pagina die op printen is ingericht. Vandaar de print-klassen hieronder.
 */
export default async function FactuurPage({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id);
  if (!order) notFound();

  // Een factuur hoort bij een betaalde bestelling. Bij een openstaande of
  // mislukte betaling zou er een factuur rondgaan voor geld dat nooit is
  // ontvangen.
  if (!isPaidStatus(order.paymentStatus)) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-2xl font-black text-ink">Nog geen factuur</h1>
        <p className="mt-2 text-ink-soft">
          Zodra je betaling binnen is, staat de factuur hier klaar.
        </p>
        <Link href={`/bestelling/${order.reference}`} className="btn btn-primary mt-6">
          Terug naar je bestelling
        </Link>
      </div>
    );
  }

  const factuur = maakFactuur(order);
  const klantregels = [
    [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" "),
    [order.customer.street, order.customer.houseNumber, order.customer.houseNumberSuffix]
      .filter(Boolean)
      .join(" "),
    [order.customer.postalCode, order.customer.city].filter(Boolean).join(" "),
    order.customer.country === "BE" ? "België" : undefined,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/bestelling/${order.reference}`}
          className="text-sm font-bold text-brand hover:underline"
        >
          ← Terug naar je bestelling
        </Link>
        {/* Printen doet de browser; die maakt er desgewenst een pdf van. */}
        <PrintKnop />
      </div>

      <article className="card p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black uppercase text-ink">Factuur</h1>
            <dl className="mt-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-ink-soft">Factuurnummer</dt>
                <dd className="font-bold text-ink">{factuur.nummer}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-soft">Factuurdatum</dt>
                <dd className="font-semibold text-ink">{datum(factuur.datum)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-soft">Bestelnummer</dt>
                <dd className="font-semibold text-ink">{order.reference}</dd>
              </div>
            </dl>
          </div>
          <div className="text-sm leading-relaxed">
            <p className="font-black text-ink">{BEDRIJF.naam}</p>
            <p className="text-ink-soft">
              {BEDRIJF.adres}
              <br />
              {BEDRIJF.postcode} {BEDRIJF.plaats}
              <br />
              KvK {BEDRIJF.kvk}
              <br />
              Btw {BEDRIJF.btw}
            </p>
          </div>
        </header>

        <section className="mt-8">
          <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
            Factuuradres
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            {klantregels.map((regel) => (
              <span key={regel} className="block">
                {regel}
              </span>
            ))}
            <span className="block text-ink-soft">{order.customer.email}</span>
          </p>
        </section>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b-2 border-ink/10 text-left">
                <th className="py-2 font-black text-ink">Omschrijving</th>
                <th className="py-2 text-right font-black text-ink">Aantal</th>
                <th className="py-2 text-right font-black text-ink">Stuk excl.</th>
                <th className="py-2 text-right font-black text-ink">Totaal excl.</th>
              </tr>
            </thead>
            <tbody>
              {factuur.regels.map((regel, index) => (
                <tr key={`${regel.omschrijving}-${index}`} className="border-b border-ink/5">
                  <td className="py-2 pr-3">
                    <span className="font-semibold text-ink">{regel.omschrijving}</span>
                    {regel.toelichting && (
                      <span className="block text-xs text-ink-soft">{regel.toelichting}</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink">{regel.aantal}</td>
                  <td className="py-2 text-right tabular-nums text-ink">
                    {euros(regel.stukprijsExcl)}
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold text-ink">
                    {euros(regel.totaalExcl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotaal excl. btw</dt>
            <dd className="tabular-nums font-semibold text-ink">
              {euros(factuur.subtotaalExcl)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Btw {Math.round(BTW_TARIEF * 100)}%</dt>
            <dd className="tabular-nums font-semibold text-ink">{euros(factuur.btw)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink/10 pt-2 text-base">
            <dt className="font-black text-ink">Totaal incl. btw</dt>
            <dd className="tabular-nums font-black text-ink">{euros(factuur.totaalIncl)}</dd>
          </div>
        </dl>

        <footer className="mt-8 border-t border-ink/10 pt-4 text-xs leading-relaxed text-ink-soft">
          <p>
            Voldaan via {order.paymentMethod ? betaalnaam(order.paymentMethod) : "de webshop"}
            {factuur.kluspasNummer && ` · Kluspas ${factuur.kluspasNummer}`}
            {order.fulfilment === "pickup" && order.store
              ? ` · afgehaald in ${order.store.city}`
              : ""}
            . Dit bedrag is al betaald; je hoeft niets meer over te maken.
          </p>
          <p className="mt-1">
            {BEDRIJF.naam} · {BEDRIJF.adres}, {BEDRIJF.postcode} {BEDRIJF.plaats} · KvK{" "}
            {BEDRIJF.kvk} · Btw {BEDRIJF.btw}
          </p>
        </footer>
      </article>
    </div>
  );
}

function betaalnaam(methode: string): string {
  const namen: Record<string, string> = {
    ideal: "iDEAL",
    bancontact: "Bancontact",
    creditcard: "creditcard",
    applepay: "Apple Pay",
    klarna: "Klarna",
    paypal: "PayPal",
  };
  return namen[methode.toLowerCase()] ?? methode;
}
