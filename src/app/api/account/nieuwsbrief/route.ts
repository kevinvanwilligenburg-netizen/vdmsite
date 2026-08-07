import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, SESSIE_COOKIE } from "@/lib/account";
import {
  aanmeldingVan,
  meldAf,
  meldDirectAan,
  TOESTEMMING_ACCOUNT,
} from "@/lib/nieuwsbrief";

export const dynamic = "force-dynamic";

/**
 * De nieuwsbriefvoorkeur van de ingelogde klant.
 *
 * ⚠️ Het e-mailadres komt ALTIJD uit de sessie, nooit uit het verzoek. Anders
 * kan iemand met dit adres een ander aan- of afmelden.
 *
 * Aanmelden gaat hier zónder bevestigingsmail: wie is ingelogd heeft met een
 * code naar dít adres bewezen dat de mailbox van hem is, en dat is precies
 * wat de dubbele opt-in elders aantoont. Waarom die stap wegviel staat wél in
 * de toestemmingstekst — zie TOESTEMMING_ACCOUNT.
 *
 *   GET  → { aangemeld: boolean, sinds?: string }
 *   POST → { aan: boolean }
 */
export async function GET() {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  if (!email) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const aanmelding = await aanmeldingVan(email);
  const aangemeld = Boolean(aanmelding?.bevestigdOp && !aanmelding.afgemeldOp);
  return NextResponse.json({
    aangemeld,
    ...(aangemeld && aanmelding?.aangemeldOp ? { sinds: aanmelding.aangemeldOp } : {}),
  });
}

export async function POST(request: Request) {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  if (!email) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  let body: { aan?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (body.aan === true) {
    await meldDirectAan(email, "account", TOESTEMMING_ACCOUNT);
    return NextResponse.json({ ok: true, aangemeld: true });
  }
  if (body.aan === false) {
    await meldAf(email);
    return NextResponse.json({ ok: true, aangemeld: false });
  }
  return NextResponse.json({ error: "Geef aan of je aan of uit wilt." }, { status: 400 });
}
