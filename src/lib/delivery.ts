/**
 * Bezorgklok (DHL) — puur, testbaar en client-veilig.
 *
 * Regels van de eigenaar (gedeeld voor beide shops):
 *  - Besteld vóór 10:00       → SAME-DAY: vandaag nog bezorgd.
 *  - Besteld 10:00 – 23:59    → NEXT-DAY: morgen bezorgd.
 *
 * De functie werkt met een meegegeven `now` (default `new Date()`) zodat 'ie
 * deterministisch te testen is. Alle berekeningen in lokale tijd (NL-publiek).
 *
 * Labels/track & trace komen centraal uit het VDM-dashboard; deze module
 * bepaalt alleen de belofte richting de klant. Zon-/feestdagregels zijn nog
 * niet gespecificeerd door de eigenaar (TODO zodra bekend).
 */

export const SAME_DAY_CUTOFF_HOUR = 10;

export type DeliveryType = "same-day" | "next-day";

export interface DeliveryInfo {
  type: DeliveryType;
  /** De (lokale) bezorgdatum, genormaliseerd op middernacht. */
  deliveryDate: Date;
  /** Milliseconden tot de 10:00-cutoff; 0 zodra die voorbij is. */
  msUntilCutoff: number;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Bereken de bezorgbelofte voor een bestelling geplaatst op `now`. */
export function deliveryInfo(now: Date = new Date()): DeliveryInfo {
  const sameDay = now.getHours() < SAME_DAY_CUTOFF_HOUR;
  const deliveryDate = sameDay ? startOfDay(now) : addDays(startOfDay(now), 1);

  let msUntilCutoff = 0;
  if (sameDay) {
    const cutoff = startOfDay(now);
    cutoff.setHours(SAME_DAY_CUTOFF_HOUR, 0, 0, 0);
    msUntilCutoff = Math.max(0, cutoff.getTime() - now.getTime());
  }

  return {
    type: sameDay ? "same-day" : "next-day",
    deliveryDate,
    msUntilCutoff,
  };
}

/** Korte NL-tekst voor de belofte, bv. "Vandaag bezorgd" / "Morgen bezorgd". */
export function deliveryLabel(info: DeliveryInfo): string {
  return info.type === "same-day" ? "Vandaag bezorgd" : "Morgen bezorgd";
}
