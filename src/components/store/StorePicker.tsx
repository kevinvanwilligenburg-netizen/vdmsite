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
    return <span className="hidden h-9 w-32 animate-pulse rounded-lg bg-ink/5 md:block" />;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-ink transition hover:text-brand sm:px-3"
      >
        <Icon name="pin" className="h-5 w-5 shrink-0 text-brand" />
        <span className="hidden sm:inline">
          {favourite ? favourite.city : "Kies je winkel"}
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
              daar klaar — gratis, binnen 2 uur.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
