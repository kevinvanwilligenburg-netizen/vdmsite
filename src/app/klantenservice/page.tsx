import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/JsonLd";
import { Mark } from "@/components/Mark";
import { getWhatsappNummer } from "@/lib/contact";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  WHATSAPP_TIJDEN,
  WHATSAPP_WEERGAVE,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Klantenservice – veelgestelde vragen en contact",
  description:
    "Vragen over bestellen, bezorgen, afhalen, verf mengen of retourneren? Bekijk de veelgestelde vragen of neem contact op met De Voordeelmarkt.",
  alternates: { canonical: "/klantenservice" },
};

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Wanneer wordt mijn bestelling bezorgd?",
    answer:
      "Dat hangt af van waar het artikel ligt. Ligt het in onze webshopvoorraad in Nijverdal, dan bezorgt DHL het de volgende dag. Bestel je vóór 09:00, dan kun je bij het afrekenen kiezen voor bezorging vandaag nog, tegen een toeslag van € 1,25. Ligt het artikel in een van onze andere winkels, dan verstuurt die winkel het met PostNL en heb je het binnen één werkdag in huis; vandaag bezorgen kan dan niet. Op elke productpagina zie je welke levertijd voor dat artikel geldt, en je ontvangt een track & trace-code zodra je pakket onderweg is.",
  },
  {
    question: "Wat kost bezorgen?",
    answer:
      "Bezorgen is gratis vanaf € 59. Daaronder betaal je € 4,95 in Nederland en € 7,95 in België. Sikkens bezorgen we altijd gratis, ongeacht het bedrag. Afhalen in de winkel is altijd gratis. In België duurt bezorgen 1–2 werkdagen.",
  },
  {
    question: "Hoe werkt afhalen in de winkel (Click & Collect)?",
    answer:
      "Kies bij het afrekenen je winkel: Nijverdal, Apeldoorn, Deventer, Zutphen of Emmen. Je krijgt bericht zodra je bestelling klaarstaat, vaak dezelfde dag nog. Meld je bij de kassa met je afhaalcode; betalen is al gebeurd.",
  },
  {
    question: "Kan ik verf in elke kleur bestellen?",
    answer:
      "Ja. Kies je kleur online met de kleurkiezer; onze verfspecialist mengt je muurverf of lak gratis aan. Je krijgt hem bezorgd of haalt hem op, je hoeft er dus niet voor langs te komen. De kleuren op je scherm zijn een indicatie; wij mengen op de officiële kleurcode, niet op wat jouw scherm toont.",
  },
  {
    question: "Hoe kan ik betalen?",
    answer:
      "Je rekent veilig af via Mollie met iDEAL, Bancontact, KBC of Belfius (België), creditcard, Apple Pay, Google Pay of PayPal. Liever achteraf betalen? Dat kan met Klarna. Bestel je zakelijk, vul dan je bedrijfsnaam in, dan kun je op rekening betalen via Billie, met 30 dagen betaaltermijn.",
  },
  {
    question: "Kan ik mijn bestelling retourneren?",
    answer:
      "Je hebt 14 dagen bedenktijd vanaf het moment dat je je bestelling hebt ontvangen. Op kleur gemengde verf is maatwerk en is daarom uitgesloten van het herroepingsrecht. Retourneren kan in al onze winkels; neem je bestelnummer mee.",
  },
  {
    question: "Waar vind ik de status van mijn bestelling?",
    answer:
      "Na het afrekenen kom je op je persoonlijke bestelpagina met je bestelnummer (bijvoorbeeld VDM-123456). Bewaar die pagina: daar zie je live de status, je afhaalcode of je track & trace.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default async function CustomerServicePage() {
  // Nummer uit het dashboard, met de omgevingsvariabele als terugval.
  const whatsappNummer = await getWhatsappNummer();
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Klantenservice" }]} />
      <JsonLd data={faqJsonLd} />

      <header className="flex max-w-3xl items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">
            Klantenservice
          </h1>
          <p className="mt-3 text-ink-soft">
            We helpen je graag, online én in de winkel. Bekijk de veelgestelde
            vragen of neem direct contact op.
          </p>
        </div>
        <div className="hidden w-32 shrink-0 sm:block">
          <Mark pose="vragend" hoogte="h-32" />
        </div>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Contact"
      >
        <a href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`} className="card group p-5">
          <span className="inline-flex text-brand" aria-hidden>
            <Icon name="phone" className="h-7 w-7" />
          </span>
          <p className="mt-2 font-black text-ink group-hover:text-brand">Bel ons</p>
          <p className="text-sm text-ink-soft">{CONTACT_PHONE}</p>
          <p className="text-xs text-ink-soft">ma t/m za tijdens winkeltijden</p>
        </a>
        {/* WhatsApp staat voor veel mensen dichter bij dan een telefoontje:
            even een foto van je kozijn sturen en vragen welke lak erop moet.
            De bereikbaarheid staat erbij, zodat niemand zaterdagavond op
            antwoord zit te wachten. */}
        {whatsappNummer && (
          <a
            href={`https://wa.me/${whatsappNummer}`}
            target="_blank"
            rel="noopener noreferrer"
            className="card group p-5"
          >
            <span className="inline-flex text-brand" aria-hidden>
              <Icon name="chat" className="h-7 w-7" />
            </span>
            <p className="mt-2 font-black text-ink group-hover:text-brand">App ons</p>
            <p className="text-sm text-ink-soft">{WHATSAPP_WEERGAVE(whatsappNummer)}</p>
            <p className="text-xs text-ink-soft">{WHATSAPP_TIJDEN}</p>
          </a>
        )}
        <a href={`mailto:${CONTACT_EMAIL}`} className="card group p-5">
          <span className="inline-flex text-brand" aria-hidden>
            <Icon name="mail" className="h-7 w-7" />
          </span>
          <p className="mt-2 font-black text-ink group-hover:text-brand">Mail ons</p>
          <p className="break-all text-sm text-ink-soft">{CONTACT_EMAIL}</p>
          <p className="text-xs text-ink-soft">reactie binnen 1 werkdag</p>
        </a>
        <Link href="/winkels" className="card group p-5">
          <span className="inline-flex text-brand" aria-hidden>
            <Icon name="store" className="h-7 w-7" />
          </span>
          <p className="mt-2 font-black text-ink group-hover:text-brand">Kom langs</p>
          <p className="text-sm text-ink-soft">5 winkels in Oost-Nederland</p>
          <p className="text-xs text-ink-soft">adressen &amp; openingstijden →</p>
        </Link>
      </section>

      <section aria-labelledby="faq-titel" className="max-w-3xl">
        <h2 id="faq-titel" className="mb-4 text-2xl font-black uppercase text-ink">
          Veelgestelde vragen
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.question} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink">
                {faq.question}
                <span className="shrink-0 transition group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-soft">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-3xl rounded-2xl bg-brand-light p-6">
        <h2 className="font-black text-ink">Meer weten?</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Lees onze{" "}
          <Link href="/algemene-voorwaarden" className="font-semibold text-brand hover:underline">
            algemene voorwaarden
          </Link>{" "}
          of de{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            privacyverklaring
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
