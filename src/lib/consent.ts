/**
 * Cookietoestemming.
 *
 * Wat er vandaag op de site staat, en waarom dat uitmaakt voor wat de banner
 * moet doen:
 *
 *  - Wij zetten zelf één cookie: de inlogsessie. Die is strikt noodzakelijk om
 *    ingelogd te blijven, en daarvoor hoeft niets gevraagd te worden (artikel
 *    11.7a Telecommunicatiewet).
 *  - De winkelwagen, de bewaarde kleuren en de gekozen winkel staan in
 *    localStorage. Ook functioneel: zonder die opslag werkt de webshop niet.
 *  - Er staat géén Analytics, géén Tag Manager en géén advertentiepixel. De
 *    enige derde partij is de Trustpilot-widget, en die laadt alleen als er
 *    een business-unit-id is ingesteld.
 *
 * De banner is er dus vooral op vooruit: zodra er wél gemeten of geadverteerd
 * wordt, staat de toestemming klaar en gaat er niets af zonder ja. Google eist
 * sinds Consent Mode v2 dat de standen vóór de tag worden gezet en dat
 * weigeren net zo makkelijk is als accepteren — twee knoppen naast elkaar,
 * geen verstopte link.
 */

export const CONSENT_COOKIE = "vdm-consent";
/** Een jaar; daarna vragen we het opnieuw. */
export const CONSENT_MAX_AGE = 365 * 24 * 60 * 60;

export type ConsentKeuze = "alles" | "alleen-noodzakelijk";

export interface ConsentStand {
  keuze: ConsentKeuze;
  /** Wanneer gekozen, zodat we kunnen zien hoe oud de toestemming is. */
  op: string;
}

/** De Google-signalen die bij een keuze horen. */
export function googleSignalen(keuze: ConsentKeuze): Record<string, "granted" | "denied"> {
  const toegestaan = keuze === "alles" ? "granted" : "denied";
  return {
    ad_storage: toegestaan,
    ad_user_data: toegestaan,
    ad_personalization: toegestaan,
    analytics_storage: toegestaan,
    // Beveiliging staat altijd aan: dat is fraudepreventie en inloggen, niet
    // meten of adverteren.
    security_storage: "granted",
    functionality_storage: "granted",
    personalization_storage: toegestaan,
  };
}

export function leesConsent(ruw: string | undefined): ConsentStand | null {
  if (!ruw) return null;
  try {
    const stand = JSON.parse(decodeURIComponent(ruw)) as ConsentStand;
    if (stand.keuze === "alles" || stand.keuze === "alleen-noodzakelijk") return stand;
  } catch {
    // Onleesbare cookie: behandelen als geen keuze, dus opnieuw vragen.
  }
  return null;
}
