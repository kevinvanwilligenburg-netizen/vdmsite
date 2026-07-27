import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { kvGetRaw, kvSetEx, isKvEnabled } from "@/lib/kv";
import { leesVraag, maakAdvies, type KlusVraag } from "@/lib/klusadvies";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * De klusadviseur achter de schermen.
 *
 * Claude doet één ding: de vraag van de klant in gewone taal omzetten naar
 * parameters (welke klus, welke maten, welke kleuren, welke ondergrond).
 * Het rekenwerk en de productkeuze gebeuren daarna in lib/klusadvies.ts,
 * deterministisch en tegen de echte catalogus. Zo kan het advies niet
 * verzinnen dat we iets verkopen wat er niet is, en klopt het aantal liters
 * altijd.
 *
 * Zonder ANTHROPIC_API_KEY blijft de adviseur werken: dan leest de
 * trefwoord-analyse de vraag. Minder soepel, maar het advies zelf is
 * hetzelfde.
 */

const MAX_TEKST = 600;

/**
 * Schema voor de vertaalstap. Alle objecten hebben `additionalProperties:
 * false` en een volledige `required` — dat eist de structured-output-modus.
 * Onbekende waarden geeft het model als lege string of 0 terug; die filteren
 * we hieronder weg.
 */
const VRAAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    klus: {
      type: "string",
      enum: [
        "muur-binnen",
        "plafond",
        "hout-binnen",
        "hout-buiten",
        "kozijn-buiten",
        "radiator",
        "vloer",
        "metaal",
        "onbekend",
      ],
      description: "Wat er geschilderd wordt. 'onbekend' als het echt niet af te leiden is.",
    },
    oppervlakM2: {
      type: "number",
      description: "Te schilderen oppervlak in m², alleen als de klant dit direct noemt. Anders 0.",
    },
    lengte: { type: "number", description: "Kamerlengte in meters, 0 als niet genoemd." },
    breedte: { type: "number", description: "Kamerbreedte in meters, 0 als niet genoemd." },
    hoogte: { type: "number", description: "Plafondhoogte in meters, 0 als niet genoemd." },
    aantal: {
      type: "number",
      description: "Aantal deuren, kozijnen of radiatoren. 0 als niet van toepassing.",
    },
    huidigeKleur: { type: "string", description: "Kleur die er nu op zit, of lege string." },
    nieuweKleur: { type: "string", description: "Gewenste kleur, of lege string." },
    ondergrond: {
      type: "string",
      enum: ["kaal-hout", "geverfd", "gestuukt", "behang", "metaal", "onbekend"],
    },
    bijzonderheden: {
      type: "array",
      items: { type: "string" },
      description:
        "Korte kernwoorden die het advies beïnvloeden, bv. 'vochtige ruimte', 'kinderkamer', 'afwasbaar'.",
    },
  },
  required: [
    "klus",
    "oppervlakM2",
    "lengte",
    "breedte",
    "hoogte",
    "aantal",
    "huidigeKleur",
    "nieuweKleur",
    "ondergrond",
    "bijzonderheden",
  ],
} as const;

const SYSTEEM = `Je verwerkt vragen van klanten van een bouwmarkt tot gestructureerde gegevens.

Je taak is uitsluitend het uitlezen van de vraag. Je geeft geen advies, je rekent niets uit en je verzint geen gegevens: wat de klant niet noemt, laat je leeg (lege string, of 0 bij getallen).

Let op deze punten:
- "4 bij 3" of "4x3" zijn kamermaten (lengte en breedte), geen oppervlak.
- "20 m2" is wel direct een oppervlak.
- Een schutting, tuinhuis of buitendeur is hout-buiten; een binnendeur, trap of plint is hout-binnen.
- Noemt de klant een ruimte zonder verder detail (slaapkamer, woonkamer), dan gaat het om muur-binnen.
- Bij "van donkerblauw naar wit" is donkerblauw de huidige kleur en wit de nieuwe.
- Een badkamer of keuken telt als bijzonderheid "vochtige ruimte".`;

interface RuweVraag {
  klus: string;
  oppervlakM2: number;
  lengte: number;
  breedte: number;
  hoogte: number;
  aantal: number;
  huidigeKleur: string;
  nieuweKleur: string;
  ondergrond: string;
  bijzonderheden: string[];
}

