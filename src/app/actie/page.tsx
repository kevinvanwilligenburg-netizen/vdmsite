import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getLopendeActies } from "@/lib/actiepagina";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acties en aanbiedingen",
  description:
    "Alle lopende acties van De Voordeelmarkt op een rij: korting op verf, ijzerwaren en gereedschap.",
  alternates: { canonical: "/actie" },
};

/**
 * Overzicht van de lopende acties.
 *
 * Staat er niets klaar, dan sturen we niet door naar een lege pagina maar
 * wijzen we naar de topdeals — daar staat altijd iets.
 */
export default async function ActieOverzicht() {
  const acties = await getLopendeActies();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Acties" }]} />
      <h1 className="mt-6 text-3xl font-black uppercase text-ink sm:text-4xl">Acties</h1>

      {acties.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-ink-soft">
            Er loopt op dit moment geen actiepagina. In onze{" "}
            <Link href="/#topdeals" className="font-bold text-brand hover:underline">
              topdeals
            </Link>{" "}
            staan wel altijd artikelen met voordeel.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {acties.map((actie) => (
            <li key={actie.slug}>
              <Link
                href={`/actie/${actie.slug}`}
                className="card block h-full p-5 transition hover:border-brand"
              >
                <h2 className="font-black text-ink">{actie.titel}</h2>
                {actie.intro && <p className="mt-1 text-sm text-ink-soft">{actie.intro}</p>}
                {actie.tot && (
                  <p className="mt-3 text-xs font-bold text-brand-dark">
                    Tot en met{" "}
                    {new Date(actie.tot).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
