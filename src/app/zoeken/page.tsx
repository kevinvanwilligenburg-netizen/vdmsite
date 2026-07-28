import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductFiltersPanel } from "@/components/plp/ProductFilters";
import { ProductCard } from "@/components/ProductCard";
import { SearchTracker } from "@/components/search/SearchTracker";
import { activeFilterCount, applyFilters, buildFacets, parseFilters } from "@/lib/facets";
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

  const results = await searchProducts(query, { limit: 500 });
  const filters = parseFilters(searchParams);
  const gefilterd = applyFilters(results.all, filters);
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

      {results.total === 0 ? (
        <div className="card p-6">
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
