import type { Metadata } from "next";
import { cookies } from "next/headers";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CartPageClient } from "@/components/cart/CartPageClient";
import { CartUpsell } from "@/components/cart/CartUpsell";
import { emailVanSessie, SESSIE_COOKIE } from "@/lib/account";

// Leest de sessiecookie om te weten of de klant al is ingelogd, dus niet
// statisch. Dat kost hier weinig: het mandje zelf komt toch clientside uit
// localStorage, er viel op deze pagina nauwelijks iets te cachen.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Winkelwagen",
  description: "Bekijk je winkelwagen en reken af.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const ingelogd = Boolean(await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Winkelwagen" }]} />
      <h1 className="text-2xl font-black uppercase text-ink sm:text-3xl">Winkelwagen</h1>
      {/* Wie al is ingelogd hoeft geen uitnodiging om een account te maken;
          die korting krijgt hij al. */}
      <CartPageClient ingelogd={ingelogd} />
      {/* Suggesties komen uit /api/bijverkoop, op basis van de mandje-inhoud. */}
      <CartUpsell />
    </div>
  );
}
