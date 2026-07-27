import { NextResponse } from "next/server";

import { isKvEnabled, kvSAdd, kvSetJSON } from "@/lib/kv";
import { DASHBOARD_API_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Registreert zoekopdrachten — vooral die zónder resultaat.
 *
 * Dat is het scherpste signaal dat een webshop krijgt: het zegt precies welk
 * artikel gemist wordt of met welk woord klanten zoeken dat wij niet kennen.
 * We bewaren het in KV (`zoekterm:<term>`, met een index) en geven het door
 * aan het dashboard, dat er een zoektermen-overzicht van maakt.
 *
 * Best-effort en zonder persoonsgegevens: alleen de term en het aantal
 * resultaten.
 */
export async function POST(request: Request) {
  let body: { term?: string; results?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false });
  }

  const term = (body.term ?? "").trim().toLowerCase().slice(0, 80);
  if (term.length < 2) return NextResponse.json({ ok: false });
  const results = Number.isFinite(body.results) ? Number(body.results) : 0;

  if (isKvEnabled()) {
    try {
      const key = `zoekterm:${term}`;
      await kvSetJSON(key, { term, results, at: new Date().toISOString() });
      await kvSAdd("zoekterm:index", term);
      if (results === 0) await kvSAdd("zoekterm:zonder-resultaat", term);
    } catch (error) {
      console.error("[zoeken] term vastleggen mislukt:", error);
    }
  }

  try {
    await fetch(`${DASHBOARD_API_URL}/api/inzicht/zoektermen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop: "vdmsite", term, results, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Het dashboard is niet altijd bereikbaar; KV heeft het al.
  }

  return NextResponse.json({ ok: true });
}
