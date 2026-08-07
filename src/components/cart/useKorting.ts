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

export interface Staffelstand {
  /** Zoals de klant hem kent: "5 halen, 3 betalen". */
  naam: string;
  gratis: number;
  /** Bedrag in centen. */
  korting: number;
}

export interface Kortingstand {
  /** Bedrag in centen. */
  bedrag: number;
  /**
   * Wat een Kluspas op dit mandje extra zou opleveren, in centen.
   *
   * Anders dan `bedrag` staat dit er ook zónder account — het is de prikkel om
   * er een te maken, niet een regel die van het totaal af gaat. Trek het dus
   * alleen van het totaal af in een zin die met "met een account" begint.
   *
   * Het is het verschil dat een pas zou máken: artikelen die al onder een
   * aantal-actie vallen tellen niet mee, want daar komt het pasvoordeel niet
   * bovenop. Zie /api/korting.
   */
  mogelijkeKorting: number;
  /** Van welke pas de korting komt; bepaalt hoe we hem noemen. */
  pas: PasSoortKorting;
  /**
   * Aantal-acties die op dit mandje afgaan, mét bedrag.
   *
   * Los van `bedrag`, want dit is korting voor iedereen — ook zonder account.
   * Ze stapelen niet: de server kiest per actie het gunstigste van de twee.
   */
  staffels: Staffelstand[];
  /** Wat die aantal-acties samen opleveren, in centen. */
  staffelKorting: number;
}

const LEEG: Kortingstand = {
  bedrag: 0,
  mogelijkeKorting: 0,
  pas: "geen",
  staffels: [],
  staffelKorting: 0,
};

export function useKorting(items: CartItem[]): Kortingstand {
  const [stand, setStand] = useState<Kortingstand>(LEEG);

  // De regels als sleutel, zodat we alleen opnieuw vragen als het mandje
  // verandert — niet bij elke render.
  const sleutel = items
    .map((item) => `${item.productId}:${item.variantId ?? ""}:${item.qty}`)
    .join("|");

  useEffect(() => {
    if (items.length === 0) {
      setStand(LEEG);
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
      .then(
        (
          data: {
            korting?: number;
            mogelijkeKorting?: number;
            pas?: string;
            staffelKorting?: number;
            staffels?: Staffelstand[];
          } | null,
        ) => {
          if (!actief || typeof data?.korting !== "number") return;
          const pas: PasSoortKorting =
            data.pas === "profpas" ? "profpas" : data.pas === "kluspas" ? "kluspas" : "geen";
          setStand({
            bedrag: data.korting,
            mogelijkeKorting:
              typeof data.mogelijkeKorting === "number" ? data.mogelijkeKorting : 0,
            pas,
            staffels: Array.isArray(data.staffels) ? data.staffels : [],
            staffelKorting:
              typeof data.staffelKorting === "number" ? data.staffelKorting : 0,
          });
        },
      )
      .catch(() => undefined);
    return () => {
      actief = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel]);

  return stand;
}
