import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { StaalBestellen } from "@/components/stalen/StaalBestellen";
import { getInitialColors, getColorCollections } from "@/lib/colors";
import { kleurtestersActief } from "@/lib/instellingen";
import { GRATIS_VANAF_TEKST, tariefTekst } from "@/lib/shipping";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { STAAL_NAAM, STAAL_PRIJS, STAAL_PRIJS_TEKST } from "@/lib/stalen";
import { VOUCHER_GELDIG_MAANDEN } from "@/lib/vouchers";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Kleurtesters: elke kleur voor ${STAAL_PRIJS_TEKST}, bedrag terug als voucher`,
  description: `Twijfel je over een verfkleur? Bestel een kleurtester van 30 ml, gemengd in elke kleur die wij voeren, ook alle RAL-kleuren. Het testerbedrag krijg je terug als voucher bij aankoop van je verf.`,
  alternates: { canonical: "/kleurstalen" },
};

export default async function KleurstalenPage() {
  // Kevin zet de kleurtesters aan in het dashboard, niet met een deploy.
  // Tot dat moment bestaat deze pagina niet: het Tilroy-artikel is er nog
  // niet, dus een bestelling zou een belofte zijn die de winkel niet kan
  // waarmaken.
  if (!(await kleurtestersActief())) notFound();

  const [colors, collections] = await Promise.all([
    getInitialColors(),
    getColorCollections(),
  ]);
  const totaalKleuren = collections.reduce((som, entry) => som + entry.count, 0);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: STAAL_NAAM,
    description:
      "Kleurtester van 30 ml, gemengd in elke kleur uit onze waaiers. Het testerbedrag krijg je als voucher terug bij aankoop van de verf.",
    brand: { "@type": "Brand", name: SITE_NAME },
    url: absoluteUrl("/kleurstalen"),
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: (STAAL_PRIJS / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/kleurstalen"),
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };

  const faqs = [
    {
      q: "Hoe werkt de voucher?",
      a: `Bij elke betaalde bestelling met kleurtesters krijg je per mail een vouchercode ter waarde van het volledige testerbedrag. Die vul je in bij het afrekenen zodra je de echte verf bestelt, het bedrag gaat er direct af. De voucher is ${VOUCHER_GELDIG_MAANDEN} maanden geldig en geldt bij een bestelling met mengverf.`,
    },
    {
      q: "Welke kleuren kan ik testen?",
      a: `Alle ${totaalKleuren.toLocaleString("nl-NL")} kleuren uit onze waaiers: de complete RAL Classic-waaier en de merkenwaaiers van onder meer Sikkens, Flexa en Histor. Elke tester wordt door onze verfspecialist gemengd, je test dus echte verf, geen gedrukt kaartje.`,
    },
    {
      q: "Wat kost verzenden?",
      a: `Verzenden kost ${tariefTekst("NL")} en is gratis vanaf ${GRATIS_VANAF_TEKST}. Afhalen in een van onze vijf winkels is altijd gratis, daar staat de tester binnen 2 uur voor je klaar.`,
    },
    {
      q: "Kan ik een tester retourneren?",
      a: "Nee, een tester wordt speciaal voor jou op kleur gemengd en is daarmee maatwerk. Daarom krijg je het bedrag als voucher terug zodra je de verf koopt: zo kost proberen je per saldo niets.",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Kleuren", href: "/kleuren" },
          { name: "Kleurtesters" },
        ]}
      />
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqJsonLd} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          Kleurtesters
        </h1>
        <p className="mt-3 text-ink-soft">
          Schermkleuren liegen; natte verf niet. Bestel een tester van 30 ml in{" "}
          <strong className="text-ink">elke kleur die wij voeren</strong>, ook
          alle RAL-kleuren, voor {STAAL_PRIJS_TEKST} per stuk. En het mooiste:{" "}
          <strong className="text-ink">
            het testerbedrag krijg je terug als voucher
          </strong>{" "}
          zodra je de echte verf koopt. Proberen kost je zo per saldo niets.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: "palette",
            title: "1. Kies je kleuren",
            text: `Uit ${totaalKleuren.toLocaleString("nl-NL")} kleuren, RAL én merkenwaaiers. Wij mengen elke tester met echte verf.`,
          },
          {
            icon: "truck",
            title: "2. Test thuis",
            text: "Morgen in huis of binnen 2 uur gratis af te halen. Zet twee lagen op de muur en kijk bij dag- én kunstlicht.",
          },
          {
            icon: "tag",
            title: "3. Bedrag terug",
            text: `Je voucher komt per mail. Verf besteld? Code invullen en het testerbedrag gaat eraf. ${VOUCHER_GELDIG_MAANDEN} maanden geldig.`,
          },
        ].map((stap) => (
          <div key={stap.title} className="card p-5">
            <span className="inline-flex text-brand" aria-hidden>
              <Icon name={stap.icon} className="h-8 w-8" strokeWidth={1.8} />
            </span>
            <h2 className="mt-2 font-black text-ink">{stap.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{stap.text}</p>
          </div>
        ))}
      </section>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-black/5" aria-hidden />}>
        <StaalBestellen initialColors={colors} />
      </Suspense>

      <p className="max-w-3xl text-sm text-ink-soft">
        Liever meteen de hele waaier zien? In onze{" "}
        <Link href="/winkels" className="font-bold text-brand hover:underline">
          vijf winkels
        </Link>{" "}
        liggen de officiële waaiers, en onze verfspecialist denkt gratis met je
        mee. Of blader online door{" "}
        <Link href="/kleuren" className="font-bold text-brand hover:underline">
          alle kleuren
        </Link>
        .
      </p>

      <section aria-labelledby="stalen-faq-titel" className="max-w-3xl">
        <h2 id="stalen-faq-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
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
    </div>
  );
}
