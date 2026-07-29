import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { KleurTrechter } from "@/components/kleur/KleurTrechter";
import { MyColors } from "@/components/MyColors";
import { getColorCollections, getInitialColors } from "@/lib/colors";
import { getProducts } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kleurkiezer – mengverf in elke kleur",
  description:
    "Kies online je kleur uit de RAL- en merkenwaaiers. Onze verfspecialist mengt hem gratis en je krijgt hem bezorgd of haalt hem op. Muurverf en lak in elke kleur.",
  alternates: { canonical: "/kleurkiezer" },
};

export default async function KleurkiezerPage() {
  const [products, colors, collections] = await Promise.all([
    getProducts(),
    getInitialColors(),
    getColorCollections(),
  ]);
  const totalColors = collections.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Kleurkiezer" }]} />
      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          Kleurkiezer
        </h1>
        <p className="mt-3 text-ink-soft">
          Kies uit {totalColors.toLocaleString("nl-NL")} kleuren uit{" "}
          {collections.length} waaiers. Onze verfspecialist mengt jouw kleur{" "}
          <strong className="text-ink">gratis</strong> aan — daarna bezorgen we
          hem of zet je hem zelf even op. De kleuren op je scherm zijn een
          indicatie; twijfel je, leg dan de officiële waaier ernaast in de winkel.
        </p>
      </header>
      <MyColors />
      <KleurTrechter initialColors={colors} producten={products} />
    </div>
  );
}
