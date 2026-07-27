"use client";

import { useEffect, useRef } from "react";

/**
 * Legt vast wat bezoekers zoeken en of ze iets vonden.
 *
 * Zoekopdrachten zonder resultaat zijn het waardevolste signaal dat een
 * webshop heeft: ze vertellen precies welk artikel ontbreekt, of met welk
 * woord klanten zoeken dat wij niet kennen. Die gaan naar het dashboard, waar
 * ze in het zoektermen-overzicht terechtkomen.
 */
export function SearchTracker({ query, results }: { query: string; results: number }) {
  const gemeld = useRef<string>("");

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term || term === gemeld.current) return;
    gemeld.current = term;

    // Even wachten: wie doortypt, stuurt anders halve woorden mee.
    const timer = window.setTimeout(() => {
      fetch("/api/zoekterm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, results }),
        keepalive: true,
      }).catch(() => undefined);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [query, results]);

  return null;
}
