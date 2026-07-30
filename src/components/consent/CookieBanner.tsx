"use client";

import Link from "next/link";

import { useConsent } from "@/components/consent/ConsentProvider";

/**
 * De cookiemelding.
 *
 * Twee knoppen náást elkaar, even groot en even opvallend. Dat is geen
 * smaakkwestie: zowel de AVG-toezichthouders als Google's eigen beleid eisen
 * dat weigeren net zo makkelijk is als accepteren. Een grijze tekstlink
 * "instellingen" naast een oranje "accepteer alles" voldoet daar niet aan, en
 * kost bij een controle meer dan hij ooit aan meetdata oplevert.
 *
 * Geen modaal venster dat de site blokkeert: er staat op dit moment niets dat
 * meet, dus doorlezen zonder te kiezen mag. Blijft de balk staan, dan blijft
 * alles wat niet noodzakelijk is uit.
 */
export function CookieBanner() {
  const { keuze, kies } = useConsent();
  if (keuze !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookies"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-brand bg-white shadow-lift"
    >
      <div className="container-page flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-ink-soft">
          <strong className="block font-black text-ink">Cookies</strong>
          Voor de winkelwagen en het inloggen gebruiken we cookies die nodig zijn
          om de site te laten werken. Met jouw toestemming meten we ook hoe de
          site gebruikt wordt, zodat we hem kunnen verbeteren.{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            Lees onze privacyverklaring
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => kies("alleen-noodzakelijk")}
            className="rounded-lg border-2 border-ink/15 px-4 py-2.5 text-sm font-bold text-ink transition hover:border-ink/40"
          >
            Alleen noodzakelijk
          </button>
          <button
            type="button"
            onClick={() => kies("alles")}
            className="rounded-lg border-2 border-brand bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:border-brand-dark hover:bg-brand-dark"
          >
            Alles accepteren
          </button>
        </div>
      </div>
    </div>
  );
}
