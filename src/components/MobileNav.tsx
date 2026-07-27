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

/** Uitklapmenu voor mobiel: categorieën + service-links achter één knop. */
export function MobileNav({
  categories,
  stores,
}: {
  categories: NavLink[];
  stores: NavLink[];
}) {
  const [open, setOpen] = useState(false);
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

            <div className="p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink-soft">
                Assortiment
              </p>
              <ul className="space-y-1">
                {categories.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-lg px-3 py-2.5 font-bold text-ink transition hover:bg-brand-light hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/kleurkiezer"
                    className="mt-1 flex items-center gap-2 rounded-lg bg-brand px-3 py-2.5 font-bold text-white"
                  >
                    <Icon name="palette" className="h-5 w-5" /> Kleurkiezer
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
