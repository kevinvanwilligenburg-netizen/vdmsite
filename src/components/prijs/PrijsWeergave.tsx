"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Prijzen inclusief of exclusief btw.
 *
 * Een schilder rekent in bedragen exclusief btw — dat is wat hij doorbelast en
 * wat in zijn offerte staat. Een particulier rekent in wat er van zijn rekening
 * gaat. Dezelfde webshop moet allebei kunnen tonen, want De Voordeelmarkt
 * verkoopt aan beide.
 *
 * De keuze staat in een cookie en niet alleen in de browseropslag: hij moet al
 * bekend zijn wanneer de server de pagina opbouwt, anders ziet een zakelijke
 * bezoeker eerst een tel lang de consumentenprijs staan. Dat is precies het
 * soort flikkering waar iemand aan gaat twijfelen of hij het goede bedrag ziet.
 */
export const PRIJS_COOKIE = "vdm-prijs";
const MAX_AGE = 365 * 24 * 60 * 60;

export type PrijsModus = "incl" | "excl";

const Context = createContext<{ modus: PrijsModus; zet: (modus: PrijsModus) => void }>({
  modus: "incl",
  zet: () => undefined,
});

export function usePrijsModus() {
  return useContext(Context);
}

export function PrijsProvider({
  start,
  children,
}: {
  start: PrijsModus;
  children: React.ReactNode;
}) {
  const [modus, setModus] = useState<PrijsModus>(start);

  // Volg de server bij een navigatie; anders blijft een oude keuze hangen als
  // de bezoeker 'm op een ander tabblad wijzigt.
  useEffect(() => setModus(start), [start]);

  const zet = useCallback((nieuw: PrijsModus) => {
    document.cookie = [
      `${PRIJS_COOKIE}=${nieuw}`,
      "Path=/",
      `Max-Age=${MAX_AGE}`,
      "SameSite=Lax",
      location.protocol === "https:" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
    setModus(nieuw);
    // Verversen zodat ook de server-gerenderde prijzen meegaan.
    location.reload();
  }, []);

  return <Context.Provider value={{ modus, zet }}>{children}</Context.Provider>;
}

/** Het schakelaartje zelf. */
export function PrijsSchakelaar({ className = "" }: { className?: string }) {
  const { modus, zet } = usePrijsModus();
  return (
    <div
      role="group"
      aria-label="Prijzen tonen"
      className={`inline-flex overflow-hidden rounded-lg border-2 border-ink/10 text-xs font-bold ${className}`}
    >
      {(
        [
          { waarde: "incl", label: "incl. btw" },
          { waarde: "excl", label: "excl. btw" },
        ] as const
      ).map((optie) => (
        <button
          key={optie.waarde}
          type="button"
          aria-pressed={modus === optie.waarde}
          onClick={() => modus !== optie.waarde && zet(optie.waarde)}
          className={`px-2.5 py-1.5 transition ${
            modus === optie.waarde
              ? "bg-ink text-white"
              : "text-ink-soft hover:text-brand"
          }`}
        >
          {optie.label}
        </button>
      ))}
    </div>
  );
}
