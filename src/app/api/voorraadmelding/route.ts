import { NextResponse } from "next/server";

import { isKvEnabled } from "@/lib/kv";
import { absoluteUrl, DASHBOARD_API_URL } from "@/lib/site";
import { meldAan } from "@/lib/voorraadmelding";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Doorgeven aan het dashboard, dat de wachtlijst sinds 4 augustus 2026 voor
 * beide shops bijhoudt.
 *
 * Waarom daarheen en niet meer bij ons: zij hebben hetzelfde gebouwd, inclusief
 * een overzicht waarop je ziet waar tien mensen op wachten. Dat is
 * inkoopinformatie die wij niet hebben, en een gemiste verkoop laat verder geen
 * spoor na. Twee lijsten naast elkaar zou betekenen dat dezelfde klant twee
 * keer bericht krijgt — en de tweede leest als "je bent te laat" precies op het
 * moment dat hij moet klikken.
 *
 * De sleutel blijft server-side: de browser praat met ons, wij met hen.
 * Lukt dat niet, dan zeggen we dat eerlijk in plaats van de aanmelding in een
 * lijst te zetten waar niemand meer naar kijkt.
 */
async function naarDashboard(payload: {
  sku: string;
  email: string;
  productNaam: string;
  url: string;
}): Promise<boolean | null> {
  const sleutel = process.env.SITE_API_KEY;
  if (!sleutel) return null;
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/voorraadmelding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sleutel}`,
      },
      body: JSON.stringify({ ...payload, site: "vdm" }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return true;
    console.error(
      `[voorraadmelding] dashboard gaf status ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
    return false;
  } catch (error) {
    console.error("[voorraadmelding] dashboard onbereikbaar:", error);
    return false;
  }
}

/**
 * Aanmelden voor bericht zodra een artikel weer op voorraad is.
 *
 * Het antwoord is altijd hetzelfde, of het adres nu klopt of niet en of het al
 * op de lijst stond of niet. Wie hier adressen zou willen aftasten, leert er
 * dus niets uit.
 */
export async function POST(request: Request) {
  let body: { sku?: string; email?: string; slug?: string; naam?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const sku = String(body.sku ?? "").trim();
  const email = String(body.email ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  const naam = String(body.naam ?? "").trim();

  if (!sku || sku.length > 64 || !slug) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }

  const productNaam = naam.slice(0, 160) || slug;
  const gelukt = await naarDashboard({
    sku,
    email,
    productNaam,
    url: absoluteUrl(`/product/${slug}`),
  });

  if (gelukt === true) return NextResponse.json({ ok: true });

  // Geen sleutel geconfigureerd (lokaal, of het dashboard doet nog niet mee):
  // dan houden we de lijst zelf bij, zoals hiervoor. Zodra SITE_API_KEY staat,
  // gaat alles naar het dashboard en blijft er maar één lijst over.
  if (gelukt === null && isKvEnabled()) {
    await meldAan(sku, {
      email,
      op: new Date().toISOString(),
      productSlug: slug,
      productNaam,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Aanmelden kan nu even niet. Probeer het later opnieuw." },
    { status: 503 },
  );
}
