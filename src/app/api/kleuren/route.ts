import { NextResponse } from "next/server";

import { getColorCollections, searchColors } from "@/lib/colors";

export const revalidate = 3600;

/**
 * Kleuren voor de kleurkiezer. De volledige bron telt tienduizenden kleuren;
 * hier gaat er nooit meer dan een pagina vol naar de browser.
 *
 * ?q=          zoekterm (naam of code)
 * ?collection= collectie-id, of "alle"
 * ?meta=1      alleen de collectielijst
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("meta") === "1") {
    return NextResponse.json({ collections: await getColorCollections() });
  }

  const { colors, total } = await searchColors({
    q: url.searchParams.get("q") ?? undefined,
    collectionId: url.searchParams.get("collection") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 240),
  });

  return NextResponse.json({ colors, total });
}
