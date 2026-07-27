"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PaintColor } from "@/lib/types";

interface Collection {
  id: string;
  name: string;
  count: number;
}

function textColorFor(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#141414" : "#FFFFFF";
}

/**
 * Kleurkiezer met server-side zoeken: de bron telt tienduizenden kleuren, dus
 * we halen per zoekterm/collectie een beperkte set op via /api/kleuren.
 * De meegegeven `initialColors` (de RAL-waaier) is meteen zichtbaar.
 */
export function ColorPicker({
  initialColors,
  value,
  onChange,
  compact = false,
}: {
  initialColors: PaintColor[];
  value?: string | null;
  onChange: (color: PaintColor) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("ral");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [colors, setColors] = useState<PaintColor[]>(initialColors);
  const [total, setTotal] = useState(initialColors.length);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  // Collectielijst één keer ophalen.
  useEffect(() => {
    let active = true;
    fetch("/api/kleuren?meta=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.collections) setCollections(data.collections);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Kleuren ophalen bij wijziging van zoekterm of collectie (met debounce).
  useEffect(() => {
    const isDefault = query.trim() === "" && collection === "ral";
    if (isDefault) {
      setColors(initialColors);
      setTotal(initialColors.length);
      setLoading(false);
      return;
    }

    const id = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("collection", collection);
      fetch(`/api/kleuren?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (id !== requestRef.current) return;
          setColors(data?.colors ?? []);
          setTotal(data?.total ?? 0);
        })
        .catch(() => {
          if (id === requestRef.current) setColors([]);
        })
        .finally(() => {
          if (id === requestRef.current) setLoading(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, collection, initialColors]);

  const selected = useMemo(
    () => colors.find((color) => color.key === value),
    [colors, value],
  );

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="sm:max-w-xs sm:flex-1">
          <label className="sr-only" htmlFor="kleur-zoek">
            Zoek een kleur
          </label>
          <input
            id="kleur-zoek"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek op kleurnummer of naam"
            className="input"
          />
        </div>
        <div className="sm:max-w-xs sm:flex-1">
          <label className="sr-only" htmlFor="kleur-collectie">
            Kies een kleurenwaaier
          </label>
          <select
            id="kleur-collectie"
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
            className="input"
          >
            <option value="alle">Alle waaiers</option>
            {collections.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={`grid w-full min-w-0 gap-1.5 ${
          compact
            ? "max-h-56 grid-cols-8 overflow-y-auto pr-1 sm:grid-cols-10"
            : "max-h-[28rem] grid-cols-6 overflow-y-auto pr-1 sm:grid-cols-10 lg:grid-cols-12"
        }`}
        role="listbox"
        aria-label="Kleuren"
        aria-busy={loading}
      >
        {colors.map((color) => {
          const isSelected = value === color.key;
          const title = [color.code, color.name].filter(Boolean).join(" – ");
          return (
            <button
              key={color.key}
              type="button"
              role="option"
              aria-selected={isSelected}
              title={title}
              onClick={() => onChange(color)}
              className={`aspect-square w-full rounded-md ring-1 ring-black/10 transition hover:scale-105 ${
                isSelected ? "outline outline-[3px] outline-offset-2 outline-brand" : ""
              }`}
              style={{ backgroundColor: color.hex }}
            >
              <span className="sr-only">{title}</span>
            </button>
          );
        })}
        {colors.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-ink-soft">
            {loading ? "Kleuren laden…" : "Geen kleuren gevonden voor deze zoekopdracht."}
          </p>
        )}
      </div>

      {total > colors.length && (
        <p className="text-xs text-ink-soft">
          {colors.length} van {total.toLocaleString("nl-NL")} kleuren getoond — verfijn
          je zoekopdracht of kies een waaier.
        </p>
      )}

      {selected && (
        <div
          className="flex items-center gap-4 rounded-xl p-4 ring-1 ring-black/10"
          style={{ backgroundColor: selected.hex, color: textColorFor(selected.hex) }}
        >
          <div>
            <p className="text-lg font-black">
              {[selected.code, selected.name].filter(Boolean).join(" · ")}
            </p>
            <p className="text-sm font-semibold opacity-90">{selected.group}</p>
          </div>
        </div>
      )}
    </div>
  );
}
