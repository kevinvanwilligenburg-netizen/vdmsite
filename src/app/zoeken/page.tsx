import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductCard } from "@/components/ProductCard";
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
  searchParams: { q?: string; categorie?: string };
}

export default async function SearchPage({ searchParams }: Props) {
  const query = (searchParams.q ?? "").trim();
  const categorySlug = searchParams.categorie;
  const [categories, results] = await Promise.all([
    getCategories(),
    query ? searchProducts(query, { categorySlug, limit: 48 }) : null,
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Zoeken" }]} />
      <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">
        {query ? `Zoekresultaten voor “${query}”` : "Zoeken"}
      </h1>

      {!query && (
        <div className="space-y-6">
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
      )}

      {results && (
        <div className="space-y-5">
          <p className="text-ink-soft" role="status">
            {results.total === 0
              ? "Geen resultaten gevonden."
              : `${results.total.toLocaleString("nl-NL")} ${
                  results.total === 1 ? "resultaat" : "resultaten"
                }${results.total > results.products.length ? ` — de eerste ${results.products.length} worden getoond` : ""}`}
          </p>

          {results.facets.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <Link
                href={`/zoeken?q=${encodeURIComponent(query)}`}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  !categorySlug ? "bg-ink text-white" : "bg-white text-ink-soft shadow-sm"
                }`}
              >
                Alles ({results.total})
              </Link>
              {results.facets.map((facet) => (
                <Link
                  key={facet.slug}
                  href={`/zoeken?q=${encodeURIComponent(query)}&categorie=${facet.slug}`}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    categorySlug === facet.slug
                      ? "bg-ink text-white"
                      : "bg-white text-ink-soft shadow-sm"
                  }`}
                >
                  {facet.name} ({facet.count})
                </Link>
              ))}
            </div>
          )}

          {results.products.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {results.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="card p-6">
              <h2 className="font-black text-ink">Niets gevonden — probeer dit</h2>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-ink-soft">
                <li>Controleer de spelling of gebruik een kortere zoekterm.</li>
                <li>Zoek op merk of artikelnummer.</li>
                <li>
                  Zoek je een kleur? Gebruik de{" "}
                  <Link href="/kleurkiezer" className="font-semibold text-brand hover:underline">
                    kleurkiezer
                  </Link>
                  .
                </li>
              </ul>
              <p className="mt-5 text-sm text-ink-soft">
                Kom je er niet uit? Onze{" "}
                <Link href="/klantenservice" className="font-semibold text-brand hover:underline">
                  klantenservice
                </Link>{" "}
                helpt je graag.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
