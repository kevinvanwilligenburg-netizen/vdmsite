import { NextResponse } from "next/server";

import { verstuurMail } from "@/lib/mail";
import { MAIL_KLEUREN, esc, mailKnop } from "@/lib/mailhuisstijl";
import { startAanmelding, TOESTEMMINGSTEKST, type Aanmeldbron } from "@/lib/nieuwsbrief";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Aanmelden voor de nieuwsbrief.
 *
 * Antwoordt ALTIJD hetzelfde, of het adres nu nieuw is, al op de lijst staat
 * of geweigerd werd. Dat is niet uit gemakzucht: een verschil in antwoord
 * maakt van dit formulier een manier om te achterhalen wie er klant is.
 *
 * De echte bevestiging gebeurt pas als de klant op de link in de mail klikt —
 * zie lib/nieuwsbrief.ts voor waarom dat niet optioneel is.
 */
export async function POST(request: Request) {
  let body: { email?: string; bron?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL_PATROON.test(email)) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }
  const bron: Aanmeldbron =
    body.bron === "checkout" || body.bron === "account" ? body.bron : "footer";

  const gestart = await startAanmelding(email, bron);

  // Al bevestigd (of geen opslag): niets doen, maar wél hetzelfde antwoord.
  if (gestart) {
    const link = absoluteUrl(`/nieuwsbrief/bevestigen?token=${encodeURIComponent(gestart.token)}`);
    const { inkt, zacht } = MAIL_KLEUREN;
    const verstuurd = await verstuurMail({
      aan: email,
      onderwerp: "Bevestig je aanmelding voor onze nieuwsbrief",
      tekst: [
        "Je hebt je aangemeld voor de nieuwsbrief van De Voordeelmarkt.",
        "",
        "Bevestig je aanmelding via deze link:",
        link,
        "",
        TOESTEMMINGSTEKST,
        "",
        "Was jij dit niet? Doe dan niets — zonder deze bevestiging sturen we je niets.",
      ].join("\n"),
      html: `
        <p style="margin:0 0 4px 0;font-size:20px;font-weight:bold;color:${inkt};">Nog één klik</p>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${zacht};">
          Je hebt je aangemeld voor onze nieuwsbrief. Bevestig even dat jij dat was,
          dan zetten we je op de lijst.
        </p>
        ${mailKnop({ href: link, label: "Ja, meld mij aan" })}
        <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:${zacht};">
          ${esc(TOESTEMMINGSTEKST)}
        </p>
        <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:${zacht};">
          Was jij dit niet? Doe dan niets. Zonder deze bevestiging sturen we je
          geen nieuwsbrief.
        </p>
      `,
    });
    if (!verstuurd.ok) {
      console.error(`[nieuwsbrief] bevestigingsmail naar ${email} mislukt: ${verstuurd.reden}`);
      return NextResponse.json(
        { error: "We konden je geen bevestigingsmail sturen. Probeer het zo nog eens." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    bericht: "Check je mail: we hebben je een berichtje gestuurd om je aanmelding te bevestigen.",
  });
}
