import { NextResponse } from "next/server";

/**
 * Een kleurvlak als afbeelding, voor voorgemengde blikken.
 *
 * Een blik Histor Hoornwit heeft in de webshop één foto: het blik. Daar zie
 * je de kleur niet op, terwijl dat nu juist is waarvoor de klant komt. Deze
 * route tekent er een tweede afbeelding bij — het kleurvlak met code en naam
 * — die zowel in de fotogalerij als in de Google Shopping-feed kan staan
 * (`g:additional_image_link` vraagt om een echte URL, geen div).
 *
 * SVG en geen PNG: het is een vlak met wat tekst, dus een paar honderd bytes
 * in plaats van tientallen kilobytes, en scherp op elk scherm. Geen externe
 * lettertypen — die laadt een feedcrawler toch niet.
 *
 * Parameters: ?hex=#EAE6CA&code=6763&naam=Hoornwit
 */
export const runtime = "edge";

const HEX = /^#?([0-9a-f]{6})$/i;

/** Zwarte of witte tekst, afhankelijk van hoe donker het vlak is. */
function leesbareTekstkleur(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Wegingen uit de WCAG-formule voor relatieve helderheid.
  const helderheid = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return helderheid > 0.6 ? "#141414" : "#ffffff";
}

function schoon(waarde: string | null, max: number): string {
  return (waarde ?? "")
    .replace(/[<>&"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const match = (url.searchParams.get("hex") ?? "").match(HEX);
  if (!match) {
    return NextResponse.json({ error: "Geef een geldige hex mee." }, { status: 400 });
  }

  const hex = `#${match[1].toUpperCase()}`;
  const tekstkleur = leesbareTekstkleur(match[1]);
  const code = schoon(url.searchParams.get("code"), 24);
  const naam = schoon(url.searchParams.get("naam"), 40);

  // Vierkant, zoals de productfoto's; de rand voorkomt dat een wit vlak op
  // een witte pagina onzichtbaar wordt.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900" role="img" aria-label="Kleurvoorbeeld ${naam || code || hex}">
  <rect width="900" height="900" fill="${hex}"/>
  <rect x="1" y="1" width="898" height="898" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="2"/>
  <g fill="${tekstkleur}" font-family="'Roboto Condensed',Arial,Helvetica,sans-serif" text-anchor="middle">
    ${code ? `<text x="450" y="742" font-size="52" font-weight="700">${code}</text>` : ""}
    ${naam ? `<text x="450" y="806" font-size="40">${naam}</text>` : ""}
    <text x="450" y="860" font-size="26" opacity="0.7">Kleur op je scherm is een indicatie</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Een kleur verandert niet; een jaar cachen scheelt de feedcrawler werk.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
