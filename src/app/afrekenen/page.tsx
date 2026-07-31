import type { Metadata } from "next";
import { cookies } from "next/headers";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Mark } from "@/components/Mark";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { emailVanSessie, SESSIE_COOKIE, voorkeurWinkel } from "@/lib/account";
import { pickupPromise } from "@/lib/pickup";
import { getStores } from "@/lib/tilroy";

// De afhaalbelofte hangt van het tijdstip af, dus niet cachen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Afrekenen",
  description: "Rond je bestelling af en kies je afhaalwinkel.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [stores, email] = await Promise.all([
    getStores(),
    emailVanSessie(cookies().get(SESSIE_COOKIE)?.value),
  ]);
  // De winkel die de klant in zijn account koos; die reist mee naar een
  // ander apparaat, de lokale winkelkiezer niet.
  const voorkeur = email ? await voorkeurWinkel(email) : null;
  const storeOptions = stores.map((store) => ({
    id: store.id,
    slug: store.slug,
    name: store.name,
    address: store.address,
    city: store.city,
    // Afhaalbelofte op basis van de openingstijden van die winkel.
    pickupLabel: pickupPromise(store).label,
  }));
  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Winkelwagen", href: "/winkelwagen" },
          { name: "Afrekenen" },
        ]}
      />
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-black uppercase italic text-ink">Afrekenen</h1>
        {/* Mark bij het afrekenen: een gezicht op het spannendste moment.
            Klein en terzijde — hij moet geruststellen, niet afleiden. */}
        <div className="hidden shrink-0 items-end gap-4 sm:flex">
          <div className="w-44"><TrustpilotWidget variant="micro" /></div>
          <div className="w-40"><Mark pose="mengen" hoogte="h-24" /></div>
        </div>
      </div>
      <CheckoutForm
        stores={storeOptions}
        ingelogdAls={email ?? undefined}
        voorkeurWinkel={voorkeur ?? undefined}
      />
    </div>
  );
}
