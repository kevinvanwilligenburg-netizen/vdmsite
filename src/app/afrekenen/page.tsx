import type { Metadata } from "next";
import { cookies } from "next/headers";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { AfrekenenMeten } from "@/components/meten/AfrekenenMeten";
import { emailVanSessie, haalKlant, SESSIE_COOKIE, voorkeurWinkel } from "@/lib/account";
import { getWhatsappNummer } from "@/lib/contact";
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
  const [stores, email, whatsapp] = await Promise.all([
    getStores(),
    emailVanSessie(cookies().get(SESSIE_COOKIE)?.value),
    getWhatsappNummer(),
  ]);
  // De winkel die de klant in zijn account koos; die reist mee naar een
  // ander apparaat, de lokale winkelkiezer niet.
  const voorkeur = email ? await voorkeurWinkel(email) : null;

  /*
   * De gegevens van een ingelogde klant, om het formulier voor te vullen.
   *
   * Op de accountpagina staat letterlijk "Bij het afrekenen vullen we dit
   * vast voor je in", en dat gebeurde niet: naam, straat, huisnummer,
   * postcode en plaats stonden leeg terwijl ze een klik verderop wél bekend
   * waren. Voor iemand die net heeft ingelogd is dat een overbodige drempel
   * op precies de verkeerde plek.
   *
   * Faalt de lookup, dan gaat het formulier gewoon leeg verder; een trage
   * klantendienst mag het afrekenen niet blokkeren.
   */
  const klant = email
    ? await haalKlant(email).catch(() => null)
    : null;
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
      <AfrekenenMeten />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Winkelwagen", href: "/winkelwagen" },
          { name: "Afrekenen" },
        ]}
      />
      <h1 className="text-3xl font-black uppercase italic text-ink">Afrekenen</h1>
      <CheckoutForm
        stores={storeOptions}
        whatsappNummer={whatsapp}
        ingelogdAls={email ?? undefined}
        voorkeurWinkel={voorkeur ?? undefined}
        bekend={
          klant
            ? {
                voornaam: klant.voornaam,
                achternaam: klant.achternaam,
                telefoon: klant.telefoon,
                straat: klant.adres?.straat,
                huisnummer: klant.adres?.huisnummer,
                postcode: klant.adres?.postcode,
                plaats: klant.adres?.plaats,
              }
            : undefined
        }
      />
    </div>
  );
}
