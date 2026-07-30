import Script from "next/script";

import { CONSENT_COOKIE, googleSignalen, leesConsent } from "@/lib/consent";

/**
 * Google Consent Mode v2: de standen zetten vóórdat er een tag draait.
 *
 * Dit script moet echt als eerste komen. Zet je de standen pas ná de
 * Google-tag, dan heeft die al één keer gemeten met de standaardinstelling —
 * en dat is precies waar Consent Mode voor bedoeld is om te voorkomen. Vandaar
 * `beforeInteractive` en niet `afterInteractive`.
 *
 * De keuze van de bezoeker lezen we hier op de server uit de cookie, zodat de
 * juiste stand al in de HTML staat en er geen moment is waarin het op
 * "toegestaan" staat.
 *
 * Er draait vandaag geen Google-tag op deze site. Dit staat er voor het moment
 * dat die er komt: dan is de toestemming al goed geregeld en hoeft er niets
 * haastig bijgebouwd te worden.
 */
export function ConsentMode({ cookieWaarde }: { cookieWaarde?: string }) {
  const keuze = leesConsent(cookieWaarde)?.keuze ?? "alleen-noodzakelijk";
  const standen = googleSignalen(keuze);

  return (
    <Script id="consent-mode" strategy="beforeInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = window.gtag || gtag;
        gtag('consent', 'default', ${JSON.stringify({ ...standen, wait_for_update: 500 })});
      `}
    </Script>
  );
}

export { CONSENT_COOKIE };
