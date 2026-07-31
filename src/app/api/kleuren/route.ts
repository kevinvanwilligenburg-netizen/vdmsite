import { NextResponse } from "next/server";

import { getColorCollections, resolvePaintColor, searchColors } from "@/lib/colors";
import type { PaintColor } from "@/lib/types";

export const revalidate = 3600;

/** Pseudo-collectie: zoek door alle waaiers heen (zie searchColors). */
const ALLE_WAAIERS = "alle";
const STANDAARD_LIMIET = 240;
const MAX_LIMIET = 600;
/** Meer waaiers meenemen op één zoekterm levert alleen maar ruis op. */
const MAX_WAAIERS_PER_ZOEKTERM = 4;

/**
 * Kleuren voor de kleurkiezer. De volledige bron telt tienduizenden kleuren;
 * hier gaat er nooit meer dan een pagina vol naar de browser.
 *
 * ?q=          zoekterm (kleurnaam, code of waaiernaam)
 * ?collection= collectie-id, of "alle"
 * ?meta=1      alleen de collectielijst
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("meta") === "1") {
    return NextResponse.json({ collections: await getColorCollections() });
  }

  // Sleutel-opzoeking voor deeplinks (?kleur=hub:… uit de Shopping-feed).
  // Een sleutel is geen zoektekst: "hub:akzo:…" matcht op geen enkele naam,
  // waardoor de klant zonder voorgeselecteerde kleur landde.
  const key = (url.searchParams.get("key") ?? "").trim();
  if (key) {
    const kleur = await resolvePaintColor(key);
    return NextResponse.json({ colors: kleur ? [kleur] : [], total: kleur ? 1 : 0 });
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  const collection = url.searchParams.get("collection") ?? undefined;

  // Een onzinnige limiet ("?limit=abc") gaf eerder een lege lijst terug.
  const gevraagd = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(gevraagd) && gevraagd > 0
      ? Math.min(Math.floor(gevraagd), MAX_LIMIET)
      : STANDAARD_LIMIET;

  const treffers = await searchColors({
    q: q || undefined,
    collectionId: collection,
    limit,
  });

  const colors: PaintColor[] = [...treffers.colors];
  let total = treffers.total;

  // Wie "sikkens" of "flexa" typt zoekt een waaier, geen kleurnaam — en de
  // kleuren zelf dragen de merknaam niet, dus zonder dit blijft het scherm
  // leeg. Zoekt iemand binnen één waaier, dan laten we dat met rust.
  const doorAlles = !collection || collection === ALLE_WAAIERS;
  if (q && doorAlles && colors.length < limit) {
    const term = q.toLowerCase();
    const waaiers = (await getColorCollections())
      .filter((waaier) => waaier.name.toLowerCase().includes(term))
      .slice(0, MAX_WAAIERS_PER_ZOEKTERM);

    const gezien = new Set(colors.map((color) => color.key));
    for (const waaier of waaiers) {
      if (colors.length >= limit) break;
      const uitWaaier = await searchColors({
        collectionId: waaier.id,
        limit: limit - colors.length,
      });
      total += uitWaaier.total;
      for (const color of uitWaaier.colors) {
        if (gezien.has(color.key)) continue;
        gezien.add(color.key);
        colors.push(color);
      }
    }
  }

  return NextResponse.json({ colors, total });
}
