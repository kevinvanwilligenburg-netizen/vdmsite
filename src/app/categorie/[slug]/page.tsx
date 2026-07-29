import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { ProductFiltersPanel } from "@/components/plp/ProductFilters";
import { ProductCard } from "@/components/ProductCard";
import { activeFilterCount, applyFilters, buildFacets, parseFilters } from "@/lib/facets";
import { absoluteUrl } from "@/lib/site";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/tilroy";

export const revalidate = 3600;

const PER_PAGE = 48;

interface Props {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory(params.slug);
  if (!category) return {};
  return {
    title: `${category.name} kopen voor de laagste prijs`,
    description: `${category.description} Gratis bezorgd of gratis afhalen in de winkel.`,
    alternates: { canonical: `/categorie/${category.slug}` },
    openGraph: {
      title: `${category.name} | De Voordeelmarkt`,
      description: category.description,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await getCategory(params.slug);
  if (!category) notFound();

  const alle = await getProductsByCategory(category.slug);
  const filters = parseFilters(searchParams);
  const gefilterd = applyFilters(alle, filters);
  const facets = buildFacets(alle, filters);
  const actief = activeFilterCount(filters);

  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const paginas = Math.max(1, Math.ceil(gefilterd.length / PER_PAGE));
  const zichtbaar = gefilterd.slice((pagina - 1) * PER_PAGE, pagina * PER_PAGE);

  // Alleen de ongefilterde eerste pagina hoort in de index; gefilterde
  // varianten zijn handig voor bezoekers maar niet voor zoekmachines.
  const indexeerbaar = actief === 0 && pagina === 1 && !filters.sort;

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.name,
    numberOfItems: gefilterd.length,
    itemListElement: zichtbaar.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: (pagina - 1) * PER_PAGE + index + 1,
      name: product.name,
      url: absoluteUrl(`/product/${product.slug}`),
    })),
  };

  const pageHref = (nummer: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "pagina" || value === undefined) continue;
      // Meerdere waarden als herhaalde parameters doorgeven, niet als één
      // komma-lijst: filterwaarden bevatten zelf komma's.
      if (Array.isArray(value)) for (const entry of value) params.append(key, entry);
      else params.set(key, value);
    }
    if (nummer > 1) params.set("pagina", String(nummer));
    const query = params.toString();
    return query ? `/categorie/${category.slug}?${query}` : `/categorie/${category.slug}`;
  };

  return (
    <div className="space-y-6">
      {!indexeerbaar && <meta name="robots" content="noindex,follow" />}
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: category.name, href: `/categorie/${category.slug}` },
        ]}
      />
      <JsonLd data={listJsonLd} />

      <header className="flex items-start gap-4">
        <span
          className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl sm:flex"
          style={{
            background: `linear-gradient(135deg, hsl(${category.hue} 85% 94%), hsl(${category.hue} 70% 86%))`,
            color: `hsl(${category.hue} 45% 38%)`,
          }}
          aria-hidden
        >
          <Icon name={category.icon} className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">
            {category.name}
          </h1>
          <p className="mt-2 max-w-2xl text-ink-soft">{category.description}</p>
        </div>
      </header>

      {alle.length === 0 ? (
        <p className="card p-10 text-center text-ink-soft">
          Er zijn op dit moment geen artikelen in deze categorie.
        </p>
      ) : (
        <Suspense fallback={null}>
          <ProductFiltersPanel
            facets={facets}
            filters={filters}
            total={gefilterd.length}
            activeCount={actief}
          >
            <div className="space-y-6">
              {zichtbaar.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="font-black text-ink">Geen artikelen met deze filters</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Probeer een filter weg te halen om meer te zien.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4">
                  {zichtbaar.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}

              {paginas > 1 && (
                <nav
                  aria-label="Paginering"
                  className="flex flex-wrap items-center justify-center gap-2"
                >
                  {pagina > 1 && (
                    <Link href={pageHref(pagina - 1)} className="btn btn-dark px-4 py-2 text-sm">
                      ← Vorige
                    </Link>
                  )}
                  <span className="px-2 text-sm text-ink-soft">
                    Pagina {pagina} van {paginas}
                  </span>
                  {pagina < paginas && (
                    <Link href={pageHref(pagina + 1)} className="btn btn-dark px-4 py-2 text-sm">
                      Volgende →
                    </Link>
                  )}
                </nav>
              )}
            </div>
          </ProductFiltersPanel>
        </Suspense>
      )}
    </div>
  );
}
