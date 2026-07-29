import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Aankopen } from "@/components/account/Aankopen";
import { Inloggen } from "@/components/account/Inloggen";
import { Kluspas } from "@/components/account/Kluspas";
import { Uitloggen } from "@/components/account/Uitloggen";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  emailVanSessie,
  haalKlant,
  SESSIE_COOKIE,
  type Aankoop,
} from "@/lib/account";
import { getOrdersByEmail } from "@/lib/orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mijn Voordeelmarkt",
  description:
    "Je Kluspas, je kluspunten en al je aankopen — online én uit de winkel — op één plek.",
  robots: { index: false, follow: false },
};

const STATUS_TEKST: Record<string, string> = {
  paid: "Betaald",
  authorized: "Betaald",
  shipped: "Verzonden",
  delivered: "Bezorgd",
  open: "Wacht op betaling",
  pending: "Wacht op betaling",
  canceled: "Geannuleerd",
  failed: "Betaling mislukt",
  expired: "Verlopen",
  refunded: "Terugbetaald",
};

export default async function AccountPage() {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);

  if (!email) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Mijn Voordeelmarkt" }]} />
        <Inloggen />
      </div>
    );
  }

  // Alleen wat snel is doen we hier: de klantgegevens en onze eigen orders.
  // De winkelhistorie haalt de pagina er zelf bij — daarvoor doorloopt het
  // dashboard een jaar verkopen, en daar wachten we de klant niet op.
  const [klant, webshoporders] = await Promise.all([
    haalKlant(email),
    getOrdersByEmail(email),
  ]);

  const webshopAankopen: Aankoop[] = webshoporders.map((order) => ({
    id: order.id,
    datum: order.createdAt,
    bron: "webshop" as const,
    bedrag: order.total,
    regels: order.items.map((item) => ({
      titel: item.title,
      aantal: item.quantity,
      bedrag: item.price * item.quantity,
    })),
    referentie: order.reference,
    status: STATUS_TEKST[order.paymentStatus] ?? order.paymentStatus,
  }));

  const naam = [klant.voornaam, klant.achternaam].filter(Boolean).join(" ");

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Mijn Voordeelmarkt" }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
            {klant.voornaam ? `Hallo ${klant.voornaam}` : "Mijn Voordeelmarkt"}
          </h1>
          <p className="mt-2 text-ink-soft">{email}</p>
        </div>
        <Uitloggen />
      </header>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          {klant.kluspas ? (
            <Kluspas nummer={klant.kluspas} naam={naam || undefined} />
          ) : (
            <div className="card p-5">
              <p className="font-black text-ink">Nog geen Kluspas gekoppeld</p>
              <p className="mt-1 text-sm text-ink-soft">
                Met een Kluspas krijg je korting op het hele assortiment. Vraag hem
                aan in de winkel — we koppelen hem dan aan dit e-mailadres, en daarna
                staat hij hier.
              </p>
              <Link href="/winkels" className="btn btn-primary mt-4 py-2 text-sm">
                Onze winkels
              </Link>
            </div>
          )}

          {klant.adres?.straat && (
            <div className="card p-5">
              <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                Bezorgadres
              </p>
              <address className="mt-2 not-italic text-ink">
                {naam && <span className="block font-bold">{naam}</span>}
                <span className="block">
                  {klant.adres.straat} {klant.adres.huisnummer}
                </span>
                <span className="block">
                  {klant.adres.postcode} {klant.adres.plaats}
                </span>
              </address>
              <p className="mt-2 text-xs text-ink-soft">
                Bij het afrekenen vullen we dit vast voor je in.
              </p>
            </div>
          )}

          {!klant.inTilroy && (
            <p className="rounded-xl bg-brand-light px-4 py-3 text-sm text-ink">
              We herkennen dit e-mailadres nog niet in onze winkeladministratie.
              Koop je met je Kluspas in de winkel, geef dan dit adres door — daarna
              verschijnen die aankopen hier ook.
            </p>
          )}
        </div>

        <section aria-labelledby="aankopen">
          <h2 id="aankopen" className="text-xl font-black uppercase text-ink">
            Jouw aankopen
          </h2>
          <p className="mb-4 mt-1 text-ink-soft">
            Alles bij elkaar: wat je online bestelde en wat je in de winkel kocht.
          </p>
          <Aankopen webshop={webshopAankopen} />
        </section>
      </div>
    </div>
  );
}
