import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { MerkLogo } from "@/components/MerkLogo";
import { ProductCard } from "@/components/ProductCard";
import { ProductFiltersPanel } from "@/components/plp/ProductFilters";
import {
  activeFilterCount,
  applyFilters,
  buildFacets,
  parseFilters,
  snelfilterAantallen,
} from "@/lib/facets";
import { euro } from "@/lib/format";
import { merkFeiten, merkInleiding, merkVragen, type MerkRubriek } from "@/lib/merkpagina";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getBrand, getBrands } from "@/lib/tilroy";

// Filters lezen de URL, dus deze pagina kan niet statisch blijven; en een
// actieprijs die een uur vastzit is precies wat we vandaag hebben opgeruimd.
export const dynamic = "force-dynamic";
export const dynamicParams = true;

interface Props {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}

/** De grootste merken vooraf; de rest op aanvraag. */
export async function generateStaticParams() {
  const brands = await getBrands(40);
  return brands.map((brand) => ({ slug: brand.slug }));
}

/**
 * Link naar deze rubriek, gefilterd op dit merk.
 *
 * Het filter vergelijkt met het merkveld uit de kassa, en dat is niet de
 * schrijfwijze die hier op het scherm staat. Op /merk/hg leverde de link
 * `?merk=HG` één artikel op in plaats van tweehonderd, omdat de feed "Hg"
 * zegt. Daarom alle schrijfwijzen van dit merk meesturen — het filter leest
 * de parameter als lijst.
 */
function rubriekHref(rubriek: MerkRubriek): string {
  const query = new URLSearchParams();
  for (const waarde of rubriek.merkwaarden) query.append("merk", waarde);
  const achter = query.toString();
  return achter ? `/categorie/${rubriek.slug}?${achter}` : `/categorie/${rubriek.slug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await getBrand(params.slug);
  if (!brand) return {};
  const feiten = merkFeiten(brand.products);
  const rubriek = feiten.rubrieken[0]?.naam.toLowerCase();
  return {
    title: `${brand.name} kopen: ${brand.count} artikelen vanaf ${euro(feiten.vanaf)}`,
    // De beschrijving noemt de grootste rubriek van dít merk, zodat hij per
    // merkpagina verschilt in plaats van dezelfde zin met een andere naam.
    description: [
      `${brand.name}${rubriek ? ` ${rubriek}` : ""} bij ${SITE_NAME}:`,
      `${brand.count} artikelen vanaf ${euro(feiten.vanaf)}.`,
      feiten.mengbaar > 0 ? "Gratis gemengd in elke kleur." : "",
      "Gratis afhalen in de winkel.",
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 160),
    alternates: { canonical: `/merk/${brand.slug}` },
    openGraph: {
      type: "website",
      title: `${brand.name} bij ${SITE_NAME}`,
      url: absoluteUrl(`/merk/${brand.slug}`),
    },
  };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const brand = await getBrand(params.slug);
  if (!brand) notFound();

  const feiten = merkFeiten(brand.products);
  const inleiding = merkInleiding(brand.name, feiten);
  const vragen = merkVragen(brand.name, feiten);

  // Filteren binnen het merk, met dezelfde parser als de categoriepagina.
  const filters = parseFilters(searchParams);
  const gefilterd = applyFilters(brand.products, filters);
  const snelfilters = snelfilterAantallen(brand.products, filters);
  const facets = buildFacets(brand.products, filters);
  const actief = activeFilterCount(filters);
  const zichtbaar = gefilterd.slice(0, 48);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${brand.name} bij ${SITE_NAME}`,
    description: inleiding,
    url: absoluteUrl(`/merk/${brand.slug}`),
    about: { "@type": "Brand", name: brand.name },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: brand.products.length,
      itemListElement: brand.products.slice(0, 40).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
        url: absoluteUrl(`/product/${product.slug}`),
      })),
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: vragen.map((vraag) => ({
      "@type": "Question",
      name: vraag.q,
      acceptedAnswer: { "@type": "Answer", text: vraag.a },
    })),
  };

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Merken", href: "/merken" },
          { name: brand.name },
        ]}
      />
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />

      <header className="flex flex-wrap items-center gap-5">
        <MerkLogo slug={brand.slug} naam={brand.name} />
        <div className="max-w-3xl">
          <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">
            {brand.name}
          </h1>
          <p className="mt-2 text-ink-soft">{inleiding}</p>
        </div>
      </header>

      {/*
        Doorklikken naar de rubrieken waarin dit merk zit. Dit is het deel dat
        een merkpagina voor zoekmachines waard maakt: het verbindt de pagina
        met de categorieën in plaats van een losse lijst te zijn. En een klant
        die "Sikkens" zoekt maar lak bedoelt, komt zo in één klik waar hij moet
        wezen.
      */}
      {feiten.rubrieken.length > 1 && (
        <section aria-labelledby="rubrieken-titel">
          <h2
            id="rubrieken-titel"
            className="text-sm font-black uppercase tracking-wide text-ink-soft"
          >
            {brand.name} per rubriek
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {feiten.rubrieken.map((rubriek) => (
              <Link
                key={rubriek.slug}
                href={rubriekHref(rubriek)}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink/10 py-1.5 pl-3 pr-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
              >
                {rubriek.naam}
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                  {rubriek.aantal}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {feiten.maten.length > 1 && (
        <p className="text-sm text-ink-soft">
          Verkrijgbaar in {feiten.maten.slice(0, -1).join(", ")} en{" "}
          {feiten.maten[feiten.maten.length - 1]}.
        </p>
      )}

      {/*
        Filters, net als op een categoriepagina.

        Die stonden hier niet, en dat viel pas op toen Drenth 102 artikelen in
        de actie kreeg: je kunt dan wel naar het merk, maar niet naar "alleen
        wat in de actie is". Op een merk met honderden artikelen is dat het
        verschil tussen bladeren en vinden.

        Dezelfde componenten en dezelfde parser als de categoriepagina — een
        tweede filterimplementatie is een tweede plek waar "aanbieding" iets
        anders gaat betekenen.
      */}
      <ProductFiltersPanel
        facets={facets}
        filters={filters}
        total={gefilterd.length}
        activeCount={actief}
        snelfilters={snelfilters}
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {zichtbaar.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </ProductFiltersPanel>

      {gefilterd.length > 48 && (
        <p className="text-sm text-ink-soft">
          Dit zijn de eerste 48 van {brand.count} artikelen.{" "}
          <Link
            href={`/zoeken?q=${encodeURIComponent(brand.name)}`}
            className="font-bold text-brand hover:underline"
          >
            Bekijk alles van {brand.name}
          </Link>
        </p>
      )}

      <section aria-labelledby="merk-faq-titel" className="max-w-3xl">
        <h2 id="merk-faq-titel" className="mb-4 text-xl font-black uppercase text-ink sm:text-2xl">
          Veelgestelde vragen over {brand.name}
        </h2>
        <div className="space-y-3">
          {vragen.map((vraag) => (
            <details key={vraag.q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink">
                {vraag.q}
                <span className="shrink-0 transition group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-soft">{vraag.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
