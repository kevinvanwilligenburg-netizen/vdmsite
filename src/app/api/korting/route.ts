import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, haalPas, SESSIE_COOKIE } from "@/lib/account";
import { kluspasUnitPrice, profpasUnitPrice } from "@/lib/kluspas";
import { getProductById } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Wat de accountkorting op dit mandje waard is, en van welke pas hij komt.
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
 *
 * ⚠️ EN MET DE JUISTE PAS. Hier werd altijd de Kluspas-besparing gerekend,
 * ook voor een ProfPas-houder — terwijl de checkout voor die klant
 * `profpasUnitPrice` gebruikt: 10% van de normale prijs, of de pasprijs als
 * die lager uitvalt. Precies het verschil waar de waarschuwing hierboven voor
 * bedoeld was, maar dan een verdieping dieper. De winkelwagen zette er
 * bovendien "Kluspas-korting" boven bij iemand die helemaal geen Kluspas
 * heeft.
 *
 * De pas komt uit de sessie, nooit uit het verzoek: anders bepaalt de browser
 * welke korting hij krijgt.
 */
export async function POST(request: Request) {
  let body: { items?: { productId?: string; variantId?: string; qty?: number }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ korting: 0, pas: "geen" });
  }

  const sessieEmail = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  const pasStatus = sessieEmail ? await haalPas(sessieEmail) : null;
  // Geen pas uit de portal maar wél ingelogd: dan geldt de Kluspas-prijs, net
  // als bij het afrekenen — een account ís de pas.
  const pas = pasStatus?.pas === "profpas" ? "profpas" : sessieEmail ? "kluspas" : "geen";

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
    if (pas === "geen") continue;
    // Op een lopende actie komt geen tweede korting; zie profpasUnitPrice.
    const inActie = Boolean(variant?.actie ?? product.actie);
    const stukprijs =
      pas === "profpas"
        ? profpasUnitPrice(prijs, pasprijs, inActie)
        : kluspasUnitPrice(prijs, pasprijs);
    korting += Math.max(0, prijs - stukprijs) * aantal;
  }

  return NextResponse.json({ korting, pas });
}
