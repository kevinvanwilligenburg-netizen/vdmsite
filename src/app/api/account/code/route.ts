import { NextResponse } from "next/server";

import { controleerCode, maakSessie, SESSIE_COOKIE } from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * Stap 2 van inloggen: de code controleren en een sessie openen.
 *
 * De sessiecookie is httpOnly en sameSite=lax: niet leesbaar vanuit
 * JavaScript, en gaat niet mee op verzoeken die een andere site namens de
 * bezoeker doet.
 */
export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Vul de code van zes cijfers in." }, { status: 400 });
  }

  const uitkomst = await controleerCode(email, code);
  if (uitkomst !== "goed") {
    const melding =
      uitkomst === "verlopen"
        ? "Deze code is verlopen. Vraag een nieuwe aan."
        : uitkomst === "geblokkeerd"
          ? "Te vaak een verkeerde code ingevoerd. Vraag een nieuwe aan."
          : "Die code klopt niet. Controleer je mail en probeer het opnieuw.";
    return NextResponse.json({ error: melding }, { status: 401 });
  }

  const token = await maakSessie(email);
  if (!token) {
    return NextResponse.json(
      { error: "Inloggen is tijdelijk niet beschikbaar. Probeer het later opnieuw." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSIE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
