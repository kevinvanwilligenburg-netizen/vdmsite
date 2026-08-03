import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { Waaiers } from "@/components/kleur/Waaiers";
import { getWaaierOverzicht, populairPaintColors } from "@/lib/colors";
import { kleurtestersActief } from "@/lib/instellingen";
import { alleRalKleuren, ralSlug } from "@/lib/kleurpaginas";
import { RAL_GROUPS } from "@/lib/ral";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Verfkleuren: RAL-kleuren en alle merkenwaaiers",
  description:
    "Bekijk alle verfkleuren: de complete RAL Classic-waaier en ruim 140 merkenwaaiers van o.a. Sikkens, Flexa en Histor. Elke kleur mengen we gratis in jouw verf.",
  alternates: { canonical: "/kleuren" },
};

export default async function KleurenPage() {
  const [collections, testers] = await Promise.all([
    getWaaierOverzicht(),
    kleurtestersActief(),
  ]);
  const ral = alleRalKleuren();
  const populair = populairPaintColors();
  const totaalKleuren = collections.reduce((som, entry) => som + entry.count, 0);

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Kleuren" }]} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          Verfkleuren
        </h1>
        <p className="mt-3 text-ink-soft">
          Van RAL 9010 voor je kozijnen tot een diep dennengroen voor de
          voordeur: wij mengen{" "}
          <strong className="text-ink">
            {totaalKleuren.toLocaleString("nl-NL")} kleuren
          </strong>{" "}
          uit {collections.length} waaiers, gratis en in de verf die jij kiest.
          {testers ? (
            <>
              {" "}
              Twijfel je tussen twee tinten? Bestel eerst een{" "}
              <Link href="/kleurstalen" className="font-bold text-brand hover:underline">
                kleurtester
              </Link>{" "}
, het bedrag krijg je terug als voucher bij je verf.
            </>
          ) : (
            " Twijfel je tussen twee tinten? Leg de officiële waaier ernaast in een van onze winkels; onze verfspecialist denkt gratis met je mee."
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/kleurkiezer" className="btn btn-primary">
            <Icon name="palette" className="h-5 w-5" /> Open de kleurkiezer
          </Link>
          <Link
            href="/kleuren/ral"
            className="btn border-2 border-ink/10 text-ink hover:border-brand hover:text-brand"
          >
            Alle RAL-kleuren
          </Link>
        </div>
      </header>

      {/* De kleuren waar de mengmachine dagelijks op draait. */}
      <section aria-labelledby="populair-titel">
        <h2 id="populair-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
          Veelgekozen kleuren
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {populair.map((kleur) => {
            const ralKleur = ral.find((entry) => `RAL ${entry.code}` === kleur.code);
            if (!ralKleur) return null;
            return (
              <li key={kleur.key}>
                <Link
                  href={`/kleuren/ral/${ralSlug(ralKleur)}`}
                  className="block rounded-xl border-2 border-ink/10 p-3 transition hover:border-brand"
                >
                  <span
                    className="block h-14 rounded-lg ring-1 ring-black/10"
                    style={{ backgroundColor: kleur.hex }}
                    aria-hidden
                  />
                  <span className="mt-2 block truncate font-bold text-ink">{kleur.code}</span>
                  <span className="block truncate text-sm text-ink-soft">{kleur.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* RAL Classic per kleurgroep: de waaier waar de winkel op mengt. */}
      <section aria-labelledby="ral-titel">
        <div className="flex items-end justify-between gap-4">
          <h2 id="ral-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
            RAL-kleuren
          </h2>
          <Link href="/kleuren/ral" className="font-bold text-brand hover:underline">
            Alle {ral.length} RAL-kleuren →
          </Link>
        </div>
        <p className="mt-1 max-w-3xl text-ink-soft">
          RAL Classic is dé standaard voor kozijnen, deuren en gevels. Elke code
          heeft een eigen pagina met de verfsoorten die we erin mengen.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {RAL_GROUPS.map((groep) => {
            const kleuren = ral.filter((kleur) => kleur.group === groep);
            return (
              <li key={groep}>
                <Link
                  href={`/kleuren/ral#${encodeURIComponent(groep)}`}
                  className="block rounded-xl border-2 border-ink/10 p-3 transition hover:border-brand"
                >
                  <span className="flex gap-1" aria-hidden>
                    {kleuren.slice(0, 6).map((kleur) => (
                      <span
                        key={kleur.code}
                        className="h-5 flex-1 rounded-sm ring-1 ring-black/10 first:rounded-l-md last:rounded-r-md"
                        style={{ backgroundColor: kleur.hex }}
                      />
                    ))}
                  </span>
                  <span className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold text-ink">{groep}</span>
                    <span className="shrink-0 text-sm font-semibold text-ink-soft">
                      {kleuren.length}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alle merkenwaaiers, bladerbaar — zelfde component als de kleurkiezer. */}
      <Waaiers collections={collections} />
    </div>
  );
}
