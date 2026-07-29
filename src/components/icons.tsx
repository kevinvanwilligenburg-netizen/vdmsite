import type { ReactNode } from "react";

/**
 * Inline SVG-iconen (huisregel: geen emoji als UI-glyphs). Eén consistente
 * stroke-stijl, 24×24, kleurt mee via currentColor.
 */

const PATHS: Record<string, ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  "circle-check": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5.5" />
    </>
  ),
  "circle-x": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9.5 9.5 5 5m0-5-5 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 11h10L21 8H6.1" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z" />
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  chat: (
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.9L3 20.5l1.5-4.4A8.5 8.5 0 0 1 3.6 12a8.4 8.4 0 0 1 8.4-8.5h.5a8.4 8.4 0 0 1 8 8z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  truck: (
    <>
      <path d="M1 16V6a1 1 0 0 1 1-1h11v11H1z" />
      <path d="M13 9h4l3.5 3.5V16H13" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </>
  ),
  store: (
    <>
      <path d="m3 9 1.5-5h15L21 9M4 11v9h16v-9M9 20v-5h6v5" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a1 1 0 0 1 0 .8z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-.7-.3-1.1-.7-1.5-.4-.4-.7-.9-.7-1.5 0-1 .8-1.9 2-1.9h1.7c2.6 0 4.7-2 4.7-4.5C21 6.4 17 3 12 3z" />
      <circle cx="7" cy="12" r="1.1" />
      <circle cx="9" cy="7.8" r="1.1" />
      <circle cx="14" cy="6.8" r="1.1" />
    </>
  ),
  roller: (
    <>
      <rect x="3" y="4" width="13" height="5" rx="1.5" />
      <path d="M16 6.5h3.5a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H11v2.5" />
      <rect x="9.8" y="13.5" width="2.4" height="7" rx="1" />
    </>
  ),
  brush: (
    <>
      <path d="m20.7 6.3-3-3L9 12l-.9 3.9L12 15l8.7-8.7z" />
      <path d="M6.8 16.8c-1.9 0-3.3 1.4-3.3 4 2.9 0 4.2-1.6 4.2-3a1 1 0 0 0-.9-1z" />
    </>
  ),
  bucket: (
    <>
      <path d="M4 8.5h16L18.6 20a2 2 0 0 1-2 1.7H7.4a2 2 0 0 1-2-1.7L4 8.5z" />
      <path d="M7 8.5a5 5 0 0 1 10 0" />
    </>
  ),
  can: (
    <>
      <rect x="5" y="8" width="14" height="12" rx="2" />
      <path d="M5 10.5c2.2 1.2 11.8 1.2 14 0M9.5 8V5h5v3" />
    </>
  ),
  tape: (
    <>
      <circle cx="11" cy="11" r="7" />
      <circle cx="11" cy="11" r="2.5" />
      <path d="M17.5 14.5 21 18v2h-4" />
    </>
  ),
  drill: (
    <>
      <path d="M4 7h11a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-5l-1 6.5H6L7 12H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <path d="M17 9.5h4" />
    </>
  ),
  toolbox: (
    <>
      <rect x="3" y="10" width="18" height="9" rx="2" />
      <path d="M3 14.5h18M9 10V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M10 14.5v2m4-2v2" />
    </>
  ),
  level: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="1.5" />
      <circle cx="12" cy="12" r="1.7" />
      <path d="M6.5 9v6m11-6v6" />
    </>
  ),
  screw: (
    <>
      <circle cx="12" cy="5" r="2.8" />
      <path d="M12 7.8V21m-2.4-9.7 4.8-1.5m-4.8 5 4.8-1.5m-4.8 5 4.8-1.5" />
    </>
  ),
  ladder: <path d="M7 3v18M17 3v18M7 7.5h10M7 12h10M7 16.5h10" />,
  bulb: (
    <>
      <path d="M12 3a6 6 0 0 1 3.5 10.9c-.8.6-1.5 1.3-1.5 2.1h-4c0-.8-.7-1.5-1.5-2.1A6 6 0 0 1 12 3z" />
      <path d="M9.5 19h5M10.5 21.5h3" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v5m6-5v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8z" />
      <path d="M12 16.5V21" />
    </>
  ),
  hose: (
    <>
      <circle cx="11" cy="12" r="7" />
      <circle cx="11" cy="12" r="2.5" />
      <path d="M18 12h4m-2-1.5v3" />
    </>
  ),
  leaf: (
    <>
      <path d="M4.5 19.5C4.5 11 10 6 20 5c-.5 10-5.5 15-13 15-.9 0-1.7-.2-2.5-.5z" />
      <path d="M4.5 19.5C7 14 11 10 16 8" />
    </>
  ),
  hand: (
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-6.5v-1a1.5 1.5 0 0 1 3 0V12m0-5.5a1.5 1.5 0 0 1 3 0V13m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.2a7 7 0 0 1-5.9-3.2L3.5 14a1.6 1.6 0 0 1 2.6-1.8L8 14.5" />
  ),
  spray: (
    <>
      <path d="M8.5 21h6a1 1 0 0 0 1-1v-6.5l-2-3V8h-4v2.5l-2 3V20a1 1 0 0 0 1 1z" />
      <path d="M9.5 8V5.5h4.2M17.5 5h.01M20 7.5h.01M20 3h.01" />
    </>
  ),
  basket: (
    <>
      <path d="m5 11 2.2-7m11.8 7-2.2-7M3.5 11h17l-1.6 8.3a2 2 0 0 1-2 1.7H7.1a2 2 0 0 1-2-1.7L3.5 11z" />
      <path d="M9.2 14.5v3.5m2.8-3.5v3.5m2.8-3.5v3.5" />
    </>
  ),
  hanger: (
    <>
      <path d="M12 7a2 2 0 1 1 2-2c0 1-1 1.4-1.6 1.8-.3.2-.4.5-.4.9z" fill="none" />
      <path d="M12 7.7 3 14.5h18L12 7.7z" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8l-3.8 3.8z" />
  ),
  box: (
    <>
      <path d="m21 8-9-5-9 5v8l9 5 9-5V8z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
};

export type IconName = keyof typeof PATHS & string;

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 2,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name] ?? PATHS.box}
    </svg>
  );
}
