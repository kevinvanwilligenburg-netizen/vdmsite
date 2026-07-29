"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { useStore } from "@/components/store/StoreProvider";
import { deliveryExplanation, deliveryPromise } from "@/lib/delivery";
import { pickupPromise } from "@/lib/pickup";
import type { ProductStock } from "@/lib/tilroy";
import type { Store } from "@/lib/types";

/**
 * Voorraad en levertijd per artikel, live uit het kassasysteem via de
 * voorraad-hub. Wordt ná de eerste render opgehaald: bij een koude cache doet
 * de hub een volledige crawl (~40 s) en dat mag de pagina niet ophouden.
 *
 * De klant ziet twee dingen los van elkaar: wanneer het bezorgd wordt, en of
 * het in zijn eigen winkel ligt om binnen twee uur op te halen.
 */
export function StockList({
  skus,
  stores,
  fallbackInStock,
  alleenAfhalen,
}: {
  skus: string[];
  stores: Store[];
  fallbackInStock: boolean;
  /** Reden waarom dit artikel niet verzonden kan worden, als dat zo is. */
  alleenAfhalen?: string;
}) {
  const { favourite, setFavourite } = useStore();
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

  const rows = stock?.stores ?? stores.map((store) => ({ storeId: store.slug, city: store.city, qty: -1 }));
  const availableCount = stock ? stock.stores.filter((entry) => entry.qty > 0).length : null;

  const delivery = stock
    ? deliveryPromise({
        webshopQty: stock.webshopQty ?? 0,
        otherStoresQty: stock.otherStoresQty ?? 0,
      })
    : null;

  // Afhaalbelofte voor de winkel van de klant (of de eerste winkel die het heeft).
  const favouriteRow = favourite ? rows.find((row) => row.storeId === favourite.slug) : undefined;
  const suggestion = rows.find((row) => row.qty > 0);
  const pickupStore = stores.find(
    (store) => store.slug === (favourite?.slug ?? suggestion?.storeId),
  );
  const pickupQty = favourite ? (favouriteRow?.qty ?? -1) : (suggestion?.qty ?? -1);
  const pickup = pickupStore && pickupQty > 0 ? pickupPromise(pickupStore) : null;

  return (
    <div className="space-y-3">
      {/* Te groot of te zwaar voor een pakket: dan is bezorgen geen optie en
          zeggen we dat hier, niet pas in de checkout. */}
      {alleenAfhalen ? (
        <div className="card flex items-start gap-3 p-4">
          <Icon name="store" className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
          <div>
            <p className="font-black text-ink">Alleen afhalen in de winkel</p>
            <p className="text-sm text-ink-soft">{alleenAfhalen}</p>
          </div>
        </div>
      ) : (
        <div className="card flex items-start gap-3 p-4">
          <Icon
            name="truck"
            className={`mt-0.5 h-6 w-6 shrink-0 ${
              delivery && delivery.type !== "unavailable" ? "text-green-700" : "text-ink-soft"
            }`}
          />
          <div>
            <p
              className={`font-black ${
                delivery && delivery.type !== "unavailable" ? "text-green-700" : "text-ink"
              }`}
            >
              {delivery
                ? delivery.label
                : failed
                  ? fallbackInStock
                    ? "Leverbaar"
                    : "Levertijd onbekend"
                  : "Levertijd ophalen…"}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {delivery
                ? deliveryExplanation(delivery)
                : "Gratis bezorgd vanaf € 59, of gratis afhalen in de winkel."}
            </p>
          </div>
        </div>
      )}

      {/* Afhalen in jouw winkel */}
      <div className="card flex items-start gap-3 p-4">
        <Icon
          name="store"
          className={`mt-0.5 h-6 w-6 shrink-0 ${pickup ? "text-green-700" : "text-ink-soft"}`}
        />
        <div className="min-w-0 flex-1">
          {pickup && pickupStore ? (
            <>
              <p className="font-black text-green-700">
                Gratis afhalen in {pickupStore.city} — {pickup.label.toLowerCase()}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">{pickup.detail}</p>
              {!favourite && (
                <button
                  type="button"
                  onClick={() => setFavourite(pickupStore.slug)}
                  className="mt-1 text-sm font-bold text-brand hover:underline"
                >
                  Maak {pickupStore.city} mijn winkel
                </button>
              )}
            </>
          ) : favourite && favouriteRow && favouriteRow.qty === 0 ? (
            <>
              <p className="font-black text-ink">Niet op voorraad in {favourite.city}</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {suggestion
                  ? `Wel op voorraad in ${rows.find((row) => row.storeId === suggestion.storeId)?.city}. Kies die winkel hieronder, of laat het bezorgen.`
                  : "Dit artikel ligt nu in geen enkele winkel. Bezorgen kan wel zodra het weer binnen is."}
              </p>
              {suggestion && (
                <button
                  type="button"
                  onClick={() => setFavourite(suggestion.storeId)}
                  className="mt-1 text-sm font-bold text-brand hover:underline"
                >
                  Wissel naar {rows.find((row) => row.storeId === suggestion.storeId)?.city}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="font-black text-ink">Gratis afhalen in de winkel</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {stock
                  ? "Dit artikel ligt nu in geen enkele winkel op voorraad."
                  : "Binnen 2 uur klaar in een winkel waar dit artikel op voorraad ligt."}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Voorraad per winkel */}
      <details className="card group p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-ink">
          <span className="flex items-center gap-2">
            <Icon name="pin" className="h-5 w-5 shrink-0 text-brand" />
            <span>
              Voorraad per winkel{" "}
              <span className="font-semibold text-ink-soft">
                {availableCount === null
                  ? ""
                  : `– in ${availableCount} van de ${rows.length} winkels`}
              </span>
            </span>
          </span>
          <span className="transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>

        <ul className="mt-3 divide-y divide-ink/5">
          {rows.map((row) => (
            <li key={row.storeId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <button
                type="button"
                onClick={() => setFavourite(row.storeId)}
                className="flex items-center gap-2 text-left font-semibold text-ink hover:text-brand"
              >
                {row.city}
                {favourite?.slug === row.storeId && (
                  <span className="rounded bg-brand-light px-1.5 py-0.5 text-xs font-bold text-brand">
                    jouw winkel
                  </span>
                )}
              </button>
              {row.qty < 0 ? (
                <span className="shrink-0 text-ink-soft">
                  {failed ? "Onbekend" : "Laden…"}
                </span>
              ) : row.qty > 2 ? (
                <span className="shrink-0 font-bold text-green-700">● Op voorraad</span>
              ) : row.qty > 0 ? (
                <span className="shrink-0 font-bold text-amber-600">● Nog {row.qty} stuks</span>
              ) : (
                <span className="shrink-0 font-semibold text-ink-soft">○ Uitverkocht</span>
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
          Klik op een winkel om die als jouw winkel te kiezen.
        </p>
      </details>
    </div>
  );
}
