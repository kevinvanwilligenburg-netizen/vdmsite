import { NextResponse } from "next/server";

import {
  HERINNER_VANAF,
  kandidaten,
  markeerHerinnerd,
  stuurBijnaVoucherMail,
  VOUCHER_VANAF,
} from "@/lib/kluspuntenherinnering";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * "Je bent er bijna": mailt klanten die tussen de 200 en 250 kluspunten staan.
 *
 * ⚠️ DE CRON STAAT UIT (3 augustus 2026). Het dashboard verstuurt deze mail nu
 * zelf en bereikt daarmee iedereen die de afgelopen 180 dagen iets kocht — ook
 * de winkelklant die nooit online besteld heeft. Onze versie kende alleen
 * webshopklanten met een Kluspas, een fractie daarvan, en die zitten in hún
 * lijst ook. Twee crons naast elkaar betekent dezelfde klant twee keer
 * dezelfde mail, en dan meldt hij zich af.
 *
 * De route blijft staan: hij is met de hand aan te roepen (en met ?proef=1
 * zonder te versturen) als de dashboardkant ooit uitvalt. Zet hem alleen weer
 * op een cron als die van hen uit gaat.
 *
 * Afgeschermd met CRON_SECRET of SITE_API_KEY, net als de andere mailcrons.
 *
 * `?proef=1` laat alleen zien wie er in aanmerking komt, zonder te mailen —
 * handig om te controleren voordat er honderd mails uitgaan.
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

  const proef = new URL(request.url).searchParams.get("proef") === "1";
  const lijst = await kandidaten();

  if (proef) {
    return NextResponse.json({
      ok: true,
      proef: true,
      band: `${HERINNER_VANAF} tot ${VOUCHER_VANAF} punten`,
      kandidaten: lijst.length,
      // Adressen afgeschermd: dit antwoord kan in een logboek belanden.
      voorbeeld: lijst.slice(0, 5).map((k) => ({
        punten: k.punten,
        tekort: k.tekort,
        email: k.email.replace(/^(.).*(@.*)$/, "$1***$2"),
      })),
    });
  }

  let gemaild = 0;
  let mislukt = 0;
  for (const kandidaat of lijst) {
    // Het stempel pas zetten als de mail echt weg is, anders slaan we iemand
    // stilletjes over nadat het versturen mislukte.
    if (await stuurBijnaVoucherMail(kandidaat)) {
      await markeerHerinnerd(kandidaat.email, kandidaat.punten);
      gemaild++;
    } else {
      mislukt++;
    }
  }

  return NextResponse.json({ ok: true, kandidaten: lijst.length, gemaild, mislukt });
}
