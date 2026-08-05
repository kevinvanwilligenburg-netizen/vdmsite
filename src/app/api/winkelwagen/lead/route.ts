import { NextResponse } from "next/server";

import { euros } from "@/lib/format";
import { absoluteUrl, DASHBOARD_API_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Verlaten winkelwagen: zodra de klant zijn e-mailadres invult (nog vóór de
 * betaalstap) geven we dat met de inhoud van het mandje door aan het
 * dashboard, dat er een herinneringsmail van maakt.
 *
 * ⚠️ De veldnamen zijn die van het dashboard, niet die van ons. Wij stuurden
 * hier `title` / `quantity` / `price` / `total`, en hun opruimstap gooit elk
 * item zonder `naam` weg — een lead zonder regels wordt niet gemaild. Alles
 * wat hier langskwam viel dus stil in het niets, zonder foutmelding. Vandaar
 * de vertaling hieronder: `naam`, `aantal`, `prijs`, `totaal`, met bedragen
 * als tekst ("€ 10,40") en niet als getal.
 *
 * `id` is verplicht en is de sleutel voor ontdubbeling: hetzelfde id ververst
 * de bestaande lead, een ander id met hetzelfde adres levert twee leads op.
 * Het komt van de browser en blijft daar staan tot de bestelling rond is.
 *
 * Best-effort: lukt het doorgeven niet, dan mag dat de checkout nooit in de
 * weg zitten — we antwoorden dus altijd 200.
 */

interface LeadItem {
  naam: string;
  aantal: string;
  prijs: string;
  variant?: string;
}

async function naarDashboard(payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/cart/lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Het dashboard accepteert deze sleutel sinds 29 juli 2026 en gaat
        // hem binnenkort eisen. Zonder sleutel geldt daar een limiet per IP —
        // dit endpoint stond eerst helemaal open.
        ...(process.env.SITE_API_KEY
          ? { Authorization: `Bearer ${process.env.SITE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    /*
     * De statuscode wél bekijken.
     *
     * Hier stond alleen een try/catch, en die vangt netwerkfouten — geen 400.
     * Een afgekeurde lead verdween dus geruisloos: onze route antwoordt de
     * browser altijd 200 (terecht, een checkout mag hier nooit op stuklopen),
     * dus er was letterlijk nergens iets te zien. Precies zo bleef maandenlang
     * onopgemerkt dat we de verkeerde veldnamen stuurden.
     *
     * De Klus=r-kant wees hierop nadat ze het endpoint zelf hadden getoetst.
     * Terechte vondst: wat je verstuurt is niet hetzelfde als wat aankomt.
     */
    if (!res.ok) {
      console.error(
        `[winkelwagen] dashboard weigerde de lead met status ${res.status}: ${(
          await res.text()
        ).slice(0, 300)}`,
      );
    }
  } catch (error) {
    console.error("[winkelwagen] lead doorgeven mislukt:", error);
  }
}

export async function POST(request: Request) {
  let body: {
    id?: string;
    action?: string;
    email?: string;
    items?: { title?: string; quantity?: number; price?: number; variant?: string }[];
    total?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false });
  }

  const id = (body.id ?? "").trim().slice(0, 100);
  if (!id) return NextResponse.json({ ok: false });

  /*
   * De bestelling is rond: melden dat deze wagen niet verlaten is.
   *
   * Zonder dit krijgt iemand die gewoon heeft afgerekend alsnog een mailtje
   * dat zijn winkelwagen klaarstaat — het irritantste bericht dat je een
   * klant kunt sturen die net betaald heeft.
   */
  if (body.action === "complete") {
    await naarDashboard({ action: "complete", id });
    return NextResponse.json({ ok: true });
  }

  const email = (body.email ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ ok: false });

  const items: LeadItem[] = (body.items ?? [])
    .slice(0, 50)
    .map((item) => ({
      naam: (item.title ?? "").trim(),
      aantal: String(Math.max(1, Math.floor(Number(item.quantity) || 1))),
      prijs: euros(Number(item.price) || 0),
      ...(item.variant ? { variant: String(item.variant).slice(0, 120) } : {}),
    }))
    // Een regel zonder naam wordt daar toch weggegooid; dan kan hij hier al weg.
    .filter((item) => item.naam.length > 0);

  await naarDashboard({
    id,
    // Het dashboard splitst de rapportage per webshop op `site`. `shop` gaat
    // mee omdat het daar in oudere gegevens ook zo staat.
    shop: "vdmsite",
    site: "vdm",
    email,
    items,
    totaal: euros(Number(body.total) || 0),
    checkoutUrl: absoluteUrl("/afrekenen"),
  });

  return NextResponse.json({ ok: true });
}
