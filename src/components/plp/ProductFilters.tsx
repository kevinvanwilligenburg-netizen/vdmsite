"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import {
  FILTER_KEYS,
  popularFacets,
  type Facet,
  type ProductFilters,
  type SortKey,
} from "@/lib/facets";

const SORT_LABELS: { value: SortKey; label: string }[] = [
  // "Relevantie" zegt niets; dit sorteert op wat de winkel het meest
  // verkoopt (voorraad, foto, mengbaar, geen restpartij).
  { value: "relevantie", label: "Populair" },
  { value: "prijs-op", label: "Prijs laag → hoog" },
  { value: "prijs-af", label: "Prijs hoog → laag" },
  { value: "korting", label: "Hoogste korting" },
  { value: "naam", label: "Naam A → Z" },
];

/** Zoveel opties tonen we uitgeklapt; de rest achter "toon alle". */
const OPTIES_ZICHTBAAR = 6;

/**
 * Eén filtergroep.
 *
 * Bewust geen eigen scrollbalkje per groep meer: met acht groepen onder
 * elkaar, elk met een eigen scrollgebiedje, wist niemand meer waar hij aan het
 * scrollen was — en de kolom als geheel kon je al helemaal niet doorlopen.
 * Nu staat er een korte lijst met een "toon alle"-knop, en scrollt de kolom.
 */
