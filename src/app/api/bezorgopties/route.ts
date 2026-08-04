import { NextResponse } from "next/server";

import { combinePromises, deliveryPromise, SAME_DAY_CUTOFF_HOUR } from "@/lib/delivery";
import { beschikbareMethoden } from "@/lib/mollie";
import {
  franco,
  gratisVanaf,
  shippingCost,
  shippingCountry,
  tekortVoorGratis,
  verzendtarief,
} from "@/lib/shipping";
import { STAAL_SKU } from "@/lib/stalen";
import { getProductBySku, getStockPerSku } from "@/lib/tilroy";

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
    /* Een Profpas geeft altijd gratis bezorging; het formulier stuurt dat mee
       zodat de prijsopgave hier klopt met wat de checkout straks rekent. Die
       checkt het zelf nog een keer, dus dit is een weergave en geen besluit. */
    profpas?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const land = shippingCountry(body.country);
  const subtotalCents = Math.max(0, Math.round(Number(body.subtotal ?? 0)));
  const alleRegels = (body.items ?? []).filter((item) => item.sku).slice(0, 50);
  // Kleurtesters staan niet in de voorraad-hub: het webshopmagazijn mengt ze
  // zelf. Zonder deze splitsing telde een tester als "nergens op voorraad" en
  // verdween de bezorgknop voor een mandje dat we gewoon kunnen leveren.
  const regels = alleRegels.filter((regel) => regel.sku !== STAAL_SKU);
  const metStalen = alleRegels.length > regels.length;

  const promises = [];
  let voorraadBekend = false;
  try {
    // Eén voorraadaanvraag voor alle regels tegelijk; per regel de hub
    // bevragen was een van de redenen dat de checkout zo traag aanvoelde.
    const perSku =
      regels.length > 0
        ? await getStockPerSku(
            regels.map((regel) => regel.sku!),
            8_000,
          )
        : null;
    if (perSku) {
      voorraadBekend = true;
      for (const regel of regels) {
        const voorraad = perSku.get(regel.sku!) ?? { webshopQty: 0, otherStoresQty: 0 };
        promises.push(deliveryPromise(voorraad, undefined, land));
      }
    }
  } catch (error) {
    console.error("[bezorgopties] voorraadcheck mislukt:", error);
  }

  // Zelfde regel als de checkout: de testerbelofte telt alleen mee als de
  // rest van het mandje een betrouwbare belofte heeft, of er geen rest is.
  if (metStalen && (regels.length === 0 || voorraadBekend)) {
    promises.push(deliveryPromise({ webshopQty: 99, otherStoresQty: 0 }, undefined, land));
  }

  // Zonder betrouwbare voorraad beloven we het voorzichtige scenario: liever
  // geen spoedoptie tonen dan er een aanbieden die we niet waarmaken.
  const promise =
    promises.length > 0
      ? combinePromises(promises)
      : deliveryPromise({ webshopQty: 0, otherStoresQty: 1 }, undefined, land);

  // Sikkens gaat franco de deur uit, ongeacht het bedrag. Welke merken er in
  // het mandje liggen weet de client niet betrouwbaar, dus zoeken we ze hier
  // op bij de sku.
  const merken: (string | undefined)[] = [];
  for (const regel of regels) {
    const product = await getProductBySku(regel.sku!);
    if (product) merken.push(product.brand);
  }
  const gratisOngeachtBedrag = franco(merken) || body.profpas === true;
  const verzendkosten = shippingCost(subtotalCents, land, gratisOngeachtBedrag);

  // Welke betaalmethoden Mollie op dít bedrag aankan. Meeliften op deze
  // aanroep scheelt een extra ronde vanaf de checkout, en het bedrag is hier
  // toch al bekend 2014 Klarna heeft drempels, dus het antwoord hangt ervan af.
  const methoden = await beschikbareMethoden(subtotalCents + verzendkosten, land);

  return NextResponse.json({
    betaalmethoden: methoden,
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
