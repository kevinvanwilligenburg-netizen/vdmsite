import type { Metadata, Viewport } from "next";
import { Mulish } from "next/font/google";
import type { ReactNode } from "react";

import { CartProvider } from "@/components/cart/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { StoreProvider } from "@/components/store/StoreProvider";
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

const mulish = Mulish({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mulish",
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
  themeColor: "#F5821F",
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

  return (
    <html lang="nl" className={mulish.variable}>
      <body>
        <JsonLd data={organizationJsonLd(rating)} />
        <JsonLd data={websiteJsonLd} />
        <a
          href="#hoofdinhoud"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:font-bold focus:text-white"
        >
          Direct naar de inhoud
        </a>
        <StoreProvider stores={storeOptions}>
          <CartProvider>
            <Header />
            <main id="hoofdinhoud" className="container-page py-6 sm:py-8">
              {children}
            </main>
            <Footer />
          </CartProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
