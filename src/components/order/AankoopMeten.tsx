"use client";

import { useEffect, useRef } from "react";

import { volgAankoop, type AnalyticsItem } from "@/lib/analytics";

/**
 * Meldt de aankoop één keer aan de dataLayer, op de bedankpagina.
 *
 * Dit is de gebeurtenis waar de Google Ads-conversietags, de GA4-omzet en de
 * Meta-purchase op hangen. Zonder deze push biedt Ads op campagnes zonder
 * terugkoppeling — precies de situatie sinds de omzetting.
 *
 * Twee vormen van dubbeltelling afgevangen:
 *
 * 1. Binnen dezelfde pagina: React draait effects in ontwikkelmodus twee keer,
 *    en de statuspolling hertekent deze pagina regelmatig. De ref houdt het bij
 *    één keer.
 * 2. Over herlaadbeurten heen: een klant die de bedankpagina bookmarkt of
 *    ververst, mag niet elke keer een conversie opleveren. Het bestelnummer
 *    gaat in sessionStorage, en Google en Meta ontdubbelen zelf nog eens op
 *    `transaction_id`.
 *
 * Alleen aanroepen als de betaling echt binnen is; een openstaande bestelling
 * is geen omzet.
 */
export function AankoopMeten({
  bestelnummer,
  waarde,
  verzendkosten,
  items,
}: {
  bestelnummer: string;
  waarde: number;
  verzendkosten: number;
  items: AnalyticsItem[];
}) {
  const gemeld = useRef(false);

  useEffect(() => {
    if (gemeld.current) return;
    gemeld.current = true;

    const sleutel = `aankoop-gemeten:${bestelnummer}`;
    try {
      if (window.sessionStorage.getItem(sleutel)) return;
      window.sessionStorage.setItem(sleutel, "1");
    } catch {
      // Geen sessieopslag (privémodus): dan vertrouwen we op de ontdubbeling
      // van Google en Meta op transaction_id. Liever één keer te veel gemeten
      // dan een aankoop die nergens terechtkomt.
    }

    volgAankoop({ bestelnummer, waarde, verzendkosten, items });

    /*
     * En melden dat deze winkelwagen niet verlaten is.
     *
     * Zonder dit krijgt iemand die net heeft afgerekend alsnog een mail dat
     * zijn winkelwagen klaarstaat — het irritantste bericht dat je een
     * betalende klant kunt sturen.
     *
     * Pas hier, en niet bij het doorsturen naar Mollie: wie daar afhaakt is
     * juist wél een verlaten wagen, en dat is de klant die zo'n herinnering
     * moet krijgen. Dit draait alleen op een betaalde bestelling.
     *
     * Daarna het kenmerk weggooien, zodat een volgende wagen een eigen lead
     * wordt in plaats van deze afgeronde te overschrijven.
     */
    try {
      const leadId = window.localStorage.getItem("vdm-lead");
      if (leadId) {
        window.localStorage.removeItem("vdm-lead");
        void fetch("/api/winkelwagen/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", id: leadId }),
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      // Geen opslag beschikbaar: dan is er ook nooit een lead aangemaakt.
    }
  }, [bestelnummer, waarde, verzendkosten, items]);

  return null;
}
