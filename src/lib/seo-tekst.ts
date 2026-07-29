import Anthropic from "@anthropic-ai/sdk";

import { kvGetJSON, kvSetJSON } from "@/lib/kv";
import type { Product } from "@/lib/types";

/**
 * Productteksten die per productlijn verschillen.
 *
 * Het probleem: van de 2.177 productlijnen in de catalogus hebben er 2.057
 * geen bruikbare omschrijving. Die kregen allemaal dezelfde terugvalzin —
 * "<naam> — voordelig online bestellen bij De Voordeelmarkt" — en daarnaast
 * staat dezelfde feedtekst soms op honderd artikelen tegelijk ("Mack
 * Spaanplaatschroef PZ2" op 103 regels). Duizenden pagina's met dezelfde
 * inhoud is precies wat Google duplicate content noemt.
 *
 * De aanpak:
 *
 *  - Eén tekst per **productlijn**, niet per artikel. De maten van hetzelfde
 *    product horen bij één pagina, en een tekst per sku zou het probleem juist
 *    vergroten.
 *  - De invoer zijn de **echte eigenschappen** uit de feed: merk, soort,
 *    glansgraad, ondergrond, toepassing, maten. Geen verzonnen kenmerken; het
 *    model mag alleen verwoorden wat er al staat.
 *  - Het resultaat wordt bewaard onder een sleutel die de eigenschappen
 *    meeneemt, dus een tekst wordt alleen opnieuw gemaakt als het artikel
 *    verandert. Zonder dat zou elke deploy de hele catalogus opnieuw laten
 *    schrijven, en dat kost geld.
 *  - Genereren gebeurt buiten het paginabezoek om (zie
 *    /api/seo-teksten/genereer). Een pagina wacht nooit op het model.
 *
 * Toon: wij schrijven voor iemand die één keer zijn slaapkamer verft, niet
 * voor een schilder die weet wat "hechtprimer op alkydbasis" betekent. Dat is
 * bewust anders dan Klus=r, dat dezelfde artikelen aan vakmensen verkoopt —
 * twee webshops van hetzelfde bedrijf met identieke teksten concurreren met
 * elkaar in de zoekresultaten.
 */

const CACHE_VERSIE = "v1";

export interface SeoTekst {
  /** Eén zin onder de productnaam; ook de meta-description. */
  kort: string;
  /** Twee tot drie alinea's voor het tabblad Productomschrijving. */
  lang: string;
  /** Wanneer gemaakt, zodat we oude teksten kunnen herzien. */
  op: string;
}

/**
 * Sleutel op inhoud: verandert er een eigenschap, dan hoort er een nieuwe
 * tekst te komen. Een simpele hash volstaat — dit is een cachesleutel, geen
 * beveiliging.
 */
