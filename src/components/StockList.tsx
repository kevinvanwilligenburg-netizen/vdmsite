"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { deliveryExplanation, deliveryPromise } from "@/lib/delivery";
import type { ProductStock } from "@/lib/tilroy";

interface StoreRow {
  storeId: string;
  city: string;
}

/**
 * Voorraad per winkel plus de bezorgbelofte, live uit het kassasysteem via de
 * voorraad-hub. Wordt ná de eerste render opgehaald: bij een koude cache doet
 * de hub een volledige crawl (~40 s) en dat mag de pagina niet ophouden.
 *
 * De belofte hangt af van waar het artikel ligt — in Nijverdal (webshop-
 * voorraad, DHL, vóór 10:00 vandaag nog) of in een andere winkel (PostNL,
 * binnen één werkdag).
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

  const promise = stock
    ? deliveryPromise({
        webshopQty: stock.webshopQty ?? 0,
        otherStoresQty: stock.otherStoresQty ?? 0,
      })
    : null;

  return (
    <div className="space-y-3">
      {/* Bezorgbelofte */}
      <div
        className={`card flex items-start gap-3 p-4 ${
          promise?.type === "unavailable" ? "" : "ring-1 ring-green-200"
        }`}
      >
        <Icon
          name="truck"
          className={`mt-0.5 h-6 w-6 shrink-0 ${
            !promise
              ? "text-ink-soft"
              : promise.type === "unavailable"
                ? "text-ink-soft"
                : "text-green-700"
          }`}
        />
        <div>
          <p
            className={`font-black ${
              promise && promise.type !== "unavailable" ? "text-green-700" : "text-ink"
            }`}
          >
            {promise
              ? promise.label
              : failed
                ? fallbackInStock
                  ? "Leverbaar"
                  : "Levertijd onbekend"
                : "Levertijd ophalen…"}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {promise
              ? deliveryExplanation(promise)
              : "Gratis bezorgd, of gratis afhalen in de winkel."}
          </p>
        </div>
      </div>

      {/* Voorraad per winkel */}
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

        <ul className="mt-3 divide-y divide-ink/5">
          {rows.map((row) => (
            <li key={row.storeId} className="flex items-center justify-between py-2 text-sm">
              <span className="font-semibold text-ink">
                {row.city}
                {row.storeId === "nijverdal" && (
                  <span className="ml-2 rounded bg-brand-light px-1.5 py-0.5 text-xs font-bold text-brand">
                    webshopvoorraad
                  </span>
                )}
              </span>
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
          Afhalen is gratis en kan in elke winkel waar het artikel ligt.
        </p>
      </details>
    </div>
  );
}
