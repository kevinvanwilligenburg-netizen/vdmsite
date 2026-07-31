import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { Mark } from "@/components/Mark";
import { CONTACT_EMAIL } from "@/lib/site";
import { getStores } from "@/lib/tilroy";
import { getVacatures } from "@/lib/vacatures";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Werken bij De Voordeelmarkt — vacatures",
  description:
    "Werken bij De Voordeelmarkt? Bekijk de openstaande vacatures in onze winkels in Nijverdal, Apeldoorn, Deventer, Zutphen en Emmen.",
  alternates: { canonical: "/vacatures" },
};

/**
 * Vacaturepagina; de inhoud komt uit het dashboard-portal, zodat de winkel
 * zelf vacatures kan plaatsen en sluiten zonder dat de site opnieuw hoeft
 * te worden uitgebracht. Winkelvacatures staan óók op de winkelpagina zelf.
 */
export default async function VacaturesPage() {
  const [vacatures, stores] = await Promise.all([getVacatures(), getStores()]);
  const winkelNaam = (slug: string | null) =>
    slug ? stores.find((store) => store.slug === slug)?.city ?? slug : "Alle winkels";

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Vacatures" }]} />

      <header className="flex max-w-3xl items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
            Werken bij De Voordeelmarkt
          </h1>
          <p className="mt-3 text-ink-soft">
            Vijf winkels vol verf, gereedschap en klanten met een klus. Hou je
            van aanpakken en een praatje aan de balie, dan zit je hier goed.
          </p>
        </div>
        <div className="hidden w-32 shrink-0 sm:block">
          <Mark pose="staand" hoogte="h-32" />
        </div>
      </header>

      {vacatures.length === 0 ? (
        <section className="card max-w-3xl p-6">
          <h2 className="font-black text-ink">Nu geen openstaande vacatures</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Maar goede mensen zijn altijd welkom. Stuur een open sollicitatie
            naar{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Open sollicitatie`}
              className="font-semibold text-brand hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            en vertel erbij in welke winkel je zou willen werken.
          </p>
        </section>
      ) : (
        <section className="max-w-3xl space-y-4" aria-label="Openstaande vacatures">
          {vacatures.map((vacature) => (
            <article key={vacature.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-xl font-black text-ink">{vacature.titel}</h2>
                <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand">
                  {winkelNaam(vacature.winkelSlug)}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-soft">
                {[vacature.uren, vacature.salaris].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                {vacature.tekst.split(/\n{2,}/).map((alinea, index) => (
                  <p key={index}>{alinea}</p>
                ))}
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                  `Sollicitatie: ${vacature.titel}`,
                )}`}
                className="btn btn-primary mt-4"
              >
                Solliciteer direct
              </a>
            </article>
          ))}
        </section>
      )}

      <section className="max-w-3xl rounded-2xl bg-brand-light p-6">
        <h2 className="flex items-center gap-2 font-black text-ink">
          <Icon name="store" className="h-5 w-5 text-brand" /> Liever even
          binnenlopen?
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Kom langs in een van onze{" "}
          <Link href="/winkels" className="font-semibold text-brand hover:underline">
            vijf winkels
          </Link>{" "}
          en vraag naar de bedrijfsleider — zo zijn de meeste collega&apos;s hier
          begonnen.
        </p>
      </section>
    </div>
  );
}
