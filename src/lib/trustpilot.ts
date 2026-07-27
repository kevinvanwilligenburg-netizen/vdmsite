/**
 * Trustpilot-koppeling.
 *
 * Twee onderdelen:
 *  1. TrustBox-widgets (de officiële Trustpilot-scripts) tonen echte reviews
 *     op de site. Daarvoor is alleen het business unit-id nodig.
 *  2. De publieke Trustpilot-API levert het gemiddelde cijfer en het aantal
 *     reviews, zodat we die in de structured data kunnen zetten.
 *
 * BELANGRIJK: sterren in zoekresultaten mogen alleen op échte reviews
 * gebaseerd zijn. Zonder API-sleutel tonen we dus géén rating in de
 * structured data — dan draaien alleen de widgets, die hun data zelf bij
 * Trustpilot ophalen.
 *
 * Instellen (Vercel → Environment Variables):
 *   NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID  het id uit je Trustpilot-account
 *   NEXT_PUBLIC_TRUSTPILOT_DOMAIN            bv. devoordeelmarkt.nl
 *   TRUSTPILOT_API_KEY                       optioneel, voor het gemiddelde cijfer
 */

export const TRUSTPILOT_BUSINESS_UNIT_ID =
  process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID ?? "";
export const TRUSTPILOT_DOMAIN =
  process.env.NEXT_PUBLIC_TRUSTPILOT_DOMAIN ?? "devoordeelmarkt.nl";

const TRUSTPILOT_API_KEY = process.env.TRUSTPILOT_API_KEY;

export function trustpilotEnabled(): boolean {
  return Boolean(TRUSTPILOT_BUSINESS_UNIT_ID);
}

export function trustpilotProfileUrl(): string {
  return `https://nl.trustpilot.com/review/${TRUSTPILOT_DOMAIN}`;
}

export interface TrustpilotRating {
  /** Gemiddelde score (1–5). */
  score: number;
  /** Aantal reviews waarop dat gemiddelde is gebaseerd. */
  count: number;
}

/**
 * Haal het gemiddelde cijfer op bij Trustpilot. `null` zonder API-sleutel of
 * bij een storing — dan blijft de rating uit de structured data, zoals het
 * hoort.
 */
export async function getTrustpilotRating(): Promise<TrustpilotRating | null> {
  if (!TRUSTPILOT_API_KEY || !TRUSTPILOT_BUSINESS_UNIT_ID) return null;
  try {
    const res = await fetch(
      `https://api.trustpilot.com/v1/business-units/${TRUSTPILOT_BUSINESS_UNIT_ID}`,
      {
        headers: { apikey: TRUSTPILOT_API_KEY },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      score?: { trustScore?: number; stars?: number };
      numberOfReviews?: { total?: number };
    };
    const score = data.score?.trustScore;
    const count = data.numberOfReviews?.total;
    if (typeof score !== "number" || typeof count !== "number" || count < 1) return null;
    return { score, count };
  } catch (error) {
    console.error("[trustpilot] cijfer ophalen mislukt:", error);
    return null;
  }
}

/** AggregateRating voor structured data; alleen bij echte reviewdata. */
export function aggregateRatingJsonLd(rating: TrustpilotRating | null) {
  if (!rating) return undefined;
  return {
    "@type": "AggregateRating",
    ratingValue: rating.score.toFixed(1),
    reviewCount: rating.count,
    bestRating: "5",
    worstRating: "1",
  };
}
