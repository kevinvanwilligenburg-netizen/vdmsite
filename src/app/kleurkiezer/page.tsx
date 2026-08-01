import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { KleurTrechter } from "@/components/kleur/KleurTrechter";
import { Waaiers } from "@/components/kleur/Waaiers";
import { MyColors } from "@/components/MyColors";
import { getInitialColors, getWaaierOverzicht } from "@/lib/colors";
import { kleurtestersActief } from "@/lib/instellingen";
import { getProducts } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kleurkiezer – mengverf in elke kleur",
  description:
    "Kies online je kleur uit de RAL- en merkenwaaiers. Onze verfspecialist mengt hem gratis en je krijgt hem bezorgd of haalt hem op. Muurverf en lak in elke kleur.",
  alternates: { canonical: "/kleurkiezer" },
};

export default async function KleurkiezerPage() {
  const [products, colors, collections, testers] = await Promise.all([
    getProducts(),
    getInitialColors(),
    getWaaierOverzicht(),
    kleurtestersActief(),
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
          indicatie; twijfel je, leg dan de officiële waaier ernaast in de
          winkel
          {testers ? (
            <>
              {" "}
              of{" "}
              <Link href="/kleurstalen" className="font-bold text-brand hover:underline">
                bestel een kleurtester
              </Link>{" "}
              — het bedrag krijg je terug als voucher bij je verf.
            </>
          ) : (
            " — onze verfspecialist denkt gratis met je mee."
          )}
        </p>
      </header>
      <MyColors />
      {/* De trechter leest ?waaier= uit de URL, en dat mag de rest van de
          pagina niet dynamisch maken: de kop, de tekst en de waaierlijst
          eronder blijven zo gewoon statisch gerenderd (belangrijk voor SEO). */}
      {/* Vast anker, zodat een klik op een waaier onderaan de pagina ook
          echt bij de kiezer uitkomt. */}
      <div id="kleuren" className="scroll-mt-24">
        <Suspense
          fallback={<div className="h-96 animate-pulse rounded-xl bg-black/5" aria-hidden />}
        >
          <KleurTrechter initialColors={colors} producten={products} />
        </Suspense>
      </div>
      {/* De waaiers uitgeschreven: dat we naast RAL ook Sikkens, Flexa,
          Histor en NCS mengen is het argument om hier te bestellen, en dat
          zag je niet zolang het in een keuzelijst zat. */}
      <Waaiers collections={collections} />
    </div>
  );
}
