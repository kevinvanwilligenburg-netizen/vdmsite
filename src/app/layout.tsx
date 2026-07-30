import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Roboto_Condensed } from "next/font/google";
import type { ReactNode } from "react";

import { AddedToCart } from "@/components/cart/AddedToCart";
import { CartProvider } from "@/components/cart/CartProvider";
import { ConsentMode } from "@/components/consent/ConsentMode";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { GoogleTagManager } from "@/components/consent/GoogleTagManager";
import { Footer } from "@/components/Footer";
import { PrijsProvider } from "@/components/prijs/PrijsWeergave";
import { PRIJS_COOKIE, prijsModusUit } from "@/lib/prijs";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { StoreProvider } from "@/components/store/StoreProvider";
import { WhatsAppKnop } from "@/components/WhatsAppKnop";
import { CONSENT_COOKIE } from "@/lib/consent";
import { getStores } from "@/lib/tilroy";
import {
  absoluteUrl,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";
import {
  aggregateRatingJsonLd,
  getTrustpilotRating,
  trustpilotEnabled,
  trustpilotProfileUrl,
} from "@/lib/trustpilot";

import "./globals.css";

/**
 * Roboto Condensed staat als lopende tekst in de huisstijlgids. Muller Black
 * is daar het letterype voor koppen, maar dat is commercieel en zit niet bij
 * Google Fonts; zolang we de webfont-licentie niet hebben, zetten we de koppen
 * in dezelfde familie op het zwaarste gewicht.
 */
const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700", "900"],
  variable: "--font-vdm",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "De beste verf voor de laagste prijs. Mengverf in elke RAL-kleur, gereedschap en alles om te klussen. Online bestellen en gratis afhalen in Nijverdal, Apeldoorn, Deventer, Zutphen of Emmen.",
  keywords: [
    "voordeelmarkt",
    "verf",
    "mengverf",
    "RAL kleuren",
    "muurverf",
    "lak",
    "verfdiscounter",
    "gereedschap",
    "klussen",
    "afhalen in de winkel",
  ],
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: SITE_NAME,
    title: `${SITE_NAME} – ${SITE_TAGLINE}`,
    description:
      "Mengverf in elke RAL-kleur, gereedschap en alles om te klussen voor de laagste prijs. Online bestellen, gratis afhalen in de winkel.",
    url: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: true, address: false, email: false },
  applicationName: SITE_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FF8200",
};

function organizationJsonLd(rating: ReturnType<typeof aggregateRatingJsonLd>) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    ...(trustpilotEnabled() ? { sameAs: [trustpilotProfileUrl()] } : {}),
    // Alleen echte Trustpilot-cijfers; nooit een verzonnen rating.
    ...(rating ? { aggregateRating: rating } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: CONTACT_PHONE.replace(/\s/g, ""),
      email: CONTACT_EMAIL,
      contactType: "customer service",
      availableLanguage: "Dutch",
    },
  };
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/zoeken?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [rating, stores] = await Promise.all([
    getTrustpilotRating().then(aggregateRatingJsonLd),
    getStores(),
  ]);
  const storeOptions = stores.map((store) => ({
    slug: store.slug,
    city: store.city,
    address: store.address,
    name: store.name,
  }));

  const consentCookie = cookies().get(CONSENT_COOKIE)?.value;
  // Inclusief of exclusief btw; server-side gelezen zodat de prijzen meteen
  // goed staan en niet eerst omslaan.
  const prijsModus = prijsModusUit(cookies().get(PRIJS_COOKIE)?.value);

  return (
    <html lang="nl" className={robotoCondensed.variable}>
      <head>
        {/* Moet vóór elke Google-tag staan; zie ConsentMode. */}
        <ConsentMode cookieWaarde={consentCookie} />
      </head>
      <body>
        {/*
          Tag Manager staat UIT op verzoek van Kevin (30 juli 2026): het script
          botste met een ander script op de huidige site. De container bestaat
          wel (GTM-MSHWXMG5) en NEXT_PUBLIC_GTM_ID staat in Vercel, dus dit
          weer aanzetten is één regel terugzetten — de Consent Mode eronder
          blijft gewoon staan en zet de standen alvast goed.

          Zoek eerst uit wélk script botste voordat je 'm terugzet; anders
          komt hetzelfde probleem terug op het moment dat er echt gemeten
          wordt.
        */}
        {/* <GoogleTagManager /> */}
        <JsonLd data={organizationJsonLd(rating)} />
        <JsonLd data={websiteJsonLd} />
        <a
          href="#hoofdinhoud"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:font-bold focus:text-white"
        >
          Direct naar de inhoud
        </a>
        <ConsentProvider>
        <PrijsProvider start={prijsModus}>
        <StoreProvider stores={storeOptions}>
          <CartProvider>
            <Header />
            <main id="hoofdinhoud" className="container-page py-6 sm:py-8">
              {children}
            </main>
            <Footer />
            {/* Bevestiging na "in winkelwagen", met wat erbij hoort. */}
            <AddedToCart />
            {/* Vragen stellen zoals klanten dat zelf het liefst doen. */}
            <WhatsAppKnop />
          </CartProvider>
        </StoreProvider>
        <CookieBanner />
        </PrijsProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