function FacetGroep({
  facet,
  isChecked,
  onToggle,
}: {
  facet: Facet;
  isChecked: (key: string, value: string) => boolean;
  onToggle: (key: string, value: string) => void;
}) {
  const [alles, setAlles] = useState(false);
  const [open, setOpen] = useState(true);
  const gekozen = facet.options.filter((optie) => isChecked(facet.key, optie.value)).length;
  // Een aangevinkte optie hoort altijd zichtbaar te zijn, ook als hij
  // verderop in de lijst staat — anders lijkt het filter uit te staan.
  const zichtbaar =
    alles ||
    facet.options.some(
      (optie, index) => index >= OPTIES_ZICHTBAAR && isChecked(facet.key, optie.value),
    )
      ? facet.options
      : facet.options.slice(0, OPTIES_ZICHTBAAR);

  return (
    <fieldset className="overflow-hidden rounded-xl border border-ink/10">
      <legend className="sr-only">{facet.label}</legend>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 bg-ink/[0.04] px-3 py-2.5 text-left"
      >
        <span className="text-sm font-black text-ink">
          {facet.label}
          {gekozen > 0 && (
            <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-xs text-white">
              {gekozen}
            </span>
          )}
        </span>
        <span
          className={`shrink-0 text-ink-soft transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 px-3 py-3">
          {zichtbaar.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isChecked(facet.key, option.value)}
                onChange={() => onToggle(facet.key, option.value)}
                className="h-4 w-4 shrink-0 accent-brand"
              />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink" title={option.label}>
                {option.label}
              </span>
              <span className="shrink-0 text-xs text-ink-soft">{option.count}</span>
            </label>
          ))}
          {facet.options.length > zichtbaar.length && (
            <button
              type="button"
              onClick={() => setAlles(true)}
              className="pt-1 text-sm font-bold text-brand hover:underline"
            >
              Toon alle {facet.options.length}
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Filters, sortering én de productlijst zelf. Alles staat in de URL, zodat
 * een gefilterde lijst deelbaar is, de terugknop werkt en zoekmachines de
 * pagina's kunnen zien.
 *
 * Deze component tekent bewust de hele kolomindeling, met de productlijst
 * als `children`. Toen de aanroeper het raster maakte en dit component
 * alleen zijn eigen delen teruggaf, telde React die delen elk als een eigen
 * rastervak: de lijst schoof door naar de smalle filterkolom en de
 * productkaarten werden een paar tientallen pixels breed. Houd het raster
 * dus hier, dan kan dat niet meer misgaan.
 */
export function ProductFiltersPanel({
  facets,
  filters,
  total,
  activeCount,
  snelfilters,
  children,
}: {
  facets: Facet[];
  filters: ProductFilters;
  total: number;
  activeCount: number;
  /**
   * Hoeveel artikelen elk snelfilter zou overhouden. Zonder dit stond
   * "Mengbaar in elke kleur" ook op de Mack-pagina, waar geen enkel artikel
   * mengbaar is: aanvinken deed dan niets zichtbaars behalve de lijst legen.
   * Een filter dat niets filtert hoort er niet te staan.
   */
  snelfilters?: { voorraad: number; aanbieding: number; mengverf: number };
  /** De productlijst (en paginering) die naast de filters komt. */
  children: React.ReactNode;
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
        // Elke waarde een eigen parameter. Komma's als scheidingsteken
        // gingen mis bij waarden die er zelf een bevatten, zoals
        // "Beits, olie en vernis".
        const current = params.getAll(key).filter(Boolean);
        const next = current.includes(value)
          ? current.filter((entry) => entry !== value)
          : [...current, value];
        params.delete(key);
        for (const entry of next) params.append(key, entry);
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

  // Waarden staan als herhaalde parameters in de URL, dus `getAll`. Met
  // `get().split(",")` zag je alleen het eerste vinkje terug, en een waarde
  // met een komma erin ("Beits, olie en vernis") nooit.
  const isChecked = (key: string, value: string) =>
    searchParams.getAll(key).includes(value);

  const clearAll = () =>
    update((params) => {
      for (const key of FILTER_KEYS) params.delete(key);
    });

  const populair = useMemo(() => popularFacets(facets), [facets]);

  // Alles wat nu aanstaat, met de groepsnaam erbij. De labels van de vaste
  // schakelaars staan hier ook, anders kun je "In de aanbieding" wel aanzetten
  // maar niet terugzien.
  const VLAG_LABELS: Record<string, string> = {
    voorraad: "Direct leverbaar",
    aanbieding: "In de aanbieding",
    mengverf: "Mengbaar in elke kleur",
  };
  const actieveChips = facets
    .flatMap((facet) =>
      searchParams.getAll(facet.key).map((value) => ({
        key: facet.key,
        groep: facet.label,
        value,
        verwijder: () => toggleValue(facet.key, value),
      })),
    )
    .concat(
      Object.entries(VLAG_LABELS)
        .filter(([key]) => searchParams.get(key) === "1")
        .map(([key, label]) => ({
          key,
          groep: "",
          value: label,
          verwijder: () => toggleFlag(key, false),
        })),
    );

  const panel = (
    <div className="space-y-3">
      {/* Snelfilters */}
      <div className="space-y-2 rounded-xl border border-ink/10 px-3 py-3">
        {[
          {
            key: "voorraad",
            label: "Direct leverbaar",
            on: Boolean(filters.opVoorraad),
            aantal: snelfilters?.voorraad,
          },
          {
            key: "aanbieding",
            label: "In de aanbieding",
            on: Boolean(filters.aanbieding),
            aantal: snelfilters?.aanbieding,
          },
          {
            key: "mengverf",
            label: "Mengbaar in elke kleur",
            on: Boolean(filters.mengverf),
            aantal: snelfilters?.mengverf,
          },
        ]
          // Weglaten als het niets oplevert of juist alles doorlaat; een
          // aangevinkt filter blijft staan, anders kun je het niet uitzetten.
          .filter(
            (flag) =>
              flag.on ||
              flag.aantal === undefined ||
              (flag.aantal > 0 && flag.aantal < total),
          )
          .map((flag) => (
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

      {/* Populaire filters: de grote namen uit alle groepen bij elkaar, zodat
          je niet eerst hoeft te raden onder welke kop "Histor" of "2,5 L"
          staat. */}
      {populair.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink/10">
          <p className="bg-ink/[0.04] px-3 py-2.5 text-sm font-black text-ink">
            Populaire filters
          </p>
          <div className="space-y-1.5 px-3 py-3">
            {populair.map((optie) => (
              <label
                key={`${optie.key}:${optie.value}`}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={isChecked(optie.key, optie.value)}
                  onChange={() => toggleValue(optie.key, optie.value)}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                  {optie.label}
                </span>
                <span className="shrink-0 text-xs text-ink-soft">{optie.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {facets.map((facet) => (
        <FacetGroep
          key={facet.key}
          facet={facet}
          isChecked={isChecked}
          onToggle={toggleValue}
        />
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

      {/* Wat staat er nu aan? Als chips, meteen boven de lijst, elk met een
          kruisje. Zonder deze rij moest je de kolom door om te zien waaróm er
          nog maar twaalf artikelen over waren. */}
      {actieveChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actieveChips.map((chip) => (
            <button
              key={`${chip.key}:${chip.value}`}
              type="button"
              onClick={() => chip.verwijder()}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/10 bg-white py-1 pl-3 pr-2 text-sm transition hover:border-brand"
            >
              <span className="text-ink-soft">{chip.groep}</span>
              <span className="font-bold text-ink">{chip.value}</span>
              <Icon name="x" className="h-3.5 w-3.5 text-ink-soft" aria-hidden />
              <span className="sr-only">verwijder filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-sm font-bold text-brand hover:underline"
          >
            Wis alles
          </button>
        </div>
      )}

      {/* Filterkolom naast de productlijst */}
      <div className="mt-4 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
        <aside className="hidden lg:block">
          {/* De kolom blijft meelopen, maar krijgt een eigen scrollbalk. Zonder
              die maximale hoogte liep een lange filterlijst onder de rand van
              het scherm door: sticky houdt hem vast, dus je kon er met geen
              mogelijkheid bij. */}
          <div className="card sticky top-40 max-h-[calc(100vh-11rem)] overflow-y-auto p-5">
            {panel}
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>

      {/*
        Zwevende filterknop op mobiel. De knop bovenaan de lijst verdwijnt uit
        beeld zodra je gaat scrollen, en dan moest je helemaal terug omhoog om
        te verfijnen. Deze blijft staan waar je duim al is.
      */}
      {facets.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-black text-white shadow-lift transition hover:bg-brand lg:hidden"
        >
          <Icon name="level" className="h-4 w-4" />
          Filteren
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs">{activeCount}</span>
          )}
        </button>
      )}

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
