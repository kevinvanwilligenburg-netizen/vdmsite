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
export type PasSoortKorting = "profpas" | "kluspas" | "geen";

export interface Kortingstand {
  /** Bedrag in centen. */
  bedrag: number;
  /** Van welke pas de korting komt; bepaalt hoe we hem noemen. */
  pas: PasSoortKorting;
}

export function useKorting(items: CartItem[]): Kortingstand {
  const [stand, setStand] = useState<Kortingstand>({ bedrag: 0, pas: "geen" });

  // De regels als sleutel, zodat we alleen opnieuw vragen als het mandje
  // verandert — niet bij elke render.
  const sleutel = items
    .map((item) => `${item.productId}:${item.variantId ?? ""}:${item.qty}`)
    .join("|");

  useEffect(() => {
    if (items.length === 0) {
      setStand({ bedrag: 0, pas: "geen" });
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
      .then((data: { korting?: number; pas?: string } | null) => {
        if (!actief || typeof data?.korting !== "number") return;
        const pas: PasSoortKorting =
          data.pas === "profpas" ? "profpas" : data.pas === "kluspas" ? "kluspas" : "geen";
        setStand({ bedrag: data.korting, pas });
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel]);

  return stand;
}
