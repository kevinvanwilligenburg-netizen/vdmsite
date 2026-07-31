import { DASHBOARD_API_URL, WHATSAPP_NUMMER } from "@/lib/site";

/**
 * Het WhatsApp-nummer, met het dashboard als bron.
 *
 * Kevin beheert het nummer in het portal (waar het voor Klus=r ook staat);
 * de site hoort mee te veranderen zonder deploy. Zolang het dashboard het
 * endpoint nog niet heeft — of even niet bereikbaar is — valt dit terug op
 * de omgevingsvariabele, en gedraagt de site zich zoals voorheen.
 */
export async function getWhatsappNummer(): Promise<string> {
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/instellingen`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { whatsapp?: string };
      const nummer = (data.whatsapp ?? "").replace(/[^\d]/g, "");
      if (nummer.length >= 10) return nummer;
    }
  } catch {
    // stil terugvallen; het nummer uit de omgeving is dan de waarheid
  }
  return WHATSAPP_NUMMER;
}
