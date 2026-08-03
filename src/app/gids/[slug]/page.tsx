import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { getGids, GIDSEN, gidsProducten } from "@/lib/gidsen";
import { kleurtestersActief } from "@/lib/instellingen";
import { absoluteUrl } from "@/lib/site";
import { getProducts } from "@/lib/tilroy";

export const revalidate = 3600;
export const dynamicParams = false;

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return GIDSEN.map((gids) => ({ slug: gids.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const gids = getGids(params.slug);
  if (!gids) return {};
  return {
    title: gids.metaTitel,
    description: gids.metaOmschrijving,
    alternates: { canonical: `/gids/${gids.slug}` },
  };
}

export default async function GidsPage({ params }: Props) {
  const gids = getGids(params.slug);
  if (!gids) notFound();

  const [alleProducten, testers] = await Promise.all([getProducts(), kleurtestersActief()]);
  const producten = gidsProducten(gids, alleProducten);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: gids.titel,
    numberOfItems: producten.length,
    itemListElement: producten.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.name,
      url: absoluteUrl(`/product/${product.slug}`),
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: gids.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[{ name: "Home", href: "/" }, { name: gids.titel }]}
      />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">{gids.titel}</h1>
        {gids.intro.map((alinea) => (
          <p key={alinea.slice(0, 40)} className="mt-3 leading-relaxed text-ink-soft">
            {alinea}
          </p>
        ))}
        {/* De kleurtester alleen beloven als de dashboard-schakelaar aan staat. */}
        {testers && (
          <p className="mt-3 leading-relaxed text-ink-soft">
            Twijfel je over de kleur? Bestel eerst een{" "}
            <Link href="/kleurstalen" className="font-bold text-brand hover:underline">
              kleurtester
            </Link>{" "}
, het bedrag krijg je terug als voucher bij je verf.
          </p>
        )}
      </header>

      {producten.length > 0 && (
        <section aria-labelledby="top-titel">
          <h2 id="top-titel" className="mb-4 text-xl font-black uppercase text-ink sm:text-2xl">
            Onze top {producten.length}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {producten.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {gids.secties.map((sectie) => (
          <div key={sectie.kop} className="card p-6">
            <h2 className="font-black text-ink">{sectie.kop}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{sectie.tekst}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-brand-light p-6 sm:p-8">
        <h2 className="text-xl font-black text-ink">Hulp bij het kiezen?</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Beschrijf je klus aan onze{" "}
          <Link href="/klusadvies" className="font-bold text-brand hover:underline">
            klusadviseur
          </Link>{" "}
          en je krijgt een boodschappenlijstje op maat, inclusief het aantal
          liters. Of loop binnen bij een van onze{" "}
          <Link href="/winkels" className="font-bold text-brand hover:underline">
            vijf winkels
          </Link>
          : daar staat een verfspecialist die je klus met je doorneemt.
        </p>
      </section>

      <section aria-labelledby="gids-faq-titel" className="max-w-3xl">
        <h2 id="gids-faq-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
          Veelgestelde vragen
        </h2>
        <div className="mt-4 space-y-3">
          {gids.faqs.map((faq) => (
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
    </div>
  );
}