function naarVraag(ruw: RuweVraag): KlusVraag {
  const vraag: KlusVraag = { klus: ruw.klus as KlusVraag["klus"] };
  if (ruw.oppervlakM2 > 0) vraag.oppervlakM2 = ruw.oppervlakM2;
  if (ruw.lengte > 0 && ruw.breedte > 0) {
    vraag.kamer = {
      lengte: ruw.lengte,
      breedte: ruw.breedte,
      ...(ruw.hoogte > 0 ? { hoogte: ruw.hoogte } : {}),
    };
  }
  if (ruw.aantal > 0) vraag.aantal = ruw.aantal;
  if (ruw.huidigeKleur) vraag.huidigeKleur = ruw.huidigeKleur.toLowerCase();
  if (ruw.nieuweKleur) vraag.nieuweKleur = ruw.nieuweKleur.toLowerCase();
  if (ruw.ondergrond && ruw.ondergrond !== "onbekend") {
    vraag.ondergrond = ruw.ondergrond as KlusVraag["ondergrond"];
  }
  if (ruw.bijzonderheden?.length > 0) vraag.bijzonderheden = ruw.bijzonderheden.slice(0, 5);
  return vraag;
}

/** Vraag laten uitlezen door Claude; `null` als dat niet lukt of niet aanstaat. */
async function leesMetAi(tekst: string): Promise<KlusVraag | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2000,
      // Uitlezen is licht werk; lage effort houdt de wachttijd voor de klant kort.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: VRAAG_SCHEMA },
      },
      system: SYSTEEM,
      messages: [{ role: "user", content: tekst }],
    });

    if (response.stop_reason === "refusal") return null;

    const blok = response.content.find((block) => block.type === "text");
    if (!blok || blok.type !== "text") return null;
    return naarVraag(JSON.parse(blok.text) as RuweVraag);
  } catch (error) {
    console.error("[klusadvies] uitlezen via Claude mislukt:", error);
    return null;
  }
}

/**
 * Eenvoudige rem per IP: dit endpoint kost geld, dus we staan een burst toe
 * maar geen misbruik. Zonder KV slaan we de rem over — dan werkt de adviseur
 * liever door dan dat hij stilvalt.
 */
async function magNog(ip: string): Promise<boolean> {
  if (!isKvEnabled()) return true;
  try {
    const key = `klusadvies:rem:${ip}`;
    const huidig = Number((await kvGetRaw(key)) ?? "0");
    if (huidig >= 20) return false;
    await kvSetEx(key, String(huidig + 1), 3600);
    return true;
  } catch {
    return true;
  }
}

export async function POST(request: Request) {
  let body: { vraag?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const tekst = (body.vraag ?? "").trim().slice(0, MAX_TEKST);
  if (tekst.length < 5) {
    return NextResponse.json(
      { error: "Vertel iets meer over je klus, dan kunnen we rekenen." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "onbekend";
  if (!(await magNog(ip))) {
    return NextResponse.json(
      { error: "Je hebt vandaag veel adviezen opgevraagd. Bel of mail ons gerust — we helpen je graag persoonlijk." },
      { status: 429 },
    );
  }

  const viaAi = await leesMetAi(tekst);
  const vraag = viaAi ?? leesVraag(tekst);
  const advies = await maakAdvies(vraag);

  return NextResponse.json({
    vraag,
    advies: {
      ...advies,
      // Alleen wat de pagina nodig heeft; niet het hele productobject.
      producten: advies.producten.map((entry) => ({
        rol: entry.rol,
        waarom: entry.waarom,
        aantal: entry.aantal,
        inhoud: entry.inhoud,
        product: {
          id: entry.product.id,
          slug: entry.product.slug,
          sku: entry.product.sku,
          name: entry.product.name,
          brand: entry.product.brand,
          price: entry.product.price,
          kluspasPrice: entry.product.kluspasPrice,
          image: entry.product.image,
          colorMixable: entry.product.colorMixable,
          art: entry.product.art,
        },
      })),
    },
    bron: viaAi ? "ai" : "regels",
  });
}
