import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { ProductFiltersPanel } from "@/components/plp/ProductFilters";
import { ProductCard } from "@/components/ProductCard";
import { SearchTracker } from "@/components/search/SearchTracker";
import {
  activeFilterCount,
  applyFilters,
  buildFacets,
  parseFilters,
  snelfilterAantallen,
} from "@/lib/facets";
import { klusIntentie } from "@/lib/klus-intentie";
import { Mark } from "@/components/Mark";
import { getCategories, searchProducts } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Zoeken in ons assortiment",
  description:
    "Zoek in het assortiment van De Voordeelmarkt: verf, mengverf, gereedschap, elektra, tuin en huishouden.",
  robots: { index: false, follow: true },
};

const POPULAR = ["muurverf", "mengverf", "lak", "kwast", "kit", "schroeven"];

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q;
  const query = (Array.isArray(q) ? q[0] : q ?? "").trim();
  const categories = await getCategories();

  if (!query) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Zoeken" }]} />
        <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">Zoeken</h1>
        <p className="text-ink-soft">
          Typ hierboven een zoekterm, of kies een populaire zoekopdracht:
        </p>
        <ul className="flex flex-wrap gap-2">
          {POPULAR.map((term) => (
            <li key={term}>
              <Link
                href={`/zoeken?q=${encodeURIComponent(term)}`}
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:text-brand"
              >
                {term}
              </Link>
            </li>
          ))}
        </ul>
        <div>
          <h2 className="mb-3 font-black text-ink">Of shop per categorie</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/categorie/${entry.slug}`}
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:text-brand"
                >
                  {entry.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const klus = klusIntentie(query);
  const eigenResultaten = await searchProducts(query, { limit: 500 });

  // Een klusomschrijving staat in geen enkele productnaam. Herkennen we de
  // klus, dan tonen we het assortiment dat erbij hoort in plaats van een
  // lege pagina met "niets gevonden".
  const viaKlus = eigenResultaten.total === 0 && klus;
  const results = viaKlus
    ? await searchProducts(klus.zoekterm, { limit: 500 })
    : eigenResultaten;
  const filters = parseFilters(searchParams);
  const gefilterd = applyFilters(results.all, filters);

  // Hoeveel houdt elk snelfilter over? Een filter dat niets wegneemt (of
  // alles) hoort niet in de kolom te staan — zie ProductFiltersPanel.
  const snelfilters = snelfilterAantallen(results.all, filters);
  const facets = buildFacets(results.all, filters);
  const actief = activeFilterCount(filters);
  const zichtbaar = gefilterd.slice(0, 48);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Zoeken" }]} />
      {/* Legt vast wat er gezocht is (en of er iets gevonden werd), zodat we
          het assortiment en de synoniemen kunnen bijsturen. */}
      <SearchTracker query={query} results={results.total} />

      <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">
        Zoekresultaten voor “{query}”
      </h1>

      {/* Beschrijft de zoekopdracht een klus, dan is een lijst artikelen niet
          het antwoord dat de klant zoekt — die wil weten wát hij nodig heeft. */}
      {klus && (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-brand/20 bg-brand-light p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Icon name="bulb" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-black uppercase text-ink">{klus.titel}?</h2>
            <p className="text-sm text-ink-soft">
              {viaKlus
                ? `We tonen hieronder ${klus.assortimentLabel}. Wil je weten hoeveel je nodig hebt? Laat het ons uitrekenen.`
                : "Vertel wat je gaat doen en wij rekenen uit hoeveel verf je nodig hebt, of er grondverf bij moet en welk gereedschap erbij hoort."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={klus.adviesHref} className="btn btn-primary py-2 text-sm">
              Bereken mijn klus →
            </Link>
            <Link
              href={klus.assortimentHref}
              className="btn border-2 border-ink/10 bg-white py-2 text-sm text-ink hover:border-brand hover:text-brand"
            >
              Alle {klus.assortimentLabel}
            </Link>
          </div>
        </section>
      )}

      {results.total === 0 ? (
        <div className="card overflow-hidden">
          {/* Een leeg zoekresultaat is een doodlopende pagina. Mark maakt er
              iets van waar iemand achter staat, in plaats van een kale melding. */}
          <Mark pose="vragend" hoogte="h-40" className="rounded-none" />
          <div className="p-6">
          <h2 className="font-black text-ink">Niets gevonden</h2>
          {results.suggestions.length > 0 && (
            <>
              <p className="mt-2 text-sm text-ink-soft">Bedoelde je misschien:</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {results.suggestions.map((suggestie) => (
                  <li key={suggestie}>
                    <Link
                      href={`/zoeken?q=${encodeURIComponent(suggestie)}`}
                      className="rounded-full bg-brand-light px-4 py-2 text-sm font-bold text-brand transition hover:bg-brand hover:text-white"
                    >
                      {suggestie}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-ink-soft">
            <li>Probeer een kortere of algemenere zoekterm.</li>
            <li>Zoek op merk of artikelnummer.</li>
            <li>
              Zoek je een kleur? Gebruik de{" "}
              <Link href="/kleurkiezer" className="font-semibold text-brand hover:underline">
                kleurkiezer
              </Link>
              .
            </li>
          </ul>
          <p className="mt-4 text-sm text-ink-soft">
            Kom je er niet uit? Onze{" "}
            <Link href="/klantenservice" className="font-semibold text-brand hover:underline">
              klantenservice
            </Link>{" "}
            helpt je graag.
          </p>
          </div>
        </div>
      ) : (
        <>
          {results.facets.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {results.facets.map((facet) => (
                <Link
                  key={facet.slug}
                  href={`/categorie/${facet.slug}`}
                  className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-soft shadow-sm transition hover:text-brand"
                >
                  {facet.name} ({facet.count})
                </Link>
              ))}
            </div>
          )}

          <Suspense fallback={null}>
            <ProductFiltersPanel
              facets={facets}
              filters={filters}
              total={gefilterd.length}
              activeCount={actief}
              snelfilters={snelfilters}
            >
              {zichtbaar.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="font-black text-ink">Geen artikelen met deze filters</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Haal een filter weg om meer resultaten te zien.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4">
                  {zichtbaar.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </ProductFiltersPanel>
          </Suspense>
        </>
      )}
    </div>
  );
}
