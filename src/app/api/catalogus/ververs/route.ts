import { NextResponse } from "next/server";

import { kvDel } from "@/lib/kv";
import { KV_KEY } from "@/lib/product-feed";

export const dynamic = "force-dynamic";

/**
 * Gooit onze catalogus-cache weg, zodat de eerstvolgende bezoeker een verse
 * bouwt uit de feed.
 *
 * Waarom dit bestaat: het dashboard synchroniseert actieprijzen elk uur, en
 * wij houden de geparste catalogus óók een uur vast. Die twee staan los van
 * elkaar, dus een actie die net is ingegaan kon tot twéé uur onzichtbaar
 * blijven. Vandaag gebeurde dat echt — de promoprijzen stonden in de feed
 * terwijl de winkel nog € 17,60 toonde waar de kassa € 14,08 rekende.
 *
 * Het dashboard kan deze route aanroepen zodra hun promosync klaar is; dan is
 * de vertraging de tijd van één pagina-render in plaats van een uur. Zonder
 * die aanroep verandert er niets: de cache verloopt gewoon vanzelf.
 *
 *   POST /api/catalogus/ververs   met Bearer SITE_API_KEY of CRON_SECRET
 *
 * ⚠️ Dit leegt alleen ONZE kopie. De feed van het dashboard heeft zijn eigen
 * CDN-cache (JSON ~10 min); direct na hun sync kan het dus zijn dat wij een
 * verse kopie bouwen van nog niet helemaal verse data. Aanroepen mag daarom
 * gerust twee keer.
 */
export async function POST(request: Request) {
  const sleutels = [process.env.CRON_SECRET, process.env.SITE_API_KEY].filter(Boolean);
  const meegegeven = request.headers.get("authorization") ?? "";
  if (sleutels.length === 0 || !sleutels.some((sleutel) => meegegeven === `Bearer ${sleutel}`)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }

  try {
    await kvDel(KV_KEY);
  } catch (error) {
    console.error("[catalogus] verversen mislukt:", error);
    return NextResponse.json({ error: "Cache legen mislukt." }, { status: 502 });
  }

  console.warn(`[catalogus] cache ${KV_KEY} geleegd op verzoek`);
  return NextResponse.json({ ok: true, geleegd: KV_KEY });
}
