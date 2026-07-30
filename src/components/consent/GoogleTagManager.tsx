import Script from "next/script";

/**
 * Google Tag Manager, met Consent Mode ervoor.
 *
 * Laadt alleen als `NEXT_PUBLIC_GTM_ID` is gezet, dus zonder configuratie
 * staat er niets in de pagina en gaat er ook niets naar Google.
 *
 * ⚠️ GTM wordt bewust wél geladen zodra het id er is, ook als de bezoeker nog
 * niets heeft gekozen of "alleen noodzakelijk" heeft geklikt.
 *
 * Dat lijkt tegenstrijdig, maar het is precies waar Consent Mode voor bestaat:
 * de standen staan op "denied" voordat GTM start (zie ConsentMode, dat draait
 * op `beforeInteractive`), en in die stand zet Google géén cookies en stuurt
 * het alleen een cookieloos signaal. Zou je GTM helemaal blokkeren, dan mis je
 * die signalen én de modellering die Google daarop baseert, terwijl je
 * juridisch niets wint — er wordt in beide gevallen niets opgeslagen.
 *
 * Wat hier níét mag gebeuren: het id hardcoderen of de tag vóór ConsentMode
 * zetten. In beide gevallen meet Google één keer voordat de toestemming
 * bekend is, en dat is precies wat een controle je aanrekent.
 */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export function GoogleTagManager() {
  if (!GTM_ID) return null;
  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}

/**
 * De noscript-variant hoort direct na de openende <body>. Zonder JavaScript
 * werkt Consent Mode niet, dus laten we die bewust weg: meten zonder dat de
 * toestemming kan worden vastgelegd is precies wat we niet willen.
 *
 * Deze export staat er zodat duidelijk is dat het een keuze is en geen
 * vergeetachtigheid.
 */
export const GTM_NOSCRIPT_BEWUST_WEGGELATEN = true;
