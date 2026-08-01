"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { useGekozenVariant } from "@/components/product/GekozenVariant";
import { Voorraadmelding } from "@/components/product/Voorraadmelding";
import { useStore } from "@/components/store/StoreProvider";
import { deliveryExplanation, deliveryPromise } from "@/lib/delivery";
import { GRATIS_VANAF_TEKST } from "@/lib/shipping";
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
  whatsappNummer,
  product,
}: {
  skus: string[];
  stores: Store[];
  fallbackInStock: boolean;
  /** Reden waarom dit artikel niet verzonden kan worden, als dat zo is. */
  alleenAfhalen?: string;
  /** Ons WhatsApp-nummer, voor wie liever appt dan mailt. */
  whatsappNummer?: string;
  /** Voor de "hou me op de hoogte"-melding bij uitverkocht. */
  product: { sku: string; slug: string; naam: string };
}) {
  const { favourite, setFavourite } = useStore();
  const [stock, setStock] = useState<ProductStock | null>(null);
  const [failed, setFailed] = useState(false);

  // Kiest de klant in het koopblok een maat, dan tonen we de voorraad van
  // precies dát artikel — dezelfde sku die de checkout straks controleert.
  // Zonder keuze (of buiten de productpagina) geldt de optelsom van alle
  // maten, zoals voorheen.
  const { sku: gekozenSku } = useGekozenVariant();
  const actieveSkus = gekozenSku ? [gekozenSku] : skus;
  const skusSleutel = actieveSkus.join(",");

  useEffect(() => {
    if (actieveSkus.length === 0) return;
    let active = true;
    // Terug naar "Laden…" bij een maatwissel; oude aantallen laten staan
    // is precies de verwarring die we hier oplossen.
    setStock(null);
    setFailed(false);
    fetch(`/api/voorraad?skus=${encodeURIComponent(skusSleutel)}`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skusSleutel]);

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

  // Nergens meer voorraad, en de hub weet dat zeker: dan is bestellen geen
  // optie en bieden we een seintje aan zodra het er weer is.
  const uitverkocht = Boolean(stock?.live) && (stock?.stores ?? []).every((rij) => rij.qty <= 0)
    && (stock?.webshopQty ?? 0) <= 0;

  return (
    <div className="space-y-3">
      {uitverkocht && (
        <Voorraadmelding
          sku={gekozenSku ?? product.sku}
          slug={product.slug}
          naam={product.naam}
          whatsappNummer={whatsappNummer}
        />
      )}
      {/*
        Bezorgen en afhalen naast elkaar, als twee keuzes.

        Hier stonden drie blokken onder elkaar — levertijd, afhaalwinkel en
        voorraad per winkel — die samen een half scherm kostten voor informatie
        waar de klant één beslissing uit haalt. Twee kolommen zeggen hetzelfde
        in de helft van de ruimte, en maken zichtbaar dát het een keuze is.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Bezorgen */}
        <div className="card p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-ink-soft">
            <Icon name="truck" className="h-4 w-4" />
            Laten bezorgen
          </p>
          {alleenAfhalen ? (
            <>
              <p className="mt-1.5 font-black text-ink">Kan niet met de post mee</p>
              <p className="mt-0.5 text-sm text-ink-soft">{alleenAfhalen}</p>
            </>
          ) : (
            <>
              <p
                className={`mt-1.5 font-black ${
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
                  : `Gratis vanaf ${GRATIS_VANAF_TEKST}.`}
              </p>
            </>
          )}
        </div>

        {/* Afhalen */}
        <div className="card p-4">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-ink-soft">
            <Icon name="store" className="h-4 w-4" />
            Gratis afhalen
          </p>
          {pickup && pickupStore ? (
            <>
              <p className="mt-1.5 font-black text-green-700">
                {pickupStore.city} — {pickup.label.toLowerCase()}
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
              <p className="mt-1.5 font-black text-ink">Niet in {favourite.city}</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {suggestion
                  ? `Wel in ${rows.find((row) => row.storeId === suggestion.storeId)?.city}.`
                  : "Nu in geen enkele winkel."}
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
              <p className="mt-1.5 font-black text-ink">In de winkel</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {stock
                  ? "Ligt nu in geen enkele winkel."
                  : "Binnen 2 uur klaar waar het op voorraad ligt."}
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
