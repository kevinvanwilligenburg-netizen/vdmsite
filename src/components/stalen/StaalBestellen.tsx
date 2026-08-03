"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { KleurVenster } from "@/components/kleur/KleurVenster";
import { kleurLabel } from "@/components/kleur/waaier";
import { euro } from "@/lib/format";
import {
  MAX_STALEN_PER_ORDER,
  STAAL_NAAM,
  STAAL_PRIJS,
  STAAL_PRODUCT_ID,
  STAAL_SKU,
} from "@/lib/stalen";
import type { PaintColor } from "@/lib/types";

/**
 * Kleurtesters kiezen en bestellen.
 *
 * Meerdere kleuren in één keer: wie twijfelt, twijfelt zelden tussen één
 * kleur. Elke gekozen kleur wordt een eigen winkelwagenregel, zodat de
 * mengmachine per potje precies weet wat er in moet.
 */
export function StaalBestellen({ initialColors }: { initialColors: PaintColor[] }) {
  const { addItem } = useCart();
  const [gekozen, setGekozen] = useState<PaintColor[]>([]);
  const [vensterOpen, setVensterOpen] = useState(false);
  const [toegevoegd, setToegevoegd] = useState(false);

  // ?kleur= (bijvoorbeeld vanaf een RAL-kleurpagina) alvast klaarzetten.
  // Na hydration, zodat de pagina statisch gerenderd blijft.
  useEffect(() => {
    const preselect = new URLSearchParams(window.location.search).get("kleur");
    if (!preselect) return;

    const local =
      initialColors.find((kandidaat) => kandidaat.key === preselect) ??
      initialColors.find((kandidaat) => kandidaat.key === `ral:${preselect}`);
    if (local) {
      setGekozen([local]);
      return;
    }

    let actief = true;
    const opzoeken = preselect.includes(":")
      ? `/api/kleuren?key=${encodeURIComponent(preselect)}`
      : `/api/kleuren?q=${encodeURIComponent(preselect)}&collection=alle&limit=1`;
    fetch(opzoeken)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found = data?.colors?.[0];
        if (actief && found) setGekozen([found]);
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
  }, [initialColors]);

  const voegToe = (kleur: PaintColor) => {
    setGekozen((huidig) => {
      if (huidig.some((k) => k.key === kleur.key)) return huidig;
      if (huidig.length >= MAX_STALEN_PER_ORDER) return huidig;
      return [...huidig, kleur];
    });
    setToegevoegd(false);
  };

  const verwijder = (key: string) => {
    setGekozen((huidig) => huidig.filter((kleur) => kleur.key !== key));
    setToegevoegd(false);
  };

  const bestel = () => {
    for (const kleur of gekozen) {
      addItem(
        {
          key: `${STAAL_PRODUCT_ID}::${kleur.key}`,
          productId: STAAL_PRODUCT_ID,
          sku: STAAL_SKU,
          slug: "kleurstalen",
          name: STAAL_NAAM,
          color: {
            key: kleur.key,
            code: kleur.code,
            name: kleur.name,
            hex: kleur.hex,
            collection: kleur.group,
          },
          unitPrice: STAAL_PRIJS,
          icon: "palette",
          hue: 25,
        },
        1,
      );
    }
    setGekozen([]);
    setToegevoegd(true);
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-black text-ink">Kies je kleuren</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Elke tester is 30 ml, gemengd in de kleur die jij kiest.{" "}
        {euro(STAAL_PRIJS)} per stuk, maximaal {MAX_STALEN_PER_ORDER} per
        bestelling.
      </p>

      {gekozen.length > 0 && (
        <ul className="mt-4 space-y-2">
          {gekozen.map((kleur) => (
            <li
              key={kleur.key}
              className="flex items-center gap-3 rounded-xl border-2 border-ink/10 p-3"
            >
              <span
                className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-black/10"
                style={{ backgroundColor: kleur.hex }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">
                  {kleurLabel(kleur).titel}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {kleurLabel(kleur).onder}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold text-ink">{euro(STAAL_PRIJS)}</span>
              <button
                type="button"
                aria-label={`${kleur.name} verwijderen`}
                onClick={() => verwijder(kleur.key)}
                className="shrink-0 rounded-lg border-2 border-ink/10 px-2.5 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setVensterOpen(true)}
          disabled={gekozen.length >= MAX_STALEN_PER_ORDER}
          className="btn border-2 border-brand bg-white text-brand transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="palette" className="h-5 w-5" />
          {gekozen.length === 0 ? "Kies een kleur" : "Nog een kleur"}
        </button>
        {gekozen.length > 0 && (
          <button type="button" onClick={bestel} className="btn btn-primary">
            {gekozen.length === 1
              ? `Tester in winkelwagen · ${euro(STAAL_PRIJS)}`
              : `${gekozen.length} testers in winkelwagen · ${euro(STAAL_PRIJS * gekozen.length)}`}
          </button>
        )}
      </div>

      {toegevoegd && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 ring-1 ring-green-200">
          Toegevoegd aan je winkelwagen ·{" "}
          <Link href="/winkelwagen" className="underline">
            Bekijk winkelwagen
          </Link>{" "}
, je voucher krijg je per mail zodra de betaling binnen is.
        </p>
      )}

      <KleurVenster
        open={vensterOpen}
        onClose={() => setVensterOpen(false)}
        initialColors={initialColors}
        huidige={null}
        onKies={(kleur) => {
          voegToe(kleur);
          setVensterOpen(false);
        }}
      />
    </div>
  );
}
