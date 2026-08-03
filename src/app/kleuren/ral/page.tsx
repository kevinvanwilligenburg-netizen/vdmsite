import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { kleurtestersActief } from "@/lib/instellingen";
import { alleRalKleuren, ralSlug } from "@/lib/kleurpaginas";
import { RAL_GROUPS } from "@/lib/ral";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Alle RAL-kleuren: verf op kleur gemengd",
  description:
    "De complete RAL Classic-waaier met alle codes en kleurnamen. Kies je RAL-kleur en wij mengen hem gratis in muurverf, lak, grondverf of beits.",
  alternates: { canonical: "/kleuren/ral" },
};

export default async function RalOverzichtPage() {
  const kleuren = alleRalKleuren();
  const testers = await kleurtestersActief();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "RAL-kleuren",
    description: "Alle RAL Classic-kleuren, elk gratis te mengen in verf.",
    url: absoluteUrl("/kleuren/ral"),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: kleuren.length,
      itemListElement: kleuren.slice(0, 50).map((kleur, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `RAL ${kleur.code} ${kleur.name}`,
        url: absoluteUrl(`/kleuren/ral/${ralSlug(kleur)}`),
      })),
    },
  };

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Kleuren", href: "/kleuren" },
          { name: "RAL" },
        ]}
      />
      <JsonLd data={jsonLd} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          RAL-kleuren
        </h1>
        <p className="mt-3 text-ink-soft">
          RAL Classic telt {kleuren.length} kleuren en is de standaard voor
          schilderwerk aan kozijnen, deuren en gevels. Kies hieronder je kleur:
          op elke kleurpagina zie je in welke verfsoorten we hem mengen, gratis,
          klaar terwijl je wacht of bezorgd. De kleuren op je scherm zijn een
          indicatie; RAL kent geen officiële schermwaarden, dus leg bij twijfel
          de officiële waaier ernaast in de winkel
          {testers ? (
            <>
              {" "}
              of bestel een{" "}
              <Link href="/kleurstalen" className="font-bold text-brand hover:underline">
                kleurtester
              </Link>
            </>
          ) : (
            ", waar onze verfspecialist gratis met je meedenkt"
          )}
          .
        </p>
      </header>

      {RAL_GROUPS.map((groep) => {
        const inGroep = kleuren.filter((kleur) => kleur.group === groep);
        if (inGroep.length === 0) return null;
        return (
          <section key={groep} aria-labelledby={`groep-${groep}`}>
            <h2
              id={groep}
              className="scroll-mt-40 border-b-2 border-ink/10 pb-1 text-lg font-black text-brand"
            >
              {groep}{" "}
              <span className="font-semibold text-ink-soft">({inGroep.length})</span>
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {inGroep.map((kleur) => (
                <li key={kleur.code}>
                  <Link
                    href={`/kleuren/ral/${ralSlug(kleur)}`}
                    className="block rounded-xl border-2 border-ink/10 p-2.5 transition hover:border-brand"
                  >
                    <span
                      className="block h-12 rounded-lg ring-1 ring-black/10"
                      style={{ backgroundColor: kleur.hex }}
                      aria-hidden
                    />
                    <span className="mt-1.5 block truncate text-sm font-bold text-ink">
                      RAL {kleur.code}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">{kleur.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
