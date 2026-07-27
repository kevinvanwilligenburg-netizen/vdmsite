import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductArt } from "@/components/ProductArt";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { StockList } from "@/components/StockList";
import { ralColors } from "@/lib/ral";
import { absoluteUrl } from "@/lib/site";
import { getCategory, getProduct, getProducts } from "@/lib/tilroy";

export const revalidate = 300;

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return {};
  return {
    title: `${product.name} kopen`,
    description: `${product.shortDescription} ✓ Laagste prijs ✓ Gratis afhalen in de winkel.`,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: `${product.name} | De Voordeelmarkt`,
      description: product.shortDescription,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);
  if (!product) notFound();
  const category = await getCategory(product.category);

  const offers =
    product.variants && product.variants.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: (Math.min(...product.variants.map((v) => v.price)) / 100).toFixed(2),
          highPrice: (Math.max(...product.variants.map((v) => v.price)) / 100).toFixed(2),
          offerCount: product.variants.length,
          availability: "https://schema.org/InStock",
          url: absoluteUrl(`/product/${product.slug}`),
        }
      : {
          "@type": "Offer",
          priceCurrency: "EUR",
          price: (product.price / 100).toFixed(2),
          availability: "https://schema.org/InStock",
          url: absoluteUrl(`/product/${product.slug}`),
        };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.shortDescription,
    brand: { "@type": "Brand", name: product.brand },
    category: category?.name,
    offers,
  };

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          ...(category
            ? [{ name: category.name, href: `/categorie/${category.slug}` }]
            : []),
          { name: product.name },
        ]}
      />
      <JsonLd data={productJsonLd} />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <ProductArt
              icon={product.art.icon}
              hue={product.art.hue}
              size="lg"
              label={product.name}
            />
          </div>
          <StockList product={product} />
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            {product.brand} · {product.sku}
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">{product.name}</h1>
          <p className="mt-3 text-ink-soft">{product.shortDescription}</p>
          <div className="mt-6">
            <PurchasePanel
              product={product}
              colors={product.colorMixable ? ralColors : []}
            />
          </div>
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-black text-ink">Productomschrijving</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">{product.description}</p>
        </div>
        {product.specs && product.specs.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-black text-ink">Specificaties</h2>
            <dl className="mt-3 divide-y divide-ink/5">
              {product.specs.map((spec) => (
                <div key={spec.label} className="grid grid-cols-2 gap-4 py-2 text-sm">
                  <dt className="font-semibold text-ink-soft">{spec.label}</dt>
                  <dd className="text-ink">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
