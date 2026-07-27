import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
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
  const stores = await getStores();
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
      <h1 className="text-3xl font-black uppercase italic text-ink">Afrekenen</h1>
      <CheckoutForm stores={storeOptions} />
    </div>
  );
}
