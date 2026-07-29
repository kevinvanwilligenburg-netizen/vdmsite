"use client";

import Link from "next/link";
import { useState } from "react";

import { ColorPicker } from "@/components/ColorPicker";
import type { PaintColor } from "@/lib/types";

interface MixableProduct {
  slug: string;
  name: string;
  fromPrice: string;
}

export function KleurkiezerClient({
  colors,
  products,
}: {
  colors: PaintColor[];
  products: MixableProduct[];
}) {
  const [selected, setSelected] = useState<PaintColor | null>(null);

  return (
    <div className="space-y-8">
      <ColorPicker
        initialColors={colors}
        value={selected?.key ?? null}
        onChange={(color) => setSelected(color)}
      />

      <section aria-live="polite">
        {selected ? (
          <div className="card p-6">
            <h2 className="text-lg font-black text-ink">
              Bestel verf in {[selected.code, selected.name].filter(Boolean).join(" · ")}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Onze verfspecialist mengt je verf gratis aan en zet hem klaar bij je
              bestelling.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <li key={product.slug}>
                  <Link
                    href={`/product/${product.slug}?kleur=${encodeURIComponent(selected.key)}`}
                    className="card flex items-center justify-between gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <span>
                      <span className="block font-bold text-ink">{product.name}</span>
                      <span className="block text-sm text-ink-soft">
                        vanaf {product.fromPrice}
                      </span>
                    </span>
                    <span
                      className="h-10 w-10 shrink-0 rounded-md ring-1 ring-black/10"
                      style={{ backgroundColor: selected.hex }}
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-xl bg-brand-light px-5 py-4 font-semibold text-ink">
            Kies hierboven een kleur om direct mengverf in die kleur te bestellen.
          </p>
        )}
      </section>
    </div>
  );
}
