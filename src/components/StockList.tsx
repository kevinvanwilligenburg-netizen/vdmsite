"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import type { ProductStock } from "@/lib/tilroy";

interface StoreRow {
  storeId: string;
  city: string;
}

/**
 * Voorraad per winkel, live uit het kassasysteem via de voorraad-hub van het
 * dashboard. Wordt ná de eerste render opgehaald: bij een koude cache doet de
 * hub een volledige crawl (~40 s) en dat mag de productpagina niet ophouden.
 */
export function StockList({
  skus,
  stores,
  fallbackInStock,
}: {
  skus: string[];
  stores: StoreRow[];
  fallbackInStock: boolean;
}) {
  const [stock, setStock] = useState<ProductStock | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (skus.length === 0) return;
    let active = true;
    fetch(`/api/voorraad?skus=${encodeURIComponent(skus.join(","))}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProductStock | null) => {
        if (!active) return;
        if (data?.live) setStock(data);
        else setFailed(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [skus]);

  const rows = stock?.stores ?? stores.map((store) => ({ ...store, qty: -1 }));
  const availableCount = stock ? stock.stores.filter((entry) => entry.qty > 0).length : null;
  const deliverable =
    stock?.webshopQty != null ? stock.webshopQty > 0 : fallbackInStock;

  return (
    <details className="card group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-ink">
        <span className="flex items-center gap-2">
          <Icon name="pin" className="h-5 w-5 shrink-0 text-brand" />
          <span>
            Voorraad in de winkel{" "}
            <span className="font-semibold text-ink-soft">
              {availableCount === null
                ? "– bekijk per winkel"
                : `– op voorraad in ${availableCount} van de ${rows.length} winkels`}
            </span>
          </span>
        </span>
        <span className="transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <Icon
          name="truck"
          className={`h-5 w-5 shrink-0 ${deliverable ? "text-green-700" : "text-ink-soft"}`}
        />
        <span className={deliverable ? "font-semibold text-green-700" : "text-ink-soft"}>
          {deliverable
            ? "Leverbaar — wordt bezorgd"
            : "Tijdelijk niet leverbaar voor bezorging"}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-ink/5">
        {rows.map((row) => (
          <li key={row.storeId} className="flex items-center justify-between py-2 text-sm">
            <span className="font-semibold text-ink">{row.city}</span>
            {row.qty < 0 ? (
              <span className="text-ink-soft">
                {failed ? "Onbekend — bel de winkel" : "Laden…"}
              </span>
            ) : row.qty > 2 ? (
              <span className="font-bold text-green-700">● Op voorraad</span>
            ) : row.qty > 0 ? (
              <span className="font-bold text-amber-600">● Nog {row.qty} stuks</span>
            ) : (
              <span className="font-semibold text-ink-soft">○ Uitverkocht</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-ink-soft">
        {stock?.live
          ? "Voorraad komt live uit ons kassasysteem."
          : failed
            ? "De voorraadstand is nu niet op te halen; bel gerust de winkel."
            : "Voorraad wordt opgehaald uit ons kassasysteem."}{" "}
        Je betaalt bij het plaatsen van je bestelling; de winkel legt je
        artikelen apart.
      </p>
    </details>
  );
}
