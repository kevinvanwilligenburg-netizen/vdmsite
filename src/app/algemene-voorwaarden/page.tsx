import type { Metadata } from "next";
import { GRATIS_VANAF_TEKST, tariefTekst } from "@/lib/shipping";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CONTACT_EMAIL, CONTACT_PHONE, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Algemene voorwaarden",
  description:
    "De algemene voorwaarden van De Voordeelmarkt: bestellen, betalen, bezorgen, afhalen, herroepingsrecht, garantie en klachten.",
  alternates: { canonical: "/algemene-voorwaarden" },
};

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "Artikel 1 – Wie zijn wij?",
    paragraphs: [
      `${SITE_NAME} is gevestigd aan de Van den Bergsweg 3, 7442 CK Nijverdal. KvK-nummer 70367922, btw-nummer NL855528618B01, IBAN NL41INGB0105014877.`,
      `Je bereikt ons op ${CONTACT_PHONE} en via ${CONTACT_EMAIL}. Deze voorwaarden gelden voor elke bestelling die je via devoordeelmarkt.nl plaatst.`,
    ],
  },
  {
    title: "Artikel 2 – Aanbod en prijzen",
    paragraphs: [
      "Alle prijzen op de site zijn in euro's en inclusief btw. Aanbiedingen gelden zolang de voorraad strekt en zolang ze op de site staan.",
      "We doen ons uiterste best om prijzen, afbeeldingen en omschrijvingen kloppend te houden. Bij een kennelijke vergissing of typefout zijn we niet verplicht om op die prijs te leveren; we nemen dan contact met je op.",
      "Kleuren op je scherm zijn een indicatie. Voor de exacte kleur is de officiële kleurenwaaier in de winkel leidend.",
    ],
  },
  {
    title: "Artikel 3 – Bestelling en overeenkomst",
    paragraphs: [
      "De overeenkomst komt tot stand zodra je bestelling is betaald en wij die hebben bevestigd. Je ontvangt een bestelnummer (bijvoorbeeld VDM-123456) waarmee je de status kunt volgen.",
      "We kunnen een bestelling weigeren of annuleren als een artikel niet meer leverbaar is, bij een vermoeden van misbruik, of als de gegevens onjuist of onvolledig zijn. Is er al betaald, dan storten we het bedrag binnen 14 dagen terug.",
    ],
  },
  {
    title: "Artikel 4 – Betalen",
    paragraphs: [
      "Betalen doe je online via onze betaalpartner Mollie: iDEAL, Bancontact, creditcard, Apple Pay of achteraf betalen met Klarna. Bij Klarna gelden de betaalvoorwaarden van Klarna zelf; de koopovereenkomst blijft tussen jou en De Voordeelmarkt. Je bestelling wordt verwerkt zodra de betaling of de Klarna-aankoop is bevestigd.",
      "Wij bewaren zelf geen betaalgegevens; die worden verwerkt door Mollie.",
    ],
  },
  {
    title: "Artikel 5 – Bezorgen",
    paragraphs: [
      `Bezorgen is gratis vanaf ${GRATIS_VANAF_TEKST}; daaronder rekenen we ${tariefTekst("NL")} binnen Nederland en ${tariefTekst("BE")} naar België. Artikelen uit onze webshopvoorraad in Nijverdal gaan met DHL en zijn de volgende dag in huis. Bestel je vóór 09:00 uur, dan kun je bij het afrekenen kiezen voor bezorging dezelfde dag tegen een toeslag van € 1,25. Artikelen die alleen in een van onze andere winkels liggen, worden door die winkel met PostNL verstuurd en zijn binnen één werkdag bezorgd; bezorging dezelfde dag is daarbij niet mogelijk. Op de productpagina staat welke levertijd geldt.`,
      "Genoemde bezorgmomenten zijn een streven, geen fatale termijn. Lukt bezorging onverhoopt niet op tijd, dan laten we dat zo snel mogelijk weten. Duurt het langer dan 30 dagen, dan mag je de overeenkomst kosteloos ontbinden.",
      "Het risico van beschadiging of verlies gaat over op jou zodra jij (of iemand die jij aanwijst) het pakket in ontvangst neemt.",
    ],
  },
  {
    title: "Artikel 6 – Afhalen in de winkel",
    paragraphs: [
      "Afhalen is gratis in al onze winkels. Je krijgt bericht zodra je bestelling klaarstaat, samen met een afhaalcode.",
      "Bestellingen bewaren we 14 dagen. Haal je je bestelling niet op, dan nemen we contact met je op; daarna kunnen we de bestelling annuleren en het betaalde bedrag terugstorten.",
    ],
  },
  {
    title: "Artikel 7 – Herroepingsrecht (bedenktijd)",
    paragraphs: [
      "Je hebt 14 dagen bedenktijd, gerekend vanaf de dag dat jij of iemand namens jou de bestelling ontvangt. Binnen die termijn mag je de overeenkomst zonder opgaaf van reden ontbinden.",
      "Meld je herroeping via e-mail of in de winkel. Daarna heb je nog 14 dagen om de producten terug te sturen of terug te brengen. Producten moeten ongebruikt en compleet zijn, met verpakking en toebehoren.",
      "Uitgesloten van het herroepingsrecht zijn producten die op jouw specificatie zijn gemaakt — bij ons is dat vooral op kleur gemengde verf. Ook verzegelde producten waarvan de verzegeling is verbroken kunnen niet retour.",
      "We betalen binnen 14 dagen na je melding terug, met hetzelfde betaalmiddel. We mogen wachten tot we de producten retour hebben ontvangen. Retourkosten voor terugsturen zijn voor jouw rekening; in de winkel terugbrengen is gratis.",
    ],
  },
  {
    title: "Artikel 8 – Garantie en conformiteit",
    paragraphs: [
      "Je hebt altijd recht op een product dat voldoet aan de overeenkomst (wettelijke conformiteit). Daarnaast geldt de eventuele fabrieksgarantie van de leverancier.",
      "Is er iets mis met je product? Neem dan contact op via de klantenservice of kom langs in de winkel met je bestelnummer. We zoeken samen naar een passende oplossing: herstel, vervanging of terugbetaling.",
    ],
  },
  {
    title: "Artikel 9 – Klachten",
    paragraphs: [
      "Klachten kun je melden via de klantenservice. We bevestigen je klacht binnen 14 dagen en komen zo snel mogelijk met een inhoudelijke reactie.",
      "Kom je er met ons niet uit, dan kun je je klacht voorleggen via het Europese ODR-platform: ec.europa.eu/consumers/odr.",
    ],
  },
  {
    title: "Artikel 10 – Toepasselijk recht",
    paragraphs: [
      "Op alle overeenkomsten is Nederlands recht van toepassing. Dwingende bepalingen van consumentenrecht blijven altijd van kracht.",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumbs
        items={[{ name: "Home", href: "/" }, { name: "Algemene voorwaarden" }]}
      />
      <h1 className="mt-6 text-3xl font-black uppercase text-ink sm:text-4xl">
        Algemene voorwaarden
      </h1>
      <p className="mt-3 text-ink-soft">
        Deze voorwaarden gelden voor alle bestellingen via devoordeelmarkt.nl.
        Vragen? Bekijk de{" "}
        <Link href="/klantenservice" className="font-semibold text-brand hover:underline">
          klantenservice
        </Link>
        .
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
