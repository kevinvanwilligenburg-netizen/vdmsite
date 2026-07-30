import { NextResponse } from "next/server";

import { kluspasSaving } from "@/lib/kluspas";
import { getProductById } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Wat de accountkorting op dit mandje waard is.
 *
 * ⚠️ Dit hoort niet in de winkelwagen zelf uitgerekend te worden.
 *
 * De winkelwagen bewaart per regel een prijsmomentopname, inclusief de
 * kortingsprijs. Dat gaat mis zodra die momentopname veroudert: een mandje
 * dat gisteren is gevuld mist een veld dat er vandaag wel is, en dan valt die
 * regel stilletjes uit de optelling. Zo toonde een mandje van € 187,92 een
 * korting van € 0,22 terwijl het er ruim € 9 hadden moeten zijn — het dure
 * blik telde niet mee, de twee kleine artikelen wel.
 *
 * Het bedrag dat de klant écht betaalt klopte wel, want de checkout rekent
 * server-side opnieuw. Maar een korting die op het scherm anders is dan bij
 * het afrekenen, kost meer vertrouwen dan hij oplevert.
 *
 * Daarom komt het bedrag hier uit de catalogus, net als bij het afrekenen.
 */
export async function POST(request: Request) {
  let body: { items?: { productId?: string; variantId?: string; qty?: number }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ korting: 0 });
  }

  const regels = (body.items ?? []).slice(0, 50);
  let korting = 0;

  for (const regel of regels) {
    const product = await getProductById(String(regel.productId ?? ""));
    if (!product) continue;
    const aantal = Math.min(99, Math.max(1, Math.floor(Number(regel.qty) || 1)));
    const variant = regel.variantId
      ? product.variants?.find((kandidaat) => kandidaat.id === regel.variantId)
      : undefined;
    // Per gekozen maat, net als bij het afrekenen: de pasprijs van 500 ml
    // hoort niet bij een blik van 2,5 liter.
    const prijs = variant?.price ?? product.price;
    const pasprijs = variant ? variant.kluspasPrice : product.kluspasPrice;
    korting += kluspasSaving(prijs, pasprijs) * aantal;
  }

  return NextResponse.json({ korting });
}
