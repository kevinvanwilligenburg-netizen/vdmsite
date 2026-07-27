import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { KleurkiezerClient } from "@/components/KleurkiezerClient";
import { getColorCollections, getInitialColors } from "@/lib/colors";
import { euro } from "@/lib/format";
import { getProducts } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kleurkiezer – mengverf in elke kleur",
  description:
    "Kies online je kleur uit de RAL- en merkenwaaiers en bestel mengverf die wij gratis voor je mengen in de winkel. Muurverf en lak in elke kleur.",
  alternates: { canonical: "/kleurkiezer" },
};

export default async function KleurkiezerPage() {
  const [products, colors, collections] = await Promise.all([
    getProducts(),
    getInitialColors(),
    getColorCollections(),
  ]);
  const totalColors = collections.reduce((sum, entry) => sum + entry.count, 0);
  // Toon de populairste mengverven; de catalogus telt er honderden.
  const mixable = products
    .filter((product) => product.colorMixable && product.inStock !== false)
    .sort((a, b) => a.price - b.price)
    .slice(0, 6)
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      fromPrice: euro(product.price),
    }));

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Kleurkiezer" }]} />
      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          Kleurkiezer
        </h1>
        <p className="mt-3 text-ink-soft">
          Kies uit {totalColors.toLocaleString("nl-NL")} kleuren uit{" "}
          {collections.length} waaiers. Wij mengen je verf{" "}
          <strong className="text-ink">gratis</strong> in de winkel en zetten hem
          klaar bij je bestelling. De kleuren op je scherm zijn een indicatie; in
          de winkel leggen we de officiële waaier ernaast.
        </p>
      </header>
      <KleurkiezerClient colors={colors} products={mixable} />
    </div>
  );
}
