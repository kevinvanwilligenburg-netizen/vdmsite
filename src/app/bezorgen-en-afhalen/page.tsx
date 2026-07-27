import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { getStores } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Bezorgen & afhalen – gratis, vaak dezelfde dag",
  description:
    "Vóór 10:00 besteld? Dan bezorgt DHL je bestelling vandaag nog. Daarna besteld is morgen in huis. Afhalen kan gratis in onze 5 winkels.",
  alternates: { canonical: "/bezorgen-en-afhalen" },
};

export default async function ShippingPage() {
  const stores = await getStores();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Breadcrumbs
        items={[{ name: "Home", href: "/" }, { name: "Bezorgen & afhalen" }]}
      />
      <header>
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          Bezorgen &amp; afhalen
        </h1>
        <p className="mt-3 text-ink-soft">
          Allebei gratis. Jij kiest wat het beste uitkomt.
        </p>
      </header>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 bg-brand p-5 text-white">
          <Icon name="truck" className="h-7 w-7 shrink-0" aria-hidden />
          <h2 className="text-lg font-black">Bezorgen met DHL — gratis</h2>
        </div>
        <div className="space-y-3 p-6 text-ink-soft">
          <p className="text-lg font-bold text-ink">
            Vóór 10:00 besteld? Vandaag bezorgd.
          </p>
          <p>
            Bestel je tussen 10:00 en 23:59 uur, dan bezorgt DHL je bestelling
            de volgende dag. Je ontvangt een track &amp; trace-code per e-mail
            zodra je pakket onderweg is, zodat je precies weet waar het blijft.
          </p>
          <p>
            Bezorgen is altijd gratis, ongeacht het bedrag. We bezorgen binnen
            Nederland.
          </p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 bg-ink p-5 text-white">
          <Icon name="store" className="h-7 w-7 shrink-0" aria-hidden />
          <h2 className="text-lg font-black">Afhalen in de winkel — gratis</h2>
        </div>
        <div className="space-y-3 p-6 text-ink-soft">
          <p>
            Kies bij het afrekenen je winkel. Je krijgt bericht zodra je
            bestelling klaarstaat — vaak dezelfde dag nog. Meld je bij de kassa
            met je afhaalcode; betalen is dan al gebeurd.
          </p>
          <p>
            Handig bij verf: we mengen je kleur klaar terwijl jij onderweg bent.
            Bestellingen bewaren we 14 dagen voor je.
          </p>
          <ul className="flex flex-wrap gap-2 pt-1">
            {stores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/winkels/${store.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-sm font-bold text-ink transition hover:text-brand"
                >
                  <Icon name="pin" className="h-4 w-4 text-brand" /> {store.city}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-black text-ink">Retourneren</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Je hebt 14 dagen bedenktijd. Ongebruikte producten kun je gratis
          terugbrengen naar elke winkel; neem je bestelnummer mee. Op kleur
          gemengde verf is maatwerk en kan niet retour. De volledige regels
          staan in de{" "}
          <Link href="/algemene-voorwaarden" className="font-semibold text-brand hover:underline">
            algemene voorwaarden
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
