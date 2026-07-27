"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Icon } from "@/components/icons";

const STORAGE_KEY = "vdm-mijn-kleuren-v1";
const MAX_COLORS = 12;

export interface SavedColor {
  key?: string;
  code: string;
  name: string;
  hex: string;
  /** Slug van het verfproduct waarin deze kleur besteld is. */
  productSlug: string;
  productName: string;
  /** Wanneer besteld (ISO), zodat we op recentheid kunnen sorteren. */
  orderedAt: string;
  reference: string;
}

/** Bewaar de kleuren uit deze bestelling lokaal, zodat bijbestellen makkelijk is. */
export function saveColors(colors: SavedColor[]): void {
  if (colors.length === 0) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const existing: SavedColor[] = raw ? JSON.parse(raw) : [];
    const merged = [...colors, ...existing];
    const seen = new Set<string>();
    const unique = merged.filter((color) => {
      const id = `${color.key ?? color.code}:${color.productSlug}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique.slice(0, MAX_COLORS)));
  } catch {
    // opslag geblokkeerd: dan is bijbestellen gewoon een zoekactie
  }
}

export function readSavedColors(): SavedColor[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedColor[]) : [];
  } catch {
    return [];
  }
}

/**
 * Toont de gemengde kleuren uit deze bestelling met een knop om ze opnieuw te
 * bestellen — en bewaart ze lokaal.
 *
 * Dit lost het grootste terugkerende probleem bij verf op: drie weken later is
 * de verf op en weet niemand meer welke kleur en welke basis het was. Wij
 * weten dat wel, dus dan hoeft de klant alleen nog te klikken.
 */
export function ReorderColor({ colors }: { colors: SavedColor[] }) {
  useEffect(() => {
    saveColors(colors);
  }, [colors]);

  if (colors.length === 0) return null;

  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2 text-lg font-black text-ink">
        <Icon name="palette" className="h-5 w-5 text-brand" />
        Jouw kleur, bewaard
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Verf op? Bestel exact dezelfde kleur opnieuw — wij weten in welke basis
        hij gemengd moet worden.
      </p>
      <ul className="mt-4 space-y-2">
        {colors.map((color) => (
          <li
            key={`${color.key ?? color.code}-${color.productSlug}`}
            className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
          >
            <span
              className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-black/10"
              style={{ backgroundColor: color.hex }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">
                {[color.code, color.name].filter(Boolean).join(" · ")}
              </span>
              <span className="line-clamp-1 block text-xs text-ink-soft">
                {color.productName}
              </span>
            </span>
            <Link
              href={`/product/${color.productSlug}?kleur=${encodeURIComponent(color.key ?? color.code)}`}
              className="shrink-0 rounded-lg border-2 border-ink/10 px-3 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
            >
              Opnieuw
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
