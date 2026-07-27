import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { mapsUrl, openingHoursSpecification, STORE_SERVICES } from "@/lib/stores";
import { absoluteUrl, CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { getDeals, getStore, getStores } from "@/lib/tilroy";

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const stores = await getStores();
  return stores.map((store) => ({ slug: store.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getStore(params.slug);
  if (!store) return {};
  const title = `Verfwinkel ${store.city} — ${store.name}`;
  const description = `Verf, gereedschap en klusmateriaal in ${store.city}: ${store.address}. Verf gratis gemengd in elke kleur, gratis parkeren en online bestellingen gratis afhalen. Open ma t/m vr 08:00–18:00, za 08:00–17:00.`;
  return {
    title,
    description,
    alternates: { canonical: `/winkels/${store.slug}` },
    openGraph: {
      type: "website",
      title: `${store.name}`,
      description,
      url: absoluteUrl(`/winkels/${store.slug}`),
    },
  };
}

export default async function StorePage({ params }: Props) {
  const [store, stores, deals] = await Promise.all([
    getStore(params.slug),
    getStores(),
    getDeals(4),
  ]);
  if (!store) notFound();

  const otherStores = stores.filter((entry) => entry.slug !== store.slug);
  const isWebshopStore = store.slug === "nijverdal";

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "HardwareStore",
    "@id": absoluteUrl(`/winkels/${store.slug}#store`),
    name: store.name,
    url: absoluteUrl(`/winkels/${store.slug}`),
    telephone: store.phone,
    ...(store.email ? { email: store.email } : {}),
    image: absoluteUrl("/icon.svg"),
    priceRange: "€€",
    currenciesAccepted: "EUR",
    paymentAccepted: "iDEAL, Bancontact, Creditcard, Apple Pay, Contant, PIN",
    parentOrganization: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      postalCode: store.postalCode,
      addressLocality: store.city,
      addressRegion: "Overijssel/Gelderland/Drenthe",
      addressCountry: "NL",
    },
    ...(store.geo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: store.geo.lat,
            longitude: store.geo.lng,
          },
        }
      : {}),
    openingHoursSpecification: openingHoursSpecification(store),
    hasMap: mapsUrl(store),
    makesOffer: STORE_SERVICES.map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service },
    })),
  };

  const faqs = [
    {
      q: `Kan ik verf laten mengen in ${store.city}?`,
      a: `Ja. In ${store.name} mengen we je verf gratis in elke gewenste kleur, uit meer dan 140 kleurenwaaiers. Meestal terwijl je wacht.`,
    },
    {
      q: `Kan ik online bestellen en afhalen in ${store.city}?`,
      a: `Dat kan. Kies bij het afrekenen voor afhalen en selecteer ${store.city}. Je krijgt bericht met een afhaalcode zodra je bestelling klaarstaat — vaak dezelfde dag nog. Afhalen is gratis.`,
    },
    {
      q: `Wat zijn de openingstijden van ${store.name}?`,
      a: "Maandag tot en met vrijdag van 08:00 tot 18:00 uur, zaterdag van 08:00 tot 17:00 uur. Op zondag zijn we gesloten.",
    },
    {
      q: "Is er parkeergelegenheid?",
      a: "Ja, er is gratis parkeergelegenheid direct voor de deur.",
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
          { name: "Winkels", href: "/winkels" },
          { name: store.city },
        ]}
      />
      <JsonLd data={storeJsonLd} />
      <JsonLd data={faqJsonLd} />

      <header className="max-w-3xl">
        <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">
          {store.name}
        </h1>
        <p className="mt-3 text-ink-soft">
          Jouw verfwinkel en klusdiscounter in {store.city}, aan de{" "}
          {store.address}. Wij mengen verf gratis in elke kleur, je parkeert
          gratis voor de deur en online bestellingen haal je hier kosteloos op.
          {isWebshopStore &&
            " Deze vestiging verzorgt bovendien onze webshopvoorraad: bestel je vóór 10:00 uur, dan gaat je pakket dezelfde dag nog de deur uit."}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">Adres &amp; contact</h2>
          <address className="mt-3 not-italic leading-relaxed text-ink-soft">
            {store.address}
            <br />
            {store.postalCode} {store.city}
          </address>
          <p className="mt-3">
            <a
              href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-2 font-semibold text-ink hover:text-brand"
            >
              <Icon name="phone" className="h-4 w-4 text-brand" /> {store.phone}
            </a>
          </p>
          <p className="mt-1">
            <a
              href={`mailto:${store.email ?? CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 font-semibold text-ink hover:text-brand"
            >
              <Icon name="mail" className="h-4 w-4 text-brand" />{" "}
              {store.email ?? CONTACT_EMAIL}
            </a>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={mapsUrl(store)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <Icon name="pin" className="h-5 w-5" /> Routebeschrijving
            </a>
            <Link href="/" className="btn btn-dark">
              Online bestellen
            </Link>
          </div>
          <div className="mt-6 rounded-xl bg-brand-light p-4 text-sm">
            <p className="flex items-center gap-2 font-bold text-ink">
              <Icon name="cart" className="h-4 w-4 text-brand" /> Bestelling afhalen?
            </p>
            <p className="mt-1 text-ink-soft">
              Meld je bij de kassa met je afhaalcode. Je bestelling ligt klaar
              zodra je daarover bericht hebt gekregen. Afhalen is altijd gratis.
            </p>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg font-black text-ink">Openingstijden</h2>
            <dl className="mt-3 divide-y divide-ink/5">
              {store.openingHours.map((entry) => (
                <div key={entry.day} className="flex justify-between py-2 text-sm">
                  <dt className="font-semibold text-ink-soft">{entry.day}</dt>
                  <dd
                    className={
                      entry.hours === "Gesloten"
                        ? "font-semibold text-brand"
                        : "font-semibold text-ink"
                    }
                  >
                    {entry.hours}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-black text-ink">
              Wat kun je hier terecht voor?
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {STORE_SERVICES.map((service) => (
                <li key={service} className="flex items-start gap-2">
                  <Icon
                    name="check"
                    className="mt-0.5 h-4 w-4 shrink-0 text-green-700"
                    strokeWidth={3}
                  />
                  {service}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {deals.length > 0 && (
        <section aria-labelledby="deals-titel">
          <h2 id="deals-titel" className="mb-4 text-xl font-black uppercase text-ink sm:text-2xl">
            Deze week in de aanbieding
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {deals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="faq-titel" className="max-w-3xl">
        <h2 id="faq-titel" className="mb-4 text-xl font-black uppercase text-ink sm:text-2xl">
          Veelgestelde vragen over {store.city}
        </h2>
        <div className="space-y-3">
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

      <section aria-labelledby="andere-titel">
        <h2 id="andere-titel" className="mb-3 text-lg font-black text-ink">
          Onze andere winkels
        </h2>
        <ul className="flex flex-wrap gap-2">
          {otherStores.map((entry) => (
            <li key={entry.slug}>
              <Link
                href={`/winkels/${entry.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:text-brand"
              >
                <Icon name="pin" className="h-4 w-4 text-brand" /> {entry.city}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
