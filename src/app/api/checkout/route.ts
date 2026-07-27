import { NextResponse } from "next/server";

import { resolvePaintColor } from "@/lib/colors";
import { deliveryInfo } from "@/lib/delivery";
import { createMolliePayment, mollieEnabled, mollieTestMode } from "@/lib/mollie";
import { createOrder, setMolliePaymentId, type CreateOrderInput } from "@/lib/orders";
import { baseUrlFromRequest } from "@/lib/site";
import { getProductById, getStore } from "@/lib/tilroy";
import type { CheckoutInput, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTAL_CODE_PATTERN = /^\d{4}\s?[A-Za-z]{2}$/;

export async function POST(request: Request) {
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
    if (!POSTAL_CODE_PATTERN.test(postalCode)) {
      return badRequest("Vul een geldige postcode in (bv. 1234 AB).");
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

  // Prijzen en productgegevens altijd server-side bepalen; de client levert
  // alleen id's en aantallen aan. Bedragen in de order zijn EURO'S (contract).
  const items: OrderItem[] = [];
  let subtotalCents = 0;
  for (const entry of input.items) {
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

    let color: OrderItem["color"];
    if (entry.colorKey) {
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

    const unitCents = variant?.price ?? product.price;
    subtotalCents += unitCents * qty;

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
      sku: variant?.sku ?? product.sku,
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

  const subtotal = subtotalCents / 100;
  const orderInput: CreateOrderInput = {
    customer: {
      firstName,
      lastName,
      email,
      phone,
      ...(address ?? {}),
      country: "NL",
    },
    items,
    subtotal,
    shipping: 0,
    total: subtotal,
    fulfilment,
    isTest: mollieTestMode() || undefined,
  };

  if (fulfilment === "pickup" && store) {
    orderInput.store = { id: store.id, name: store.name, city: store.city };
  } else {
    const promise = deliveryInfo();
    orderInput.delivery = {
      type: promise.type,
      expectedDate: promise.deliveryDate.toISOString(),
    };
  }

  const order = await createOrder(orderInput);
  const baseUrl = baseUrlFromRequest(request);

  if (!mollieEnabled()) {
    return NextResponse.json({
      orderId: order.id,
      reference: order.reference,
      checkoutUrl: `/betalen/demo/${order.reference}`,
    });
  }

  try {
    const { paymentId, checkoutUrl } = await createMolliePayment(order, baseUrl);
    await setMolliePaymentId(order.id, paymentId);
    return NextResponse.json({ orderId: order.id, reference: order.reference, checkoutUrl });
  } catch (error) {
    console.error(`[mollie] betaling aanmaken voor ${order.reference} mislukt:`, error);
    return NextResponse.json(
      { error: "De betaling kon niet worden gestart. Probeer het opnieuw." },
      { status: 502 },
    );
  }
}
