import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SESSIE_COOKIE, emailVanSessie } from "@/lib/account";
import { euros } from "@/lib/format";
import { factuurNummer, maakFactuur } from "@/lib/factuur";
import { getOrdersByEmail } from "@/lib/orders";
import { PRIJS_COOKIE, prijsModusUit } from "@/lib/prijs";
import { isOpenStatus, isPaidStatus } from "@/lib/types";

import { AccountNav } from "../_onderdelen/AccountNav";
import { btwLabel, toonEuros } from "../_onderdelen/bedrag";
import { datumLang, statusTekst } from "../_onderdelen/opmaak";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Je facturen",
  robots: { index: false, follow: false },
};

/**
 * Alle facturen op één plek.
 *
 * De bedragen komen uit dezelfde factuurmodule als de factuur zelf
 * (lib/factuur.ts). Zou dit overzicht zelf gaan rekenen, dan staat er vroeg of
 * laat een cent verschil tussen deze lijst en het papier in de boekhouding —
 * precies het soort verschil waar een boekhouder over belt.
 */
export default async function FacturenPage() {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  if (!email) redirect("/account?verder=/account/facturen");

  const modus = prijsModusUit(cookies().get(PRIJS_COOKIE)?.value);
  const orders = await getOrdersByEmail(email, 50);

  const facturen = orders.filter((order) => isPaidStatus(order.paymentStatus)).map((order) => {
    const factuur = maakFactuur(order);
    return {
      reference: order.reference,
      nummer: factuurNummer(order),
      datum: factuur.datum,
      // Op de factuur staat het totaal inclusief en het subtotaal exclusief;
      // we tonen precies die bedragen, niet een eigen herberekening.
      bedrag: modus === "excl" ? factuur.subtotaalExcl : factuur.totaalIncl,
      terugbetaald: order.refundedAmount ?? 0,
    };
  });

  const openstaand = orders.filter((order) => isOpenStatus(order.paymentStatus));
  const terugbetaald = orders.filter((order) => order.paymentStatus === "refunded");

  const totaal = facturen.reduce((som, factuur) => som + factuur.bedrag, 0);
  const openBedrag = openstaand.reduce((som, order) => som + order.total, 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Mijn Voordeelmarkt", href: "/account" },
          { name: "Facturen" },
        ]}
      />

      <header>
        <h1 className="text-3xl font-black uppercase text-ink">Je facturen</h1>
        <p className="mt-2 text-ink-soft">
          Van elke betaalde webshopbestelling. Bedragen {btwLabel(modus)}.
        </p>
      </header>

      <AccountNav actief="/account/facturen" />

      {facturen.length === 0 && openstaand.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-black text-ink">Nog geen facturen</p>
          <p className="mt-1 text-sm text-ink-soft">
            Zodra een bestelling betaald is, staat de factuur hier klaar. Kocht je in
            de winkel, dan is je kassabon de bon.
          </p>
          <Link href="/" className="btn btn-primary mt-4">
            Naar de winkel
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                Totaal van deze facturen
              </p>
              <p className="mt-1 text-3xl font-black text-ink">{euros(totaal)}</p>
              <p className="text-xs text-ink-soft">
                {facturen.length === 1 ? "1 factuur" : `${facturen.length} facturen`} ·{" "}
                {btwLabel(modus)}
              </p>
            </div>

            <div className="card p-5">
              <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                Nog te betalen
              </p>
              <p className="mt-1 text-3xl font-black text-ink">
                {toonEuros(openBedrag, modus)}
              </p>
              <p className="text-xs text-ink-soft">
                {openstaand.length === 0
                  ? "Je hebt niets openstaan."
                  : `${openstaand.length === 1 ? "1 bestelling wacht" : `${openstaand.length} bestellingen wachten`} nog op betaling.`}
              </p>
            </div>
          </div>

          {facturen.length > 0 && (
            <section aria-labelledby="factuurlijst" className="card overflow-hidden">
              <h2 id="factuurlijst" className="px-5 pt-5 text-xl font-black uppercase text-ink">
                Facturen
              </h2>
              <ul className="mt-3 divide-y divide-ink/10">
                {facturen.map((factuur) => (
                  <li
                    key={factuur.nummer}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{factuur.nummer}</p>
                      <p className="text-sm text-ink-soft">
                        {datumLang(factuur.datum)} · bestelling {factuur.reference}
                        {factuur.terugbetaald > 0 && (
                          <> · {euros(factuur.terugbetaald)} terugbetaald</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span className="font-black text-ink">{euros(factuur.bedrag)}</span>
                      <Link
                        href={`/bestelling/${factuur.reference}/factuur`}
                        className="text-sm font-bold text-brand hover:underline"
                      >
                        Bekijken →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="px-5 pb-5 pt-3 text-xs text-ink-soft">
                Een factuur open je als pagina; met de printknop maakt je browser er een
                pdf van.
              </p>
            </section>
          )}

          {openstaand.length > 0 && (
            <section aria-labelledby="openstaand" className="card overflow-hidden">
              <h2 id="openstaand" className="px-5 pt-5 text-xl font-black uppercase text-ink">
                Nog te betalen
              </h2>
              <ul className="mt-3 divide-y divide-ink/10">
                {openstaand.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink">Bestelling {order.reference}</p>
                      <p className="text-sm text-ink-soft">
                        {datumLang(order.createdAt)} · {statusTekst(order.paymentStatus)}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span className="font-black text-ink">
                        {toonEuros(order.total, modus)}
                      </span>
                      <Link
                        href={`/bestelling/${order.reference}`}
                        className="text-sm font-bold text-brand hover:underline"
                      >
                        Afronden →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              {/* Een factuur hoort bij geld dat binnen is; daarom staan deze
                  bestellingen apart en niet in de lijst hierboven. */}
              <p className="px-5 pb-5 pt-3 text-xs text-ink-soft">
                Zolang een bestelling niet betaald is, maken we er geen factuur van.
              </p>
            </section>
          )}

          {terugbetaald.length > 0 && (
            <section aria-labelledby="terugbetaald" className="card overflow-hidden">
              <h2 id="terugbetaald" className="px-5 pt-5 text-xl font-black uppercase text-ink">
                Terugbetaald
              </h2>
              <ul className="mt-3 divide-y divide-ink/10">
                {terugbetaald.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink">Bestelling {order.reference}</p>
                      <p className="text-sm text-ink-soft">{datumLang(order.createdAt)}</p>
                    </div>
                    <span className="font-black text-ink">
                      {toonEuros(order.refundedAmount ?? order.total, modus)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="px-5 pb-5 pt-3 text-xs text-ink-soft">
                Een terugbetaling loopt terug via de betaalmethode die je koos; we houden
                er geen tegoed voor aan.
              </p>
            </section>
          )}

          <p className="text-sm text-ink-soft">
            Je kluspunten staan bij je aankopen op{" "}
            <Link href="/account" className="font-bold text-brand hover:underline">
              je overzicht
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
