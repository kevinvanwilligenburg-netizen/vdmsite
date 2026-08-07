import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, haalPas, SESSIE_COOKIE } from "@/lib/account";
import { kluspasUnitPrice, profpasUnitPrice } from "@/lib/kluspas";
import { kiesVoordeligste, staffelregels, type MandjeRegel } from "@/lib/staffel";
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
  // De Kluspas-prijs houden we per regel apart bij, ook voor wie niet is
  // ingelogd: daar komt `mogelijkeKorting` verderop uit.
  const mandje: (MandjeRegel & { kluspasPrijs: number })[] = [];
  /*
   * Per regel wat er op het schermpje bij het artikel hoort te staan.
   *
   * Kevin: "ik zie nu niet de andere actie en ook niet de van en voor prijs in
   * de winkelwagen bij t product zelf." De HG-actie van 20% zit al ín de
   * stuksprijs — die kan er dus geen kortingsregel in het overzicht bij
   * krijgen, dat zou dubbel tellen — maar bij het artikel zelf hoort wél te
   * staan dát het een actieprijs is en wat hij eerst was.
   *
   * Uit de catalogus en niet uit de opgeslagen winkelwagen: die bewaart een
   * momentopname die kan verouderen. Zelfde reden als voor het kortingsbedrag,
   * zie de kop van dit bestand.
   */
  const perRegel: {
    sleutel: string;
    prijs: number;
    vanaf?: number;
    actie: boolean;
    /** Naam van de aantal-actie die op deze regel afgaat, als die er is. */
    staffel?: string;
  }[] = [];

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
    // Op een lopende actie komt geen tweede korting; zie profpasUnitPrice.
    const inActie = Boolean(variant?.actie ?? product.actie);
    const kluspasPrijs = kluspasUnitPrice(prijs, pasprijs);
    const stukprijs =
      pas === "profpas"
        ? profpasUnitPrice(prijs, pasprijs, inActie)
        : pas === "kluspas"
          ? kluspasPrijs
          : prijs;
    mandje.push({
      sku: variant?.sku ?? product.sku,
      merk: product.brand,
      categorie: product.category,
      prijs,
      pasPrijs: stukprijs,
      kluspasPrijs,
      aantal,
    });

    // Alleen een "van"-prijs als hij écht hoger is. De adviesprijs staat bij
    // veel artikelen permanent boven onze prijs; daar een doorgestreepte
    // "van" van maken zou van elke marge een aanbieding maken. Bij een lopende
    // actie is `compareAtPrice` de gewone prijs en is doorstrepen wél terecht.
    const vanaf = variant?.compareAtPrice ?? product.compareAtPrice;
    perRegel.push({
      sleutel: `${product.id}:${regel.variantId ?? ""}`,
      prijs,
      ...(inActie && vanaf && vanaf > prijs ? { vanaf } : {}),
      actie: inActie,
    });
  }

  const lopende = await staffelregels();

  /*
   * Aantal-acties tellen ook mee, en ze gelden voor iedereen — ook zonder pas.
   *
   * Dit was de bug: de winkelwagen vroeg hier alleen naar het pasvoordeel, dus
   * vijf Led's light lampen bij "5 halen, 3 betalen" gaven € 0,75 kluspas en
   * verder niets, terwijl de merkpagina twee gratis lampen belooft.
   */
  const { toepassingen, staffelKorting, paskorting } = kiesVoordeligste(lopende, mandje);

  // De actienaam bij het artikel zelf. `perRegel` wordt in dezelfde lus
  // opgebouwd als `mandje`, dus de index van een toepassing wijst hier de
  // goede regel aan.
  for (const toepassing of toepassingen) {
    for (const index of toepassing.indices) {
      if (perRegel[index]) perRegel[index].staffel = toepassing.regel.naam;
    }
  }

  /*
   * Wat een Kluspas op dít mandje extra zou opleveren — ook zonder sessie.
   *
   * `korting` hierboven is nul zolang er geen account is, en dat hoort zo: dat
   * bedrag gaat van het totaal af en moet dus overeenkomen met wat de checkout
   * rekent. Maar daardoor kón de winkelwagen nooit tonen wat een account waard
   * is. Het wervende blok stond achter `korting > 0 && niet ingelogd`, en die
   * twee kunnen niet tegelijk waar zijn — de klant zag nooit een reden om er
   * een te maken.
   *
   * ⚠️ Het verschil van twee doorrekeningen, niet de kale pasbesparing. Wat er
   * van een aantal-actie af gaat, krijgt iedereen ook zónder account, en op die
   * artikelen komt het pasvoordeel er niet bovenop (zie kiesVoordeligste).
   * Vijf lampen bij "5 halen, 3 betalen" leveren dus geen belofte op. Zou je
   * hier gewoon prijs − kluspasprijs optellen, dan beloofde het blokje korting
   * die de klant er bij het afrekenen niet bij krijgt — precies de fout die de
   * waarschuwing bovenaan dit bestand wil voorkomen, maar dan andersom.
   *
   * Altijd de Kluspas-prijs, nooit profpasUnitPrice: wie hier zonder account
   * zit en er een maakt, krijgt de Kluspas. De ProfPas is een aanvraag bij de
   * winkel en geen knop in de webshop.
   */
  const teHalen = (uitkomst: { staffelKorting: number; paskorting: number }) =>
    uitkomst.staffelKorting + uitkomst.paskorting;
  const zonderPas = kiesVoordeligste(
    lopende,
    mandje.map((regel) => ({ ...regel, pasPrijs: regel.prijs })),
  );
  const metKluspas = kiesVoordeligste(
    lopende,
    mandje.map((regel) => ({ ...regel, pasPrijs: regel.kluspasPrijs })),
  );
  const mogelijkeKorting = Math.max(0, teHalen(metKluspas) - teHalen(zonderPas));

  return NextResponse.json({
    korting: paskorting,
    mogelijkeKorting,
    regels: perRegel,
    pas,
    staffelKorting,
    staffels: toepassingen.map((toepassing) => ({
      naam: toepassing.regel.naam,
      gratis: toepassing.gratis,
      korting: toepassing.korting,
    })),
  });
}
