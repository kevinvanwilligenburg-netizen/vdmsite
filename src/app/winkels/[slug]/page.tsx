import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { mapsUrl } from "@/lib/stores";
import { absoluteUrl } from "@/lib/site";
import { getStore, getStores } from "@/lib/tilroy";

export const revalidate = 300;

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
  return {
    title: `${store.name} – adres en openingstijden`,
    description: `Bezoek ${store.name} aan de ${store.address} in ${store.city}. Bekijk de openingstijden en haal je online bestelling hier gratis op.`,
    alternates: { canonical: `/winkels/${store.slug}` },
  };
}

export default async function StorePage({ params }: Props) {
  const store = await getStore(params.slug);
  if (!store) notFound();

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "HardwareStore",
    name: store.name,
    url: absoluteUrl(`/winkels/${store.slug}`),
    telephone: store.phone,
    ...(store.email ? { email: store.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      postalCode: store.postalCode,
      addressLocality: store.city,
      addressCountry: "NL",
    },
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

      <header>
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          {store.name}
        </h1>
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
          {store.email && (
            <p className="mt-1">
              <a
                href={`mailto:${store.email}`}
                className="inline-flex items-center gap-2 font-semibold text-ink hover:text-brand"
              >
                <Icon name="mail" className="h-4 w-4 text-brand" /> {store.email}
              </a>
            </p>
          )}
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
              zodra je daarover bericht hebt gekregen.
            </p>
          </div>
        </section>

        {store.openingHours.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
