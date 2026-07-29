import { NextResponse } from "next/server";

import { isKvEnabled } from "@/lib/kv";
import { meldAan } from "@/lib/voorraadmelding";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Aanmelden voor bericht zodra een artikel weer op voorraad is.
 *
 * Het antwoord is altijd hetzelfde, of het adres nu klopt of niet en of het al
 * op de lijst stond of niet. Wie hier adressen zou willen aftasten, leert er
 * dus niets uit.
 */
export async function POST(request: Request) {
  if (!isKvEnabled()) {
    return NextResponse.json(
      { error: "Aanmelden kan nu even niet. Probeer het later opnieuw." },
      { status: 503 },
    );
  }

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

  await meldAan(sku, {
    email,
    op: new Date().toISOString(),
    productSlug: slug,
    productNaam: naam.slice(0, 160) || slug,
  });

  return NextResponse.json({ ok: true });
}
