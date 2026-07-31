"use client";

import Script from "next/script";
import { useConsent } from "@/components/consent/ConsentProvider";
import { useEffect, useRef } from "react";

import {
  TRUSTPILOT_BUSINESS_UNIT_ID,
  TRUSTPILOT_DOMAIN,
  trustpilotProfileUrl,
} from "@/lib/trustpilot";

type WidgetVariant = "micro" | "horizontal" | "carousel";

/** Officiële TrustBox-templates van Trustpilot. */
const TEMPLATES: Record<WidgetVariant, { id: string; height: string }> = {
  micro: { id: "5419b6ffb0d04a076446a9af", height: "20px" },
  horizontal: { id: "5406e65db0d04a09e042d5fc", height: "28px" },
  carousel: { id: "53aa8912dec7e10d38f59f36", height: "140px" },
};

/**
 * Trustpilot TrustBox. De data komt rechtstreeks van Trustpilot, dus wat hier
 * staat zijn altijd echte reviews. Zonder business unit-id rendert er niets,
 * zodat de site zonder configuratie geen lege widget toont.
 */
export function TrustpilotWidget({
  variant = "horizontal",
  className,
}: {
  variant?: WidgetVariant;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Trustpilot is een derde partij die eigen cookies zet. Zonder toestemming
  // laden we het script niet; dat is de enige externe partij op deze site.
  const { magDerden } = useConsent();

  useEffect(() => {
    if (!magDerden) return;
    const tp = (window as unknown as { Trustpilot?: { loadFromElement: (el: HTMLElement, b: boolean) => void } })
      .Trustpilot;
    if (tp && ref.current) tp.loadFromElement(ref.current, true);
  }, [magDerden]);

  if (!TRUSTPILOT_BUSINESS_UNIT_ID || !magDerden) return null;

  const template = TEMPLATES[variant];

  return (
    <>
      <Script
        src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="lazyOnload"
      />
      <div
        ref={ref}
        className={`trustpilot-widget ${className ?? ""}`}
        data-locale="nl-NL"
        data-template-id={template.id}
        data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT_ID}
        data-style-height={template.height}
        data-style-width="100%"
        data-theme="light"
        {...(variant === "carousel"
          ? {
              // Uit de embed-code van Kevins Trustpilot-beheer. Het token is
              // openbaar (staat in de HTML van elke site die de widget
              // voert). Sterrenfilter 3–5 is zijn keuze; de talen staan op
              // Nederlands in plaats van de en-US uit de gegenereerde
              // snippet — de klanten lezen Nederlands.
              "data-token": "ab003025-c9e0-4101-a2ca-689be0484882",
              "data-stars": "3,4,5",
              "data-review-languages": "nl",
            }
          : {})}
      >
        <a href={trustpilotProfileUrl()} target="_blank" rel="noopener noreferrer">
          Lees onze reviews op Trustpilot ({TRUSTPILOT_DOMAIN})
        </a>
      </div>
    </>
  );
}
