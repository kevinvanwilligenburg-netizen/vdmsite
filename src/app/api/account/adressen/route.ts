import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { emailVanSessie, SESSIE_COOKIE } from "@/lib/account";
import { adressenVan, bewaarAdressen, leesAdres, zelfdeAdres } from "@/lib/adressen";

export const dynamic = "force-dynamic";

/**
 * Het adresboek van de ingelogde klant.
 *
 * Kevin: *"graag meerdere adressen kunnen invoeren."* Een schilder bestelt de
 * ene week naar zijn loods en de andere naar het werkadres van een klant; dat
 * elke keer overtikken is waar een postcode een cijfer verschuift.
 *
 * ⚠️ Het e-mailadres komt ALTIJD uit de sessie, nooit uit het verzoek. Anders
 * kan iemand die het adres van deze route kent het adresboek van een ander
 * uitlezen door een mailadres mee te sturen.
 *
 *   GET    → { adressen: [...] }
 *   PUT    → hele lijst vervangen  { adressen: [...] }
 *   POST   → één adres toevoegen of bijwerken  { adres: {...} }
 *   DELETE → ?index=2
 */

const MAX = 10;

async function huidigeEmail(): Promise<string | null> {
  return emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
}

export async function GET() {
  const email = await huidigeEmail();
  if (!email) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  return NextResponse.json({ adressen: await adressenVan(email) });
}

export async function POST(request: Request) {
  const email = await huidigeEmail();
  if (!email) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  let body: { adres?: unknown; vervangIndex?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const adres = leesAdres(body.adres);
  if (!adres) {
    return NextResponse.json(
      { error: "Vul straat, huisnummer, postcode en plaats in. Controleer de postcode." },
      { status: 400 },
    );
  }

  const bestaand = await adressenVan(email);
  const index = Number(body.vervangIndex);
  let lijst: typeof bestaand;

  if (Number.isInteger(index) && index >= 0 && index < bestaand.length) {
    // Bewerken: op zijn plek laten staan, anders springt het rijtje door
    // elkaar terwijl de klant alleen een typefout herstelde.
    lijst = bestaand.map((ander, i) => (i === index ? adres : ander));
  } else {
    if (bestaand.length >= MAX) {
      return NextResponse.json(
        { error: `Je kunt maximaal ${MAX} adressen bewaren. Verwijder er eerst een.` },
        { status: 400 },
      );
    }
    // Nieuwste vooraan; een adres dat er al stond schuift naar voren in plaats
    // van er dubbel bij te komen.
    lijst = [adres, ...bestaand.filter((ander) => !zelfdeAdres(ander, adres))];
  }

  if (!(await bewaarAdressen(email, lijst))) {
    return NextResponse.json({ error: "Opslaan lukte niet." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, adressen: lijst });
}

export async function DELETE(request: Request) {
  const email = await huidigeEmail();
  if (!email) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const index = Number(new URL(request.url).searchParams.get("index"));
  const bestaand = await adressenVan(email);
  if (!Number.isInteger(index) || index < 0 || index >= bestaand.length) {
    return NextResponse.json({ error: "Dat adres bestaat niet." }, { status: 400 });
  }
  const lijst = bestaand.filter((_, i) => i !== index);
  if (!(await bewaarAdressen(email, lijst))) {
    return NextResponse.json({ error: "Opslaan lukte niet." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, adressen: lijst });
}
