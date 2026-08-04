import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { euros } from "@/lib/format";
import {
  EURO_PER_PUNT,
  KLUSPUNTEN_ONLINE,
  KORTING_BIJ_DREMPEL,
  PUNTEN_PER_EURO,
  PUNTEN_VOOR_KORTING,
} from "@/lib/kluspunten";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Kluspunten sparen met je Kluspas",
  description:
    "Bij De Voordeelmarkt spaar je kluspunten op elke aankoop. 250 punten is € 12,50 korting, oftewel 5% terug. Hoe het werkt, waar je je saldo ziet en hoe je ze inwisselt.",
  alternates: { canonical: "/kluspunten" },
};

const VRAGEN: { v: string; a: string }[] = [
  {
    v: "Hoeveel punten spaar ik?",
    a: `Normaal ${PUNTEN_PER_EURO} punt per euro. Bij ${PUNTEN_VOOR_KORTING} punten staat er ${euros(
      KORTING_BIJ_DREMPEL,
    )} korting klaar. Tijdens een dubbele-puntenactie gaat het sneller; wat je precies hebt gespaard, zie je altijd in je account.`,
  },
  {
    v: "Verlopen mijn punten?",
    a: "Je punten blijven drie jaar geldig. De datum staat bij je saldo in je account, dus je ziet altijd tot wanneer.",
  },
  {
    v: "Hoe wissel ik mijn punten in?",
    a: "Aan de kassa in de winkel. Geef je Kluspas mee en zeg dat je je punten wilt gebruiken; het bedrag gaat er direct af.",
  },
  {
    v: "Ik ben mijn Kluspas kwijt. Wat nu?",
    a: "Je punten staan op je klantnummer, niet op het pasje. Vraag in de winkel om een nieuwe pas, dan staat je saldo er gewoon weer op. In je account vind je ook een digitale versie met barcode.",
  },
  {
    v: "Kost de Kluspas iets?",
    a: "Nee. De pas is gratis en je vraagt hem aan in een van onze vijf winkels. Je krijgt er meteen de Kluspas-prijs mee, die op veel artikelen lager is dan de gewone prijs.",
  },
];

export default function KluspuntenPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: VRAGEN.map((vraag) => ({
      "@type": "Question",
      name: vraag.v,
      acceptedAnswer: { "@type": "Answer", text: vraag.a },
    })),
  };

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Kluspunten" }]} />
      <JsonLd data={faqJsonLd} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
          Kluspunten sparen
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          Met je Kluspas spaar je bij elke aankoop. Geen zegels, geen gedoe:
          normaal {PUNTEN_PER_EURO} punt per euro, en bij{" "}
          {PUNTEN_VOOR_KORTING} punten staat er{" "}
          <strong className="text-ink">{euros(KORTING_BIJ_DREMPEL)}</strong>{" "}
          korting voor je klaar. Dat is 5% terug op wat je uitgeeft.
        </p>
      </header>

      {/* De rekensom in drie stappen: dat is het hele verhaal. */}
      <section aria-labelledby="hoe-titel">
        <h2 id="hoe-titel" className="mb-5 text-2xl font-black uppercase text-ink">
          Zo werkt het
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: "tag",
              kop: "Je koopt",
              tekst: `Elke euro is ${PUNTEN_PER_EURO} punt. Laat je Kluspas scannen aan de kassa${
                KLUSPUNTEN_ONLINE ? " of bestel online met je account" : ""
              }.`,
            },
            {
              icon: "palette",
              kop: "Je spaart",
              tekst: `Je punten komen op je pas te staan. Eén punt is ${euros(
                EURO_PER_PUNT,
              )} waard.`,
            },
            {
              icon: "store",
              kop: "Je verzilvert",
              tekst: `Bij ${PUNTEN_VOOR_KORTING} punten haal je ${euros(
                KORTING_BIJ_DREMPEL,
              )} van je aankoop af. Aan de kassa, in één keer.`,
            },
          ].map((stap, index) => (
            <li key={stap.kop} className="card p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
                <Icon name={stap.icon} className="h-6 w-6" />
              </span>
              <p className="mt-3 text-xs font-black uppercase tracking-wide text-ink-soft">
                Stap {index + 1}
              </p>
              <h3 className="font-black text-ink">{stap.kop}</h3>
              <p className="mt-1 text-sm text-ink-soft">{stap.tekst}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Een rekenvoorbeeld doet meer dan een percentage. */}
      <section className="rounded-2xl bg-brand-light p-6 sm:p-8">
        <h2 className="text-xl font-black uppercase text-ink">Een rekenvoorbeeld</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Je schildert je kozijnen: 2 blikken lak van 2,5 liter en een pot
          grondverf, samen € 250.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { boven: "Je besteedt", onder: "€ 250" },
            { boven: "Je spaart", onder: `${250 * PUNTEN_PER_EURO} punten` },
            { boven: "Dat is waard", onder: euros(KORTING_BIJ_DREMPEL) },
          ].map((blok) => (
            <div key={blok.boven} className="rounded-xl bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                {blok.boven}
              </p>
              <p className="mt-1 text-2xl font-black text-ink">{blok.onder}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Precies genoeg voor de volgende pot verf, of voor het gereedschap dat
          je er toch bij nodig had.
        </p>
      </section>

      {!KLUSPUNTEN_ONLINE && (
        <section className="card p-6">
          <h2 className="font-black text-ink">Online bestellen</h2>
          <p className="mt-1 text-ink-soft">
            Punten spaar je op dit moment in de winkel. Bestel je online, dan
            profiteer je wel meteen van de Kluspas-prijs: die is op honderden
            artikelen lager dan de gewone prijs, en die korting krijg je bij het
            afrekenen direct.
          </p>
        </section>
      )}

      <section aria-labelledby="vragen-titel" className="max-w-3xl">
        <h2 id="vragen-titel" className="mb-4 text-2xl font-black uppercase text-ink">
          Veelgestelde vragen
        </h2>
        <dl className="space-y-3">
          {VRAGEN.map((vraag) => (
            <div key={vraag.v} className="card p-5">
              <dt className="font-black text-ink">{vraag.v}</dt>
              <dd className="mt-1 text-ink-soft">{vraag.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Link href="/account" className="btn btn-primary">
          Bekijk je saldo →
        </Link>
        <Link
          href="/winkels"
          className="btn border-2 border-ink/10 bg-white text-ink hover:border-brand hover:text-brand"
        >
          Kluspas aanvragen in de winkel
        </Link>
        <a
          href={absoluteUrl("/klantenservice")}
          className="text-sm font-bold text-brand hover:underline"
        >
          Vraag over je punten?
        </a>
      </section>
    </div>
  );
}
