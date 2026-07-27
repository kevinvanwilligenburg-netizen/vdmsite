import { NextResponse } from "next/server";

import { getStockForSkus } from "@/lib/tilroy";

export const dynamic = "force-dynamic";
// Ruim genoeg voor een koude cache bij de hub (die doet dan een volledige crawl).
export const maxDuration = 60;

/**
 * Voorraad per winkel voor één product, opgehaald bij de voorraad-hub van het
 * dashboard. De productpagina laadt dit ná de eerste render, zodat een koude
 * cache bij de hub de pagina nooit ophoudt.
 *
 * ?skus=39037791,39037792
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const skus = (url.searchParams.get("skus") ?? "")
    .split(",")
    .map((sku) => sku.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (skus.length === 0) {
    return NextResponse.json({ error: "Geen sku's opgegeven." }, { status: 400 });
  }

  const stock = await getStockForSkus(skus);
  return NextResponse.json(stock, {
    headers: { "Cache-Control": "public, max-age=120, s-maxage=300" },
  });
}
