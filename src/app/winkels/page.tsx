import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StoreCard } from "@/components/StoreCard";
import { getStores } from "@/lib/tilroy";

export const metadata: Metadata = {
  title: "Onze winkels – adressen en openingstijden",
  description:
    "Vind een De Voordeelmarkt bij jou in de buurt. Bekijk adressen en openingstijden en haal je online bestelling gratis op in de winkel.",
  alternates: { canonical: "/winkels" },
};

export default async function StoresPage() {
  const stores = await getStores();
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Winkels" }]} />
      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase italic text-ink sm:text-4xl">
          Onze winkels
        </h1>
        <p className="mt-3 text-ink-soft">
          Bestel online en haal gratis op in een van onze {stores.length}{" "}
          winkels. Je krijgt bericht met een afhaalcode zodra je bestelling
          klaarstaat, meestal al binnen een paar uur.
        </p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </div>
    </div>
  );
}
