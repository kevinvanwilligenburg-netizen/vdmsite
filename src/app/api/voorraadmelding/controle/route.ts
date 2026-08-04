import { NextResponse } from "next/server";

import { verstuurMail } from "@/lib/mail";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getStockForSkus } from "@/lib/tilroy";
import { aanmeldingen, wachtlijstSkus, wisWachtlijst } from "@/lib/voorraadmelding";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Loopt de wachtlijst langs en mailt iedereen wiens artikel weer op voorraad
 * ligt.
 *
 * ⚠️ STAAT NIET MEER IN DE CRON (4 augustus 2026). Het dashboard houdt de
 * wachtlijst nu voor beide shops bij en mailt elke ochtend om 06:45; twee
 * lijsten naast elkaar betekent dat dezelfde klant twee keer bericht krijgt.
 * De route blijft bestaan om hem met de hand te kunnen draaien zolang er nog
 * aanmeldingen in ónze KV staan — draai hem niet zomaar, want dan mailt hij
 * mensen die het dashboard óók al heeft gemaild.
 *
 * Afgeschermd met SITE_API_KEY of CRON_SECRET: deze route verstuurt mail, en
 * zonder slot zou iemand hem in een lus kunnen aanroepen. Vercel Cron stuurt
 * zelf een `Authorization: Bearer <CRON_SECRET>` mee.
 */
function magDit(request: Request): boolean {
  const meegegeven = request.headers.get("authorization") ?? "";
  const sleutels = [process.env.CRON_SECRET, process.env.SITE_API_KEY].filter(Boolean);
  if (sleutels.length === 0) return false;
  return sleutels.some((sleutel) => meegegeven === `Bearer ${sleutel}`);
}

export async function GET(request: Request) {
  if (!magDit(request)) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const skus = await wachtlijstSkus();
  let gemaild = 0;
  let mislukt = 0;
  const bekeken: string[] = [];

  for (const sku of skus) {
    const wachtenden = await aanmeldingen(sku);
    if (wachtenden.length === 0) continue;
    bekeken.push(sku);

    const voorraad = await getStockForSkus([sku]);
    // Onbekende voorraad is geen "nul": bij een hapering van de hub sturen we
    // liever niets dan een bericht dat niet klopt.
    if (!voorraad.live) continue;
    const totaal = (voorraad.webshopQty ?? 0) + (voorraad.otherStoresQty ?? 0);
    if (totaal <= 0) continue;

    let misluktHier = 0;
    for (const wachtende of wachtenden) {
      const url = absoluteUrl(`/product/${wachtende.productSlug}`);
      const resultaat = await verstuurMail({
        aan: wachtende.email,
        onderwerp: `${wachtende.productNaam} is weer op voorraad`,
        tekst: [
          `Goed nieuws, ${wachtende.productNaam} ligt weer voor je klaar.`,
          "",
          `Bestellen: ${url}`,
          "",
          "Wees er wel snel bij; we hebben er nu een beperkt aantal van.",
          "",
          `Groet, ${SITE_NAME}`,
          "",
          "Je krijgt dit bericht omdat je op de productpagina hebt gevraagd om",
          "een seintje. We bewaren je adres hier verder niet voor.",
        ].join("\n"),
        html: [
          `<p>Goed nieuws, <strong>${wachtende.productNaam}</strong> ligt weer voor je klaar.</p>`,
          `<p><a href="${url}">Bekijk het artikel</a></p>`,
          "<p>Wees er wel snel bij; we hebben er nu een beperkt aantal van.</p>",
          `<p>Groet,<br>${SITE_NAME}</p>`,
          '<p style="color:#666;font-size:12px">Je krijgt dit bericht omdat je op de productpagina hebt gevraagd om een seintje. We bewaren je adres hier verder niet voor.</p>',
        ].join(""),
      });
      if (resultaat.ok) {
        gemaild++;
      } else {
        misluktHier++;
        mislukt++;
      }
    }

    // Per artikel tellen, niet over de hele ronde: met één globale teller zou
    // na de eerste hapering geen enkele lijst meer worden geleegd, en kreeg
    // iedereen bij de volgende ronde hetzelfde bericht nog een keer.
    if (misluktHier === 0) await wisWachtlijst(sku);
  }

  return NextResponse.json({
    ok: true,
    skusOpDeLijst: skus.length,
    metWachtenden: bekeken.length,
    gemaild,
    mislukt,
  });
}
