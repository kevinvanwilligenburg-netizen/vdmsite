"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { useStore } from "@/components/store/StoreProvider";

/**
 * Winkelkiezer in de header: klant kiest zijn vaste winkel en ziet die overal
 * terug — bij de voorraad op productpagina's, de afhaalbelofte en het
 * afrekenen.
 */
export function StorePicker() {
  const { stores, favourite, hydrated, setFavourite } = useStore();
  const [open, setOpen] = useState(false);

  if (!hydrated) {
    // Ook op de telefoon een plaatshouder van dezelfde maat, anders springt de
    // hele header opzij zodra de knop verschijnt.
    return <span className="block h-9 w-24 animate-pulse rounded-lg bg-ink/5 sm:w-32" />;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          favourite ? `Jouw winkel: ${favourite.city}. Andere winkel kiezen` : "Kies je winkel"
        }
        // Op de telefoon stond hier alleen een speldje met een pijltje, en dan
        // is het raden wat de knop doet. Nu staat de plaatsnaam erbij, met een
        // randje eromheen zodat je ziet dát het een knop is.
        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink/10 px-2.5 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand sm:gap-2 sm:px-3 sm:py-2"
      >
        <Icon name="pin" className="h-5 w-5 shrink-0 text-brand" />
        <span className="max-w-[7rem] truncate">
          {favourite ? (
            favourite.city
          ) : (
            <>
              <span className="sm:hidden">Winkel</span>
              <span className="hidden sm:inline">Kies je winkel</span>
            </>
          )}
        </span>
        <span aria-hidden className="text-xs">
          ▾
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-1 w-72 rounded-xl bg-white p-2 shadow-lift ring-1 ring-black/10">
            <p className="px-3 py-2 text-xs font-black uppercase tracking-wide text-ink-soft">
              Jouw winkel
            </p>
            <ul>
              {stores.map((store) => (
                <li key={store.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      setFavourite(store.slug);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-brand-light ${
                      favourite?.slug === store.slug ? "bg-brand-light" : ""
                    }`}
                  >
                    <span className="mt-0.5 w-4 shrink-0 text-brand">
                      {favourite?.slug === store.slug && (
                        <Icon name="check" className="h-4 w-4" strokeWidth={3} />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-ink">{store.city}</span>
                      <span className="block text-xs text-ink-soft">{store.address}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-ink/10 px-3 py-2 text-xs text-ink-soft">
              We tonen dan de voorraad van die winkel en zetten je bestelling
              daar klaar, gratis, binnen 2 uur.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
