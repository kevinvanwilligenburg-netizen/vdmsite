import { NextResponse } from "next/server";

import { createMolliePayment, mollieEnabled } from "@/lib/mollie";
import { createOrder, updateOrder } from "@/lib/orders";
import { findRal } from "@/lib/ral";
import { baseUrlFromRequest } from "@/lib/site";
import { getProductById, getStore } from "@/lib/tilroy";
import type { CartItem, CheckoutInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let input: CheckoutInput;
  try {
    input = (await request.json()) as CheckoutInput;
  } catch {
    return badRequest("Ongeldige aanvraag.");
  }

  const name = (input.customer?.name ?? "").trim();
  const email = (input.customer?.email ?? "").trim();
  const phone = (input.customer?.phone ?? "").trim();
  if (name.length < 2) return badRequest("Vul je naam in.");
  if (!EMAIL_PATTERN.test(email)) return badRequest("Vul een geldig e-mailadres in.");
  if (phone.replace(/[^\d]/g, "").length < 8) {
    return badRequest("Vul een geldig telefoonnummer in.");
  }

  const store = await getStore(String(input.storeId ?? ""));
  if (!store) return badRequest("Kies een geldige afhaalwinkel.");

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return badRequest("Je winkelwagen is leeg.");
  }
  if (input.items.length > 50) {
    return badRequest("Een bestelling kan maximaal 50 verschillende artikelen bevatten.");
  }

  // Prijzen en productgegevens altijd server-side bepalen; de client levert
  // alleen id's en aantallen aan.
  const items: CartItem[] = [];
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

    let color: CartItem["color"];
    if (entry.colorCode) {
      if (!product.colorMixable) {
        return badRequest(`${product.name} is niet op kleur te mengen.`);
      }
      const ral = findRal(String(entry.colorCode));
      if (!ral) return badRequest(`Onbekende RAL-kleur voor ${product.name}.`);
      color = { code: ral.code, name: ral.name, hex: ral.hex };
    } else if (product.colorMixable) {
      return badRequest(`Kies een kleur voor ${product.name}.`);
    }

    items.push({
      key: `${product.id}:${variant?.id ?? ""}:${color?.code ?? ""}`,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantId: variant?.id,
      variantName: variant?.name,
      color,
      unitPrice: variant?.price ?? product.price,
      qty,
      icon: product.art.icon,
      hue: product.art.hue,
    });
  }

  const order = await createOrder({
    items,
    customer: { name, email, phone },
    store: { id: store.id, name: store.name, city: store.city },
  });

  const baseUrl = baseUrlFromRequest(request);

  if (!mollieEnabled()) {
    await updateOrder(order.id, { payment: { provider: "demo" } });
    return NextResponse.json({
      orderId: order.id,
      checkoutUrl: `/betalen/demo/${order.id}`,
    });
  }

  try {
    const { paymentId, checkoutUrl } = await createMolliePayment(order, baseUrl);
    await updateOrder(order.id, { payment: { provider: "mollie", id: paymentId } });
    return NextResponse.json({ orderId: order.id, checkoutUrl });
  } catch (error) {
    console.error(`[mollie] betaling aanmaken voor ${order.id} mislukt:`, error);
    return NextResponse.json(
      { error: "De betaling kon niet worden gestart. Probeer het opnieuw." },
      { status: 502 },
    );
  }
}
