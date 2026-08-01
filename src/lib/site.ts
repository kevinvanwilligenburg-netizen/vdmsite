export const SITE_NAME = "De Voordeelmarkt";
export const SITE_TAGLINE = "De beste verf voor de laagste prijs";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.devoordeelmarkt.nl"
).replace(/\/$/, "");

export const CONTACT_PHONE = "+31 85 273 8338";
export const CONTACT_EMAIL = "klantenservice@devoordeelmarkt.nl";

/**
 * Bedrijfsgegevens zoals ze op een factuur moeten staan. Een factuur zonder
 * KvK- en btw-nummer is voor een zakelijke klant onbruikbaar; die kan de btw
 * dan niet terugvragen.
 */
export const BEDRIJF = {
  naam: "De Voordeelmarkt",
  adres: "Nijverheidsweg 2",
  postcode: "7442 CH",
  plaats: "Nijverdal",
  land: "Nederland",
  kvk: "70367922",
  btw: "NL855528618B01",
} as const;

/**
 * WhatsApp-nummer van de klantenservice, in internationaal formaat zonder
 * plus of spaties (bv. 31852738338). Staat de variabele niet gezet, dan tonen
 * we de WhatsApp-knop niet: liever geen knop dan een knop naar een nummer
 * waar niemand meeleest.
 */
export const WHATSAPP_NUMMER = (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/[^\d]/g, "");

/**
 * Wanneer er iemand meeleest op WhatsApp. Erbij zetten is geen slag om de arm
 * maar een belofte: wie zaterdagavond appt weet dat maandag het antwoord komt
 * en gaat niet zitten wachten.
 */
export const WHATSAPP_TIJDEN = "ma t/m vr 9:00–17:00";

/** 31631231915 → +31 6 31231915, zodat het nummer leesbaar op de pagina staat. */
export function WHATSAPP_WEERGAVE(nummer: string): string {
  const cijfers = nummer.replace(/[^\d]/g, "");
  const nl = cijfers.startsWith("31") ? cijfers.slice(2) : cijfers;
  if (nl.startsWith("6") && nl.length === 9) {
    return `+31 6 ${nl.slice(1)}`;
  }
  return cijfers ? `+${cijfers}` : "";
}

/** Basis-URL van het VDM-dashboard (voorraad-hub, kleurenfeed, fulfilment). */
export const DASHBOARD_API_URL = (
  process.env.DASHBOARD_API_URL ?? "https://dashboardvdm.vercel.app"
).replace(/\/$/, "");

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}

/** Basis-URL voor redirects/webhooks: env-var indien gezet, anders de origin van het verzoek. */
export function baseUrlFromRequest(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return SITE_URL;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
