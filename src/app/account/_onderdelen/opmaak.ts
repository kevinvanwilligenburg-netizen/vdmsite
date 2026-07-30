import type { OrderPaymentStatus } from "@/lib/types";

/**
 * Statussen in gewone taal.
 *
 * "authorized" en "paid" zijn voor ons twee dingen, voor de klant één: het
 * geld is geregeld. Dat verschil hoort niet op zijn scherm.
 */
const STATUS_TEKST: Record<string, string> = {
  paid: "Betaald",
  authorized: "Betaald",
  shipped: "Verzonden",
  delivered: "Bezorgd",
  open: "Wacht op betaling",
  pending: "Wacht op betaling",
  canceled: "Geannuleerd",
  failed: "Betaling mislukt",
  expired: "Verlopen",
  refunded: "Terugbetaald",
};

export function statusTekst(status: OrderPaymentStatus | string): string {
  return STATUS_TEKST[status] ?? status;
}

export function datumLang(waarde: string): string {
  const datum = new Date(waarde);
  if (Number.isNaN(datum.getTime())) return waarde;
  return datum.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
