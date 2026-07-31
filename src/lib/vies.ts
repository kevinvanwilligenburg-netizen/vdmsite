import { isKvEnabled, kvGetRaw, kvSetEx } from "@/lib/kv";
import { btwFormaatGeldig, normaliseerBtw } from "@/lib/zakelijk";

/**
 * BTW-nummercontrole via VIES, het officiële EU-register. Alleen voor
 * server-code: dit bestand cachet in Redis en hoort dus nooit in een client
 * component — de zuivere formaatregels staan daarom in lib/zakelijk.ts.
 *
 * De Profpas geeft direct korting, en het enige dat een bedrijf van een
 * koopjesjager onderscheidt is een BTW-nummer dat écht bestaat. Formaat
 * controleren is niet genoeg — NL123456789B01 ziet er keurig uit en bestaat
 * niet — dus we vragen het VIES zelf.
 *
 * VIES is geregeld traag of tijdelijk stuk ("MS_UNAVAILABLE"). Daarom drie
 * uitkomsten in plaats van twee: geldig, ongeldig en onbeslist. Onbeslist
 * betekent nooit korting — anders is elke storing bij de EU een gratis
 * kortingsdag bij ons.
 */

export type ViesUitkomst = {
  status: "geldig" | "ongeldig" | "onbeslist";
  /** Bedrijfsnaam volgens het register, als VIES die meegeeft. */
  naam?: string;
};

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";

export async function controleerBtw(ruw: string): Promise<ViesUitkomst> {
  const btw = normaliseerBtw(ruw);
  if (!btwFormaatGeldig(btw)) return { status: "ongeldig" };

  // Cache: een geldig nummer blijft een week geldig genoeg, een ongeldig
  // nummer een dag. VIES vraagt zelf om spaarzaam bevragen.
  const cacheSleutel = `vies:${btw}`;
  if (isKvEnabled()) {
    const bekend = await kvGetRaw(cacheSleutel);
    if (bekend) {
      const [status, ...naam] = bekend.split("|");
      if (status === "geldig" || status === "ongeldig") {
        return { status, ...(naam.length ? { naam: naam.join("|") } : {}) };
      }
    }
  }

  try {
    const res = await fetch(VIES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode: btw.slice(0, 2),
        vatNumber: btw.slice(2),
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { status: "onbeslist" };
    const data = (await res.json()) as {
      valid?: boolean;
      name?: string;
      userError?: string;
    };
    // VALID/INVALID zijn echte antwoorden; al het andere (MS_UNAVAILABLE,
    // rate limit) is geen oordeel over het nummer.
    if (data.userError && !["VALID", "INVALID"].includes(data.userError)) {
      return { status: "onbeslist" };
    }
    const status = data.valid === true ? "geldig" : "ongeldig";
    const naam = (data.name ?? "").trim().replace(/^-+$/, "");
    if (isKvEnabled()) {
      await kvSetEx(
        cacheSleutel,
        naam ? `${status}|${naam}` : status,
        status === "geldig" ? 7 * 24 * 3600 : 24 * 3600,
      );
    }
    return { status, ...(naam ? { naam } : {}) };
  } catch {
    return { status: "onbeslist" };
  }
}
