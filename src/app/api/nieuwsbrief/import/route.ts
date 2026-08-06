import { NextResponse } from "next/server";

import { isKvEnabled, kvGetJSON, kvSetJSON } from "@/lib/kv";
import { normaliseerEmail } from "@/lib/account";
import { TOESTEMMINGSTEKST, type Aanmelding } from "@/lib/nieuwsbrief";

export const dynamic = "force-dynamic";

const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Eén keer een hele lijst posten kan; in stukken van vijfhonderd is prettiger. */
const MAX_PER_AANROEP = 1000;

/**
 * Het toestemmingsdossier van de overgezette Mailchimp-inschrijvers.
 *
 * Het dashboard zet de contacten in Resend — dat is de verzendkant. Deze route
 * legt de andere helft vast: wannéér iemand oorspronkelijk toestemming gaf.
 *
 * ⚠️ Zonder dit stuk is de import onvolledig op de manier die pas pijn doet
 * als het misgaat. Bij een klacht moet je kunnen laten zien wanneer iemand
 * zich aanmeldde. Zetten we alleen het adres in Resend, dan begint die
 * geschiedenis vandaag opnieuw en staat er bij een klacht uit 2024 niets
 * tegenover.
 *
 * Daarom nemen we `timestamp_opt` uit Mailchimp letterlijk over als
 * `aangemeldOp`, en noteren we de bron als "mailchimp" zodat later te zien is
 * dat die toestemming daar vandaan komt en niet van ons formulier.
 *
 *   POST /api/nieuwsbrief/import
 *   Authorization: Bearer <SITE_API_KEY of CRON_SECRET>
 *   { "leden": [{ "email": "...", "timestampOpt": "2024-03-11T09:12:00Z" }] }
 *
 * Idempotent: iemand die al bij ons bekend is, houdt zijn bestaande record.
 * Twee keer draaien kan dus geen kwaad, en dat is precies wat je wilt bij een
 * import die in stukken gaat.
 */
export async function POST(request: Request) {
  const sleutels = [process.env.CRON_SECRET, process.env.SITE_API_KEY].filter(Boolean);
  const meegegeven = request.headers.get("authorization") ?? "";
  if (sleutels.length === 0 || !sleutels.some((s) => meegegeven === `Bearer ${s}`)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }
  if (!isKvEnabled()) {
    return NextResponse.json({ error: "Geen opslag beschikbaar." }, { status: 503 });
  }

  let body: { leden?: { email?: string; timestampOpt?: string; status?: string }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }
  const leden = Array.isArray(body.leden) ? body.leden : [];
  if (leden.length === 0) {
    return NextResponse.json({ error: "Geen leden meegestuurd." }, { status: 400 });
  }
  if (leden.length > MAX_PER_AANROEP) {
    return NextResponse.json(
      { error: `Maximaal ${MAX_PER_AANROEP} per aanroep; stuur de rest in een volgende.` },
      { status: 400 },
    );
  }

  let nieuw = 0;
  let bestond = 0;
  let overgeslagen = 0;

  for (const lid of leden) {
    const email = String(lid.email ?? "").trim().toLowerCase();
    if (!EMAIL_PATROON.test(email)) {
      overgeslagen++;
      continue;
    }
    /*
     * Vangnet, ook al filtert het dashboard al op drie plekken. Deze route
     * staat open voor elke aanroeper met de sleutel, en één verkeerd script
     * dat hier "unsubscribed" in duwt maakt van afgemelde mensen weer
     * ontvangers. Dat is precies de fout die je niet één keer wilt kunnen
     * maken.
     */
    if (lid.status && lid.status !== "subscribed") {
      overgeslagen++;
      continue;
    }

    const sleutel = `nieuwsbrief:${normaliseerEmail(email)}`;
    const bestaand = await kvGetJSON<Aanmelding>(sleutel);
    if (bestaand) {
      bestond++;
      continue;
    }

    const opgegeven = lid.timestampOpt ? Date.parse(lid.timestampOpt) : Number.NaN;
    const aangemeldOp = Number.isNaN(opgegeven)
      ? new Date().toISOString()
      : new Date(opgegeven).toISOString();

    await kvSetJSON(sleutel, {
      email: normaliseerEmail(email),
      aangemeldOp,
      bevestigdOp: aangemeldOp,
      bron: "mailchimp",
      // Bewust niet onze eigen tekst: die stond er bij hen niet. Wat er wél
      // vaststaat is waar en wanneer, en dat zeggen we dan ook precies zo.
      toestemmingstekst:
        "Aangemeld via de Mailchimp-nieuwsbrieflijst van De Voordeelmarkt; " +
        "overgezet naar Resend op " +
        new Date().toISOString().slice(0, 10) +
        ".",
      inResend: true,
    } satisfies Aanmelding);
    nieuw++;
  }

  console.warn(
    `[nieuwsbrief] import: ${nieuw} nieuw, ${bestond} bestonden al, ${overgeslagen} overgeslagen`,
  );
  return NextResponse.json({ ok: true, nieuw, bestond, overgeslagen });
}
