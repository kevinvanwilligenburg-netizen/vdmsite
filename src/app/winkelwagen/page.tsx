import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CartPageClient } from "@/components/cart/CartPageClient";
import { CartUpsell } from "@/components/cart/CartUpsell";
import { getUpsellProducts } from "@/lib/tilroy";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Winkelwagen",
  description: "Bekijk je winkelwagen en reken af.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const suggestions = await getUpsellProducts();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Winkelwagen" }]} />
      <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">Winkelwagen</h1>
      <CartPageClient />
      <CartUpsell suggestions={suggestions} />
    </div>
  );
}
