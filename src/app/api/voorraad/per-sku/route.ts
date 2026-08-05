import { NextResponse } from "next/server";

import { getStockPerSku } from "@/lib/tilroy";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Voorraad per artikel, in één aanvraag voor een heel mandje.
 *
 * `/api/voorraad` bestaat al, maar telt de opgegeven sku's bij elkáár op —
 * prima voor één productpagina, onbruikbaar voor de winkelwagen, want daar
 * moet elke regel zijn eigen maximum kennen.
 *
 * Alle vestigingen opgeteld: orders worden met de hand over de winkels
 * verdeeld, dus er gaat ook vanuit Emmen en Zutphen wat de deur uit.
 *
 * Antwoordt de hub niet, dan geven we een lege lijst terug in plaats van een
 * fout. De winkelwagen laat het maximum dan open; de checkout controleert het
 * daarna alsnog tegen de dan actuele voorraad.
 *
 * ?skus=39973205,39978614
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const skus = (url.searchParams.get("skus") ?? "")
    .split(",")
    .map((sku) => sku.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (skus.length === 0) {
    return NextResponse.json({ perSku: {} });
  }

  const kaart = await getStockPerSku(skus, 8000);
  const perSku: Record<string, number> = {};
  if (kaart) {
    for (const [sku, voorraad] of kaart) {
      perSku[sku] = (voorraad.webshopQty ?? 0) + (voorraad.otherStoresQty ?? 0);
    }
  }

  return NextResponse.json(
    { perSku },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=120" } },
  );
}
