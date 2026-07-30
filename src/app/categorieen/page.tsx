import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductArt } from "@/components/ProductArt";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getCategories } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Alle categorieën",
  description:
    "Het complete assortiment van De Voordeelmarkt per categorie: verf, behang, gereedschap, bevestigingsmateriaal, lijmen en kitten. Online bestellen of gratis afhalen.",
  alternates: { canonical: "/categorieen" },
};

/**
 * Het complete rubriekenoverzicht.
 *
 * Menu en footer tonen bewust alleen de grote rubrieken — anders wordt het een
 * lijst van tweeënzeventig regels waarin niemand iets vindt. Maar de kleine
 * rubrieken moeten wél ergens vandaan te bereiken zijn, anders is er
 * assortiment dat je alleen via de zoekbalk vindt. Dit is die plek.
 */
export default async function CategorieenPage() {
  const categories = await getCategories();
  const gesorteerd = [...categories].sort((a, b) => b.count - a.count);
  const totaal = gesorteerd.reduce((som, category) => som + category.count, 0);

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Categorieën" }]} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          Alle categorieën
        </h1>
        <p className="mt-3 text-ink-soft">
          {totaal.toLocaleString("nl-NL")} artikelen, verdeeld over{" "}
          {gesorteerd.length} rubrieken — dezelfde indeling als in de winkel.
          Alles uit voorraad, gratis af te halen of thuisbezorgd.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {gesorteerd.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/categorie/${category.slug}`}
              className="card flex h-full flex-col overflow-hidden transition hover:shadow-lift"
            >
              <ProductArt
                icon={category.icon}
                hue={category.hue}
                size="sm"
                label={category.name}
              />
              <div className="flex flex-1 flex-col p-3">
                <p className="font-black text-ink">{category.name}</p>
                <p className="mt-auto pt-1 text-sm text-ink-soft">
                  {category.count.toLocaleString("nl-NL")}{" "}
                  {category.count === 1 ? "artikel" : "artikelen"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": absoluteUrl("/categorieen#pagina"),
          name: `Categorieën bij ${SITE_NAME}`,
          url: absoluteUrl("/categorieen"),
          description:
            "Het complete assortiment van De Voordeelmarkt, ingedeeld per categorie.",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: gesorteerd.length,
            itemListElement: gesorteerd.map((category, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: category.name,
              url: absoluteUrl(`/categorie/${category.slug}`),
            })),
          },
        }}
      />
    </div>
  );
}
