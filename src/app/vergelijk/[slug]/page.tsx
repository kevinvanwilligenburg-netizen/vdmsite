import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { kleurtestersActief } from "@/lib/instellingen";
import { getProducts } from "@/lib/tilroy";
import { getVergelijking, sectieProducten, VERGELIJKINGEN } from "@/lib/vergelijk";

export const revalidate = 3600;
export const dynamicParams = false;

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return VERGELIJKINGEN.map((vergelijking) => ({ slug: vergelijking.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const vergelijking = getVergelijking(params.slug);
  if (!vergelijking) return {};
  return {
    title: vergelijking.metaTitel,
    description: vergelijking.metaOmschrijving,
    alternates: { canonical: `/vergelijk/${vergelijking.slug}` },
  };
}

export default async function VergelijkPage({ params }: Props) {
  const vergelijking = getVergelijking(params.slug);
  if (!vergelijking) notFound();

  const [products, testers] = await Promise.all([getProducts(), kleurtestersActief()]);

  // De kleurtester-variant van een antwoord alleen als de schakelaar aan staat.
  const faqs = vergelijking.faqs.map((faq) => ({
    q: faq.q,
    a: testers && faq.aMetTesters ? faq.aMetTesters : faq.a,
  }));

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  const andere = VERGELIJKINGEN.filter((entry) => entry.slug !== vergelijking.slug);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Merken", href: "/merken" },
          { name: vergelijking.titel },
        ]}
      />
      <JsonLd data={faqJsonLd} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          {vergelijking.titel}
        </h1>
        {vergelijking.intro.map((alinea) => (
          <p key={alinea.slice(0, 40)} className="mt-3 leading-relaxed text-ink-soft">
            {alinea}
          </p>
        ))}
      </header>

      {vergelijking.secties.map((sectie) => {
        const producten = sectieProducten(sectie, products);
        if (producten.length === 0) return null;
        return (
          <section key={sectie.kop} aria-label={sectie.kop}>
            <h2 className="text-xl font-black uppercase text-ink sm:text-2xl">{sectie.kop}</h2>
            <p className="mt-1 max-w-3xl text-ink-soft">{sectie.tekst}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {producten.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="rounded-2xl bg-brand-light p-6 sm:p-8">
        <h2 className="text-xl font-black text-ink">Twijfel je nog?</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Beschrijf je klus aan de{" "}
          <Link href="/klusadvies" className="font-bold text-brand hover:underline">
            klusadviseur
          </Link>{" "}
          voor een boodschappenlijstje op maat, of loop binnen bij een van onze{" "}
          <Link href="/winkels" className="font-bold text-brand hover:underline">
            vijf winkels
          </Link>{" "}
          — daar krijg je wél gewoon advies van een verfspecialist.
        </p>
      </section>

      <section aria-labelledby="vergelijk-faq-titel" className="max-w-3xl">
        <h2 id="vergelijk-faq-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
          Veelgestelde vragen
        </h2>
        <div className="mt-4 space-y-3">
          {faqs.map((faq) => (
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

      {andere.length > 0 && (
        <nav aria-label="Andere vergelijkingen" className="text-sm text-ink-soft">
          Ook interessant:{" "}
          {andere.map((entry, index) => (
            <span key={entry.slug}>
              {index > 0 && " · "}
              <Link
                href={`/vergelijk/${entry.slug}`}
                className="font-bold text-brand hover:underline"
              >
                {entry.titel}
              </Link>
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}
