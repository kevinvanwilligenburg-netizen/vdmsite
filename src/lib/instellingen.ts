import { DASHBOARD_API_URL } from "@/lib/site";

/**
 * Schakelaars die Kevin in het dashboard omzet, zonder deploy.
 *
 * Bewust met "uit" als standaard: gaat het endpoint plat of bestaat het nog
 * niet, dan blijft een functie verborgen in plaats van dat hij ongewild
 * aanstaat. Voor de kleurtesters is dat het verschil tussen een bestelling
 * die we niet kunnen leveren (het Tilroy-artikel bestaat nog niet) en een
 * pagina die simpelweg nog niet bestaat.
 */
export interface Instellingen {
  /** Kleurtesters (/kleurstalen) tonen en bestelbaar maken. */
  kleurtesters: boolean;
}

const UIT: Instellingen = { kleurtesters: false };

export async function getInstellingen(): Promise<Instellingen> {
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/instellingen`, {
      signal: AbortSignal.timeout(4000),
      // Kort genoeg dat een omgezette schakelaar binnen een paar minuten
      // zichtbaar is, lang genoeg om niet elke render een rondje te doen.
      next: { revalidate: 300 },
    });
    if (!res.ok) return UIT;
    const data = (await res.json()) as Record<string, unknown>;
    return { kleurtesters: aan(data.kleurtesters) };
  } catch {
    return UIT;
  }
}

/**
 * Het dashboard mag een schakelaar als vinkje, tekst of getal opsturen —
 * alles wat niet overtuigend "aan" zegt, telt als uit.
 */
function aan(waarde: unknown): boolean {
  if (typeof waarde === "boolean") return waarde;
  if (typeof waarde === "number") return waarde === 1;
  if (typeof waarde === "string") {
    return ["true", "1", "ja", "aan", "on"].includes(waarde.trim().toLowerCase());
  }
  return false;
}

/** Losse helper: is het bestellen van kleurtesters nu opengesteld? */
export async function kleurtestersActief(): Promise<boolean> {
  return (await getInstellingen()).kleurtesters;
}
