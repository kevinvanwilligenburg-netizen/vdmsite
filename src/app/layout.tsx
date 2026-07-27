import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CartProvider } from "@/components/cart/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Bij De Voordeelmarkt klus je voor weinig: verf op elke RAL-kleur gemengd, gereedschap en alles voor huis & tuin. Online bestellen en gratis afhalen in de winkel.",
  keywords: [
    "voordeelmarkt",
    "klussen",
    "verf",
    "mengverf",
    "RAL kleuren",
    "gereedschap",
    "bouwmarkt",
    "afhalen in de winkel",
  ],
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: SITE_NAME,
    title: `${SITE_NAME} – ${SITE_TAGLINE}`,
    description:
      "Verf op kleur, gereedschap en alles voor huis & tuin voor de laagste prijs. Online bestellen, gratis afhalen in de winkel.",
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl("/icon.svg"),
};

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={websiteJsonLd} />
        <CartProvider>
          <Header />
          <main className="container-page py-8">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
