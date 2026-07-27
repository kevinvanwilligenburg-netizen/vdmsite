"use client";

import { useMemo, useState } from "react";

import { RAL_GROUPS } from "@/lib/ral";
import type { RalColor } from "@/lib/types";

function textColorFor(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#17233B" : "#FFFFFF";
}

export function ColorPicker({
  colors,
  value,
  onChange,
  compact = false,
}: {
  colors: RalColor[];
  value?: string | null;
  onChange: (color: RalColor) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("Alle");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^ral\s*/i, "");
    return colors.filter((color) => {
      if (group !== "Alle" && color.group !== group) return false;
      if (!q) return true;
      return (
        color.code.includes(q) || color.name.toLowerCase().includes(q)
      );
    });
  }, [colors, query, group]);

  const selected = value ? colors.find((color) => color.code === value) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="ral-zoek">
          Zoek een RAL-kleur
        </label>
        <input
          id="ral-zoek"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op RAL-nummer of naam, bv. 9010 of antraciet"
          className="input sm:max-w-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["Alle", ...RAL_GROUPS].map((groupName) => (
          <button
            key={groupName}
            type="button"
            onClick={() => setGroup(groupName)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              group === groupName
                ? "bg-ink text-white"
                : "bg-ink/5 text-ink-soft hover:bg-ink/10"
            }`}
          >
            {groupName}
          </button>
        ))}
      </div>

      <div
        className={`grid gap-1.5 ${
          compact
            ? "max-h-56 grid-cols-8 overflow-y-auto pr-1 sm:grid-cols-10"
            : "grid-cols-6 sm:grid-cols-10 lg:grid-cols-12"
        }`}
        role="listbox"
        aria-label="RAL-kleuren"
      >
        {filtered.map((color) => {
          const isSelected = selected?.code === color.code;
          return (
            <button
              key={color.code}
              type="button"
              role="option"
              aria-selected={isSelected}
              title={`RAL ${color.code} – ${color.name}`}
              onClick={() => onChange(color)}
              className={`aspect-square w-full rounded-md ring-1 ring-black/10 transition hover:scale-105 ${
                isSelected ? "outline outline-[3px] outline-offset-2 outline-brand" : ""
              }`}
              style={{ backgroundColor: color.hex }}
            >
              <span className="sr-only">
                RAL {color.code} {color.name}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-ink-soft">
            Geen kleuren gevonden voor deze zoekopdracht.
          </p>
        )}
      </div>

      {selected && (
        <div
          className="flex items-center gap-4 rounded-xl p-4 ring-1 ring-black/10"
          style={{ backgroundColor: selected.hex, color: textColorFor(selected.hex) }}
        >
          <div>
            <p className="text-lg font-black">RAL {selected.code}</p>
            <p className="text-sm font-semibold opacity-90">
              {selected.name} · {selected.group}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
