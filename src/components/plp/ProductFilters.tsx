"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Icon } from "@/components/icons";
import type { Facet, ProductFilters, SortKey } from "@/lib/facets";

const SORT_LABELS: { value: SortKey; label: string }[] = [
  { value: "relevantie", label: "Relevantie" },
  { value: "prijs-op", label: "Prijs laag → hoog" },
  { value: "prijs-af", label: "Prijs hoog → laag" },
  { value: "korting", label: "Hoogste korting" },
  { value: "naam", label: "Naam A → Z" },
];

/**
 * Filters en sortering voor productlijsten. Alles staat in de URL, zodat een
 * gefilterde lijst deelbaar is, terugknop werkt en zoekmachines de pagina's
 * kunnen zien.
 */
export function ProductFiltersPanel({
  facets,
  filters,
  total,
  activeCount,
}: {
  facets: Facet[];
  filters: ProductFilters;
  total: number;
  activeCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("pagina");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const toggleValue = useCallback(
    (key: string, value: string) => {
      update((params) => {
        const current = (params.get(key) ?? "").split(",").filter(Boolean);
        const next = current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value];
        if (next.length > 0) params.set(key, next.join(","));
        else params.delete(key);
      });
    },
    [update],
  );

  const toggleFlag = useCallback(
    (key: string, on: boolean) => {
      update((params) => {
        if (on) params.set(key, "1");
        else params.delete(key);
      });
    },
    [update],
  );

  const isChecked = (key: string, value: string) =>
    (searchParams.get(key) ?? "").split(",").filter(Boolean).includes(value);

  const clearAll = () =>
    update((params) => {
      for (const key of ["merk", "glans", "verfsoort", "inhoud", "prijs", "aanbieding", "mengverf", "voorraad"]) {
        params.delete(key);
      }
    });

  const panel = (
    <div className="space-y-5">
      {/* Snelfilters */}
      <div className="space-y-2">
        {[
          { key: "voorraad", label: "Direct leverbaar", on: Boolean(filters.opVoorraad) },
          { key: "aanbieding", label: "In de aanbieding", on: Boolean(filters.aanbieding) },
          { key: "mengverf", label: "Mengbaar in elke kleur", on: Boolean(filters.mengverf) },
        ].map((flag) => (
          <label key={flag.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flag.on}
              onChange={(event) => toggleFlag(flag.key, event.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            <span className="font-semibold text-ink">{flag.label}</span>
          </label>
        ))}
      </div>

      {facets.map((facet) => (
        <fieldset key={facet.key} className="border-t border-ink/10 pt-4">
          <legend className="mb-2 text-sm font-black text-ink">{facet.label}</legend>
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {facet.options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={isChecked(facet.key, option.value)}
                  onChange={() => toggleValue(facet.key, option.value)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                <span className="min-w-0 flex-1 truncate text-ink">{option.label}</span>
                <span className="shrink-0 text-xs text-ink-soft">{option.count}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="w-full rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
        >
          Wis alle filters ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Balk met aantal, sortering en (mobiel) de filterknop */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-soft" role="status">
          {total.toLocaleString("nl-NL")} {total === 1 ? "artikel" : "artikelen"}
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand lg:hidden"
        >
          <Icon name="level" className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-1.5 text-xs text-white">{activeCount}</span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="sorteer" className="text-sm text-ink-soft">
            Sorteer
          </label>
          <select
            id="sorteer"
            value={filters.sort ?? "relevantie"}
            onChange={(event) =>
              update((params) => {
                if (event.target.value === "relevantie") params.delete("sorteer");
                else params.set("sorteer", event.target.value);
              })
            }
            className="rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-brand"
          >
            {SORT_LABELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop: vaste kolom */}
      <aside className="hidden lg:block">
        <div className="card sticky top-40 p-5">{panel}</div>
      </aside>

      {/* Mobiel: uitschuifpaneel */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Filters sluiten"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/50"
          />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-ink/10 p-4">
              <p className="font-black text-ink">Filters</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Sluiten"
                className="rounded-lg p-2 text-ink-soft transition hover:text-brand"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{panel}</div>
            <div className="border-t border-ink/10 p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full"
              >
                Toon {total.toLocaleString("nl-NL")} artikelen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