function inhoudsHash(waarden: string[]): string {
  let hash = 5381;
  const tekst = waarden.join("|").toLowerCase();
  for (let i = 0; i < tekst.length; i++) {
    hash = ((hash << 5) + hash + tekst.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/** De eigenschappen waarop we een tekst baseren, in vaste volgorde. */
function eigenschappen(product: Product): { label: string; waarde: string }[] {
  const attr = product.attributes ?? {};
  const maten = (product.variants ?? [])
    .map((variant) => variant.size ?? variant.name)
    .filter(Boolean);
  return [
    { label: "Merk", waarde: product.brand },
    { label: "Soort", waarde: attr.subcategorie ?? "" },
    { label: "Glansgraad", waarde: attr.glans ?? "" },
    { label: "Verfsoort", waarde: attr.verfsoort ?? "" },
    { label: "Toepassing", waarde: attr.toepassing ?? "" },
    { label: "Ondergrond", waarde: attr.ondergrond ?? "" },
    { label: "Kwaliteit", waarde: attr.kwaliteit ?? "" },
    { label: "Kleur", waarde: attr.kleur ?? "" },
    { label: "Maten", waarde: [...new Set(maten)].join(", ") },
    { label: "Mengbaar in elke kleur", waarde: product.colorMixable ? "ja" : "" },
  ].filter((entry) => entry.waarde.trim().length > 0);
}

export function seoSleutel(product: Product): string {
  const kenmerken = eigenschappen(product).map((e) => `${e.label}=${e.waarde}`);
  return `seo:${CACHE_VERSIE}:${inhoudsHash([product.name, ...kenmerken])}`;
}

/** De opgeslagen tekst, of null. Nooit genereren tijdens een paginabezoek. */
export async function haalSeoTekst(product: Product): Promise<SeoTekst | null> {
  return kvGetJSON<SeoTekst>(seoSleutel(product));
}

const SYSTEEM = `Je schrijft productteksten voor De Voordeelmarkt, een Nederlandse verfdiscounter met vijf winkels in Overijssel en Gelderland.

Je publiek is de doe-het-zelver: iemand die één keer per paar jaar zijn woonkamer verft, een kast in elkaar zet of een kier dichtkit. Geen vakman. Schrijf zoals een medewerker in de winkel het zou uitleggen: gewone woorden, korte zinnen, en zeg wat iemand ermee kan.

Harde regels:
- Gebruik UITSLUITEND de eigenschappen die je krijgt. Verzin geen droogtijden, dekkracht, garantietermijnen, normen, keurmerken of prijzen. Weet je iets niet, laat het weg.
- Geen superlatieven ("de beste", "ongeëvenaard") en geen uitroeptekens.
- Geen beloftes over levering, voorraad of korting; die staan elders op de pagina en veranderen.
- Nederlands, je-vorm, geen Engelse leenwoorden waar een Nederlands woord bestaat.
- Elke tekst moet duidelijk anders zijn dan die van vergelijkbare artikelen. Begin niet elke tekst met de productnaam of met "Deze".

De korte tekst is één zin van maximaal 155 tekens: wat is het en voor wie.
De lange tekst is twee of drie korte alinea's, gescheiden door een lege regel: wat het is, waar je het voor gebruikt, en waar je op moet letten bij het kiezen of aanbrengen. Samen 90 tot 160 woorden.`;

const SCHEMA = {
  type: "object",
  properties: {
    kort: { type: "string", maxLength: 155 },
    lang: { type: "string" },
  },
  required: ["kort", "lang"],
  additionalProperties: false,
} as const;

/**
 * Woordoverlap tussen twee teksten (Jaccard op unieke woorden van 4+ letters).
 *
 * Bedoeld om te merken dát twee teksten te veel op elkaar lijken, niet om
 * precies te meten hoevéél. Boven de grens laten we het model het opnieuw
 * proberen met de opdracht om een andere invalshoek te kiezen.
 */
export function overlap(a: string, b: string): number {
  const woorden = (tekst: string) =>
    new Set(
      tekst
        .toLowerCase()
        .replace(/[^a-zà-ÿ\s]/g, " ")
        .split(/\s+/)
        .filter((woord) => woord.length >= 4),
    );
  const eenA = woorden(a);
  const eenB = woorden(b);
  if (eenA.size === 0 || eenB.size === 0) return 0;
  let gedeeld = 0;
  for (const woord of eenA) if (eenB.has(woord)) gedeeld++;
  return gedeeld / (eenA.size + eenB.size - gedeeld);
}

/** Boven deze overlap vinden we twee teksten te veel op elkaar lijken. */
export const MAX_OVERLAP = 0.5;

export interface GenereerResultaat {
  tekst: SeoTekst | null;
  /** Waarom het niet lukte, voor het logboek van de batchroute. */
  reden?: string;
  /** Hoe vaak het model is aangeroepen (voor de kostenraming). */
  aanroepen: number;
}

/**
 * Maakt een tekst voor één productlijn. Vergelijkt met teksten die al bestaan
 * voor vergelijkbare artikelen; lijkt het te veel op elkaar, dan één herkansing
 * met de opdracht een andere invalshoek te kiezen.
 */
export async function genereerSeoTekst(
  product: Product,
  buren: string[] = [],
): Promise<GenereerResultaat> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { tekst: null, reden: "geen ANTHROPIC_API_KEY", aanroepen: 0 };

  const kenmerken = eigenschappen(product);
  // Zonder eigenschappen is er niets om over te schrijven; dan is een generieke
  // tekst juist wél duplicate content. Liever niets dan vulling.
  if (kenmerken.length < 2) {
    return { tekst: null, reden: "te weinig eigenschappen", aanroepen: 0 };
  }

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  const basis = [
    `Productnaam: ${product.name}`,
    ...kenmerken.map((e) => `${e.label}: ${e.waarde}`),
  ].join("\n");

  let aanroepen = 0;
  let laatste: SeoTekst | null = null;

  for (let poging = 0; poging < 2; poging++) {
    const opdracht =
      poging === 0
        ? basis
        : [
            basis,
            "",
            "Je vorige tekst leek te veel op die van een vergelijkbaar artikel.",
            "Schrijf een nieuwe met een andere invalshoek: begin bij de klus in",
            "plaats van bij het product, of bij de ondergrond in plaats van bij",
            "de eigenschappen. Gebruik andere woorden.",
          ].join("\n");

    try {
      aanroepen++;
      const response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 1500,
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: SCHEMA },
        },
        system: SYSTEEM,
        messages: [{ role: "user", content: opdracht }],
      });
      if (response.stop_reason === "refusal") {
        return { tekst: null, reden: "geweigerd", aanroepen };
      }
      const blok = response.content.find((block) => block.type === "text");
      if (!blok || blok.type !== "text") continue;
      const ruw = JSON.parse(blok.text) as { kort?: string; lang?: string };
      if (!ruw.kort || !ruw.lang) continue;

      laatste = { kort: ruw.kort.trim(), lang: ruw.lang.trim(), op: new Date().toISOString() };
      const teVeelOverlap = buren.some((buur) => overlap(laatste!.lang, buur) > MAX_OVERLAP);
      if (!teVeelOverlap) return { tekst: laatste, aanroepen };
    } catch (error) {
      console.error(`[seo] tekst maken voor ${product.slug} mislukt:`, error);
      return { tekst: null, reden: "fout bij het model", aanroepen };
    }
  }

  // Ook de herkansing lijkt te veel op de buren. Dan is dat blijkbaar het
  // maximaal haalbare bij vier bijna identieke schroeven; we nemen 'm, want
  // een eigen tekst met overlap is nog altijd beter dan overal dezelfde zin.
  return { tekst: laatste, reden: laatste ? "overlap blijft hoog" : "geen bruikbare tekst", aanroepen };
}

export async function bewaarSeoTekst(product: Product, tekst: SeoTekst): Promise<void> {
  await kvSetJSON(seoSleutel(product), tekst);
}
