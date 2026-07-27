"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";
import { euro } from "@/lib/format";

export function CartPageClient() {
  const { items, subtotal, hydrated, setQty, removeItem } = useCart();

  if (!hydrated) {
    return <p className="py-16 text-center text-ink-soft">Winkelwagen laden…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <p className="text-5xl" aria-hidden>
          🛒
        </p>
        <h2 className="mt-4 text-xl font-black text-ink">Je winkelwagen is leeg</h2>
        <p className="mt-2 text-ink-soft">
          Ontdek onze topdeals en vul je winkelwagen met voordeel.
        </p>
        <Link href="/" className="btn btn-primary mt-6">
          Verder winkelen
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.key} className="card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-3xl"
              style={{
                background: `linear-gradient(135deg, hsl(${item.hue} 85% 94%), hsl(${item.hue} 70% 86%))`,
              }}
              aria-hidden
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/product/${item.slug}`}
                className="font-bold text-ink hover:text-brand"
              >
                {item.name}
              </Link>
              <p className="text-sm text-ink-soft">
                {item.variantName && <span>{item.variantName}</span>}
                {item.variantName && item.color && <span> · </span>}
                {item.color && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-sm ring-1 ring-black/10"
                      style={{ backgroundColor: item.color.hex }}
                      aria-hidden
                    />
                    RAL {item.color.code} {item.color.name}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{euro(item.unitPrice)} per stuk</p>
            </div>
            <div className="inline-flex items-center rounded-lg border-2 border-ink/10">
              <button
                type="button"
                aria-label={`Aantal van ${item.name} verlagen`}
                onClick={() => setQty(item.key, item.qty - 1)}
                className="px-3 py-1.5 text-lg font-black text-ink hover:text-brand"
              >
                −
              </button>
              <span className="w-8 text-center font-bold">{item.qty}</span>
              <button
                type="button"
                aria-label={`Aantal van ${item.name} verhogen`}
                onClick={() => setQty(item.key, item.qty + 1)}
                className="px-3 py-1.5 text-lg font-black text-ink hover:text-brand"
              >
                +
              </button>
            </div>
            <p className="w-24 text-right font-black text-ink">
              {euro(item.unitPrice * item.qty)}
            </p>
            <button
              type="button"
              aria-label={`${item.name} verwijderen`}
              onClick={() => removeItem(item.key)}
              className="text-xl text-ink-soft transition hover:text-brand"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <aside className="card h-fit p-6">
        <h2 className="text-lg font-black text-ink">Overzicht</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotaal</dt>
            <dd className="font-semibold">{euro(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Afhalen in de winkel</dt>
            <dd className="font-bold text-green-700">Gratis</dd>
          </div>
          <div className="flex justify-between border-t border-ink/10 pt-3 text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">{euro(subtotal)}</dd>
          </div>
        </dl>
        <Link href="/afrekenen" className="btn btn-primary mt-6 w-full">
          Afrekenen →
        </Link>
        <Link
          href="/"
          className="mt-3 block text-center text-sm font-semibold text-ink-soft hover:text-brand"
        >
          Verder winkelen
        </Link>
      </aside>
    </div>
  );
}
