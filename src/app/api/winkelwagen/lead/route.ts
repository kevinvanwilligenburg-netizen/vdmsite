import { NextResponse } from "next/server";

import { DASHBOARD_API_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Verlaten winkelwagen: zodra de klant zijn e-mailadres invult (nog vóór de
 * betaalstap) geven we dat met de inhoud van het mandje door aan het
 * dashboard, dat er een herinneringsmail van maakt.
 *
 * Best-effort: lukt het doorgeven niet, dan mag dat de checkout nooit in de
 * weg zitten — we antwoorden dus altijd 200.
 */
export async function POST(request: Request) {
  let body: {
    email?: string;
    items?: { title?: string; quantity?: number; price?: number }[];
    total?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false });
  }

  const email = (body.email ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ ok: false });

  try {
    await fetch(`${DASHBOARD_API_URL}/api/cart/lead`, {
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
      body: JSON.stringify({
        shop: "vdmsite",
        email,
        items: (body.items ?? []).slice(0, 50),
        total: body.total ?? 0,
        at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (error) {
    console.error("[winkelwagen] lead doorgeven mislukt:", error);
  }

  return NextResponse.json({ ok: true });
}
