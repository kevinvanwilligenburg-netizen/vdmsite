import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SearchResults } from "@/components/search/SearchResults";
import { getProducts } from "@/lib/tilroy";

export const metadata: Metadata = {
  title: "Zoeken",
  description: "Zoek in het assortiment van De Voordeelmarkt.",
  robots: { index: false, follow: true },
};

export default async function SearchPage() {
  const products = await getProducts();
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Zoeken" }]} />
      <h1 className="text-3xl font-black uppercase italic text-ink">Zoeken</h1>
      <Suspense fallback={<p className="text-ink-soft">Zoekresultaten laden…</p>}>
        <SearchResults products={products} />
      </Suspense>
    </div>
  );
}
