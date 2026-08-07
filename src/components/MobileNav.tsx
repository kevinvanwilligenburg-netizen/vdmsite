"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";

interface NavLink {
  href: string;
  label: string;
  icon?: string;
}

/** Een categorie met de soorten die erin zitten, voor de uitklapboom. */
export interface MobileCategory extends NavLink {
  soorten?: { label: string; href: string; count: number }[];
}

/**
 * Uitklapmenu voor mobiel.
 *
 * De categorieën zijn uitvouwbaar naar de soorten die erin zitten. Zonder dat
 * moest een klant eerst een categoriepagina laden en daar verder filteren —
 * op een telefoon een omweg van twee schermen voor iets wat hier in één tik
 * kan. De categorie zelf blijft aantikbaar voor wie het hele assortiment wil.
 */
export function MobileNav({
  categories,
  stores,
}: {
  categories: MobileCategory[];
  stores: NavLink[];
}) {
  const [open, setOpen] = useState(false);
  const [uitgeklapt, setUitgeklapt] = useState<string | null>(null);
  const pathname = usePathname();

  // Sluit het menu bij navigatie en zet de pagina-scroll terug.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu openen"
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-lg border-2 border-ink/10 p-2 text-ink transition hover:border-brand hover:text-brand lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menu sluiten"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/50"
          />
          <nav
            aria-label="Hoofdmenu"
            className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-ink/10 p-4">
              <p className="font-black uppercase text-ink">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Menu sluiten"
                className="rounded-lg p-2 text-ink-soft transition hover:text-brand"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            {/*
              Acties bovenaan, en in het rood.

              Op een breed scherm staat deze knop naast de categorieën in de
              balk; in dit menu stond hij er helemaal niet, terwijl juist op een
              telefoon álles achter dit ene knopje zit. Kevin: "geen actie
              button in de mobiele versie website, menu. die mag bovenaan."

              Bovenaan en niet tussen de rubrieken: wie het menu opent tijdens
              een lopende campagne moet er niet eerst langs elf categorieën
              voor scrollen.
            */}
            <div className="border-b border-ink/10 p-4">
              <Link
                href="/actie"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl bg-brand-actie px-4 py-3 font-black uppercase text-white transition hover:brightness-110"
              >
                Acties
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink-soft">
                Assortiment
              </p>
              <ul className="space-y-1">
                {categories.map((link) => {
                  const heeftSoorten = (link.soorten?.length ?? 0) > 0;
                  const isOpen = uitgeklapt === link.href;
                  return (
                    <li key={link.href}>
                      <div className="flex items-stretch gap-1">
                        <Link
                          href={link.href}
                          className="flex-1 rounded-lg px-3 py-2.5 font-bold text-ink transition hover:bg-brand-light hover:text-brand"
                        >
                          {link.label}
                        </Link>
                        {heeftSoorten && (
                          <button
                            type="button"
                            onClick={() => setUitgeklapt(isOpen ? null : link.href)}
                            aria-expanded={isOpen}
                            aria-label={`${link.label} uitklappen`}
                            className="rounded-lg px-3 text-ink-soft transition hover:bg-brand-light hover:text-brand"
                          >
                            <svg
                              viewBox="0 0 16 16"
                              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              aria-hidden
                            >
                              <path
                                d="M3 6l5 5 5-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      {heeftSoorten && isOpen && (
                        <ul className="mb-1 ml-3 space-y-0.5 border-l-2 border-brand/20 pl-3">
                          {link.soorten!.map((soort) => (
                            <li key={soort.href}>
                              <Link
                                href={soort.href}
                                className="flex items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-brand-light hover:text-brand"
                              >
                                <span className="truncate">{soort.label}</span>
                                <span className="shrink-0 text-xs text-ink-soft">
                                  {soort.count}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
                <li>
                  <Link
                    href="/kleurkiezer"
                    className="mt-1 flex items-center gap-2 rounded-lg bg-brand px-3 py-2.5 font-bold text-white"
                  >
                    <Icon name="palette" className="h-5 w-5" /> Kleurkiezer
                  </Link>
                </li>
                <li>
                  <Link
                    href="/klusadvies"
                    className="mt-1 flex items-center gap-2 rounded-lg border-2 border-brand px-3 py-2.5 font-bold text-brand"
                  >
                    <Icon name="bulb" className="h-5 w-5" /> Klusadvies
                  </Link>
                </li>
                <li>
                  <Link
                    href="/account"
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 font-bold text-ink transition hover:bg-brand-light hover:text-brand"
                  >
                    <Icon name="hand" className="h-5 w-5 text-brand" /> Mijn Voordeelmarkt
                  </Link>
                </li>
                <li>
                  <Link
                    href="/merken"
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 font-bold text-ink transition hover:bg-brand-light hover:text-brand"
                  >
                    <Icon name="tag" className="h-5 w-5 text-brand" /> Alle merken
                  </Link>
                </li>
              </ul>
            </div>

            <div className="border-t border-ink/10 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink-soft">
                Onze winkels
              </p>
              <ul className="space-y-1">
                {stores.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-ink transition hover:bg-brand-light hover:text-brand"
                    >
                      <Icon name="pin" className="h-4 w-4 text-brand" /> {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-ink/10 p-4 pb-8">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink-soft">
                Service
              </p>
              <ul className="space-y-1 text-sm">
                {[
                  { href: "/klantenservice", label: "Klantenservice" },
                  { href: "/bezorgen-en-afhalen", label: "Bezorgen & afhalen" },
                  { href: "/algemene-voorwaarden", label: "Algemene voorwaarden" },
                  { href: "/privacy", label: "Privacy & cookies" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-lg px-3 py-2 text-ink-soft transition hover:bg-brand-light hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
