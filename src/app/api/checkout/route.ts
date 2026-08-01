import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, kluspasNummerVan, SESSIE_COOKIE } from "@/lib/account";
import { controleerBtw } from "@/lib/vies";
import { btwFormaatGeldig, isBedrijfsType, kvkGeldig, normaliseerBtw } from "@/lib/zakelijk";
import { isBetaalmethode } from "@/lib/betaalmethoden";
import { resolvePaintColor } from "@/lib/colors";
import { combinePromises, deliveryPromise } from "@/lib/delivery";
import { franco, shippingCost, shippingCountry } from "@/lib/shipping";
import { kluspasUnitPrice } from "@/lib/kluspas";
import { createMolliePayment, mollieEnabled, mollieTestMode } from "@/lib/mollie";
import { createOrder, setMolliePaymentId, type CreateOrderInput } from "@/lib/orders";
import {
  isStaalOrderItem,
  isStaalRegel,
  MAX_STALEN_PER_ORDER,
  STAAL_NAAM,
  STAAL_PRIJS,
  staalOrderItem,
} from "@/lib/stalen";
import { beoordeelVoucher, normaliseerVoucherCode } from "@/lib/vouchers";
import { baseUrlFromRequest } from "@/lib/site";
import { getProductById, getStockForSkus, getStockPerSku, getStore } from "@/lib/tilroy";
import type { CheckoutInput, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTAL_CODE_PATTERN = /^\d{4}\s?[A-Za-z]{2}$/;

export async function POST(request: Request) {
  // Stopwatch per fase. "Je wordt doorgestuurd…" bleef bij Kevin lang staan
  // en de logs konden niet vertellen wáár de tijd zat; nu wel.
  const gestart = Date.now();
  let vorigMeetpunt = gestart;
  const klok: string[] = [];
  const meet = (fase: string) => {
    klok.push(`${fase} ${Date.now() - vorigMeetpunt}ms`);
    vorigMeetpunt = Date.now();
  };

  let input: CheckoutInput;
  try {
    input = (await request.json()) as CheckoutInput;
  } catch {
    return badRequest("Ongeldige aanvraag.");
  }

  const firstName = (input.customer?.firstName ?? "").trim();
  const lastName = (input.customer?.lastName ?? "").trim();
  const email = (input.customer?.email ?? "").trim();
  const phone = (input.customer?.phone ?? "").trim();
  // Bedrijfsnaam is vrijwillig; alleen schoonmaken en begrenzen, niet eisen.
  const company = (input.customer?.company ?? "").toString().trim().slice(0, 120);
  if (firstName.length < 2) return badRequest("Vul je voornaam in.");
  if (lastName.length < 2) return badRequest("Vul je achternaam in.");
  if (!EMAIL_PATTERN.test(email)) return badRequest("Vul een geldig e-mailadres in.");
  if (phone.replace(/[^\d]/g, "").length < 8) {
    return badRequest("Vul een geldig telefoonnummer in.");
  }

  // Bezorgen of afhalen bepaalt de rest van de validatie.
  const fulfilment = input.fulfilment === "pickup" ? "pickup" : "delivery";

  let store: Awaited<ReturnType<typeof getStore>> | undefined;
  let address:
    | {
        street: string;
        houseNumber: string;
        houseNumberSuffix?: string;
        postalCode: string;
        city: string;
      }
    | undefined;

  if (fulfilment === "pickup") {
    store = await getStore(String(input.storeId ?? ""));
    if (!store) return badRequest("Kies een geldige afhaalwinkel.");
  } else {
    // Tilroy vereist een gesplitst adres: straat en huisnummer (+ toevoeging) apart.
    const street = (input.customer?.street ?? "").trim();
    const houseNumber = (input.customer?.houseNumber ?? "").trim();
    const houseNumberSuffix = (input.customer?.houseNumberSuffix ?? "").trim();
    const postalCode = (input.customer?.postalCode ?? "").trim().toUpperCase();
    const city = (input.customer?.city ?? "").trim();
    if (street.length < 2) return badRequest("Vul je straatnaam in.");
    if (!/\d/.test(houseNumber) || houseNumber.length > 8) {
      return badRequest("Vul een geldig huisnummer in.");
    }
    // Elk land zijn eigen postcodevorm: Nederland 1234 AB, België vier
    // cijfers. Eén NL-patroon voor beide weigerde élke Belgische klant —
    // terwijl de site België expliciet belooft.
    const bestemming = shippingCountry(input.customer?.country);
    if (bestemming === "BE" ? !/^\d{4}$/.test(postalCode) : !POSTAL_CODE_PATTERN.test(postalCode)) {
      return badRequest(
        bestemming === "BE"
          ? "Vul een geldige Belgische postcode in (vier cijfers, bv. 2000)."
          : "Vul een geldige postcode in (bv. 1234 AB).",
      );
    }
    if (city.length < 2) return badRequest("Vul je woonplaats in.");
    address = {
      street,
      houseNumber,
      ...(houseNumberSuffix ? { houseNumberSuffix } : {}),
      postalCode,
      city,
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return badRequest("Je winkelwagen is leeg.");
  }
  if (input.items.length > 50) {
    return badRequest("Een bestelling kan maximaal 50 verschillende artikelen bevatten.");
  }

  /*
   * Korting hangt aan het account, niet aan een ingetypt pasnummer.
   *
   * Hier stond een veld waar de klant zijn Kluspas-nummer intypte, en elk
   * plausibel nummer (zes tot twintig cijfers) gaf 5% korting — het echte
   * ledenbestand kent alleen de kassa, dus er viel niets te controleren.
   * Bovendien zijn de nummers oplopend, dus raden was triviaal.
   *
   * Nu leest de server het e-mailadres uit de sessiecookie. Ingelogd is
   * korting; dat is ook wat de winkel wil, want een account levert een
   * klant op die terugkomt.
   */
  const sessieEmail = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);

  /*
   * Drie geldige gronden voor directe korting, elk server-side getoetst:
   *
   * 1. Ingelogd — het bestaande pad.
   * 2. Particulier die bij het bestellen een account laat aanmaken. Het adres
   *    is dan meteen een account (accounts zijn e-mailgebaseerd; inloggen kan
   *    altijd al met een code naar datzelfde adres).
   * 3. Zakelijk met Profpas-vinkje — alleen als VIES het BTW-nummer écht
   *    bevestigt. Formaat is niet genoeg: een verzonnen nummer ziet er net zo
   *    uit. Zo houden we koopjesjagers zonder bedrijf buiten de korting.
   *
   * VIES onbereikbaar telt als níét bevestigd: anders is elke storing bij de
   * EU een gratis kortingsdag. De klant krijgt dat als nette melding terug en
   * kan zonder vinkje gewoon bestellen.
   */
  const klantType = input.klantType === "zakelijk" ? "zakelijk" : "particulier";
  const accountAanmaken = klantType === "particulier" && input.accountAanmaken === true;
  const kvk = (input.kvk ?? "").replace(/[^0-9]/g, "");
  const btw = normaliseerBtw(input.btw ?? "");
  const land = shippingCountry(input.customer?.country);

  /*
   * Zakelijke controle per land (regels Kevin):
   * - Nederland: alleen een KvK-nummer nodig. Acht cijfers is de lat.
   * - Buitenland (België): een BTW-nummer dat VIES écht bevestigt — dat is
   *   de enige controle die wij op afstand kunnen doen, en het nummer komt
   *   ook op de factuur, dus fout invullen blokkeert.
   */
  if (klantType === "zakelijk") {
    if (!company) return badRequest("Vul je bedrijfsnaam in.");
    if (input.bedrijfsType && !isBedrijfsType(input.bedrijfsType)) {
      return badRequest("Ongeldig bedrijfstype.");
    }
    if (land === "NL") {
      if (!kvkGeldig(kvk)) {
        return badRequest("Vul je KvK-nummer in (acht cijfers).");
      }
    } else {
      if (!btwFormaatGeldig(btw)) {
        return badRequest("Vul een geldig BTW-nummer in (bijv. BE0123456789).");
      }
      const vies = await controleerBtw(btw);
      if (vies.status === "ongeldig") {
        return badRequest(
          "Dit BTW-nummer wordt niet herkend in het EU-register (VIES). Controleer het nummer.",
        );
      }
      if (vies.status === "onbeslist" && input.profpas === true) {
        return badRequest(
          "De BTW-controle (VIES) is tijdelijk niet bereikbaar. Probeer het zo weer, of bestel zonder Profpas-korting — die schrijven we dan later bij.",
        );
      }
      if (vies.status === "geldig") {
        console.log(
          `[checkout] VIES bevestigt ${btw}${vies.naam ? ` (${vies.naam})` : ""}`,
        );
      }
    }
  }

  // Korting: ingelogd, account aanmaken, of een gecontroleerd bedrijf met
  // Profpas-vinkje (NL: geldige KvK; buitenland: VIES-bevestigde BTW —
  // hierboven al afgedwongen, anders was de bestelling geweigerd).
  let kluspas = Boolean(sessieEmail) || accountAanmaken;
  if (klantType === "zakelijk" && input.profpas === true) {
    kluspas = true;
  }

  // Het pasnummer zetten we alleen in de order als de klant er echt een heeft;
  // de winkel koppelt de bestelling daarmee aan de kaart.
  const kluspasInput = sessieEmail ? await kluspasNummerVan(sessieEmail) : "";

  // Prijzen en productgegevens altijd server-side bepalen; de client levert
  // alleen id's en aantallen aan. Bedragen in de order zijn EURO'S (contract).
  const items: OrderItem[] = [];
  // Artikelen die niet met de pakketdienst mee kunnen (kruiwagen, 25 kg zout).
  const nietVerzendbaar: string[] = [];
  let subtotalCents = 0;
  let kluspasSavingCents = 0;
  // Zit er mengverf in het mandje? Bepaalt of een staal-voucher geldt.
  let bevatMengverf = false;
  let aantalStalen = 0;
  meet("validatie");
  for (const entry of input.items) {
    // Kleurtesters zijn een virtueel artikel: ze staan niet in de catalogus,
    // dus prijs en naam komen uit lib/stalen.ts — nooit uit het verzoek.
    if (isStaalRegel(entry)) {
      const qty = Math.floor(Number(entry.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_STALEN_PER_ORDER) {
        return badRequest(`Ongeldig aantal voor ${STAAL_NAAM}.`);
      }
      aantalStalen += qty;
      if (aantalStalen > MAX_STALEN_PER_ORDER) {
        return badRequest(
          `Maximaal ${MAX_STALEN_PER_ORDER} kleurtesters per bestelling. Voor meer kleuren helpt de winkel je graag met de officiële waaier.`,
        );
      }
      if (!entry.colorKey || entry.colorKey === "wit") {
        return badRequest(`Kies een kleur voor je ${STAAL_NAAM.toLowerCase()}.`);
      }
      const paint = await resolvePaintColor(String(entry.colorKey));
      if (!paint) return badRequest(`Onbekende kleur voor ${STAAL_NAAM.toLowerCase()}.`);
      items.push(
        staalOrderItem(
          {
            key: paint.key,
            code: paint.code,
            name: paint.name,
            hex: paint.hex,
            collection: paint.group,
          },
          qty,
        ),
      );
      subtotalCents += STAAL_PRIJS * qty;
      continue;
    }

    const product = await getProductById(String(entry.productId ?? ""));
    if (!product) return badRequest("Een van de artikelen bestaat niet (meer).");

    const qty = Math.floor(Number(entry.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
      return badRequest(`Ongeldig aantal voor ${product.name}.`);
    }

    const variant = entry.variantId
      ? product.variants?.find((candidate) => candidate.id === entry.variantId)
      : undefined;
    if (entry.variantId && !variant) {
      return badRequest(`Ongeldige variant voor ${product.name}.`);
    }

    // Per gekozen maat beoordelen: een blik van 2,5 liter gaat prima mee,
    // dezelfde verf in 25 liter niet.
    if (variant?.pickupOnly ?? product.pickupOnly) {
      nietVerzendbaar.push([product.name, variant?.name].filter(Boolean).join(" "));
    }

    if (product.colorMixable) bevatMengverf = true;

    let color: OrderItem["color"];
    // 100% wit is geen mengkleur maar een eigen artikel: de variant draagt de
    // sku en prijs van het fabriekswit, en dáár boekt de kassa de voorraad af.
    const wit100 = entry.colorKey === "wit";
    if (wit100) {
      if (!variant?.wit) {
        return badRequest(`${product.name} is niet in 100% wit leverbaar.`);
      }
      color = {
        key: "wit",
        code: "100% Wit",
        name: "100% Wit — direct uit voorraad",
        hex: "#FFFFFF",
      };
    } else if (entry.colorKey) {
      if (!product.colorMixable) {
        return badRequest(`${product.name} is niet op kleur te mengen.`);
      }
      const paint = await resolvePaintColor(String(entry.colorKey));
      if (!paint) return badRequest(`Onbekende kleur voor ${product.name}.`);
      color = {
        key: paint.key,
        code: paint.code,
        name: paint.name,
        hex: paint.hex,
        collection: paint.group,
      };
    } else if (product.colorMixable) {
      return badRequest(`Kies een kleur voor ${product.name}.`);
    }

    // Met een Kluspas geldt de kortingsprijs uit de feed; die rekenen we niet
    // zelf uit, zodat site en kassa altijd hetzelfde bedrag hanteren.
    //
    // ⚠️ De Kluspas-prijs hoort bij de gekozen maat. Namen we hier die van het
    // product (= de goedkoopste maat), dan rekende een klant met pas voor een
    // blik van 2,5 liter de pasprijs van het blikje van 500 ml af.
    const listCents = wit100 && variant?.wit ? variant.wit.price : variant?.price ?? product.price;
    const listKluspas =
      wit100 && variant?.wit
        ? variant.wit.kluspasPrice
        : variant
          ? variant.kluspasPrice
          : product.kluspasPrice;
    const unitCents = kluspas ? kluspasUnitPrice(listCents, listKluspas) : listCents;
    subtotalCents += unitCents * qty;
    kluspasSavingCents += (listCents - unitCents) * qty;

    const variantLabel = [
      variant?.name,
      color ? [color.code, color.name].filter(Boolean).join(" ") : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    items.push({
      key: `${product.id}:${variant?.id ?? ""}:${color?.code ?? ""}`,
      productId: product.id,
      variantId: variant?.id,
      // sku van de bestelde variant (of het product) — Tilroy identificeert
      // orderregels uitsluitend hierop; ean gaat mee zodra de bron die levert.
      // Bij 100% wit is dat de sku van het wit-artikel, zodat de kassa de
      // voorraad van het juiste blik afboekt. Uit de catalogus, nooit uit het
      // verzoek.
      sku: wit100 && variant?.wit ? variant.wit.sku : variant?.sku ?? product.sku,
      ean: product.ean,
      title: product.name,
      brand: product.brand,
      image: "",
      variantLabel: variantLabel || undefined,
      slug: product.slug,
      quantity: qty,
      price: unitCents / 100,
      color,
      icon: product.art.icon,
      hue: product.art.hue,
    });
  }

  // Te groot of te zwaar voor een pakket: dan kan die bestelling niet bezorgd
  // worden. Hier tegenhouden en niet alleen op de productpagina melden, anders
  // komt er een order binnen die de winkel moet terugbellen.
  if (fulfilment === "delivery" && nietVerzendbaar.length > 0) {
    const enkel = nietVerzendbaar.length === 1;
    return NextResponse.json(
      {
        error: `${nietVerzendbaar.join(" en ")} ${
          enkel ? "kan" : "kunnen"
        } niet met de pakketdienst mee. Kies afhalen in de winkel, of haal ${
          enkel ? "dit artikel" : "deze artikelen"
        } uit je winkelwagen.`,
        alleenAfhalen: nietVerzendbaar,
      },
      { status: 409 },
    );
  }

  // Afhalen kan alleen als élk artikel in die winkel ligt — anders staat de
  // klant voor niets aan de balie. Dit hier controleren (niet alleen in de
  // browser) is wat het echt afdwingt.
  if (fulfilment === "pickup" && store) {
    const tekort: { naam: string; elders: string[] }[] = [];
    for (const item of items) {
      // Kleurtesters worden ter plekke gemengd; elke winkel kan dat.
      if (isStaalOrderItem(item)) continue;
      const stock = await getStockForSkus([item.sku ?? item.productId]);
      if (!stock.live) break; // voorraad onbekend: niet blokkeren op een gok
      const hier = stock.stores.find((row) => row.storeId === store.slug);
      if ((hier?.qty ?? 0) < item.quantity) {
        tekort.push({
          naam: item.title,
          elders: stock.stores
            .filter((row) => row.qty >= item.quantity && row.storeId !== store.slug)
            .map((row) => row.city),
        });
      }
    }
    if (tekort.length > 0) {
      const eerste = tekort[0];
      const elders =
        eerste.elders.length > 0
          ? ` Wel op voorraad in ${eerste.elders.join(", ")}.`
          : " Kies bezorgen, dan regelen we het vanuit een andere vestiging.";
      return NextResponse.json(
        {
          error:
            tekort.length === 1
              ? `${eerste.naam} ligt niet (voldoende) in ${store.city}.${elders}`
              : `${tekort.length} artikelen liggen niet in ${store.city}.${elders}`,
          unavailable: tekort,
        },
        { status: 409 },
      );
    }
  }

  const subtotal = subtotalCents / 100;

  /*
   * Staal-voucher: het testerbedrag terug, maar alleen op een bestelling mét
   * mengverf — de voucher is een aanbetaling op de klus, geen kortingscode
   * voor het hele assortiment. Beoordeling en bedrag komen uit de opslag;
   * het verzoek levert alleen de code aan. Opgemaakt wordt hij pas als de
   * betaling binnen is (applyPaymentResult), zodat een afgebroken betaling
   * het tegoed niet kost.
   */
  let voucherKortingCents = 0;
  let voucherCode: string | undefined;
  const gevraagdeVoucher = normaliseerVoucherCode(input.voucherCode ?? "");
  if (gevraagdeVoucher) {
    const oordeel = await beoordeelVoucher(gevraagdeVoucher);
    if (oordeel.status !== "geldig") {
      return badRequest(oordeel.melding);
    }
    if (!bevatMengverf) {
      return badRequest(
        "Je staal-voucher geldt bij een bestelling met mengverf. Voeg de verf toe waarvoor je de kleur hebt getest, dan gaat het tegoed er direct af.",
      );
    }
    voucherKortingCents = Math.min(oordeel.voucher.bedrag, subtotalCents);
    voucherCode = oordeel.voucher.code;
  }

  // Afhalen is altijd gratis; bij bezorgen gelden de landtarieven, tenzij er
  // een merk in het mandje ligt dat we franco versturen (Sikkens). Dat
  // bepalen we hier en niet op de client: anders kan iemand het meesturen.
  // De gratis-grens rekent over wat de klant écht betaalt, dus ná de voucher.
  const gratisOngeachtBedrag = franco(items.map((item) => item.brand));
  const verzendkostenCents =
    fulfilment === "pickup"
      ? 0
      : shippingCost(subtotalCents - voucherKortingCents, land, gratisOngeachtBedrag);

  const orderInput: CreateOrderInput = {
    customer: {
      firstName,
      lastName,
      email,
      phone,
      ...(company ? { company } : {}),
      ...(klantType === "zakelijk"
        ? {
            ...(kvk ? { kvk } : {}),
            ...(btw ? { btw } : {}),
            ...(input.bedrijfsType && isBedrijfsType(input.bedrijfsType)
              ? { bedrijfsType: input.bedrijfsType }
              : {}),
          }
        : {}),
      ...(address ?? {}),
      country: land,
    },
    items,
    subtotal,
    shipping: verzendkostenCents / 100,
    total: (subtotalCents - voucherKortingCents + verzendkostenCents) / 100,
    fulfilment,
    ...(kluspas
      ? {
          kluspasNumber: kluspasInput,
          kluspasSavings: kluspasSavingCents / 100,
        }
      : {}),
    ...(voucherCode
      ? { voucherCode, voucherKorting: voucherKortingCents / 100 }
      : {}),
    isTest: mollieTestMode() || undefined,
  };

  if (fulfilment === "pickup" && store) {
    orderInput.store = { id: store.id, name: store.name, city: store.city };
  } else {
    // De bezorgbelofte volgt uit de voorraad: ligt alles in Nijverdal
    // (webshopvoorraad), dan gaat het met DHL onder de 09:00-cutoff; anders
    // verstuurt de winkel die het artikel heeft het met PostNL binnen één
    // werkdag. Lukt de voorraadcheck niet, dan beloven we het voorzichtige
    // scenario in plaats van iets wat we niet waar kunnen maken.
    const promises = [];
    let fulfilStoreId: string | undefined;
    // Kleurtesters staan niet in de voorraad-hub: het webshopmagazijn mengt
    // ze zelf, dus ze zijn altijd leverbaar en tellen niet mee in de check.
    const voorraadItems = items.filter((item) => !isStaalOrderItem(item));
    let voorraadBekend = false;
    try {
      // Eén voorraadaanvraag voor het hele mandje. Regel voor regel de hub
      // bevragen — ná elkaar — was waarom "Je wordt doorgestuurd…" bij vijf
      // artikelen tientallen seconden bleef staan.
      const perSku =
        voorraadItems.length > 0
          ? await getStockPerSku(
              voorraadItems.map((item) => item.sku ?? item.productId),
              8_000,
            )
          : null;
      if (perSku) {
        voorraadBekend = true;
        // Nul-voorraad is niet bestelbaar (beslissing Kevin). Zonder deze
        // weigering betaalde een klant gewoon voor een artikel dat nergens
        // ligt, met "binnen 1 werkdag" als valse belofte erbij. Alleen
        // weigeren als de hub écht antwoordde — bij een storing liever de
        // voorzichtige belofte dan een dichte winkel.
        for (const item of voorraadItems) {
          const voorraad = perSku.get(item.sku ?? item.productId);
          if (voorraad && voorraad.webshopQty <= 0 && voorraad.otherStoresQty <= 0) {
            return badRequest(
              `${item.title} is tijdelijk uitverkocht en kan nu niet besteld worden. Haal het uit je winkelwagen, of zet er een voorraadmelding op.`,
            );
          }
        }
        for (const item of voorraadItems) {
          const voorraad = perSku.get(item.sku ?? item.productId) ?? {
            webshopQty: 0,
            otherStoresQty: 0,
          };
          promises.push(deliveryPromise(voorraad, undefined, land));
        }
        // Verstuurt een andere winkel? Eén aparte blik op de rijen volstaat.
        if (promises.some((p) => p.carrier === "postnl") && !fulfilStoreId) {
          const stock = await getStockForSkus(
            voorraadItems.map((item) => item.sku ?? item.productId),
          );
          const from = stock.stores.find((row) => row.qty > 0 && row.storeId !== "nijverdal");
          if (from) fulfilStoreId = from.storeId;
        }
      }
    } catch (error) {
      console.error("[checkout] voorraadcheck voor de bezorgbelofte mislukt:", error);
    }

    // De testers zelf: het webshopmagazijn mengt en verstuurt ze. Alleen
    // meetellen als de rest van het mandje een betrouwbare belofte heeft
    // (of er geen rest is) — anders zou een tester een snelle belofte doen
    // voor artikelen waarvan de voorraad onbekend is.
    if (
      items.some((item) => isStaalOrderItem(item)) &&
      (voorraadItems.length === 0 || voorraadBekend)
    ) {
      promises.push(deliveryPromise({ webshopQty: 99, otherStoresQty: 0 }, undefined, land));
    }

    const promise =
      promises.length > 0
        ? combinePromises(promises)
        : deliveryPromise({ webshopQty: 0, otherStoresQty: 1 }, undefined, land);

    // Vandaag bezorgen alleen als de klant het vroeg én het op dít moment
    // ook echt kan. De server beslist, niet het formulier: anders zou een
    // oude pagina of een aangepast verzoek een spoedlabel opleveren voor een
    // order die pas morgen de deur uit kan — of andersom, een klant die
    // betaalde voor vandaag een gewoon label geven.
    const wilSameDay = input.sameDay === true;
    const sameDay = wilSameDay && promise.sameDayAvailable;

    if (sameDay) {
      const toeslag = promise.sameDaySurcharge / 100;
      orderInput.shipping = Number((orderInput.shipping + toeslag).toFixed(2));
      orderInput.total = Number((orderInput.total + toeslag).toFixed(2));
    }

    orderInput.delivery = {
      type: sameDay ? "same-day" : promise.type === "unavailable" ? "next-workday" : promise.type,
      carrier: promise.carrier ?? "postnl",
      expectedDate: (
        (sameDay ? promise.sameDayDate : promise.deliveryDate) ?? new Date()
      ).toISOString(),
      ...(fulfilStoreId ? { fulfilStoreId } : {}),
    };
  }

  meet("artikelen-en-voorraad");
  const order = await createOrder(orderInput);
  meet("order-opslaan");
  const baseUrl = baseUrlFromRequest(request);

  if (!mollieEnabled()) {
    return NextResponse.json({
      orderId: order.id,
      reference: order.reference,
      checkoutUrl: `/betalen/demo/${order.reference}`,
    });
  }

  try {
    const { paymentId, checkoutUrl } = await createMolliePayment(
      order,
      baseUrl,
      // Alleen een methode die wij ook echt aanbieden; een willekeurige
      // waarde uit het verzoek zou Mollie met een foutmelding weigeren.
      isBetaalmethode(input.betaalmethode) ? input.betaalmethode : undefined,
    );
    await setMolliePaymentId(order.id, paymentId);
    meet("mollie");
    console.log(
      "[checkout] " + order.reference + " klaar in " + (Date.now() - gestart) + "ms — " + klok.join(", "),
    );
    return NextResponse.json({ orderId: order.id, reference: order.reference, checkoutUrl });
  } catch (error) {
    console.error(`[mollie] betaling aanmaken voor ${order.reference} mislukt:`, error);
    return NextResponse.json(
      { error: "De betaling kon niet worden gestart. Probeer het opnieuw." },
      { status: 502 },
    );
  }
}
