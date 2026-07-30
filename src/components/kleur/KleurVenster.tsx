"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ColorPicker } from "@/components/ColorPicker";
import { Icon } from "@/components/icons";
import { kleurLabel } from "@/components/kleur/waaier";
import type { PaintColor } from "@/lib/types";

const FOCUSBAAR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * De kleurkeuze bij een artikel, als venster.
 *
 * Op een productpagina concurreert de kleurkiezer met de prijs, de inhoud en
 * de bestelknop. In een venster heeft hij het scherm even voor zich alleen —
 * en op een telefoon scheelt dat een halve meter scrollen naar de knop.
 *
 * De keuze wordt hier pas doorgegeven als er op "Kies deze kleur" wordt
 * geklikt: aanklikken is passen, sluiten met Escape laat de vorige kleur staan.
 */
export function KleurVenster({
  open,
  onClose,
  initialColors,
  huidige,
  onKies,
}: {
  open: boolean;
  onClose: () => void;
  initialColors: PaintColor[];
  huidige: PaintColor | null;
  onKies: (color: PaintColor) => void;
}) {
  const titelId = useId();
  const [gemonteerd, setGemonteerd] = useState(false);
  const [keuze, setKeuze] = useState<PaintColor | null>(huidige);
  const paneel = useRef<HTMLDivElement | null>(null);

  useEffect(() => setGemonteerd(true), []);

  // Bij openen beginnen bij wat er al gekozen was.
  useEffect(() => {
    if (open) setKeuze(huidige);
  }, [open, huidige]);

  const sluit = useCallback(() => onClose(), [onClose]);

  // Escape sluit, en Tab blijft binnen het venster. Zonder die tweede stap
  // loopt de focus achter het venster door de hele pagina.
  useEffect(() => {
    if (!open) return;
    const kwam = document.activeElement as HTMLElement | null;
    const overloop = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Naar het zoekveld, zodat je meteen kunt typen.
    const start = window.setTimeout(() => {
      paneel.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }, 0);

    const opToets = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        sluit();
        return;
      }
      if (event.key !== "Tab" || !paneel.current) return;
      const stops = Array.from(
        paneel.current.querySelectorAll<HTMLElement>(FOCUSBAAR),
      ).filter((element) => element.offsetParent !== null);
      if (stops.length === 0) return;
      const eerste = stops[0];
      const laatste = stops[stops.length - 1];
      const actief = document.activeElement;
      if (event.shiftKey && (actief === eerste || !paneel.current.contains(actief))) {
        event.preventDefault();
        laatste.focus();
      } else if (!event.shiftKey && actief === laatste) {
        event.preventDefault();
        eerste.focus();
      }
    };

    document.addEventListener("keydown", opToets, true);
    return () => {
      window.clearTimeout(start);
      document.removeEventListener("keydown", opToets, true);
      document.body.style.overflow = overloop;
      kwam?.focus?.();
    };
  }, [open, sluit]);

  if (!open || !gemonteerd) return null;

  const label = keuze ? kleurLabel(keuze) : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={sluit}
        className="absolute inset-0 bg-ink/60"
      />

      <div
        ref={paneel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-lift sm:h-[85vh] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink/10 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id={titelId} className="text-lg font-black uppercase text-ink sm:text-xl">
              Kies je kleur
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              Wij mengen je verf exact op deze kleur aan, gratis, in onze eigen
              werkplaats.
            </p>
          </div>
          <button
            type="button"
            onClick={sluit}
            aria-label="Venster sluiten"
            className="shrink-0 rounded-lg p-2 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
          <ColorPicker
            initialColors={initialColors}
            value={keuze?.key ?? null}
            onChange={setKeuze}
            fill
          />
        </div>

        <div
          className="flex items-center gap-3 border-t border-ink/10 bg-white p-3 sm:p-4"
          // Op een iPhone valt de balk anders half achter de systeembalk.
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {keuze && label ? (
            <>
              <span
                className="h-11 w-11 shrink-0 rounded-lg ring-1 ring-black/10"
                style={{ backgroundColor: keuze.hex }}
                aria-hidden
              />
              <p className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">{label.titel}</span>
                <span className="block truncate text-sm text-ink-soft">{label.onder}</span>
              </p>
            </>
          ) : (
            <p className="min-w-0 flex-1 text-sm text-ink-soft">
              Kies hierboven een kleur.
            </p>
          )}
          <button
            type="button"
            disabled={!keuze}
            onClick={() => {
              if (!keuze) return;
              onKies(keuze);
              sluit();
            }}
            className="btn btn-primary shrink-0 px-5 disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-white"
          >
            Kies deze kleur
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
