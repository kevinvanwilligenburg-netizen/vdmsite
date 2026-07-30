import { absoluteUrl, CONTACT_EMAIL, CONTACT_PHONE, SITE_NAME } from "@/lib/site";
import { GRATIS_VANAF_TEKST, tariefTekst } from "@/lib/shipping";
import { getCategories, getStores } from "@/lib/tilroy";

export const revalidate = 86400;

/**
 * llms.txt — een korte, feitelijke samenvatting van de winkel voor
 * AI-assistenten (ChatGPT, Claude, Perplexity, Copilot). Die halen hun
 * antwoorden liever uit één beknopt bestand dan uit gerenderde HTML, en zo
 * krijgen klanten die via een assistent zoeken de juiste openingstijden,
 * bezorgvoorwaarden en vestigingen te horen.
 *
 * Zie https://llmstxt.org voor de conventie.
 */
export async function GET() {
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);

  const body = `# ${SITE_NAME}

> Verfspecialist en klusdiscounter met vijf winkels in Oost- en Noordoost-Nederland.
> Kernbelofte: de beste verf voor de laagste prijs. Verf wordt gratis gemengd in
> elke gewenste kleur (RAL en alle grote merkenwaaiers).

## Bestellen en bezorgen

- Bezorging is gratis vanaf ${GRATIS_VANAF_TEKST}. Daaronder kost bezorging ${tariefTekst("NL")} binnen Nederland en ${tariefTekst("BE")} naar België.
- Artikelen uit de webshopvoorraad (vestiging Nijverdal) gaan met DHL en zijn de volgende dag bezorgd. Wie vóór 09:00 uur bestelt, kan bij het afrekenen kiezen voor bezorging dezelfde dag tegen een toeslag van € 1,25.
- Artikelen die alleen in een van de andere winkels liggen, worden door die winkel met PostNL verstuurd en zijn binnen één werkdag bezorgd.
- Op elke productpagina staat welke levertijd voor dat artikel geldt.
- Afhalen in de winkel is ook gratis (Click & Collect); de klant krijgt bericht met een afhaalcode zodra de bestelling klaarstaat.
- Betalen kan met iDEAL, Bancontact, creditcard en Apple Pay, via betaalprovider Mollie. Achteraf betalen kan met Klarna.
- Retourneren kan binnen 14 dagen; op kleur gemengde verf is maatwerk en daarvan uitgezonderd.

## Verf op kleur

- Meer dan 18.000 kleuren uit ruim 140 kleurenwaaiers, waaronder RAL Classic.
- Mengen is gratis en gebeurt in de winkel, meestal terwijl de klant wacht.
- De juiste mengbasis (licht, midden of donker) wordt automatisch bij de gekozen kleur bepaald.
- Kleurkiezer: ${absoluteUrl("/kleurkiezer")}

## Klusadvies

- De klusadviseur rekent uit hoeveel verf een klus kost: oppervlak, aantal lagen, liters, of er grondverf nodig is en welk gereedschap erbij hoort.
- Vuistregels die wij hanteren: ongeveer 8 m² per liter per laag bij muurverf, twee lagen als norm, drie lagen bij overschilderen van donker naar licht zonder grondlaag.
- Grondverf is nodig op kaal hout, vers stucwerk en metaal, en bij een grote kleursprong.
- Klusadvies: ${absoluteUrl("/klusadvies")}

## Merken

- Overzicht van alle gevoerde merken: ${absoluteUrl("/merken")}
- Per merk een eigen pagina met het volledige assortiment: ${absoluteUrl("/merk/<merknaam>")}

## Assortiment

${categories.map((category) => `- ${category.name}: ${category.description} → ${absoluteUrl(`/categorie/${category.slug}`)}`).join("\n")}

## Winkels

${stores
  .map(
    (store) =>
      `- ${store.name}, ${store.address}, ${store.postalCode} ${store.city}. Telefoon ${store.phone}. Openingstijden: maandag t/m vrijdag 08:00–18:00, zaterdag 08:00–17:00, zondag gesloten. → ${absoluteUrl(`/winkels/${store.slug}`)}`,
  )
  .join("\n")}

## Contact

- Klantenservice: ${CONTACT_PHONE}, ${CONTACT_EMAIL}
- Veelgestelde vragen: ${absoluteUrl("/klantenservice")}
- Bezorgen en afhalen: ${absoluteUrl("/bezorgen-en-afhalen")}
- Algemene voorwaarden: ${absoluteUrl("/algemene-voorwaarden")}

## Bedrijfsgegevens

- ${SITE_NAME}, Van den Bergsweg 3, 7442 CK Nijverdal
- KvK 70367922, btw NL855528618B01
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
