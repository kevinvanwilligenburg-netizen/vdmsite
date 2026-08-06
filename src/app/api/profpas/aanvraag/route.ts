import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, SESSIE_COOKIE } from "@/lib/account";
import { verstuurMail } from "@/lib/mail";
import { esc, MAIL_KLEUREN } from "@/lib/mailhuisstijl";
import { DASHBOARD_API_URL } from "@/lib/site";
import { btwFormaatGeldig, kvkGeldig, normaliseerBtw } from "@/lib/zakelijk";

export const dynamic = "force-dynamic";

const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Waar de aanvraag naartoe gaat zolang niemand hem oppakt in het portaal. */
const VERKOOP = "verkoop@devoordeelmarkt.nl";

/**
 * ProfPas aanvragen, vanaf de site.
 *
 * Tot nu toe stond er op /zakelijk: "stuur een verzoek naar verkoop@". Voor
 * iemand die 's avonds op zijn telefoon zit is dat een doodlopende straat —
 * hij moet zijn mailprogramma open, bedenken wat erin moet, en maar hopen dat
 * hij de goede gegevens meestuurt. Dat is precies de drempel waar een
 * aanvraag sneuvelt.
 *
 * ⚠️ Aanvragen worden met de hand beoordeeld (Kevin). Dit endpoint zet dus
 * niemand als pashouder in Tilroy en belooft de klant ook geen korting; het
 * levert een nette aanvraag af bij verkoop, met alles er al in.
 *
 * KvK en btw controleren we hier opnieuw. De browser doet het ook, maar dat
 * is de spiegel — dit is het slot.
 */
