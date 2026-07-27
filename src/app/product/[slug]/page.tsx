import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductArt } from "@/components/ProductArt";
import { ProductCard } from "@/components/ProductCard";
import { Companions } from "@/components/product/Companions";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { StickyBuyBar } from "@/components/product/StickyBuyBar";
import { StockList } from "@/components/StockList";
import { getInitialColors } from "@/lib/colors";
import { euro } from "@/lib/format";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { aggregateRatingJsonLd, getTrustpilotRating } from "@/lib/trustpilot";
import {
  getCategory,
  getCompanions,
  getProduct,
  getProducts,
  getRelatedProducts,
  getStores,
  skusFor,
} from "@/lib/tilroy";

export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: { slug: string };
}

/**
 * De catalogus telt duizenden artikelen; die bouwen we niet allemaal vooraf.
 * Een beperkte set wordt voorgerenderd, de rest op aanvraag (ISR). Bewust niet
 * meer: elke build-worker haalt de feed apart op, en te veel parallelle
 * verzoeken lokken bot-mitigatie uit bij de bron.
 */
export async function generateStaticParams() {
  const products = await getProducts();
  return products.slice(0, 60).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return {};
  const prijs = euro(product.price);
  const title = `${product.name} kopen — ${prijs}`;
  const description = [
    product.shortDescription.slice(0, 110),
    `Nu ${prijs}${product.compareAtPrice ? ` (van ${euro(product.compareAtPrice)})` : ""}.`,
    "Gratis bezorgd of gratis afhalen in de winkel.",
  ].join(" ");
  return {
    title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(`/product/${product.slug}`),
      ...(product.image ? { images: [{ url: product.image, alt: product.name }] } : {}),
    },
    twitter: {
      card: product.image ? "summary_large_image" : "summary",
      title: `${product.name} — ${prijs}`,
      description,
    },
    other: {
      "product:price:amount": (product.price / 100).toFixed(2),
      "product:price:currency": "EUR",
      "product:brand": product.brand,
      "product:availability": product.inStock === false ? "oos" : "instock",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);
  if (!product) notFound();
  const [category, related, companions, colors, stores, rating] = await Promise.all([
    getCategory(product.category),
    getRelatedProducts(product),
    getCompanions(product),
    product.colorMixable ? getInitialColors() : Promise.resolve([]),
    getStores(),
    getTrustpilotRating(),
  ]);

  // Gratis bezorgen en 14 dagen retour gelden voor het hele assortiment.
  const offerTerms = {
    availability: "https://schema.org/InStock",
    url: absoluteUrl(`/product/${product.slug}`),
    seller: { "@type": "Organization", name: SITE_NAME },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "EUR" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "NL" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: 1,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: 1,
          unitCode: "DAY",
        },
      },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "NL",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 14,
      returnMethod: "https://schema.org/ReturnInStore",
      returnFees: "https://schema.org/FreeReturn",
    },
  };

  const offers =
    product.variants && product.variants.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: (Math.min(...product.variants.map((v) => v.price)) / 100).toFixed(2),
          highPrice: (Math.max(...product.variants.map((v) => v.price)) / 100).toFixed(2),
          offerCount: product.variants.length,
          ...offerTerms,
        }
      : {
          "@type": "Offer",
          priceCurrency: "EUR",
          price: (product.price / 100).toFixed(2),
          ...offerTerms,
        };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    mpn: product.sku,
    ...(product.ean ? { gtin13: product.ean } : {}),
    description: product.shortDescription,
    brand: { "@type": "Brand", name: product.brand },
    category: category?.name,
    ...(product.image ? { image: [product.image] } : {}),
    url: absoluteUrl(`/product/${product.slug}`),
    // Winkelbeoordelingen van Trustpilot; alleen als er echte reviews zijn.
    ...(aggregateRatingJsonLd(rating)
      ? { aggregateRating: aggregateRatingJsonLd(rating) }
      : {}),
    ...(product.specs && product.specs.length > 0
      ? {
          additionalProperty: product.specs.map((spec) => ({
            "@type": "PropertyValue",
            name: spec.label,
            value: spec.value,
          })),
        }
      : {}),
    offers,
  };

  // Vragen die klanten bij dit soort artikelen stellen — goed voor de
  // vindbaarheid én voor AI-assistenten die productvragen beantwoorden.
  const productFaqs = [
    {
      q: `Wat kost ${product.name}?`,
      a: `${product.name} kost ${euro(product.price)}${
        product.compareAtPrice
          ? ` in plaats van de adviesprijs van ${euro(product.compareAtPrice)}`
          : ""
      }. Bezorgen is gratis, net als afhalen in de winkel.`,
    },
    {
      q: "Hoe snel heb ik dit in huis?",
      a: "Ligt dit artikel in onze webshopvoorraad in Nijverdal, dan bezorgt DHL het dezelfde dag als je vóór 10:00 uur bestelt. Ligt het in een van onze andere winkels, dan verstuurt die winkel het met PostNL en heb je het binnen één werkdag. Op deze pagina zie je de actuele voorraad per winkel.",
    },
    ...(product.colorMixable
      ? [
          {
            q: "Kan ik dit in elke kleur krijgen?",
            a: "Ja. Kies je kleur met de kleurkiezer op deze pagina — je hebt keuze uit meer dan 18.000 kleuren. Wij mengen de verf gratis in de winkel en kiezen automatisch de juiste mengbasis bij jouw kleur.",
          },
        ]
      : []),
    {
      q: "Kan ik dit artikel retourneren?",
      a: "Je hebt 14 dagen bedenktijd. Ongebruikte artikelen kun je gratis terugbrengen naar elke winkel. Op kleur gemengde verf is maatwerk en daarvan uitgezonderd.",
    },
  ];

  const productFaqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: productFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <div className="space-y-8 pb-20 sm:pb-0">
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
      <JsonLd data={productFaqJsonLd} />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0 space-y-4">
          <div className="card overflow-hidden">
            <ProductArt
              icon={product.art.icon}
              hue={product.art.hue}
              image={product.image}
              size="lg"
              label={product.name}
              priority
            />
          </div>
          <StockList
            skus={skusFor(product)}
            stores={stores.map((store) => ({ storeId: store.slug, city: store.city }))}
            fallbackInStock={product.inStock !== false}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            {product.brand} · {product.sku}
          </p>
          <h1 className="mt-1 text-2xl font-black text-ink sm:text-3xl">{product.name}</h1>
          <p className="mt-3 text-ink-soft">{product.shortDescription}</p>
          <div id="koopblok" className="mt-6 scroll-mt-32">
            <PurchasePanel product={product} colors={colors} />
          </div>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2 lg:gap-8">
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

      <Companions items={companions} />

      <section aria-labelledby="product-faq-titel" className="max-w-3xl">
        <h2
          id="product-faq-titel"
          className="mb-4 text-xl font-black uppercase text-ink sm:text-2xl"
        >
          Veelgestelde vragen
        </h2>
        <div className="space-y-3">
          {productFaqs.map((faq) => (
            <details key={faq.q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink">
                {faq.q}
                <span className="shrink-0 transition group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-soft">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="gerelateerd-titel">
          <h2 id="gerelateerd-titel" className="mb-4 text-xl font-black uppercase text-ink sm:text-2xl">
            Vergelijkbare artikelen
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      )}

      <StickyBuyBar name={product.name} price={product.price} targetId="koop-knop" />
    </div>
  );
}
