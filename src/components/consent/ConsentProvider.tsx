"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  googleSignalen,
  leesConsent,
  type ConsentKeuze,
} from "@/lib/consent";

interface ConsentWaarde {
  /** `null` zolang de bezoeker nog niet gekozen heeft. */
  keuze: ConsentKeuze | null;
  kies: (keuze: ConsentKeuze) => void;
  /** Mag er iets van een derde partij geladen worden? */
  magDerden: boolean;
}

const Context = createContext<ConsentWaarde>({
  keuze: null,
  kies: () => undefined,
  magDerden: false,
});

export function useConsent(): ConsentWaarde {
  return useContext(Context);
}

function huidigeCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((deel) => deel.startsWith(`${CONSENT_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [keuze, setKeuze] = useState<ConsentKeuze | null>(null);

  // De cookie pas ná de eerste render lezen: op de server bestaat `document`
  // niet, en de banner mag geen verschil geven tussen server en browser.
  useEffect(() => {
    const stand = leesConsent(huidigeCookie());
    setKeuze(stand?.keuze ?? null);
    if (!stand) return;

    /*
     * Bij élke paginalading opnieuw doorgeven, niet alleen bij het klikken.
     *
     * Hier zat een gat dat Google Ads zijn conversies kostte. De update ging
     * alleen af in `kies()`, dus precies één keer: op het moment dat de
     * bezoeker op "Accepteren" drukte. Elk bezoek daarna was de banner weg,
     * kwam er geen update meer, en bleef Google hangen op de standaardstand
     * uit de pagina — geweigerd.
     *
     * Gemeten op de live site (4 augustus 2026): cookie
     * {"keuze":"alles"}, en tegelijk ad_storage, ad_user_data,
     * ad_personalization en analytics_storage alle vier op false. Geen
     * advertentiecookie, dus geen attributie, dus nul conversies in een
     * account dat wel klikken betaalt.
     *
     * De standaardstand in de HTML blijft staan (die moet vóór elke tag), maar
     * die kan bij een gecachte pagina van een andere bezoeker komen. Deze
     * regel is de enige die zeker weet wat déze bezoeker heeft gekozen.
     */
    const venster = window as unknown as { gtag?: (...args: unknown[]) => void };
    venster.gtag?.("consent", "update", googleSignalen(stand.keuze));
  }, []);

  const kies = useCallback((nieuw: ConsentKeuze) => {
    const stand = { keuze: nieuw, op: new Date().toISOString() };
    document.cookie = [
      `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(stand))}`,
      "Path=/",
      `Max-Age=${CONSENT_MAX_AGE}`,
      "SameSite=Lax",
      location.protocol === "https:" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
    setKeuze(nieuw);

    // Google bijwerken als er een tag draait. Staat die er niet, dan gebeurt
    // hier niets — en dat is precies de bedoeling: de toestemming ligt vast
    // voordat er ooit iets meet.
    const venster = window as unknown as { gtag?: (...args: unknown[]) => void };
    venster.gtag?.("consent", "update", googleSignalen(nieuw));
  }, []);

  return (
    <Context.Provider value={{ keuze, kies, magDerden: keuze === "alles" }}>
      {children}
    </Context.Provider>
  );
}
