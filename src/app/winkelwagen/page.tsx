import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CartPageClient } from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Winkelwagen",
  description: "Bekijk je winkelwagen en reken af.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Winkelwagen" }]} />
      <h1 className="text-3xl font-black uppercase italic text-ink">Winkelwagen</h1>
      <CartPageClient />
    </div>
  );
}
