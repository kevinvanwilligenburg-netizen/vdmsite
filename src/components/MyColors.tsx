"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { readSavedColors, type SavedColor } from "@/components/order/ReorderColor";

/**
 * "Mijn kleuren": de kleuren die deze bezoeker eerder heeft besteld, lokaal
 * bewaard. Staat op de kleurkiezer, want daar zoekt iemand die bijbestelt.
 * Rendert niets als er nog niets bewaard is.
 */
export function MyColors() {
  const [colors, setColors] = useState<SavedColor[]>([]);

  useEffect(() => {
    setColors(readSavedColors());
  }, []);

  if (colors.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-black text-ink">
        <Icon name="palette" className="h-5 w-5 text-brand" />
        Jouw eerdere kleuren
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Bijbestellen in exact dezelfde kleur? Klik erop.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {colors.map((color) => (
          <li key={`${color.key ?? color.code}-${color.productSlug}`}>
            <Link
              href={`/product/${color.productSlug}?kleur=${encodeURIComponent(color.key ?? color.code)}`}
              className="flex items-center gap-2 rounded-lg bg-slate-50 py-1.5 pl-1.5 pr-3 transition hover:bg-slate-100"
              title={`${color.code} ${color.name} — ${color.productName}`}
            >
              <span
                className="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/10"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <span className="text-sm font-bold text-ink">
                {color.code || color.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
