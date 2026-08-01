import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { euro } from "@/lib/format";
import {
  findRalBySlug,
  hexNaarRgb,
  mengproductenPerSoort,
  ralSlug,
  verwanteRalKleuren,
} from "@/lib/kleurpaginas";
import { kleurtestersActief } from "@/lib/instellingen";
import { STAAL_PRIJS_TEKST } from "@/lib/stalen";
import { getProducts } from "@/lib/tilroy";

export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: { slug: string };
}

/**
 * Alleen de veelgekozen kleuren vooraf bouwen; de rest op aanvraag (ISR).
 * Alle 213 tegelijk laten elke build-worker de productfeed apart ophalen, en
 * te veel parallelle verzoeken lokken bot-mitigatie uit bij de bron.
 */
export function generateStaticParams() {
  const codes = new Set(["9010", "9016", "9001", "7016", "7021", "9005", "6009"]);
  return [...codes].flatMap((code) => {
    const kleur = findRalBySlug(`ral-${code}`);
    return kleur ? [{ slug: ralSlug(kleur) }] : [];
  });
}

export function generateMetadata({ params }: Props): Metadata {
  const kleur = findRalBySlug(params.slug);
  if (!kleur) return {};
  const naam = `RAL ${kleur.code} ${kleur.name}`;
  return {
    title: `${naam} verf kopen — gemengd in elke verfsoort`,
    description: `Verf in ${naam} bestellen? Wij mengen deze kleur gratis in muurverf, lak, grondverf en beits. Vandaag gemengd, bezorgd of gratis afgehaald in de winkel.`,
    alternates: { canonical: `/kleuren/ral/${ralSlug(kleur)}` },
  };
}

export default async function RalKleurPage({ params }: Props) {
  const kleur = findRalBySlug(params.slug);
  if (!kleur) notFound();
  // De code is leidend; een oude of afwijkende naamvorm stuurt blijvend door
  // naar de canonieke URL in plaats van dezelfde pagina op twee adressen.
  const canoniek = ralSlug(kleur);
  if (params.slug !== canoniek) permanentRedirect(`/kleuren/ral/${canoniek}`);

  const [products, testers] = await Promise.all([getProducts(), kleurtestersActief()]);
  const mengbaar = mengproductenPerSoort(products);
  const verwant = verwanteRalKleuren(kleur);
  const rgb = hexNaarRgb(kleur.hex);
  const naam = `RAL ${kleur.code} ${kleur.name}`;
  const kleurKey = `ral:${kleur.code}`;

  const faqs = [
    {
      q: `In welke verf kan ik ${naam} laten mengen?`,
      a: `In vrijwel al onze mengverf: muurverf, lak (hoogglans, zijdeglans en mat), grondverf en beits. Onze verfspecialist mengt de kleur gratis en kiest automatisch de juiste mengbasis. Hierboven zie je per verfsoort een startpunt.`,
    },
    {
      q: `Klopt de kleur op mijn scherm?`,
      a: `Schermkleuren zijn een indicatie: RAL kent geen officiële schermwaarden en elk beeldscherm wijkt af. Leg bij twijfel de officiële RAL-waaier ernaast in een van onze winkels, of bestel eerst een kleurtester voor ${STAAL_PRIJS_TEKST} — dat bedrag krijg je als voucher terug bij aankoop van je verf.`,
    },
    {
      q: `Kan op kleur gemengde verf retour?`,
      a: `Nee — verf die speciaal voor jou in ${naam} is gemengd, is maatwerk en valt buiten het herroepingsrecht. Twijfel je over de kleur, bestel dan eerst een kleurtester of kom langs in de winkel.`,
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
          { name: "RAL", href: "/kleuren/ral" },
          { name: naam },
        ]}
      />
      <JsonLd data={faqJsonLd} />

      <header className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div
          className="min-h-56 rounded-2xl ring-1 ring-black/10 lg:min-h-72"
          style={{ backgroundColor: kleur.hex }}
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            RAL Classic · {kleur.group}
          </p>
          <h1 className="mt-1 text-3xl font-black uppercase text-ink sm:text-4xl">{naam}</h1>
          <p className="mt-3 text-ink-soft">
            {kleur.name} ({kleur.code}) uit de groep {kleur.group.toLowerCase()} van de
            RAL Classic-waaier. Wij mengen deze kleur gratis in de verf die jij
            kiest — klaar terwijl je wacht in de winkel, of morgen in huis.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-ink/5 p-3">
              <dt className="font-bold text-ink">Kleurcode</dt>
              <dd className="text-ink-soft">RAL {kleur.code}</dd>
            </div>
            <div className="rounded-lg bg-ink/5 p-3">
              <dt className="font-bold text-ink">Indicatie (scherm)</dt>
              <dd className="text-ink-soft">
                {kleur.hex.toUpperCase()}
                {rgb ? ` · RGB ${rgb}` : ""}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            {testers && (
              <Link
                href={`/kleurstalen?kleur=${encodeURIComponent(kleurKey)}`}
                className="btn btn-primary"
              >
                <Icon name="palette" className="h-5 w-5" /> Kleurtester bestellen ·{" "}
                {STAAL_PRIJS_TEKST}
              </Link>
            )}
            <Link
              href="/kleurkiezer"
              className={
                testers
                  ? "btn border-2 border-ink/10 text-ink hover:border-brand hover:text-brand"
                  : "btn btn-primary"
              }
            >
              {testers ? "Andere kleur zoeken" : "Zoek je kleur in de kleurkiezer"}
            </Link>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Het testerbedrag krijg je terug als voucher zodra je de verf koopt.
          </p>
        </div>
      </header>

      {mengbaar.length > 0 && (
        <section aria-labelledby="mengbaar-titel">
          <h2 id="mengbaar-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
            Verf in {naam}
          </h2>
          <p className="mt-1 max-w-3xl text-ink-soft">
            Kies je verfsoort — de kleur staat alvast voor je klaar op de
            productpagina.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mengbaar.map(({ soort, product }) => (
              <li key={product.id}>
                <Link
                  href={`/product/${product.slug}?kleur=${encodeURIComponent(kleurKey)}`}
                  className="flex h-full flex-col rounded-xl border-2 border-ink/10 p-4 transition hover:border-brand"
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-brand">
                    {soort}
                  </span>
                  <span className="mt-1 font-bold text-ink">{product.name}</span>
                  <span className="mt-auto pt-2 text-sm text-ink-soft">
                    vanaf <strong className="text-ink">{euro(product.price)}</strong> · gratis
                    gemengd
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {verwant.length > 0 && (
        <section aria-labelledby="verwant-titel">
          <h2 id="verwant-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
            Kleuren in de buurt
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {verwant.map((buur) => (
              <li key={buur.code}>
                <Link
                  href={`/kleuren/ral/${ralSlug(buur)}`}
                  className="block rounded-xl border-2 border-ink/10 p-2.5 transition hover:border-brand"
                >
                  <span
                    className="block h-10 rounded-lg ring-1 ring-black/10"
                    style={{ backgroundColor: buur.hex }}
                    aria-hidden
                  />
                  <span className="mt-1.5 block truncate text-sm font-bold text-ink">
                    RAL {buur.code}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">{buur.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="kleur-faq-titel" className="max-w-3xl">
        <h2 id="kleur-faq-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
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
