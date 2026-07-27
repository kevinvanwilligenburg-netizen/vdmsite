import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { CONTACT_EMAIL, CONTACT_PHONE, SITE_NAME } from "@/lib/site";
import { getStores } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Zakelijk inkopen — voor schilders en klusbedrijven",
  description:
    "Professioneel inkopen bij De Voordeelmarkt: scherpe staffelprijzen op verf, gratis mengen in elke kleur, snel afhalen in vijf winkels en op rekening bestellen.",
  alternates: { canonical: "/zakelijk" },
};

const VOORDELEN = [
  {
    icon: "tag",
    title: "Scherpe prijzen, ook op grote aantallen",
    text: "Vaste lage prijzen en staffels op verf en materialen. Vraag een offerte voor je project.",
  },
  {
    icon: "palette",
    title: "Verf mengen terwijl je wacht",
    text: "Elke kleur uit meer dan 140 waaiers, gratis gemengd. Ook grotere partijen in dezelfde kleur.",
  },
  {
    icon: "store",
    title: "Snel afhalen, vijf vestigingen",
    text: "Vandaag besteld, binnen twee uur klaar in de winkel die het op voorraad heeft.",
  },
  {
    icon: "truck",
    title: "Op de klus bezorgd",
    text: "Gratis bezorging in heel Nederland — vóór 10:00 besteld uit onze webshopvoorraad is dezelfde dag in huis.",
  },
];

export default async function BusinessPage() {
  const stores = await getStores();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Zakelijk inkopen bij ${SITE_NAME}`,
    serviceType: "Zakelijke levering van verf en klusmaterialen",
    provider: { "@type": "Organization", name: SITE_NAME },
    areaServed: { "@type": "Country", name: "Nederland" },
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Schilders, klusbedrijven, aannemers en vastgoedbeheerders",
    },
  };

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Zakelijk" }]} />
      <JsonLd data={jsonLd} />

      <section className="overflow-hidden rounded-2xl bg-ink p-8 text-white sm:p-12">
        <p className="inline-block rounded-md bg-brand px-3 py-1.5 text-sm font-black uppercase">
          Voor professionals
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
          Professioneel inkopen bij De Voordeelmarkt
        </h1>
        <p className="mt-4 max-w-2xl text-lg font-semibold text-white/80">
          Schilder, klusbedrijf of vastgoedbeheerder? Je koopt bij ons tegen
          scherpe prijzen in, laat verf gratis mengen in elke kleur en haalt je
          spullen op wanneer het jou uitkomt — in vijf winkels in Oost- en
          Noordoost-Nederland.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={`mailto:${CONTACT_EMAIL}?subject=Zakelijk%20account`} className="btn btn-primary">
            Vraag een zakelijk account aan
          </a>
          <a
            href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`}
            className="btn border-2 border-white/25 text-white hover:border-brand hover:text-brand-bright"
          >
            <Icon name="phone" className="h-5 w-5" /> {CONTACT_PHONE}
          </a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VOORDELEN.map((voordeel) => (
          <div key={voordeel.title} className="card p-5">
            <span className="inline-flex text-brand" aria-hidden>
              <Icon name={voordeel.icon} className="h-8 w-8" strokeWidth={1.8} />
            </span>
            <h2 className="mt-2 font-black text-ink">{voordeel.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{voordeel.text}</p>
          </div>
        ))}
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-xl font-black text-ink">Hoe werkt het?</h2>
        <ol className="mt-4 space-y-4">
          {[
            {
              t: "Vraag een zakelijk account aan",
              d: "Mail of bel ons met je bedrijfsgegevens en KvK-nummer. We nemen dezelfde werkdag contact op.",
            },
            {
              t: "Ontvang je prijzen",
              d: "Je krijgt prijzen die passen bij wat je afneemt, inclusief staffels op de artikelen die je vaak koopt.",
            },
            {
              t: "Bestel online of in de winkel",
              d: "Bestel wanneer het uitkomt en haal op in de dichtstbijzijnde vestiging, of laat het bezorgen op de klus.",
            },
          ].map((stap, index) => (
            <li key={stap.t} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-black text-white">
                {index + 1}
              </span>
              <span>
                <span className="block font-bold text-ink">{stap.t}</span>
                <span className="block text-sm text-ink-soft">{stap.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-brand-light p-6 sm:p-8">
        <h2 className="text-xl font-black text-ink">Kom langs bij een van onze winkels</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Onze mensen kennen het vak. Loop binnen voor kleuradvies, een offerte
          of gewoon om te overleggen wat je nodig hebt.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {stores.map((store) => (
            <li key={store.slug}>
              <Link
                href={`/winkels/${store.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:text-brand"
              >
                <Icon name="pin" className="h-4 w-4 text-brand" /> {store.city}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
