import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, haalWinkelaankopen, SESSIE_COOKIE } from "@/lib/account";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Winkelaankopen van de ingelogde klant.
 *
 * Apart van de accountpagina, omdat het dashboard hiervoor een jaar
 * verkopen doorloopt: na cache-verval duurt dat tientallen seconden. De
 * pagina toont dus eerst de Kluspas en de webshopbestellingen, en haalt dit
 * er daarna bij.
 *
 * Het e-mailadres komt uit de sessie, nooit uit het verzoek — anders kon
 * iedereen andermans aankoopgeschiedenis opvragen door een adres in te
 * typen.
 */
export async function GET() {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  if (!email) {
    return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  }

  const aankopen = await haalWinkelaankopen(email);
  return NextResponse.json({ aankopen });
}
