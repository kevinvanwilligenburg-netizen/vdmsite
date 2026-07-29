"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { ColorPicker } from "@/components/ColorPicker";
import { Icon } from "@/components/icons";
import { Price } from "@/components/Price";
import { PaintCalculator } from "@/components/product/PaintCalculator";
import {
  coveragePerLiter,
  hasBases,
  PAINT_BASES,
  pickVariant,
  sizesInLiters,
  sizesOf,
} from "@/lib/paint-bases";
import { euro } from "@/lib/format";
import type { PaintColor, Product } from "@/lib/types";

export function PurchasePanel({
  product,
  colors,
}: {
  product: Product;
  colors: PaintColor[];
}) {
  const { addItem } = useCart();

  const variants = product.variants ?? [];
  const basesInPlay = hasBases(product);
  const sizes = sizesOf(product);
  const [size, setSize] = useState<string | undefined>(sizes[0]);
  const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);
  const [qty, setQtyState] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<PaintColor | null>(null);
  const [pickerOpen, setPickerOpen] = useState(Boolean(product.colorMixable));

  // ?kleur= uit de kleurkiezer pas na hydration lezen, zodat de pagina
  // volledig statisch gerenderd kan blijven (belangrijk voor SEO).
  // Ondersteunt keys ("ral:9010", "hub:…") én kale RAL-codes ("9010").
  useEffect(() => {
    if (!product.colorMixable) return;
    const preselect = new URLSearchParams(window.location.search).get("kleur");
    if (!preselect) return;

    const local =
      colors.find((candidate) => candidate.key === preselect) ??
      colors.find((candidate) => candidate.key === `ral:${preselect}`);
    if (local) {
      setColor(local);
      setPickerOpen(false);
      return;
    }

    // Kleur uit een merkenwaaier: opzoeken bij de server.
    let active = true;
    fetch(`/api/kleuren?q=${encodeURIComponent(preselect)}&collection=alle&limit=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found = data?.colors?.[0];
        if (active && found) {
          setColor(found);
          setPickerOpen(false);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product.colorMixable, colors]);

  // Bij mengverf volgt de basis (en dus het exacte blik) uit de gekozen kleur;
  // de klant kiest alleen de inhoud. Anders is de variant een gewone keuze.
  const activeVariant = basesInPlay
    ? pickVariant(product, size, color)
    : variants.find((variant) => variant.id === variantId);

  // Maat en verpakking als twee keuzes: de unieke maten in de volgorde van de
  // feed (die staat al op grootte), en daarbinnen de verpakkingen.
  const maten = useMemo(() => {
    const gezien: string[] = [];
    for (const variant of variants) {
      const maat = variant.size ?? variant.name;
      if (maat && !gezien.includes(maat)) gezien.push(maat);
    }
    return gezien;
  }, [variants]);

  const actieveMaat = activeVariant?.size ?? activeVariant?.name;
  const verpakkingenVanMaat = variants.filter(
    (variant) => (variant.size ?? variant.name) === actieveMaat,
  );

  // "Kies je inhoud" klopt voor blikken verf, niet voor bouten van 70 mm.
  const maatLabel = variants.some((variant) => /\b(ml|l|liter)\b/i.test(variant.size ?? ""))
    ? "Kies je inhoud"
    : "Kies je maat";
  const unitPrice = activeVariant?.price ?? product.price;
  const activeBase = activeVariant?.base;
  const coverage = coveragePerLiter(product);

  const cartKey = useMemo(
    () => `${product.id}:${activeVariant?.id ?? ""}:${color?.key ?? ""}`,
    [product.id, activeVariant?.id, color],
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
        // De sku van de gekozen variant; daarmee checkt de checkout of de
        // artikelen in de afhaalwinkel liggen.
        sku: activeVariant?.sku ?? product.sku,
        slug: product.slug,
        name: product.name,
        image: product.image,
        variantId: activeVariant?.id,
        variantName: activeBase
          ? `${activeVariant?.size ?? activeVariant?.name} · ${PAINT_BASES[activeBase].label}`
          : activeVariant?.name,
        color: color
          ? {
              key: color.key,
              code: color.code,
              name: color.name,
              hex: color.hex,
              collection: color.group,
            }
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
    <div className="min-w-0 space-y-5">
      <Price
        price={unitPrice}
        compareAtPrice={product.compareAtPrice}
        kluspasPrice={product.kluspasPrice}
        size="lg"
      />

      {basesInPlay ? (
        sizes.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">Kies je inhoud</legend>
            <div className="flex flex-wrap gap-2">
              {sizes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSize(option)}
                  aria-pressed={option === size}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                    option === size
                      ? "border-brand bg-brand-light text-brand"
                      : "border-ink/10 text-ink hover:border-ink/30"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        )
      ) : (
        variants.length > 0 && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-ink">{maatLabel}</legend>
              <div className="flex flex-wrap gap-2">
                {maten.map((maat) => (
                  <button
                    key={maat}
                    type="button"
                    onClick={() => {
                      // Bij het wisselen van maat de eerste verpakking van die
                      // maat kiezen; de vorige bestaat er misschien niet in.
                      const eerste = variants.find((variant) => (variant.size ?? variant.name) === maat);
                      if (eerste) setVariantId(eerste.id);
                    }}
                    aria-pressed={maat === actieveMaat}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                      maat === actieveMaat
                        ? "border-brand bg-brand-light text-brand"
                        : "border-ink/10 text-ink hover:border-ink/30"
                    }`}
                  >
                    {maat}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Bestaat deze maat in meerdere verpakkingen, dan is dat een
                tweede keuze. Anders zou de klant tientallen knoppen krijgen
                waarin maat en aantal door elkaar lopen. */}
            {verpakkingenVanMaat.length > 1 && (
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-ink">Aantal per verpakking</legend>
                <div className="flex flex-wrap gap-2">
                  {verpakkingenVanMaat.map((variant) => (
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
                      {variant.packaging ?? variant.name}
                      <span className="ml-2 font-normal text-ink-soft">
                        {euro(variant.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )
      )}

      {product.colorMixable && (
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
              <Icon name="palette" className="h-4 w-4 text-brand" /> Jouw kleur{" "}
              <span className="font-normal text-ink-soft">(gratis gemengd door onze verfspecialist)</span>
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
                className="h-9 w-9 shrink-0 rounded-md ring-1 ring-black/10"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {[color.code, color.name].filter(Boolean).join(" · ")}
                </p>
                {activeBase && (
                  <p className="text-xs text-ink-soft">
                    Wordt gemengd in de{" "}
                    <strong className="font-semibold text-ink">
                      {PAINT_BASES[activeBase].label.toLowerCase()}
                    </strong>{" "}
                    — dat kiezen wij voor je.
                  </p>
                )}
              </div>
            </div>
          )}
          {!color && basesInPlay && (
            <p className="mt-3 text-xs text-ink-soft">
              De juiste mengbasis kiezen wij automatisch bij jouw kleur.
            </p>
          )}
          {pickerOpen && (
            <div className="mt-4">
              <ColorPicker
                initialColors={colors}
                value={color?.key ?? null}
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

      {coverage && (
        <PaintCalculator
          coveragePerLiter={coverage}
          sizesInLiters={sizesInLiters(product).length > 0 ? sizesInLiters(product) : [1]}
        />
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
        <button
          type="button"
          id="koop-knop"
          onClick={handleAdd}
          className="btn btn-primary flex-1 scroll-mt-32 sm:flex-none"
        >
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
          Toegevoegd aan je winkelwagen ·{" "}
          <Link href="/winkelwagen" className="underline">
            Bekijk winkelwagen
          </Link>
        </p>
      )}

      <ul className="space-y-1.5 border-t border-ink/10 pt-4 text-sm text-ink-soft">
        {[
          "Vóór 09:00 besteld? Kies vandaag bezorgd voor € 1,25",
          "Gratis bezorgd vanaf € 59, afhalen is altijd gratis",
          "Betaal met iDEAL, creditcard of Apple Pay — of achteraf met Klarna",
        ].map((usp) => (
          <li key={usp} className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
            {usp}
          </li>
        ))}
      </ul>
    </div>
  );
}
