import type { Store } from "@/lib/types";

/**
 * Afhaalbelofte: binnen 2 uur klaar, gratis.
 *
 * Die belofte kan alleen waargemaakt worden als de winkel open is én er nog
 * genoeg tijd rest voor sluitingstijd. Bestelt iemand 's avonds of op zondag,
 * dan beloven we niet "binnen 2 uur" maar het eerstvolgende moment dat de
 * winkel open is. Beter een eerlijke belofte dan een teleurgestelde klant aan
 * de balie.
 *
 * Puur en testbaar: `now` is injecteerbaar.
 */

export const PICKUP_READY_HOURS = 2;

export interface PickupPromise {
  /** Kan het vandaag nog, binnen twee uur? */
  today: boolean;
  /** Korte tekst voor de klant. */
  label: string;
  /** Uitleg eronder. */
  detail: string;
}

const DAY_NAMES = [
  "Zondag",
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
];

interface DayHours {
  opens: number; // in minuten na middernacht
  closes: number;
}

/** Lees "08:00 – 18:00" uit de openingstijden; null bij "Gesloten". */
function hoursFor(store: Store, dayIndex: number): DayHours | null {
  const entry = store.openingHours.find((row) => row.day === DAY_NAMES[dayIndex]);
  if (!entry || entry.hours.toLowerCase().includes("gesloten")) return null;
  const match = entry.hours.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    opens: Number(match[1]) * 60 + Number(match[2]),
    closes: Number(match[3]) * 60 + Number(match[4]),
  };
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Wanneer gaat deze winkel weer open? Kijkt maximaal een week vooruit. */
function nextOpening(store: Store, now: Date): { dayIndex: number; opens: number } | null {
  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 8; offset++) {
    const dayIndex = (today + offset) % 7;
    const hours = hoursFor(store, dayIndex);
    if (!hours) continue;
    // Vandaag telt alleen als de winkel nog moet opengaan.
    if (offset === 0 && nowMinutes >= hours.opens) continue;
    return { dayIndex, opens: hours.opens };
  }
  return null;
}

/** Bepaal de afhaalbelofte voor deze winkel op dit moment. */
export function pickupPromise(store: Store, now: Date = new Date()): PickupPromise {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = hoursFor(store, now.getDay());
  const readyAt = nowMinutes + PICKUP_READY_HOURS * 60;

  // Open én genoeg tijd voor sluitingstijd: dan halen we de twee uur.
  if (today && nowMinutes >= today.opens && readyAt <= today.closes) {
    return {
      today: true,
      label: `Vandaag klaar, rond ${formatMinutes(readyAt)}`,
      detail: `Binnen ${PICKUP_READY_HOURS} uur klaar om op te halen in ${store.city}. Je krijgt bericht met een afhaalcode.`,
    };
  }

  const opening = nextOpening(store, now);
  if (!opening) {
    return {
      today: false,
      label: "Klaar zodra de winkel open is",
      detail: `Je krijgt bericht met een afhaalcode zodra je bestelling in ${store.city} klaarstaat.`,
    };
  }

  const isTomorrow = opening.dayIndex === (now.getDay() + 1) % 7;
  const wanneer = isTomorrow ? "morgen" : DAY_NAMES[opening.dayIndex].toLowerCase();
  const klaarOm = formatMinutes(opening.opens + PICKUP_READY_HOURS * 60);

  /*
   * Eén tijd noemen, niet twee.
   *
   * Hier stond in de kop "morgen klaar, rond 10:00" en er direct onder "we
   * zetten je bestelling morgen vanaf 08:00 klaar". Allebei waar — om 08:00
   * gaat de winkel open en dán beginnen we — maar de klant leest twee
   * beloftes die elkaar tegenspreken en weet niet wanneer hij moet komen.
   * De openingstijd staat er nu als toelichting, niet als tweede belofte.
   */
  const openTijd = formatMinutes(opening.opens);
  return {
    today: false,
    label: `${wanneer.charAt(0).toUpperCase() + wanneer.slice(1)} klaar, rond ${klaarOm}`,
    detail:
      today && nowMinutes >= today.closes
        ? `De winkel in ${store.city} is voor vandaag gesloten. Hij gaat ${wanneer} om ${openTijd} open, en je bestelling staat rond ${klaarOm} voor je klaar.`
        : `De winkel in ${store.city} gaat ${wanneer} om ${openTijd} open; binnen ${PICKUP_READY_HOURS} uur daarna staat je bestelling klaar.`,
  };
}

/** Is de winkel op dit moment open? */
export function isOpenNow(store: Store, now: Date = new Date()): boolean {
  const hours = hoursFor(store, now.getDay());
  if (!hours) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= hours.opens && minutes < hours.closes;
}