export async function POST(request: Request) {
  let body: {
    bedrijf?: string;
    kvk?: string;
    btw?: string;
    land?: string;
    naam?: string;
    email?: string;
    telefoon?: string;
    besteding?: string;
    betaalwijze?: string;
    opmerking?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const tekst = (waarde: string | undefined, max = 160) =>
    String(waarde ?? "").replace(/\s+/g, " ").trim().slice(0, max);

  const bedrijf = tekst(body.bedrijf);
  const naam = tekst(body.naam);
  const telefoon = tekst(body.telefoon, 40);
  const land = tekst(body.land, 2).toUpperCase() === "BE" ? "BE" : "NL";
  const kvk = tekst(body.kvk, 20);
  const btw = normaliseerBtw(tekst(body.btw, 30));
  const besteding = tekst(body.besteding, 40);
  const betaalwijze = tekst(body.betaalwijze, 40);
  const opmerking = tekst(body.opmerking, 500);

  // Het adres van de ingelogde klant wint: dat is het adres waar de pas
  // straks aan hangt, en het is het enige dat we hebben geverifieerd.
  const sessieEmail = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  const email = sessieEmail ?? tekst(body.email, 200).toLowerCase();

  if (!bedrijf) return NextResponse.json({ error: "Vul je bedrijfsnaam in." }, { status: 400 });
  if (!naam) return NextResponse.json({ error: "Vul je naam in." }, { status: 400 });
  if (!EMAIL_PATROON.test(email)) {
    return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  }
  /*
   * Legitimatie, met dezelfde regels als bij het afrekenen: een Nederlands
   * bedrijf met KvK, een Belgisch met een btw-nummer. Hier alleen de vorm —
   * de VIES-controle draait al in de browser en het oordeel ligt bij verkoop.
   */
  if (land === "NL" && !kvkGeldig(kvk)) {
    return NextResponse.json(
      { error: "Een KvK-nummer bestaat uit acht cijfers." },
      { status: 400 },
    );
  }
  if (land === "BE" && !btwFormaatGeldig(btw)) {
    return NextResponse.json({ error: "Vul een geldig btw-nummer in." }, { status: 400 });
  }

  const regels: [string, string][] = [
    ["Bedrijf", bedrijf],
    ["Contactpersoon", naam],
    ["E-mail", email],
    ["Telefoon", telefoon || "—"],
    [land === "BE" ? "Btw-nummer" : "KvK-nummer", land === "BE" ? btw : kvk],
    ["Land", land],
    ["Verwachte besteding", besteding || "—"],
    ["Betaalwijze", betaalwijze || "—"],
    ["Via", sessieEmail ? "ingelogd account" : "niet ingelogd"],
  ];

  const { oranje, inkt, zacht, lijn } = MAIL_KLEUREN;
  const html = `
    <p style="margin:0 0 4px 0;font-size:20px;font-weight:bold;color:${inkt};">Nieuwe ProfPas-aanvraag</p>
    <p style="margin:0 0 16px 0;font-size:14px;color:${zacht};">Beoordeel hem in het portaal en koppel de pas als hij akkoord is.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${regels
        .map(
          ([label, waarde]) => `<tr>
            <td style="padding:6px 12px 6px 0;border-bottom:1px solid ${lijn};font-size:13px;color:${zacht};white-space:nowrap;">${esc(label)}</td>
            <td style="padding:6px 0;border-bottom:1px solid ${lijn};font-size:14px;font-weight:bold;color:${inkt};">${esc(waarde)}</td>
          </tr>`,
        )
        .join("")}
    </table>
    ${
      opmerking
        ? `<p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;color:${inkt};"><span style="color:${oranje};font-weight:bold;">Opmerking:</span> ${esc(opmerking)}</p>`
        : ""
    }
  `;

  /*
   * Eerst naar het portaal, want daar wordt de aanvraag behandeld.
   *
   * Het dashboard zet hem in het /profpas-scherm mét herkomst-badge, en
   * stuurt de klant zélf de bevestigingsmail met de procedure. Wij sturen er
   * dus géén tweede achteraan — twee mails over dezelfde aanvraag leest als
   * een fout in de webshop.
   *
   * Let op de veldnamen: dit is hún contract, niet het onze. `contactpersoon`
   * (niet naam), `btwNummer` (niet btw), `verwachteBestedingPerMaand`, en
   * `betaalwijze` moet kleine letters zijn en precies "vooraf" of "factuur" —
   * onze knop zei "Op factuur" en dat had een 400 gegeven.
   */
  const sleutel = process.env.SITE_API_KEY;
  let inPortaal = false;
  let alBekend = false;
  if (sleutel) {
    try {
      const res = await fetch(`${DASHBOARD_API_URL}/api/profpas/aanvraag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sleutel}` },
        body: JSON.stringify({
          site: "vdm",
          bedrijf,
          contactpersoon: naam,
          email,
          ...(telefoon ? { telefoon } : {}),
          ...(land === "BE" ? { btwNummer: btw } : { kvk }),
          ...(besteding ? { verwachteBestedingPerMaand: besteding } : {}),
          betaalwijze: betaalwijze === "factuur" ? "factuur" : "vooraf",
        }),
        signal: AbortSignal.timeout(6000),
      });
      const antwoord = (await res.json().catch(() => null)) as
        | { ok?: boolean; alBekend?: boolean; fout?: string }
        | null;
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Het is nu erg druk met aanvragen. Probeer het over een uur nog eens." },
          { status: 429 },
        );
      }
      if (res.ok && antwoord?.ok) {
        inPortaal = true;
        alBekend = Boolean(antwoord.alBekend);
      } else {
        console.error(
          `[profpas] portaal weigerde de aanvraag (${res.status}): ${antwoord?.fout ?? "geen reden"}`,
        );
      }
    } catch (error) {
      console.error("[profpas] portaal onbereikbaar:", error);
    }
  }

  if (inPortaal) return NextResponse.json({ ok: true, alBekend });

  /*
   * Kwam hij daar niet aan, dan gaat hij per mail naar verkoop — zoals het
   * vóór dit formulier ook ging. Liever een aanvraag in een mailbox dan een
   * klant die op "versturen" drukt en niets hoort.
   */
  const gemaild = await verstuurMail({
    aan: VERKOOP,
    onderwerp: `ProfPas-aanvraag: ${bedrijf}`,
    tekst: [
      "Nieuwe ProfPas-aanvraag via de webshop.",
      "Let op: het portaal nam hem niet aan, dus hij staat niet in /profpas.",
      "",
      ...regels.map(([label, waarde]) => `${label}: ${waarde}`),
      ...(opmerking ? ["", `Opmerking: ${opmerking}`] : []),
    ].join("\n"),
    html,
  });

  if (!gemaild.ok) {
    console.error(`[profpas] aanvraag van ${bedrijf} niet gemaild: ${gemaild.reden}`);
    return NextResponse.json(
      {
        error:
          "Versturen lukte even niet. Probeer het opnieuw, of mail ons rechtstreeks op " +
          VERKOOP,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
