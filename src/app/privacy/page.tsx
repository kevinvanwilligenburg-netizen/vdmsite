import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy- en cookieverklaring",
  description:
    "Hoe De Voordeelmarkt omgaat met je persoonsgegevens: welke gegevens we verwerken, waarom, hoe lang we ze bewaren en welke rechten je hebt.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "Welke gegevens verwerken we?",
    paragraphs: [
      "Als je een bestelling plaatst, verwerken we je naam, e-mailadres, telefoonnummer en, bij bezorging, je adresgegevens. Daarnaast bewaren we wat je hebt besteld, het bedrag en de status van je betaling.",
      "Kies je voor afhalen, dan bewaren we ook de gekozen winkel en je afhaalcode.",
    ],
  },
  {
    title: "Waarom verwerken we die gegevens?",
    paragraphs: [
      "We gebruiken je gegevens om je bestelling te verwerken, te bezorgen of klaar te zetten, je op de hoogte te houden en om je te kunnen helpen als er iets misgaat. Dat is nodig om onze overeenkomst met jou uit te voeren.",
      "Daarnaast bewaren we bestelgegevens om te voldoen aan onze wettelijke administratie- en belastingplicht.",
    ],
  },
  {
    title: "Met wie delen we gegevens?",
    paragraphs: [
      "Met onze betaalprovider Mollie (voor de afhandeling van je betaling), met DHL (voor de bezorging van je pakket) en met onze kassa- en voorraadsoftware, zodat de winkel je bestelling kan klaarzetten.",
      "We verkopen je gegevens nooit en delen ze niet met derden voor commerciële doeleinden.",
    ],
  },
  {
    title: "Hoe lang bewaren we je gegevens?",
    paragraphs: [
      "Bestelgegevens bewaren we zeven jaar, omdat de Belastingdienst dat van ons verlangt. Gegevens die we niet hoeven te bewaren, verwijderen we zodra ze niet meer nodig zijn.",
    ],
  },
  {
    title: "Cookies",
    paragraphs: [
      "Deze webshop gebruikt alleen functionele opslag: je winkelwagen wordt lokaal in je browser bewaard, zodat je artikelen niet verdwijnen als je een pagina verder klikt. Daar is geen toestemming voor nodig en er worden geen gegevens mee gedeeld.",
      "We plaatsen geen tracking- of advertentiecookies zonder jouw toestemming.",
    ],
  },
  {
    title: "Jouw rechten",
    paragraphs: [
      `Je mag je gegevens inzien, laten corrigeren of laten verwijderen. Ook kun je bezwaar maken tegen verwerking of vragen om overdracht van je gegevens. Stuur daarvoor een e-mail naar ${CONTACT_EMAIL}; we reageren binnen een maand.`,
      "Ben je het niet eens met hoe wij met je gegevens omgaan? Dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens.",
    ],
  },
  {
    title: "Beveiliging",
    paragraphs: [
      `${SITE_NAME} beveiligt je gegevens met passende technische en organisatorische maatregelen. De website werkt volledig via een beveiligde verbinding (https) en betaalgegevens komen nooit op onze eigen servers terecht.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Privacy" }]} />
      <h1 className="mt-6 text-3xl font-black uppercase text-ink sm:text-4xl">
        Privacy- en cookieverklaring
      </h1>
      <p className="mt-3 text-ink-soft">
        We gaan zorgvuldig om met je gegevens en verzamelen niet meer dan nodig
        is om je bestelling goed af te handelen.
      </p>

      <div className="card mt-6 space-y-8 p-6 sm:p-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-black text-ink">{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-3 leading-relaxed text-ink-soft">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
