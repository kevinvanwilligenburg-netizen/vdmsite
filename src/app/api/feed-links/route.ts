import { NextResponse } from "next/server";

import { bouwLinkmap, stuurLinkmap } from "@/lib/feedlinks";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * De linkmap voor de Google-feed van het dashboard.
 *
 * GET  = kijken wat we zouden sturen (verandert niets).
 * POST = daadwerkelijk versturen.
 *
 * Bewust geen cron. Het dashboard heeft nu nog de adressen van de oude site en
 * die werken tot het moment dat het domein naar ons wijst; de onze werken pas
 * vanaf dat moment. Wie deze POST te vroeg afvuurt, zet de feed van het
 * dashboard vandaag op 404. Hij hoort dus één keer te draaien, bij de
 * omschakeling — en daarna telkens als slugs op grote schaal veranderen.
 *
 * Afgeschermd met SITE_API_KEY of CRON_SECRET: hij schrijft in een systeem
 * waar Google uit leest.
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

  const links = await bouwLinkmap();
  const sleutels = Object.keys(links);
  return NextResponse.json({
    // Waar de links heen wijzen hangt aan NEXT_PUBLIC_SITE_URL. Staat die nog
    // op het proefadres, dan stuur je het dashboard de verkeerde kant op.
    basis: absoluteUrl("/"),
    aantalSkus: sleutels.length,
    aantalPaginas: new Set(Object.values(links)).size,
    voorbeeld: Object.fromEntries(sleutels.slice(0, 5).map((sku) => [sku, links[sku]])),
  });
}

export async function POST(request: Request) {
  if (!magDit(request)) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  try {
    const resultaat = await stuurLinkmap();
    return NextResponse.json({ ok: true, ...resultaat });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 502 },
    );
  }
}
