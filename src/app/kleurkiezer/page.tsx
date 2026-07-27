import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { KleurkiezerClient } from "@/components/KleurkiezerClient";
import { euro } from "@/lib/format";
import { ralColors } from "@/lib/ral";
import { getProducts } from "@/lib/tilroy";

export const metadata: Metadata = {
  title: "Kleurkiezer – kies uit 140+ RAL-kleuren",
  description:
    "Kies online je RAL-kleur en bestel mengverf die wij gratis voor je mengen in de winkel. Muurverf en lak in elke kleur, klaar terwijl je bestelling wordt ingepakt.",
  alternates: { canonical: "/kleurkiezer" },
};

export default async function KleurkiezerPage() {
  const products = await getProducts();
  const mixable = products
    .filter((product) => product.colorMixable)
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
          Kies uit meer dan 140 RAL-kleuren. Wij mengen je verf{" "}
          <strong className="text-ink">gratis</strong> in de winkel en zetten hem
          klaar bij je bestelling. De kleuren op je scherm zijn een indicatie; in
          de winkel leggen we de officiële RAL-waaier ernaast.
        </p>
      </header>
      <KleurkiezerClient colors={ralColors} products={mixable} />
    </div>
  );
}
