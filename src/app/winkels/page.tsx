import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { StoreCard } from "@/components/StoreCard";
import { winkelUsps } from "@/lib/stores";
import { getStores } from "@/lib/tilroy";

export const metadata: Metadata = {
  title: "Onze winkels – adressen en openingstijden",
  description:
    "Vind een De Voordeelmarkt bij jou in de buurt. Bekijk adressen en openingstijden en haal je online bestelling gratis op in de winkel.",
  alternates: { canonical: "/winkels" },
};

export default async function StoresPage() {
  const stores = await getStores();
  // Alleen wat op élke vestiging van toepassing is.
  const gedeeldeUsps = stores.length
    ? winkelUsps(stores[0]).filter((usp) =>
        stores.every((store) => winkelUsps(store).includes(usp)),
      )
    : [];
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

      {/*
        Wat in élke winkel geldt, één keer.

        Vijf kaarten met vijf keer dezelfde lijst eronder is ruis. En het is de
        doorsnede, niet de standaardlijst: zodra één vestiging een afwijkende
        set krijgt (parkeren verschilt per pand), verdwijnt dat punt hier
        vanzelf en blijft het alleen op de winkels staan waar het waar is.
      */}
      {gedeeldeUsps.length > 0 && (
        <ul className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border-2 border-ink/10 bg-white px-5 py-4">
          {gedeeldeUsps.map((usp) => (
            <li key={usp} className="flex items-start gap-2 text-sm font-semibold text-ink">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
              {usp}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </div>
    </div>
  );
}
