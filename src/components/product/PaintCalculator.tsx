"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/icons";

/**
 * "Hoeveel verf heb ik nodig?" — de vraag die iedereen bij de schappen stelt.
 *
 * Rekent met het rendement dat in de productspecificaties staat (bv. "ca. 8 m²
 * per liter"). Standaard twee lagen, want dat is bij verf de norm. Beter dat
 * de klant hier het juiste aantal liters uitrekent dan dat hij thuis te weinig
 * blijkt te hebben — of onnodig te veel koopt en terugbrengt.
 */

interface Props {
  /** Rendement in m² per liter, uit de specificaties. */
  coveragePerLiter: number;
  /** Beschikbare inhoudsmaten in liters, om een advies te kunnen geven. */
  sizesInLiters: number[];
}

export function PaintCalculator({ coveragePerLiter, sizesInLiters }: Props) {
  const [open, setOpen] = useState(false);
  const [lengte, setLengte] = useState("");
  const [hoogte, setHoogte] = useState("");
  const [lagen, setLagen] = useState(2);

  const resultaat = useMemo(() => {
    const l = Number(lengte.replace(",", "."));
    const h = Number(hoogte.replace(",", "."));
    if (!Number.isFinite(l) || !Number.isFinite(h) || l <= 0 || h <= 0) return null;

    const oppervlak = l * h;
    const liters = (oppervlak * lagen) / coveragePerLiter;
    // Naar boven afronden op een tiende: je wilt niet net tekort komen.
    const nodig = Math.ceil(liters * 10) / 10;

    // Welke verpakking(en) dekken dat het voordeligst?
    const grootste = [...sizesInLiters].sort((a, b) => b - a);
    let rest = nodig;
    const advies: number[] = [];
    for (const maat of grootste) {
      while (rest >= maat - 0.001) {
        advies.push(maat);
        rest -= maat;
      }
    }
    if (rest > 0.001) {
      const kleinste = [...sizesInLiters].sort((a, b) => a - b);
      const passend = kleinste.find((maat) => maat >= rest) ?? kleinste[kleinste.length - 1];
      if (passend) advies.push(passend);
    }

    return { oppervlak, nodig, advies };
  }, [lengte, hoogte, lagen, coveragePerLiter, sizesInLiters]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl bg-slate-50 p-4 text-left text-sm font-bold text-ink ring-1 ring-black/5 transition hover:bg-slate-100"
      >
        <Icon name="level" className="h-5 w-5 shrink-0 text-brand" />
        Hoeveel verf heb ik nodig?
        <span className="ml-auto text-xs font-normal text-ink-soft">Reken het uit →</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <Icon name="level" className="h-4 w-4 text-brand" /> Hoeveel verf heb ik nodig?
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-bold text-brand hover:underline"
        >
          Verberg
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="calc-lengte" className="mb-1 block text-xs font-bold text-ink">
            Lengte (m)
          </label>
          <input
            id="calc-lengte"
            inputMode="decimal"
            value={lengte}
            onChange={(event) => setLengte(event.target.value)}
            className="input bg-white"
            placeholder="4,5"
          />
        </div>
        <div>
          <label htmlFor="calc-hoogte" className="mb-1 block text-xs font-bold text-ink">
            Hoogte (m)
          </label>
          <input
            id="calc-hoogte"
            inputMode="decimal"
            value={hoogte}
            onChange={(event) => setHoogte(event.target.value)}
            className="input bg-white"
            placeholder="2,6"
          />
        </div>
        <div>
          <label htmlFor="calc-lagen" className="mb-1 block text-xs font-bold text-ink">
            Aantal lagen
          </label>
          <select
            id="calc-lagen"
            value={lagen}
            onChange={(event) => setLagen(Number(event.target.value))}
            className="input bg-white"
          >
            <option value={1}>1 laag</option>
            <option value={2}>2 lagen (aanbevolen)</option>
            <option value={3}>3 lagen</option>
          </select>
        </div>
      </div>

      {resultaat && (
        <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-black/5">
          <p className="text-sm text-ink-soft">
            {resultaat.oppervlak.toFixed(1).replace(".", ",")} m² in {lagen}{" "}
            {lagen === 1 ? "laag" : "lagen"} vraagt om ongeveer
          </p>
          <p className="text-lg font-black text-ink">
            {resultaat.nodig.toFixed(1).replace(".", ",")} liter
          </p>
          {resultaat.advies.length > 0 && (
            <p className="mt-1 text-sm font-semibold text-brand">
              Advies:{" "}
              {resultaat.advies
                .map((maat) => `${maat.toString().replace(".", ",")} L`)
                .join(" + ")}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            Gerekend met {coveragePerLiter.toString().replace(".", ",")} m² per
            liter. Op een ruwe of donkere ondergrond gaat er meer verf in — houd
            dan wat marge aan.
          </p>
        </div>
      )}
    </div>
  );
}
