"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import type { MenuCategory } from "@/lib/tilroy";

/**
 * Hoofdmenu met uitklappaneel per categorie.
 *
 * De vorige balk schoof horizontaal: bij negen categorieën liep hij ruim
 * 300 pixels buiten een laptopscherm, compleet met scrollbalk, en de laatste
 * items waren onvindbaar. Nu wrapt de balk in plaats van te scrollen, en
 * opent elke categorie een paneel met de soorten en de merken die er
 * werkelijk in zitten — zo ziet een klant het assortiment zonder eerst te
 * moeten klikken.
 *
 * Openen gaat met de muis (hover) én met het toetsenbord (focus, Escape om
 * te sluiten). De categorie zelf blijft een gewone link, dus wie het paneel
 * niet gebruikt komt gewoon op de categoriepagina uit.
 */
export function MegaMenu({ categories }: { categories: MenuCategory[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sluitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const annuleerSluiten = useCallback(() => {
    if (sluitTimer.current) {
      clearTimeout(sluitTimer.current);
      sluitTimer.current = null;
    }
  }, []);

  // Kort uitstel bij het weggaan: anders klapt het paneel dicht zodra de
  // muis de ruimte tussen de knop en het paneel kruist.
  const sluitStraks = useCallback(() => {
    annuleerSluiten();
    sluitTimer.current = setTimeout(() => setOpen(null), 120);
  }, [annuleerSluiten]);

  useEffect(() => () => annuleerSluiten(), [annuleerSluiten]);

  useEffect(() => {
    if (!open) return;
    const opToets = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", opToets);
    return () => document.removeEventListener("keydown", opToets);
  }, [open]);

  return (
    <nav
      ref={navRef}
      aria-label="Assortiment"
      className="relative hidden bg-ink text-white lg:block"
      onMouseLeave={sluitStraks}
      onBlur={(event) => {
        // Sluit zodra de focus het hele menu verlaat.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(null);
        }
      }}
    >
      {/*
        De categorieën en de twee knoppen staan in aparte flex-groepen.
        Met `ml-auto` op de knoppen binnen één wrappende rij slokt die marge
        de vrije ruimte op en springen ze naar een tweede regel, ook als
        alles ruim past.
      */}
      <div className="container-page flex items-center justify-between gap-4 py-1 text-sm font-bold">
        <div className="flex flex-wrap items-center gap-x-1">
          {categories.map((category) => {
          const isOpen = open === category.slug;
          const heeftPaneel = category.soorten.length > 0 || category.merken.length > 0;
          return (
            <div key={category.slug} className="static">
              <Link
                href={`/categorie/${category.slug}`}
                aria-expanded={heeftPaneel ? isOpen : undefined}
                onMouseEnter={() => {
                  annuleerSluiten();
                  setOpen(heeftPaneel ? category.slug : null);
                }}
                onFocus={() => {
                  annuleerSluiten();
                  setOpen(heeftPaneel ? category.slug : null);
                }}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 transition ${
                  isOpen ? "bg-white/10 text-brand-bright" : "hover:text-brand-bright"
                }`}
              >
                {category.menuLabel ?? category.name}
                {heeftPaneel && (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-60" aria-hidden>
                    <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/klusadvies"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition hover:text-brand-bright"
          >
            <Icon name="bulb" className="h-4 w-4" /> Klusadvies
          </Link>
          <Link
            href="/kleurkiezer"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-white transition hover:bg-brand-dark"
          >
            <Icon name="palette" className="h-4 w-4" /> Kleurkiezer
          </Link>
        </div>
      </div>

      {categories.map((category) => {
        if (open !== category.slug) return null;
        if (category.soorten.length === 0 && category.merken.length === 0) return null;
        return (
          <div
            key={category.slug}
            onMouseEnter={annuleerSluiten}
            onMouseLeave={sluitStraks}
            className="absolute inset-x-0 top-full z-50 border-t-2 border-brand bg-white text-ink shadow-lift"
          >
            <div className="container-page grid gap-8 py-6 md:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                  Soorten
                </p>
                <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {category.soorten.map((soort) => (
                    <li key={soort.label}>
                      <Link
                        href={soort.href}
                        className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 font-semibold text-ink transition hover:bg-brand-light hover:text-brand"
                      >
                        <span className="truncate">{soort.label}</span>
                        <span className="shrink-0 text-xs font-normal text-ink-soft">
                          {soort.count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/categorie/${category.slug}`}
                  className="mt-3 inline-block px-2 text-sm font-bold text-brand hover:underline"
                >
                  Alles in {category.name.toLowerCase()} ({category.count}) →
                </Link>
              </div>

              {category.merken.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                    Merken
                  </p>
                  <ul className="mt-3 space-y-1">
                    {category.merken.map((merk) => (
                      <li key={merk.label}>
                        <Link
                          href={merk.href}
                          className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 font-semibold text-ink transition hover:bg-brand-light hover:text-brand"
                        >
                          <span className="truncate">{merk.label}</span>
                          <span className="shrink-0 text-xs font-normal text-ink-soft">
                            {merk.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/merken"
                    className="mt-3 inline-block px-2 text-sm font-bold text-brand hover:underline"
                  >
                    Alle merken →
                  </Link>
                </div>
              )}

              <div className="rounded-2xl bg-brand-light p-5">
                <p className="text-sm font-black uppercase text-ink">
                  {category.slug === "verf" ? "Verf in elke kleur" : "Weet je het niet zeker?"}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {category.slug === "verf"
                    ? "Kies je kleur online, wij mengen hem gratis in de winkel."
                    : "Vertel wat je gaat doen en wij rekenen uit wat je nodig hebt."}
                </p>
                <Link
                  href={category.slug === "verf" ? "/kleurkiezer" : "/klusadvies"}
                  className="btn btn-primary mt-4 py-2 text-sm"
                >
                  {category.slug === "verf" ? "Open de kleurkiezer" : "Naar het klusadvies"}
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
