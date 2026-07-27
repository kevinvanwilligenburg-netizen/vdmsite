"use client";

import Script from "next/script";
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

  useEffect(() => {
    const tp = (window as unknown as { Trustpilot?: { loadFromElement: (el: HTMLElement, b: boolean) => void } })
      .Trustpilot;
    if (tp && ref.current) tp.loadFromElement(ref.current, true);
  }, []);

  if (!TRUSTPILOT_BUSINESS_UNIT_ID) return null;

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
      >
        <a href={trustpilotProfileUrl()} target="_blank" rel="noopener noreferrer">
          Lees onze reviews op Trustpilot ({TRUSTPILOT_DOMAIN})
        </a>
      </div>
    </>
  );
}
