import { NextResponse } from "next/server";

import { combinePromises, deliveryPromise, SAME_DAY_CUTOFF_HOUR } from "@/lib/delivery";
import {
  franco,
  gratisVanaf,
  shippingCost,
  shippingCountry,
  tekortVoorGratis,
  verzendtarief,
} from "@/lib/shipping";
import { getProductBySku, getStockForSkus } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Welke bezorgopties gelden voor deze bestelling, en wat kosten ze?
 *
 * De checkout draait in de browser en kan de voorraad en de klok niet zelf
 * beoordelen. Deze route doet dat met dezelfde functies als de checkout zelf,
 * zodat wat de klant ziet en wat hij uiteindelijk betaalt niet uiteen kunnen
 * lopen.
 */
export async function POST(request: Request) {
  let body: {
    items?: { sku?: string; quantity?: number }[];
    subtotal?: number;
    country?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const land = shippingCountry(body.country);
  const subtotalCents = Math.max(0, Math.round(Number(body.subtotal ?? 0)));
  const regels = (body.items ?? []).filter((item) => item.sku).slice(0, 50);

  const promises = [];
  try {
    for (const regel of regels) {
      const stock = await getStockForSkus([regel.sku!]);
      if (!stock.live) {
        promises.length = 0;
        break;
      }
      promises.push(
        deliveryPromise({
          webshopQty: stock.webshopQty ?? 0,
          otherStoresQty: stock.otherStoresQty ?? 0,
        }),
      );
    }
  } catch (error) {
    console.error("[bezorgopties] voorraadcheck mislukt:", error);
  }

  // Zonder betrouwbare voorraad beloven we het voorzichtige scenario: liever
  // geen spoedoptie tonen dan er een aanbieden die we niet waarmaken.
  const promise =
    promises.length > 0
      ? combinePromises(promises)
      : deliveryPromise({ webshopQty: 0, otherStoresQty: 1 });

  // Sikkens gaat franco de deur uit, ongeacht het bedrag. Welke merken er in
  // het mandje liggen weet de client niet betrouwbaar, dus zoeken we ze hier
  // op bij de sku.
  const merken: (string | undefined)[] = [];
  for (const regel of regels) {
    const product = await getProductBySku(regel.sku!);
    if (product) merken.push(product.brand);
  }
  const gratisOngeachtBedrag = franco(merken);
  const verzendkosten = shippingCost(subtotalCents, land, gratisOngeachtBedrag);

  return NextResponse.json({
    standaard: {
      type: promise.type,
      label: promise.label,
      kosten: verzendkosten,
    },
    sameDay: promise.sameDayAvailable
      ? {
          beschikbaar: true,
          toeslag: promise.sameDaySurcharge,
          label: "Vandaag bezorgd",
          cutoffUur: SAME_DAY_CUTOFF_HOUR,
        }
      : { beschikbaar: false, cutoffUur: SAME_DAY_CUTOFF_HOUR },
    verzending: {
      land,
      kosten: verzendkosten,
      gratisVanaf: gratisVanaf(land),
      tarief: verzendtarief(land),
      tekort: tekortVoorGratis(subtotalCents, land, gratisOngeachtBedrag),
      // Zodat de checkout kan zeggen wáárom het gratis is.
      franco: gratisOngeachtBedrag,
    },
  });
}
