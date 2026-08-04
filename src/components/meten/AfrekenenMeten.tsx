"use client";

import { useCart } from "@/components/cart/CartProvider";
import { AfrekenenGestart } from "@/components/meten/Paginameting";
import { euroWaarde } from "@/lib/analytics";

/**
 * Meldt begin_checkout zodra iemand de afrekenpagina opent.
 *
 * Apart van de afrekenpagina zelf omdat het mandje clientside leeft: de
 * server weet niet wat erin zit. Deze component leest het uit de context en
 * geeft het door.
 *
 * Wacht op `hydrated`: vóór dat moment is het mandje uit localStorage nog niet
 * ingelezen en zou je een lege afrekenpoging melden.
 */
export function AfrekenenMeten() {
  const { items, subtotal, hydrated } = useCart();
  if (!hydrated) return null;
  return (
    <AfrekenenGestart
      waarde={euroWaarde(subtotal)}
      items={items.map((item) => ({
        item_id: item.productId,
        item_name: item.name,
        ...(item.variantName ? { item_variant: item.variantName } : {}),
        price: euroWaarde(item.unitPrice),
        quantity: item.qty,
      }))}
    />
  );
}
