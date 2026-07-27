"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { ColorPicker } from "@/components/ColorPicker";
import { Price } from "@/components/Price";
import { findRal } from "@/lib/ral";
import type { Product, RalColor } from "@/lib/types";

export function PurchasePanel({
  product,
  colors,
}: {
  product: Product;
  colors: RalColor[];
}) {
  const { addItem } = useCart();

  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);
  const [qty, setQtyState] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<RalColor | null>(null);
  const [pickerOpen, setPickerOpen] = useState(Boolean(product.colorMixable));

  // ?kleur= uit de kleurkiezer pas na hydration lezen, zodat de pagina
  // volledig statisch gerenderd kan blijven (belangrijk voor SEO).
  useEffect(() => {
    if (!product.colorMixable) return;
    const preselect = new URLSearchParams(window.location.search).get("kleur");
    if (!preselect) return;
    const ral = findRal(preselect);
    if (ral) {
      setColor(ral);
      setPickerOpen(false);
    }
  }, [product.colorMixable]);

  const activeVariant = variants.find((variant) => variant.id === variantId);
  const unitPrice = activeVariant?.price ?? product.price;

  const cartKey = useMemo(
    () => `${product.id}:${variantId ?? ""}:${color?.code ?? ""}`,
    [product.id, variantId, color],
  );

  function handleAdd() {
    if (product.colorMixable && !color) {
      setError("Kies eerst een kleur voor deze mengverf.");
      setPickerOpen(true);
      return;
    }
    setError(null);
    addItem(
      {
        key: cartKey,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantId,
        variantName: activeVariant?.name,
        color: color
          ? { code: color.code, name: color.name, hex: color.hex }
          : undefined,
        unitPrice,
        icon: product.art.icon,
        hue: product.art.hue,
      },
      qty,
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 4000);
  }

  return (
    <div className="space-y-5">
      <Price price={unitPrice} compareAtPrice={product.compareAtPrice} size="lg" />

      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">Kies je inhoud</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setVariantId(variant.id)}
                aria-pressed={variant.id === variantId}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                  variant.id === variantId
                    ? "border-brand bg-brand-light text-brand"
                    : "border-ink/10 text-ink hover:border-ink/30"
                }`}
              >
                {variant.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {product.colorMixable && (
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-ink">
              🎨 Jouw kleur{" "}
              <span className="font-normal text-ink-soft">(gratis gemengd in de winkel)</span>
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              className="text-sm font-bold text-brand hover:underline"
            >
              {pickerOpen ? "Verberg kleuren" : color ? "Wijzig kleur" : "Kies kleur"}
            </button>
          </div>
          {color && (
            <div className="mt-3 flex items-center gap-3">
              <span
                className="h-9 w-9 rounded-md ring-1 ring-black/10"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <p className="text-sm font-semibold text-ink">
                RAL {color.code} · {color.name}
              </p>
            </div>
          )}
          {pickerOpen && (
            <div className="mt-4">
              <ColorPicker
                colors={colors}
                value={color?.code ?? null}
                compact
                onChange={(next) => {
                  setColor(next);
                  setError(null);
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border-2 border-ink/10">
          <button
            type="button"
            aria-label="Aantal verlagen"
            onClick={() => setQtyState((current) => Math.max(1, current - 1))}
            className="px-3 py-2 text-lg font-black text-ink hover:text-brand"
          >
            −
          </button>
          <span className="w-10 text-center font-bold" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Aantal verhogen"
            onClick={() => setQtyState((current) => Math.min(99, current + 1))}
            className="px-3 py-2 text-lg font-black text-ink hover:text-brand"
          >
            +
          </button>
        </div>
        <button type="button" onClick={handleAdd} className="btn btn-primary flex-1 sm:flex-none">
          In winkelwagen
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark">
          {error}
        </p>
      )}
      {added && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 ring-1 ring-green-200">
          ✔ Toegevoegd aan je winkelwagen ·{" "}
          <Link href="/winkelwagen" className="underline">
            Bekijk winkelwagen
          </Link>
        </p>
      )}

      <ul className="space-y-1.5 border-t border-ink/10 pt-4 text-sm text-ink-soft">
        <li>✔ Gratis afhalen in de winkel van je keuze</li>
        <li>✔ Vandaag besteld, vaak dezelfde dag klaar</li>
        <li>✔ Betaal veilig met iDEAL, Bancontact, creditcard of Apple Pay</li>
      </ul>
    </div>
  );
}
