import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getStores } from "@/lib/tilroy";

export const metadata: Metadata = {
  title: "Afrekenen",
  description: "Rond je bestelling af en kies je afhaalwinkel.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const stores = await getStores();
  const storeOptions = stores.map((store) => ({
    id: store.id,
    name: store.name,
    address: store.address,
    city: store.city,
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
