import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Aankopen } from "@/components/account/Aankopen";
import { Inloggen } from "@/components/account/Inloggen";
import { Kluspas } from "@/components/account/Kluspas";
import { WinkelKeuze } from "@/components/account/WinkelKeuze";
import { Uitloggen } from "@/components/account/Uitloggen";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  SESSIE_COOKIE,
  emailVanSessie,
  haalFavorieten,
  haalKlant,
  haalKluspunten,
  type Aankoop,
  voorkeurWinkel,
} from "@/lib/account";
import { euros } from "@/lib/format";
import { VOUCHER_VANAF, VOUCHER_WAARDE } from "@/lib/kluspuntenherinnering";
import { getOrdersByEmail } from "@/lib/orders";
import { PRIJS_COOKIE, prijsModusUit } from "@/lib/prijs";
import { getStores } from "@/lib/tilroy";
import { isPaidStatus } from "@/lib/types";

import { AccountNav } from "./_onderdelen/AccountNav";
import { btwLabel } from "./_onderdelen/bedrag";
import { datumLang, statusTekst } from "./_onderdelen/opmaak";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mijn Voordeelmarkt",
  description:
    "Je Kluspas, je kluspunten en al je aankopen, online én uit de winkel, op één plek.",
  robots: { index: false, follow: false },
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

  const modus = prijsModusUit(cookies().get(PRIJS_COOKIE)?.value);

  // Alleen wat snel is doen we hier: de klantgegevens en onze eigen orders.
  // De winkelhistorie haalt de pagina er zelf bij — daarvoor doorloopt het
  // dashboard een jaar verkopen, en daar wachten we de klant niet op.
  const [klant, webshoporders, winkelKeuze, winkels, favorieten, kluspunten] = await Promise.all([
    haalKlant(email),
    getOrdersByEmail(email),
    voorkeurWinkel(email),
    getStores(),
    haalFavorieten(email),
    haalKluspunten(email),
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
    status: statusTekst(order.paymentStatus),
    betaald: isPaidStatus(order.paymentStatus),
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

      <AccountNav actief="/account" />

      {/* Eén keer vragen waar de klant meestal komt; daarna nooit meer. */}
      {!winkelKeuze && (
        <WinkelKeuze
          winkels={winkels.map((winkel) => ({
            slug: winkel.slug,
            stad: winkel.city,
            adres: winkel.address,
          }))}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          {klant.kluspas ? (
            <Kluspas nummer={klant.kluspas} naam={naam || undefined} />
          ) : (
            <div className="card p-5">
              <p className="font-black text-ink">Nog geen Kluspas gekoppeld</p>
              <p className="mt-1 text-sm text-ink-soft">
                Met een Kluspas krijg je korting op het hele assortiment. Vraag hem
                aan in de winkel, we koppelen hem dan aan dit e-mailadres, en daarna
                staat hij hier.
              </p>
              <Link href="/winkels" className="btn btn-primary mt-4 py-2 text-sm">
                Onze winkels
              </Link>
            </div>
          )}

          {/* Saldo alleen tonen als we het écht weten. "Onbekend" mag nooit
              als "0 punten" op het scherm — zie haalKluspunten. */}
          {kluspunten ? (
            <div className="card p-5">
              <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                Kluspunten
              </p>
              <p className="mt-1 text-2xl font-black text-ink">
                {kluspunten.punten === 0
                  ? "Nog geen punten"
                  : `${kluspunten.punten} punten`}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {/* "Bij elke aankoop" stond hier, en dat klopt niet: op
                    webshopbestellingen boekt Tilroy geen punten (gemeten over
                    54 online bonnen: nul). Dat is een instelling op de
                    webshopvestiging. Zolang die uit staat beloven we het niet. */}
                {kluspunten.punten === 0
                  ? "Je spaart punten bij elke aankoop in de winkel, op je Kluspas."
                  : `Goed voor ${euros(kluspunten.waarde)} korting, in te wisselen aan de kassa.`}
                {kluspunten.geldigTot ? ` Geldig tot ${datumLang(kluspunten.geldigTot)}.` : ""}
              </p>
              {/* Hoe ver nog? Een saldo zonder doel zegt een klant niets; met
                  de streep erbij weet hij wat één klus hem oplevert. Dezelfde
                  drempel als de herinneringsmail, uit één bron. */}
              {kluspunten.punten > 0 && kluspunten.punten < VOUCHER_VANAF && (
                <>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.min(100, (kluspunten.punten / VOUCHER_VANAF) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-ink">
                    Nog{" "}
                    {Math.round((VOUCHER_VANAF - kluspunten.punten) * 10) / 10} punten tot{" "}
                    {euros(VOUCHER_WAARDE * 100)} korting.
                  </p>
                </>
              )}
            </div>
          ) : klant.kluspas ? (
            <div className="card p-5">
              <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                Kluspunten
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Je puntensaldo kon nu even niet worden opgehaald. Het staat er
                gewoon nog, kijk straks nog eens, of vraag ernaar in de winkel.
              </p>
            </div>
          ) : null}

          <div className="card p-5">
            <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
              Bewaard voor later
            </p>
            <p className="mt-1 text-ink">
              {favorieten.length === 0
                ? "Je hebt nog niets bewaard."
                : favorieten.length === 1
                  ? "1 artikel staat op je lijstje."
                  : `${favorieten.length} artikelen staan op je lijstje.`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Bewaard bij je account, dus ook op je telefoon.
            </p>
            <Link
              href="/account/favorieten"
              className="mt-3 inline-flex text-sm font-bold text-brand hover:underline"
            >
              Bekijk je lijstje →
            </Link>
          </div>

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
              Koop je met je Kluspas in de winkel, geef dan dit adres door, daarna
              verschijnen die aankopen hier ook.
            </p>
          )}
        </div>

        <section aria-labelledby="aankopen">
          <h2 id="aankopen" className="text-xl font-black uppercase text-ink">
            Jouw aankopen
          </h2>
          <div className="mb-4 mt-1 space-y-2">
            <p className="text-ink-soft">
              Alles bij elkaar: wat je online bestelde en wat je in de winkel kocht,
              voor de bedragen die je hebt afgerekend (incl. btw).{" "}
              <Link href="/account/bestellingen" className="font-bold text-brand hover:underline">
                Bij je webshopbestellingen
              </Link>{" "}
              kun je een bestelling in één keer opnieuw in je mandje leggen.
            </p>
            {/* De knop in de kop staat op excl. btw, maar deze lijst toont wat
                er is afgerekend. Dat verschil benoemen we, anders gaat een
                schilder tellen of hij twee keer betaalt. */}
            {modus === "excl" && (
              <p className="text-sm text-ink-soft">
                Je hebt prijzen op {btwLabel(modus)} staan. Bij je{" "}
                <Link
                  href="/account/bestellingen"
                  className="font-bold text-brand hover:underline"
                >
                  bestellingen
                </Link>{" "}
                en{" "}
                <Link href="/account/facturen" className="font-bold text-brand hover:underline">
                  facturen
                </Link>{" "}
                staan de bedragen exclusief btw.
              </p>
            )}
          </div>
          <Aankopen webshop={webshopAankopen} />
        </section>
      </div>
    </div>
  );
}
