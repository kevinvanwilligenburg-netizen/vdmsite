"use client";

import { useEffect, useState } from "react";

import { bezorgBelofte } from "@/lib/delivery";

/**
 * De bezorgbelofte, live. Vóór 09:00 op een werkdag staat er "vandaag
 * verzonden"; daarna en in het weekend schuift de tekst vanzelf op naar
 * morgen of maandag.
 *
 * Client component, want de meeste pagina's zijn statisch (ISR): een tekst
 * die om 03:00 wordt gebakken en om 14:00 nog "vandaag" belooft, liegt het
 * grootste deel van de dag. De eerste render gebruikt bewust een vast
 * na-negenen-moment — dat is de voorzichtige variant en geeft geen
 * hydratieverschil; direct na het laden komt de echte tijd erin.
 */
const NEUTRAAL = new Date("2026-01-06T12:00:00");

export function BezorgBelofte({
  soort = "usp",
  className = "",
}: {
  soort?: "badge" | "usp";
  className?: string;
}) {
  const [tekst, setTekst] = useState(() => bezorgBelofte(NEUTRAAL)[soort]);
  useEffect(() => {
    setTekst(bezorgBelofte(new Date())[soort]);
    // Elke minuut verversen: wie om 08:58 de site opent, ziet de belofte om
    // 09:00 omklappen in plaats van een verlopen "vandaag" aan te klikken.
    const timer = window.setInterval(
      () => setTekst(bezorgBelofte(new Date())[soort]),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, [soort]);

  return <span className={className}>{tekst}</span>;
}
