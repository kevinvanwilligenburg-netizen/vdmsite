import type { Metadata } from "next";
import { GRATIS_VANAF_TEKST, tariefTekst } from "@/lib/shipping";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { getStores } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Bezorgen & afhalen – gratis vanaf ${GRATIS_VANAF_TEKST}`,
  description:
    `Vanaf ${GRATIS_VANAF_TEKST} bezorgen we gratis. Bestel je vóór 09:00, dan kun je kiezen voor bezorging vandaag nog voor € 1,25. Afhalen is altijd gratis in onze 5 winkels.`,
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
          Afhalen is altijd gratis, bezorgen vanaf {GRATIS_VANAF_TEKST}. Jij kiest wat het beste
          uitkomt.
        </p>
      </header>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 bg-brand p-5 text-white">
          <Icon name="truck" className="h-7 w-7 shrink-0" aria-hidden />
          <h2 className="text-lg font-black">Bezorgen — gratis vanaf {GRATIS_VANAF_TEKST}</h2>
        </div>
        <div className="space-y-3 p-6 text-ink-soft">
          <p className="text-lg font-bold text-ink">
            Morgen in huis, of vandaag nog als je vóór 09:00 bestelt.
          </p>
          <p>
            Onze webshopvoorraad ligt in Nijverdal. Ligt jouw artikel daar, dan
            gaat het met DHL de deur uit en heb je het de volgende dag in huis.
            Bestel je vóór 09:00, dan kun je bij het afrekenen kiezen voor
            bezorging vandaag nog, tegen een toeslag van € 1,25.
          </p>
          <p>
            Ligt het artikel in een van onze andere winkels, dan verstuurt die
            winkel het met PostNL en heb je het binnen één werkdag in huis.
            Bezorging vandaag is dan niet mogelijk.
          </p>
          <table className="w-full text-sm">
            <caption className="mb-2 text-left font-bold text-ink">Verzendkosten</caption>
            <tbody>
              <tr className="border-t border-ink/10">
                <th scope="row" className="py-2 text-left font-semibold text-ink">
                  Nederland
                </th>
                <td className="py-2 text-right">
                  Gratis vanaf {GRATIS_VANAF_TEKST}, daaronder {tariefTekst("NL")}
                </td>
              </tr>
              <tr className="border-t border-ink/10">
                <th scope="row" className="py-2 text-left font-semibold text-ink">
                  België
                </th>
                <td className="py-2 text-right">
                  Gratis vanaf {GRATIS_VANAF_TEKST}, daaronder {tariefTekst("BE")}
                </td>
              </tr>
              <tr className="border-t border-ink/10">
                <th scope="row" className="py-2 text-left font-semibold text-ink">
                  Vandaag bezorgd
                </th>
                <td className="py-2 text-right">
                  € 1,25 — bij bestellingen vóór 09:00
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Op elke productpagina staat welke levertijd voor dat artikel geldt.
            Je ontvangt een track &amp; trace-code zodra je pakket onderweg is.
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
