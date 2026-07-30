import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  bewaarVoorkeurWinkel,
  emailVanSessie,
  ONLINE_KEUZE,
  SESSIE_COOKIE,
} from "@/lib/account";
import { getStores } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * De favoriete winkel van een ingelogde klant vastleggen.
 *
 * Het e-mailadres komt uit de sessie en nooit uit het verzoek: anders kan
 * iemand de voorkeur van een ander overschrijven door een adres mee te sturen.
 */
export async function POST(request: Request) {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  if (!email) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  let body: { winkel?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const keuze = String(body.winkel ?? "").trim();
  // Alleen een bestaande winkel of "online"; geen vrije tekst in de opslag.
  const winkels = await getStores();
  const geldig = keuze === ONLINE_KEUZE || winkels.some((winkel) => winkel.slug === keuze);
  if (!geldig) {
    return NextResponse.json({ error: "Onbekende winkel." }, { status: 400 });
  }

  const bewaard = await bewaarVoorkeurWinkel(email, keuze);
  if (!bewaard) {
    return NextResponse.json(
      { error: "We konden je keuze nu niet bewaren. Probeer het zo nog eens." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, winkel: keuze });
}
