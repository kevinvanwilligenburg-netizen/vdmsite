import { NextResponse } from "next/server";

import { controleerBtw } from "@/lib/vies";

/**
 * Live BTW-controle voor het afrekenformulier: de klant ziet meteen of zijn
 * nummer klopt in plaats van pas bij het afrekenen een foutmelding te krijgen.
 *
 * De checkout vertrouwt dit antwoord niet — die controleert server-side
 * opnieuw. Dit is alleen de spiegel voor de klant.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let btw = "";
  try {
    const body = (await request.json()) as { btw?: string };
    btw = String(body.btw ?? "");
  } catch {
    return NextResponse.json({ status: "ongeldig" }, { status: 400 });
  }
  if (!btw.trim()) return NextResponse.json({ status: "ongeldig" }, { status: 400 });
  const uitkomst = await controleerBtw(btw);
  return NextResponse.json(uitkomst);
}
