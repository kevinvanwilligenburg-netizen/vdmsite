import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, SESSIE_COOKIE } from "@/lib/account";
import { getOrderForEmail, herhaalBestelling } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Een eerdere bestelling omzetten in winkelwagenregels van vandaag.
 *
 * Het e-mailadres komt uit de sessie en de bestelling wordt daaraan getoetst:
 * het referentienummer alleen is geen bewijs van wie je bent. Zonder die
 * controle kon iemand met VDM-100001, VDM-100002, … de mandjes van andere
 * klanten aflopen.
 *
 * Onbekend en niet-van-jou geven allebei hetzelfde antwoord. Een apart
 * "bestaat wel, maar niet van jou" vertelt een vreemde precies welke
 * referenties bestaan.
 */
export async function POST(request: Request) {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  if (!email) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  let body: { bestelling?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const order = await getOrderForEmail(String(body.bestelling ?? "").trim(), email);
  if (!order) {
    return NextResponse.json(
      { error: "Deze bestelling konden we niet bij je account vinden." },
      { status: 404 },
    );
  }

  return NextResponse.json(await herhaalBestelling(order));
}
