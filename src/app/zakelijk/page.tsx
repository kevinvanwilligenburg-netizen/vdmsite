import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProfpasAanvraag } from "@/components/zakelijk/ProfpasAanvraag";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { PrijsSchakelaar } from "@/components/prijs/PrijsWeergave";
import { CONTACT_EMAIL, CONTACT_PHONE, SITE_NAME } from "@/lib/site";
import { getStores } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Zakelijk inkopen: binnen 2 minuten besteld, ook op rekening",
  description:
    "Zakelijk verf inkopen zonder wachten op een accountmanager: KvK-nummer invullen, Profpas-korting direct verrekend, op rekening betalen via Billie en altijd gratis bezorgd.",
  alternates: { canonical: "/zakelijk" },
};

/**
 * De voorwaarden van de Profpas: 10% korting en altijd gratis verzending,
 * rechtstreeks door Kevin opgegeven (6/8/2026); de oude folderpagina
 * (/nl/profpas) bestaat niet meer.
 *
 * ⚠️ Niets hier verzinnen. Staat er op die pagina iets anders, dan is die
 * pagina leidend — een webshop die andere kortingen belooft dan de folder is
 * een discussie aan de balie.
 */
const VOORDELEN = [
  {
    icon: "tag",
    title: "Altijd 10% korting",
    text: "Op het hele assortiment, direct verrekend bij het afrekenen. Uitgezonderd Sikkens; vraag daar naar de voorwaarden.",
  },
  {
    icon: "truck",
    title: "Altijd gratis bezorgd",
    text: "Al je online bestellingen worden gratis thuis of op je werkadres bezorgd, ongeacht het bedrag.",
  },
  {
    icon: "store",
    title: "Op rekening kopen",
    text: "Bestellen en later betalen is mogelijk. Vraag naar de voorwaarden.",
  },
  {
    icon: "palette",
    title: "Bonus achteraf",
    text: "Boven € 10.000 per jaar krijg je 5% bonus terug, uitgekeerd in het eerste kwartaal daarna. Vanaf € 15.000 komt daar 2,5% bij.",
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
          Zakelijk
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
          Binnen 2 minuten zakelijk bestellen, zonder wachten op een
          accountmanager
        </h1>
        <p className="mt-4 max-w-2xl text-lg font-semibold text-white/80">
          Geen aanvraagformulier, geen offerte afwachten. Vul je mandje, kies{" "}
          <strong className="text-white">Zakelijk</strong> bij het afrekenen en
          vul je KvK-nummer in: je Profpas-korting wordt direct verrekend en je
          betaalt desgewenst op rekening. Verf mengen we gratis in elke kleur,
          terwijl je wacht.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/categorieen" className="btn btn-primary">
            Bestel direct zakelijk
          </Link>
          <a
            href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`}
            className="btn border-2 border-white/25 text-white hover:border-brand hover:text-brand-bright"
          >
            <Icon name="phone" className="h-5 w-5" /> {CONTACT_PHONE}
          </a>
        </div>
        <p className="mt-4 text-sm text-white/60">
          Prijzen liever exclusief btw? Zet de btw-schakelaar om, rechtsboven
          in de balk, of hieronder.
        </p>
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

      {/* De aanvraag zelf. Hier stond alleen "stuur een verzoek naar
          verkoop@" -- een doodlopende straat voor iemand die 's avonds op
          zijn telefoon zit. Aanvragen worden met de hand beoordeeld, dus dit
          formulier belooft geen korting; het zorgt dat de aanvraag compleet
          bij verkoop aankomt. */}
      <ProfpasAanvraag />

      {/* Twee dingen die vaak gevraagd worden en op de oude site apart
          stonden: de omzetting vanaf een Kluspas, en de btw-weergave. */}
      <section className="card flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="max-w-xl">
          <h2 className="font-black text-ink">Al een Kluspas?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Die zetten we eenmalig gratis om naar een Profpas. Stuur een verzoek
            naar{" "}
            <a href="mailto:verkoop@devoordeelmarkt.nl" className="font-bold text-brand hover:underline">
              verkoop@devoordeelmarkt.nl
            </a>
            .
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-ink">Prijzen tonen</p>
          <p className="mb-2 text-xs text-ink-soft">Reken je liever zonder btw?</p>
          <PrijsSchakelaar />
        </div>
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-xl font-black text-ink">Zo bestel je vandaag nog zakelijk</h2>
        <ol className="mt-4 space-y-4">
          {[
            {
              t: "Vul je mandje en kies 'Zakelijk' bij het afrekenen",
              d: "Gewoon in de webshop, wanneer het jou uitkomt, geen apart account nodig vooraf.",
            },
            {
              t: "Vul je KvK-nummer in, wij checken het direct",
              d: "Een Nederlands bedrijf legitimeert zich met zijn KvK-nummer; een Belgisch bedrijf met een btw-nummer dat we live bij het EU-register (VIES) controleren. Vink Profpas aan en je korting wordt meteen verrekend.",
            },
            {
              t: "Betaal zoals het jou past, ook op rekening",
              d: "iDEAL, creditcard, of op rekening met 30 dagen betaaltermijn via Billie zodra je bedrijfsnaam is ingevuld. Bezorging is voor zakelijke klanten gratis; afhalen kan binnen 2 uur in vijf winkels.",
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
        <p className="mt-5 border-t border-ink/10 pt-4 text-sm text-ink-soft">
          Grotere volumes of vaste afname? Voor staffelprijzen op de artikelen
          die je vaak koopt mail je{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Zakelijke%20staffelprijzen`}
            className="font-bold text-brand hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
, we nemen dezelfde werkdag contact op.
        </p>
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
