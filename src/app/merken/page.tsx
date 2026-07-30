import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";
import { isVerfmerk, verfmerken, verfrubrieken } from "@/lib/merkpagina";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getBrands, getCategories, getProducts, type BrandSummary } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Alle verfmerken en klusmerken",
  description:
    "Histor, Flexa, Sikkens, Fitex, Hammerite en meer — alle merken die wij voeren, met het complete assortiment per merk en de laagste prijs.",
  alternates: { canonical: "/merken" },
};

/**
 * Merkenoverzicht.
 *
 * Verf staat bovenaan en apart: dat is waar De Voordeelmarkt om bekendstaat,
 * en klanten zoeken vaak eerst op merk ("hebben jullie Sikkens?"). De rest
 * van het assortiment volgt daaronder.
 *
 * Welke merken verfmerken zijn wordt uit de artikelen afgeleid (zie
 * lib/merkpagina.ts) en niet uit één rubrieknaam. Die stond hier eerst wél,
 * en toen die rubriek verdween viel de bovenste helft van de pagina stilletjes
 * weg.
 */

/** Onder dit aantal is een rubriek geen wegwijzer waard. */
const MIN_ARTIKELEN_VOOR_RUBRIEKLINK = 8;

function BrandGrid({ brands }: { brands: BrandSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {brands.map((brand) => (
        <li key={brand.slug}>
          <Link
            href={`/merk/${brand.slug}`}
            className="card flex h-full flex-col overflow-hidden transition hover:shadow-lift"
          >
            <div className="bg-white">
              <ProductArt
                icon="tag"
                hue={25}
                image={brand.image}
                size="sm"
                label={brand.name}
              />
            </div>
            <div className="flex flex-1 flex-col p-3">
              <p className="font-black text-ink">{brand.name}</p>
              <p className="text-sm text-ink-soft">
                {brand.count} {brand.count === 1 ? "artikel" : "artikelen"}
              </p>
              <p className="mt-auto pt-2 text-sm font-bold text-brand">
                vanaf {euro(brand.fromPrice)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function MerkenPage() {
  // Ruim boven het aantal merken dat de catalogus kent (nu 56 met drie of meer
  // artikelen). Deze pagina hoort ze állemaal te tonen, en de zin hieronder
  // noemt het aantal — een limiet die stilletjes afkapt maakt die zin onwaar.
  const [alleMerken, producten, categorieen] = await Promise.all([
    getBrands(200),
    getProducts(),
    getCategories(),
  ]);

  const verf = verfmerken(producten);
  const verfMerken = alleMerken.filter((brand) => isVerfmerk(verf, brand.name));
  const overige = alleMerken.filter((brand) => !isVerfmerk(verf, brand.name));

  // De verfrubrieken als wegwijzer onder de kop. Dit verving de knop "Alle
  // verf", die naar /categorie/verf wees — een pagina die sinds de overgang
  // naar de indeling van Tilroy een 404 gaf.
  const rubrieken = verfrubrieken(producten);
  const verfCategorieen = categorieen
    .filter(
      (categorie) =>
        rubrieken.has(categorie.slug) && categorie.count >= MIN_ARTIKELEN_VOOR_RUBRIEKLINK,
    )
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Merken" }]} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">Onze merken</h1>
        <p className="mt-3 text-ink-soft">
          Van Sikkens, Histor en Flexa tot ons eigen Fitex: {alleMerken.length} merken
          staan online, waarvan {verfMerken.length} met verf. Per merk zie je hoeveel
          artikelen er zijn en vanaf welke prijs.
        </p>
      </header>

      {verfMerken.length > 0 && (
        <section aria-labelledby="verfmerken">
          <div className="mb-4">
            <h2 id="verfmerken" className="text-2xl font-black uppercase text-ink">
              Verfmerken
            </h2>
            <p className="mt-1 text-ink-soft">
              Muurverf, lak, beits en speciaalverf. Mengen doen we gratis, in elke kleur.
            </p>
            {verfCategorieen.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {verfCategorieen.map((categorie) => (
                  <Link
                    key={categorie.slug}
                    href={`/categorie/${categorie.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink/10 py-1.5 pl-3 pr-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
                  >
                    {categorie.name}
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                      {categorie.count}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <BrandGrid brands={verfMerken} />
        </section>
      )}

      {overige.length > 0 && (
        <section aria-labelledby="overige-merken">
          <h2 id="overige-merken" className="mb-4 text-2xl font-black uppercase text-ink">
            Overige merken
          </h2>
          <BrandGrid brands={overige} />
        </section>
      )}

      <section className="rounded-2xl bg-brand-light p-6 sm:p-8">
        <h2 className="text-xl font-black uppercase text-ink">Merk niet gevonden?</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Ons assortiment in de winkel is groter dan wat online staat. Bel of mail
          gerust — vaak kunnen we het bestellen of hebben we een gelijkwaardig
          alternatief voor een scherpere prijs.
        </p>
        <Link href="/klantenservice" className="btn btn-primary mt-4">
          Neem contact op
        </Link>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": absoluteUrl("/merken#pagina"),
          name: `Merken bij ${SITE_NAME}`,
          url: absoluteUrl("/merken"),
          description:
            "Alle verfmerken en klusmerken die De Voordeelmarkt voert, met het complete assortiment per merk.",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: verfMerken.length + overige.length,
            itemListElement: [...verfMerken, ...overige].slice(0, 40).map((brand, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: brand.name,
              url: absoluteUrl(`/merk/${brand.slug}`),
            })),
          },
        }}
      />
    </div>
  );
}
