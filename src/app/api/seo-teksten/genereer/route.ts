import { NextResponse } from "next/server";

import { isKvEnabled } from "@/lib/kv";
import {
  bewaarSeoTekst,
  genereerSeoTekst,
  haalSeoTekst,
} from "@/lib/seo-tekst";
import { getProducts } from "@/lib/tilroy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Maakt producttekst voor artikelen die er nog geen hebben.
 *
 * Bewust in porties: het model aanroepen kost geld en tijd, en een
 * serverless functie heeft een harde bovengrens. Elke aanroep pakt een
 * beperkt aantal artikelen op; wie de hele catalogus wil doen, roept 'm een
 * paar keer aan. Het antwoord vertelt hoeveel er nog te gaan zijn.
 *
 * Afgeschermd: dit endpoint kost geld per aanroep.
 *
 *   GET /api/seo-teksten/genereer?aantal=25
 *   Authorization: Bearer <SITE_API_KEY of CRON_SECRET>
 *
 * Met `?alleenTellen=1` wordt er niets gegenereerd en krijg je alleen de
 * stand van zaken — handig om te zien wat een volledige ronde gaat kosten.
 */
function magDit(request: Request): boolean {
  const meegegeven = request.headers.get("authorization") ?? "";
  const sleutels = [process.env.CRON_SECRET, process.env.SITE_API_KEY].filter(Boolean);
  if (sleutels.length === 0) return false;
  return sleutels.some((sleutel) => meegegeven === `Bearer ${sleutel}`);
}

/** Ruwe schatting per artikel, om vooraf te weten wat een ronde kost. */
const KOSTEN_PER_ARTIKEL_CENT = 1.1;

export async function GET(request: Request) {
  if (!magDit(request)) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }
  if (!isKvEnabled()) {
    return NextResponse.json(
      { error: "Zonder KV kunnen we teksten niet bewaren; dan is genereren weggegooid geld." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const aantal = Math.min(Math.max(Number(url.searchParams.get("aantal") ?? 25), 1), 100);
  const alleenTellen = url.searchParams.get("alleenTellen") === "1";

  const producten = await getProducts();

  // Welke hebben er nog geen tekst? Dat bepaalt zowel de teller als het werk.
  const zonderTekst: typeof producten = [];
  const metTekst = new Map<string, string>();
  for (const product of producten) {
    const bestaand = await haalSeoTekst(product);
    if (bestaand) metTekst.set(product.id, bestaand.lang);
    else zonderTekst.push(product);
  }

  if (alleenTellen) {
    return NextResponse.json({
      producten: producten.length,
      metTekst: metTekst.size,
      zonderTekst: zonderTekst.length,
      schattingHeleRondeEuro:
        Math.round((zonderTekst.length * KOSTEN_PER_ARTIKEL_CENT) / 100 * 100) / 100,
    });
  }

  const teDoen = zonderTekst.slice(0, aantal);
  let gemaakt = 0;
  let overgeslagen = 0;
  let aanroepen = 0;
  const redenen: Record<string, number> = {};

  for (const product of teDoen) {
    // Vergelijken met teksten van artikelen uit dezelfde hoek: hetzelfde merk
    // of dezelfde soort. Daar loert de overlap, niet bij een willekeurige
    // schroef versus een blik muurverf.
    const buren = producten
      .filter(
        (ander) =>
          ander.id !== product.id &&
          metTekst.has(ander.id) &&
          (ander.brand === product.brand ||
            ander.attributes?.subcategorie?.split("|")[0] === product.attributes?.subcategorie?.split("|")[0]),
      )
      .slice(0, 6)
      .map((ander) => metTekst.get(ander.id) as string);

    const resultaat = await genereerSeoTekst(product, buren);
    aanroepen += resultaat.aanroepen;
    if (resultaat.tekst) {
      await bewaarSeoTekst(product, resultaat.tekst);
      metTekst.set(product.id, resultaat.tekst.lang);
      gemaakt++;
    } else {
      overgeslagen++;
      const reden = resultaat.reden ?? "onbekend";
      redenen[reden] = (redenen[reden] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    ok: true,
    gemaakt,
    overgeslagen,
    redenen,
    modelaanroepen: aanroepen,
    nogTeGaan: Math.max(0, zonderTekst.length - teDoen.length),
  });
}
