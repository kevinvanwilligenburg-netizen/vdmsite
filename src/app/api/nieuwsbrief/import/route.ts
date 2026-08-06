import { NextResponse } from "next/server";

import { isKvEnabled, kvGetJSON, kvSetJSON } from "@/lib/kv";
import { normaliseerEmail } from "@/lib/account";
import { type Aanmelding } from "@/lib/nieuwsbrief";

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

  let body: {
    leden?: { email?: string; timestampOpt?: string; status?: string }[];
    overschrijf?: boolean;
  };
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
  let bijgewerkt = 0;
  let bestond = 0;
  let overgeslagen = 0;

  /*
   * Met `overschrijf: true` worden bestaande records bijgewerkt in plaats van
   * overgeslagen. Nodig omdat de eerste import 43.950 records wegschreef met
   * een toestemmingstekst die een aanmelddatum suggereerde die we niet kunnen
   * hardmaken; zonder deze vlag was die tekst niet meer te corrigeren.
   */
  const overschrijf = body.overschrijf === true;

  /**
   * De twee dagen waarop een hele lijst in Mailchimp is geladen.
   *
   * Gemeten over het dossier van 6 augustus 2026: 60.664 van de 68.323
   * stempels vallen op 30-12-2025 en 6.871 op 19-03-2026 — samen 98,9%.
   * Zestigduizend mensen melden zich niet op één dag aan, dus die datums zijn
   * importmomenten. Alleen bij deze twee zetten we erbij dat het echte
   * toestemmingsmoment onbekend is; de 788 verspreide adressen zijn wél
   * gewone aanmeldingen en verdienen die kanttekening niet.
   */
  const BULKDAGEN = new Set(["2025-12-30", "2026-03-19"]);

  /*
   * In groepjes tegelijk, niet één voor één.
   *
   * Elke regel kost een KV-lees plus een KV-schrijf. Achter elkaar zijn dat
   * 2.000 rondjes voor 1.000 leden, en daar liep de eerste migratiepoging van
   * het dashboard op vast: hun 30 seconden waren om voordat wij klaar waren.
   *
   * Vijftig tegelijk is genoeg om de latency weg te werken zonder de store
   * plat te leggen. Bewust geen `Promise.all` over álles: dan open je duizend
   * verbindingen tegelijk en verplaats je het probleem naar de andere kant.
   */
  const GROEP = 50;
  const verwerk = async (lid: { email?: string; timestampOpt?: string; status?: string }) => {
    const email = String(lid.email ?? "").trim().toLowerCase();
    if (!EMAIL_PATROON.test(email)) {
      overgeslagen++;
      return;
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
      return;
    }

    const sleutel = `nieuwsbrief:${normaliseerEmail(email)}`;
    const bestaand = await kvGetJSON<Aanmelding>(sleutel);
    if (bestaand && !overschrijf) {
      bestond++;
      return;
    }
    /*
     * Iemand die zich intussen heeft AFGEMELD blijft afgemeld, ook bij
     * overschrijven. Een correctieronde over de toestemmingsteksten mag nooit
     * iemand terugzetten op de lijst — dat is precies de fout waar deze route
     * verder zo hard tegen beveiligt.
     */
    if (bestaand?.afgemeldOp) {
      overgeslagen++;
      return;
    }

    // Mailchimp levert "JJJJ-MM-DD UU:MM:SS"; Date.parse wil een T.
    const opgegeven = lid.timestampOpt
      ? Date.parse(String(lid.timestampOpt).replace(" ", "T"))
      : Number.NaN;
    const aangemeldOp = Number.isNaN(opgegeven)
      ? new Date().toISOString()
      : new Date(opgegeven).toISOString();
    const bulkdag = BULKDAGEN.has(aangemeldOp.slice(0, 10));

    await kvSetJSON(sleutel, {
      email: normaliseerEmail(email),
      aangemeldOp,
      bevestigdOp: aangemeldOp,
      bron: "mailchimp",
      /*
       * Opschrijven wat we ECHT weten, niet wat het handigst leest.
       *
       * Gemeten over het dossier van 6 augustus 2026: 60.664 van de 68.323
       * "toestemmingsmomenten" vallen op 30 december 2025 en 6.871 op 19 maart
       * 2026. Zestigduizend mensen melden zich niet op één dag aan — dat zijn
       * twee bulk-imports in Mailchimp, waarbij OPTIN_TIME op de importdatum
       * werd gezet. Slechts 788 adressen zijn over losse dagen verspreid en
       * zien eruit als echte aanmeldingen.
       *
       * "Aangemeld op 30-12-2025" zou dus een onwaarheid zijn, en juist deze
       * tekst is wat je bij een klacht laat zien. Dan is een eerlijke regel
       * ("herkomst bekend, moment niet") meer waard dan een datum die niet
       * standhoudt zodra iemand doorvraagt.
       */
      toestemmingstekst:
        `Overgezet uit de Mailchimp-lijst van De Voordeelmarkt op ${new Date()
          .toISOString()
          .slice(0, 10)}. Stempel uit Mailchimp: ${aangemeldOp.slice(0, 10)}` +
        (bulkdag
          ? " — dat is een importdatum, niet het moment van aanmelden; het oorspronkelijke toestemmingsmoment is onbekend."
          : "."),
      inResend: true,
    } satisfies Aanmelding);
    if (bestaand) bijgewerkt++;
    else nieuw++;
  };

  for (let i = 0; i < leden.length; i += GROEP) {
    await Promise.all(leden.slice(i, i + GROEP).map(verwerk));
  }

  console.warn(
    `[nieuwsbrief] import: ${nieuw} nieuw, ${bijgewerkt} bijgewerkt, ${bestond} bestonden al, ${overgeslagen} overgeslagen`,
  );
  return NextResponse.json({ ok: true, nieuw, bijgewerkt, bestond, overgeslagen });
}
