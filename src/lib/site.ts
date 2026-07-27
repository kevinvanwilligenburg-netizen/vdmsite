export const SITE_NAME = "De Voordeelmarkt";
export const SITE_TAGLINE = "De beste verf voor de laagste prijs";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.devoordeelmarkt.nl"
).replace(/\/$/, "");

export const CONTACT_PHONE = "+31 85 273 8338";
export const CONTACT_EMAIL = "klantenservice@devoordeelmarkt.nl";

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
