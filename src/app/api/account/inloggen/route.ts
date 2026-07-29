import { NextResponse } from "next/server";

import { bewaarCode, nieuweCode } from "@/lib/account";
import { isKvEnabled, kvGetRaw, kvSetEx } from "@/lib/kv";
import { verstuurMail } from "@/lib/mail";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Stap 1 van inloggen: een eenmalige code naar het opgegeven e-mailadres.
 *
 * Het antwoord is bewust altijd hetzelfde, of het adres nu bij ons bekend is
 * of niet. Anders wordt deze route een manier om uit te zoeken wie er klant
 * is — en dat is klantgegevens weggeven aan wie er niet om zou moeten kunnen
 * vragen.
 */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATROON.test(email)) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }

  if (!isKvEnabled()) {
    return NextResponse.json(
      { error: "Inloggen is tijdelijk niet beschikbaar. Probeer het later opnieuw." },
      { status: 503 },
    );
  }

  // Rem per adres: een code aanvragen mag niet uitgroeien tot een manier om
  // iemands mailbox vol te sturen.
  const remSleutel = `account:rem:${email}`;
  const pogingen = Number((await kvGetRaw(remSleutel)) ?? "0");
  if (pogingen >= 5) {
    return NextResponse.json(
      { error: "Je hebt te vaak een code aangevraagd. Probeer het over een uur opnieuw." },
      { status: 429 },
    );
  }
  await kvSetEx(remSleutel, String(pogingen + 1), 3600);

  const code = nieuweCode();
  const bewaard = await bewaarCode(email, code);
  if (!bewaard) {
    return NextResponse.json(
      { error: "Inloggen is tijdelijk niet beschikbaar. Probeer het later opnieuw." },
      { status: 503 },
    );
  }

  const resultaat = await verstuurMail({
    aan: email,
    onderwerp: `Je inlogcode: ${code}`,
    tekst: [
      `Je inlogcode voor ${SITE_NAME} is: ${code}`,
      "",
      "De code is 15 minuten geldig. Heb je hem niet zelf aangevraagd, dan hoef je niets te doen.",
    ].join("\n"),
    html: `
      <p>Je inlogcode voor <strong>${SITE_NAME}</strong> is:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p>
      <p>De code is 15 minuten geldig. Heb je hem niet zelf aangevraagd, dan hoef je niets te doen.</p>
    `,
  });

  if (!resultaat.ok) {
    console.error("[account] inlogcode versturen mislukt:", resultaat.reden);
    return NextResponse.json(
      {
        error:
          "We konden de code niet versturen. Neem contact op met de klantenservice, dan helpen we je verder.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
