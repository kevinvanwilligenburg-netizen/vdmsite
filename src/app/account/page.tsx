import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Inloggen } from "@/components/account/Inloggen";
import { Kluspas } from "@/components/account/Kluspas";
import { Uitloggen } from "@/components/account/Uitloggen";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import {
  emailVanSessie,
  haalKlant,
  haalWinkelaankopen,
  SESSIE_COOKIE,
  type Aankoop,
} from "@/lib/account";
import { euro } from "@/lib/format";
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

function datumKort(waarde: string): string {
  const datum = new Date(waarde);
  if (Number.isNaN(datum.getTime())) return waarde;
  return datum.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

export default async function AccountPage() {
  const token = cookies().get(SESSIE_COOKIE)?.value;
  const email = await emailVanSessie(token);

  if (!email) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Mijn Voordeelmarkt" }]} />
        <Inloggen />
      </div>
    );
  }

  const [klant, webshoporders, winkelaankopen] = await Promise.all([
    haalKlant(email),
    getOrdersByEmail(email),
    haalWinkelaankopen(email),
  ]);

  // Webshop- en winkelaankopen door elkaar, nieuwste eerst. Dat is het punt
  // van omnichannel: de klant denkt niet in kanalen, die denkt in "wat heb ik
  // gekocht".
  const aankopen: Aankoop[] = [
    ...webshoporders.map((order) => ({
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
    })),
    ...winkelaankopen,
  ].sort((a, b) => Date.parse(b.datum) - Date.parse(a.datum));

  // Punten: Tilroy kent geen saldo-endpoint, maar elke bon meldt wat hij
  // opleverde. Optellen is het eerlijkste dat we kunnen tonen — met de
  // kanttekening erbij, zodat niemand denkt dat dit het officiële saldo is.
  const puntenGeteld = winkelaankopen.reduce((som, aankoop) => som + (aankoop.punten ?? 0), 0);
  const kentPunten = winkelaankopen.some((aankoop) => typeof aankoop.punten === "number");

  const naam = [klant.voornaam, klant.achternaam].filter(Boolean).join(" ");

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Mijn Voordeelmarkt" }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
            {naam ? `Hallo ${klant.voornaam ?? naam}` : "Mijn Voordeelmarkt"}
          </h1>
          <p className="mt-2 text-ink-soft">{email}</p>
        </div>
        <Uitloggen />
      </header>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          {klant.kluspas ? (
            <>
              <Kluspas nummer={klant.kluspas} naam={naam || undefined} />
              {kentPunten && (
                <div className="card p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                    Kluspunten
                  </p>
                  <p className="mt-1 text-3xl font-black text-brand">
                    {puntenGeteld.toLocaleString("nl-NL")}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Opgeteld uit je aankopen. Het officiële saldo staat op de kassabon
                    en in de winkel.
                  </p>
                </div>
              )}
            </>
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
        </div>

        <section aria-labelledby="aankopen">
          <h2 id="aankopen" className="text-xl font-black uppercase text-ink">
            Jouw aankopen
          </h2>
          <p className="mt-1 text-ink-soft">
            Alles bij elkaar: wat je online bestelde en wat je in de winkel kocht.
          </p>

          {aankopen.length === 0 ? (
            <div className="card mt-4 p-8 text-center">
              <p className="font-black text-ink">Nog geen aankopen gevonden</p>
              <p className="mt-1 text-sm text-ink-soft">
                Zodra je bestelt of in de winkel koopt met je Kluspas, staat het hier.
              </p>
              <Link href="/" className="btn btn-primary mt-4">
                Naar de winkel
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {aankopen.map((aankoop) => (
                <li key={`${aankoop.bron}-${aankoop.id}`} className="card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="flex items-center gap-2 font-black text-ink">
                      <Icon
                        name={aankoop.bron === "webshop" ? "truck" : "store"}
                        className="h-4 w-4 text-brand"
                      />
                      {aankoop.bron === "webshop"
                        ? `Bestelling ${aankoop.referentie ?? ""}`
                        : `Winkel ${aankoop.winkel ?? ""}`}
                    </p>
                    <p className="text-sm text-ink-soft">{datumKort(aankoop.datum)}</p>
                  </div>

                  <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                    {aankoop.regels.slice(0, 4).map((regel, index) => (
                      <li key={index} className="flex justify-between gap-3">
                        <span className="truncate">
                          {regel.aantal}× {regel.titel}
                        </span>
                        <span className="shrink-0">{euro(regel.bedrag * 100)}</span>
                      </li>
                    ))}
                    {aankoop.regels.length > 4 && (
                      <li className="text-xs">en nog {aankoop.regels.length - 4} artikelen</li>
                    )}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
                    <span className="text-sm font-semibold text-ink-soft">
                      {aankoop.status ?? "Afgerekend in de winkel"}
                      {typeof aankoop.punten === "number" && aankoop.punten > 0 && (
                        <span className="ml-2 text-brand">+{aankoop.punten} punten</span>
                      )}
                    </span>
                    <span className="font-black text-ink">{euro(aankoop.bedrag * 100)}</span>
                  </div>

                  {aankoop.bron === "webshop" && aankoop.referentie && (
                    <Link
                      href={`/bestelling/${aankoop.referentie}`}
                      className="mt-2 inline-block text-sm font-bold text-brand hover:underline"
                    >
                      Bekijk bestelling →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!klant.inTilroy && (
            <p className="mt-4 rounded-xl bg-brand-light px-4 py-3 text-sm text-ink">
              We herkennen dit e-mailadres nog niet in onze winkeladministratie.
              Koop je met je Kluspas in de winkel, geef dan dit adres door — daarna
              verschijnen die aankopen hier ook.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
