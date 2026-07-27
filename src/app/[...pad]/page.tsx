import { notFound, permanentRedirect } from "next/navigation";

import { resolveLegacyPath } from "@/lib/redirects";

export const dynamic = "force-dynamic";

/**
 * Vangnet voor alle URL's die geen eigen pagina hebben.
 *
 * Bij de overgang van de huidige (Tilroy-)site moeten bestaande links blijven
 * werken: productpagina's, winkelpagina's en de vaste content-pagina's krijgen
 * hier een permanente redirect (308, door Google net als een 301 verwerkt).
 * Herkennen we het pad niet, dan volgt gewoon de 404-pagina.
 */
export default async function LegacyCatchAll({
  params,
}: {
  params: { pad: string[] };
}) {
  const target = await resolveLegacyPath(params.pad ?? []);
  if (target) permanentRedirect(target);
  notFound();
}
