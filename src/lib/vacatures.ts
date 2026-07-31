import { DASHBOARD_API_URL } from "@/lib/site";

/**
 * Vacatures, beheerd in het dashboard-portal.
 *
 * De site leest alleen. Zolang het endpoint er nog niet is (404) of hapert,
 * is de lijst leeg en verbergen de pagina's hun vacaturedeel — een lege
 * vacaturepagina met een foutmelding werft niemand.
 */
export interface Vacature {
  id: string;
  titel: string;
  /** Winkel-slug ("apeldoorn"); null of leeg = alle winkels / hoofdkantoor. */
  winkelSlug: string | null;
  uren?: string;
  salaris?: string;
  tekst: string;
  publicatiedatum?: string;
}

export async function getVacatures(): Promise<Vacature[]> {
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/vacatures`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { vacatures?: unknown };
    if (!Array.isArray(data.vacatures)) return [];
    return data.vacatures
      .filter(
        (v): v is Record<string, unknown> =>
          Boolean(v) && typeof v === "object" && typeof (v as { titel?: unknown }).titel === "string",
      )
      .map((v) => ({
        id: String(v.id ?? v.titel),
        titel: String(v.titel),
        winkelSlug:
          typeof v.winkelSlug === "string" && v.winkelSlug.trim()
            ? v.winkelSlug.trim().toLowerCase()
            : null,
        ...(typeof v.uren === "string" && v.uren ? { uren: v.uren } : {}),
        ...(typeof v.salaris === "string" && v.salaris ? { salaris: v.salaris } : {}),
        tekst: String(v.tekst ?? ""),
        ...(typeof v.publicatiedatum === "string"
          ? { publicatiedatum: v.publicatiedatum }
          : {}),
      }));
  } catch {
    return [];
  }
}

/** Vacatures voor één winkel, plus de winkel-overstijgende. */
export async function getVacaturesVoorWinkel(slug: string): Promise<Vacature[]> {
  const alle = await getVacatures();
  const gezocht = slug.trim().toLowerCase();
  return alle.filter((v) => v.winkelSlug === gezocht || v.winkelSlug === null);
}
