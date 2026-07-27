import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { absoluteUrl } from "@/lib/site";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/tilroy";

export const revalidate = 3600;

interface Props {
  params: { slug: string };
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
    description: `${category.description} Online bestellen en gratis afhalen in de winkel.`,
    alternates: { canonical: `/categorie/${category.slug}` },
    openGraph: {
      title: `${category.name} | De Voordeelmarkt`,
      description: category.description,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const category = await getCategory(params.slug);
  if (!category) notFound();
  const products = await getProductsByCategory(category.slug);

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.name,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.name,
      url: absoluteUrl(`/product/${product.slug}`),
    })),
  };

  return (
    <div className="space-y-6">
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
      {products.length === 0 ? (
        <p className="card p-10 text-center text-ink-soft">
          Er zijn op dit moment geen artikelen in deze categorie. Kom snel terug!
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {products.length} {products.length === 1 ? "artikel" : "artikelen"}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
