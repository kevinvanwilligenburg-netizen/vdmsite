import { NextResponse } from "next/server";

import { getStockForSkus, getStores } from "@/lib/tilroy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Welke winkels hebben deze hele bestelling op voorraad?
 *
 * Gebruikt door de checkout om de winkelkeuze te sturen: winkels die alles
 * hebben liggen, kunnen binnen twee uur klaarzetten; bij de rest zeggen we
 * eerlijk wat er ontbreekt.
 *
 * POST { items: [{ sku, quantity }] }
 */
export async function POST(request: Request) {
  let body: { items?: { sku?: string; quantity?: number }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const items = (body.items ?? [])
    .map((item) => ({
      sku: String(item.sku ?? "").trim(),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }))
    .filter((item) => item.sku)
    .slice(0, 50);

  const stores = await getStores();
  if (items.length === 0) {
    return NextResponse.json({
      live: false,
      stores: stores.map((store) => ({
        storeId: store.slug,
        city: store.city,
        complete: false,
        missing: [],
      })),
    });
  }

  // Per winkel bijhouden welke artikelen ontbreken.
  const missingByStore = new Map<string, string[]>(stores.map((store) => [store.slug, []]));
  let live = true;

  for (const item of items) {
    const stock = await getStockForSkus([item.sku]);
    if (!stock.live) {
      live = false;
      break;
    }
    for (const row of stock.stores) {
      if (row.qty < item.quantity) {
        missingByStore.get(row.storeId)?.push(item.sku);
      }
    }
  }

  return NextResponse.json({
    live,
    stores: stores.map((store) => ({
      storeId: store.slug,
      city: store.city,
      complete: live && (missingByStore.get(store.slug)?.length ?? 0) === 0,
      missing: missingByStore.get(store.slug) ?? [],
    })),
  });
}
