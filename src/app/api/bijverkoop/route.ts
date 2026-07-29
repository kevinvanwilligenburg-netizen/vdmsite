import { NextResponse } from "next/server";

import { getCompanions, getProductById, getUpsellProducts } from "@/lib/tilroy";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Passende artikelen bij wat er in de winkelwagen ligt.
 *
 * De winkelwagen draait in de browser, dus de site weet server-side niet wat
 * erin zit. Deze route krijgt de product-id's en geeft terug wat erbij hoort,
 * met de reden erbij ("Voor een strak lakresultaat").
 *
 * Zonder deze route toonde de winkelwagen willekeurige goedkope artikelen:
 * bij een blik beits kreeg de klant houtbouten en staaldraadklemmen
 * aangeboden. Dat verkoopt niets en het oogt onnozel.
 */
export async function POST(request: Request) {
  let body: { productIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ producten: [] });
  }

  const ids = (body.productIds ?? []).filter(Boolean).slice(0, 20);
  if (ids.length === 0) return NextResponse.json({ producten: [] });

  const inMandje = new Set(ids);
  const gekozen = new Map<string, { product: Product; waarom: string }>();

  // Per artikel in het mandje de bijpassende accessoires ophalen.
  for (const id of ids) {
    if (gekozen.size >= 6) break;
    const product = await getProductById(id);
    if (!product) continue;
    for (const companion of await getCompanions(product, 3)) {
      if (gekozen.size >= 6) break;
      if (inMandje.has(companion.product.id) || gekozen.has(companion.product.id)) continue;
      gekozen.set(companion.product.id, {
        product: companion.product,
        waarom: companion.reason,
      });
    }
  }

  // Levert dat niets op (bijvoorbeeld bij artikelen zonder eigen regels),
  // dan vullen we aan met veelgekochte losse artikelen.
  if (gekozen.size < 3) {
    for (const product of await getUpsellProducts(8)) {
      if (gekozen.size >= 3) break;
      if (inMandje.has(product.id) || gekozen.has(product.id)) continue;
      gekozen.set(product.id, { product, waarom: "Vaak samen gekocht" });
    }
  }

  return NextResponse.json({
    producten: [...gekozen.values()].map(({ product, waarom }) => ({
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      price: product.price,
      kluspasPrice: product.kluspasPrice,
      image: product.image,
      art: product.art,
      pickupOnly: product.pickupOnly,
      waarom,
    })),
  });
}
