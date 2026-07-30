"use client";

import { useEffect, useState } from "react";

import type { CartItem } from "@/lib/types";

/**
 * Wat de accountkorting op dit mandje waard is, opgehaald bij de server.
 *
 * Bewust niet uit de winkelwagen zelf gerekend: die bewaart een
 * prijsmomentopname per regel, en een mandje van gisteren mist velden die er
 * vandaag wel zijn. Zie /api/korting voor het hele verhaal.
 */
export function useKorting(items: CartItem[]): number {
  const [korting, setKorting] = useState(0);

  // De regels als sleutel, zodat we alleen opnieuw vragen als het mandje
  // verandert — niet bij elke render.
  const sleutel = items
    .map((item) => `${item.productId}:${item.variantId ?? ""}:${item.qty}`)
    .join("|");

  useEffect(() => {
    if (items.length === 0) {
      setKorting(0);
      return;
    }
    let actief = true;
    fetch("/api/korting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
        })),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { korting?: number } | null) => {
        if (actief && typeof data?.korting === "number") setKorting(data.korting);
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel]);

  return korting;
}
