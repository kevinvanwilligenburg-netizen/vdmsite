import { DASHBOARD_API_URL } from "@/lib/site";

/**
 * Actiebanners voor de homepage.
 *
 * Kevin beheert ze in het dashboard (/banners) en dat serveert ze hier uit.
 * De volgorde in het antwoord is de volgorde van de slideshow.
 *
 * Geen banners, of het dashboard even niet bereikbaar: dan geen slideshow. Een
 * homepage zonder actiebanner is een homepage; een homepage met een kapotte
 * afbeelding erboven is een winkel waar niemand meer iets van gelooft.
 */

export interface Banner {
  id: string;
  desktopUrl: string;
  /** Vierkante variant voor telefoons; leeg = desktopafbeelding gebruiken. */
  mobielUrl?: string;
  /** Waar de banner heen linkt; leeg = niet klikbaar. */
  link?: string;
  alt: string;
  /**
   * Groot (de slideshow bovenaan) of klein (het rijtje van twee eronder).
   *
   * Het dashboard kent dit veld nog niet; tot die tijd is alles groot en
   * blijft het rijtje kleine banners gewoon leeg. Zodra ze het meesturen,
   * werkt het hier zonder verdere wijziging.
   */
  formaat: "groot" | "klein";
}

function schoon(waarde: unknown): string {
  return typeof waarde === "string" ? waarde.trim() : "";
}

/**
 * Alleen https-adressen doorlaten.
 *
 * De banners komen van een ander systeem, en dit is de plek waar dat systeem
 * de homepage in mag. Een `javascript:`-link in het `link`-veld zou daar zo
 * doorheen lopen.
 */
function veiligeUrl(waarde: unknown): string | undefined {
  const tekst = schoon(waarde);
  if (!tekst) return undefined;
  try {
    const url = new URL(tekst, "https://www.devoordeelmarkt.nl");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function getBanners(): Promise<Banner[]> {
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/banners`, {
      // Een actie gaat aan of uit op een moment dat Kevin kiest; een uur
      // wachten tot de homepage het doorheeft is te lang.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { banners?: unknown };
    if (!Array.isArray(data.banners)) return [];

    return data.banners.flatMap((ruw): Banner[] => {
      const item = ruw as Record<string, unknown>;
      const desktopUrl = veiligeUrl(item.desktopUrl);
      // Zonder afbeelding valt er niets te tonen.
      if (!desktopUrl) return [];
      const mobielUrl = veiligeUrl(item.mobielUrl);
      const link = veiligeUrl(item.link);
      return [
        {
          id: schoon(item.id) || desktopUrl,
          desktopUrl,
          ...(mobielUrl ? { mobielUrl } : {}),
          ...(link ? { link } : {}),
          // Alt-tekst is geen bijzaak: bij een banner die niet laadt is dit
          // het enige wat er staat, en een schermlezer heeft niets anders.
          alt: schoon(item.alt) || "Actie bij De Voordeelmarkt",
          formaat: schoon(item.formaat).toLowerCase() === "klein" ? "klein" : "groot",
        },
      ];
    });
  } catch (error) {
    console.error("[banners] ophalen mislukt:", error);
    return [];
  }
}
