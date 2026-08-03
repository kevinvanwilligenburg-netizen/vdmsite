import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { Klusadviseur } from "@/components/Klusadviseur";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

// Leest `?vraag=` uit de URL en is daarmee per definitie dynamisch; de
// pagina zelf is licht, dus dat kost niets.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Klusadvies – bereken hoeveel verf je nodig hebt",
  description:
    "Vertel wat je gaat schilderen en wij rekenen uit hoeveel liter verf je nodig hebt, of er grondverf bij moet en welk gereedschap erbij hoort. Direct in je mandje.",
  alternates: { canonical: "/klusadvies" },
};

const VRAGEN = [
  {
    vraag: "Hoeveel verf heb ik nodig voor mijn kamer?",
    antwoord:
      "Reken met ongeveer 8 m² per liter per laag. Voor een kamer van 4 bij 3 meter met een plafondhoogte van 2,6 meter komt dat op ongeveer 31 m² wand, en dus op zo'n 8 liter voor twee lagen. Vul je maten in de klusadviseur in, dan rekenen wij het exact uit en zetten we de juiste blikken klaar.",
  },
  {
    vraag: "Wanneer heb ik grondverf nodig?",
    antwoord:
      "Op kaal hout, vers stucwerk en metaal altijd. Verder bij een grote kleursprong: van donker naar licht dekt zelden in twee lagen. Met een grondlaag ben je sneller klaar en gebruik je uiteindelijk minder verf.",
  },
  {
    vraag: "Hoeveel lagen verf moet ik aanbrengen?",
    antwoord:
      "Twee lagen is de norm. Schilder je over een donkere kleur heen zonder te gronden, reken dan op drie. Twee dunne lagen geven altijd een mooier en duurzamer resultaat dan één dikke.",
  },
  {
    vraag: "Kan ik de verf in mijn eigen kleur laten mengen?",
    antwoord:
      "Ja. Wij mengen mengverf gratis in elke kleur uit de RAL-waaier en de merkenwaaiers. Kies je kleur in de kleurkiezer en wij mengen hem in de winkel, klaar bij je bestelling.",
  },
];

export default function KlusadviesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ruw = searchParams.vraag;
  const startVraag = (Array.isArray(ruw) ? ruw[0] : ruw ?? "").slice(0, 600);

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Klusadvies" }]} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">Klusadvies</h1>
        <p className="mt-3 text-ink-soft">
          Vertel in gewone taal wat je gaat doen. Wij rekenen uit hoeveel verf je nodig
          hebt, of er grondverf bij moet en welk gereedschap erbij hoort, en zetten het
          boodschappenlijstje in één klik in je mandje. Net als aan de balie, alleen dan
          om drie uur 's nachts ook.
        </p>
      </header>

      {/* Komt de bezoeker vanaf het zoeken ("trap verven"), dan staat die
          vraag al ingevuld — die hoeft hij niet nog eens te typen. */}
      <Klusadviseur startVraag={startVraag} />

      <section className="max-w-3xl">
        <h2 className="text-xl font-black uppercase text-ink">Veelgestelde vragen</h2>
        <dl className="mt-4 space-y-4">
          {VRAGEN.map((item) => (
            <div key={item.vraag} className="rounded-2xl border-2 border-ink/10 bg-white p-4">
              <dt className="font-bold text-ink">{item.vraag}</dt>
              <dd className="mt-1 text-ink-soft">{item.antwoord}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-ink-soft">
          Kom je er niet uit? Loop even binnen bij{" "}
          <Link href="/winkels" className="font-bold text-brand hover:underline">
            een van onze winkels
          </Link>{" "}
          of neem contact op met{" "}
          <Link href="/klantenservice" className="font-bold text-brand hover:underline">
            onze klantenservice
          </Link>
          .
        </p>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "FAQPage",
              "@id": absoluteUrl("/klusadvies#faq"),
              mainEntity: VRAGEN.map((item) => ({
                "@type": "Question",
                name: item.vraag,
                acceptedAnswer: { "@type": "Answer", text: item.antwoord },
              })),
            },
            {
              "@type": "WebApplication",
              "@id": absoluteUrl("/klusadvies#app"),
              name: "Klusadvies van De Voordeelmarkt",
              url: absoluteUrl("/klusadvies"),
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Web",
              description:
                "Bereken hoeveel verf je nodig hebt voor je klus, inclusief grondverf en gereedschap.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
            },
          ],
        }}
      />
    </div>
  );
}
