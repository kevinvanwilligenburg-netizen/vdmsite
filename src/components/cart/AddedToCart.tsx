"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";

interface Suggestie {
  id: string;
  slug: string;
  sku: string;
  name: string;
  price: number;
  kluspasPrice?: number;
  /** Gezet als dit artikel alleen afgehaald kan worden. */
  pickupOnly?: string;
  image?: string;
  art: { icon: string; hue: number };
  waarom: string;
}

/**
 * Bevestiging na het toevoegen aan de winkelwagen.
 *
 * Het moment vlak na "in winkelwagen" is het beste moment voor bijverkoop:
 * de klant is met deze klus bezig en weet nog wat hij nodig heeft. Daarom
 * tonen we hier wat erbij hoort, met de reden erbij, en twee duidelijke
 * uitgangen — doorwinkelen of afrekenen.
 */
export function AddedToCart() {
  const { laatstToegevoegd, sluitBevestiging, addItem, items, count, subtotal } = useCart();
  const [suggesties, setSuggesties] = useState<Suggestie[]>([]);
  const [toegevoegd, setToegevoegd] = useState<string[]>([]);

  const productId = laatstToegevoegd?.productId;

  useEffect(() => {
    if (!productId) return;
    setToegevoegd([]);
    let afgebroken = false;
    fetch("/api/bijverkoop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: [productId] }),
    })
      .then((response) => (response.ok ? response.json() : { producten: [] }))
      .then((data: { producten?: Suggestie[] }) => {
        if (!afgebroken) setSuggesties(data.producten ?? []);
      })
      .catch(() => {
        // Suggesties zijn meegenomen; de bevestiging zelf blijft staan.
      });
    return () => {
      afgebroken = true;
    };
  }, [productId]);

  // Sluiten met Escape, zoals elk ander venster.
  useEffect(() => {
    if (!laatstToegevoegd) return;
    const opToets = (event: KeyboardEvent) => {
      if (event.key === "Escape") sluitBevestiging();
    };
    document.addEventListener("keydown", opToets);
    return () => document.removeEventListener("keydown", opToets);
  }, [laatstToegevoegd, sluitBevestiging]);

  if (!laatstToegevoegd) return null;

  const inMandje = new Set(items.map((item) => item.productId));
  const zichtbaar = suggesties.filter((product) => !inMandje.has(product.id)).slice(0, 3);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="toegevoegd-titel"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center"
    >
      <button
        type="button"
        aria-label="Sluiten"
        onClick={sluitBevestiging}
        className="absolute inset-0 bg-ink/50"
      />

      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-lift">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
          <p id="toegevoegd-titel" className="flex items-center gap-2 font-black text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white">
              <Icon name="check" className="h-4 w-4" strokeWidth={3} />
            </span>
            Toegevoegd aan je winkelwagen
          </p>
          <button
            type="button"
            onClick={sluitBevestiging}
            aria-label="Sluiten"
            className="rounded-lg p-1 text-ink-soft transition hover:text-brand"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 p-5">
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5">
            <ProductArt
              icon={laatstToegevoegd.icon}
              hue={laatstToegevoegd.hue}
              image={laatstToegevoegd.image}
              size="sm"
              label={laatstToegevoegd.name}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{laatstToegevoegd.name}</p>
            {laatstToegevoegd.variantName && (
              <p className="text-sm text-ink-soft">{laatstToegevoegd.variantName}</p>
            )}
            <p className="text-sm text-ink-soft">
              {laatstToegevoegd.qty}× {euro(laatstToegevoegd.unitPrice)}
            </p>
          </div>
        </div>

        {zichtbaar.length > 0 && (
          <div className="border-t border-ink/10 p-5">
            <p className="font-black text-ink">Hier heb je dit vaak bij nodig</p>
            <ul className="mt-3 space-y-2">
              {zichtbaar.map((product) => {
                const isToegevoegd = toegevoegd.includes(product.id);
                return (
                  <li key={product.id} className="flex items-center gap-3">
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={sluitBevestiging}
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5"
                    >
                      <ProductArt
                        icon={product.art.icon}
                        hue={product.art.hue}
                        image={product.image}
                        size="sm"
                        label={product.name}
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${product.slug}`}
                        onClick={sluitBevestiging}
                        className="line-clamp-1 text-sm font-bold text-ink hover:text-brand"
                      >
                        {product.name}
                      </Link>
                      <p className="line-clamp-1 text-xs text-ink-soft">{product.waarom}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-brand">
                      {euro(product.kluspasPrice ?? product.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        addItem({
                          key: `${product.id}::`,
                          productId: product.id,
                          sku: product.sku,
                          slug: product.slug,
                          name: product.name,
                          unitPrice: product.price,
                          kluspasUnitPrice: product.kluspasPrice,
                          icon: product.art.icon,
                          hue: product.art.hue,
                          pickupOnly: product.pickupOnly,
                          image: product.image,
                        });
                        setToegevoegd((huidig) => [...huidig, product.id]);
                      }}
                      disabled={isToegevoegd}
                      className="shrink-0 rounded-lg border-2 border-ink/10 px-2.5 py-1 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:border-green-600/30 disabled:text-green-700"
                    >
                      {isToegevoegd ? "✓" : "+"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="sticky bottom-0 border-t border-ink/10 bg-white p-5">
          <p className="mb-3 flex items-center justify-between text-sm">
            <span className="text-ink-soft">
              {count} {count === 1 ? "artikel" : "artikelen"} in je winkelwagen
            </span>
            <strong className="font-black text-ink">{euro(subtotal)}</strong>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={sluitBevestiging}
              className="btn flex-1 border-2 border-ink/10 bg-white text-ink hover:border-brand hover:text-brand"
            >
              Verder winkelen
            </button>
            <Link
              href="/winkelwagen"
              onClick={sluitBevestiging}
              className="btn btn-primary flex-1"
            >
              Naar winkelwagen →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
