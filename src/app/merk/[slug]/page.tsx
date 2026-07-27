import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { euro } from "@/lib/format";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getBrand, getBrands } from "@/lib/tilroy";

export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: { slug: string };
}

/** De grootste merken vooraf; de rest op aanvraag. */
export async function generateStaticParams() {
  const brands = await getBrands(40);
  return brands.map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await getBrand(params.slug);
  if (!brand) return {};
  return {
    title: `${brand.name} kopen — ${brand.count} artikelen`,
    description: `${brand.name} bij ${SITE_NAME}: ${brand.count} artikelen vanaf ${euro(brand.fromPrice)}. Gratis bezorgd of gratis afgehaald in de winkel.`,
    alternates: { canonical: `/merk/${brand.slug}` },
  };
}

export default async function BrandPage({ params }: Props) {
  const brand = await getBrand(params.slug);
  if (!brand) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${brand.name} bij ${SITE_NAME}`,
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

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ name: "Home", href: "/" }, { name: brand.name }]}
      />
      <JsonLd data={jsonLd} />

      <header className="max-w-3xl">
        <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">
          {brand.name}
        </h1>
        <p className="mt-2 text-ink-soft">
          {brand.count} artikelen van {brand.name} bij De Voordeelmarkt, vanaf{" "}
          {euro(brand.fromPrice)}. Gratis bezorgd — vóór 10:00 besteld is vandaag
          in huis — of gratis afgehaald in een van onze vijf winkels.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {brand.products.slice(0, 48).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
