import { NextResponse } from "next/server";

import { getActiepagina, type Actieblok } from "@/lib/actiepagina";
import { isKvEnabled, kvDel, kvSAdd, kvSetJSON, kvSMembers } from "@/lib/kv";

export const dynamic = "force-dynamic";

/**
 * Actiepagina's aanmaken, wijzigen en weghalen.
 *
 * Kevin vroeg om een tool om een actiepagina te maken "met producten en
 * teksten". Het samenstelscherm hoort in het dashboard, naast zijn banners —
 * maar dan moet er wel iets zijn om naartoe te schrijven. Dit is dat.
 *
 * Afgeschermd met SITE_API_KEY of CRON_SECRET: hiermee zet je een pagina op de
 * winkel. Zonder slot kan iedereen die het adres raadt een actie publiceren.
 *
 *   POST   /api/actie   {slug, titel, intro?, bannerUrl?, van?, tot?, blokken[]}
 *   DELETE /api/actie?slug=…
 *   GET    /api/actie             → welke er zijn
 *
 * Zie lib/actiepagina.ts voor de vorm van `blokken`. Kort:
 *   {"soort":"tekst","kop":"…","tekst":"…"}
 *   {"soort":"producten","kop":"…","skus":["39981135"]}
 *   {"soort":"producten","kop":"…","merk":"HG","maximaal":8}
 */

const SLUG_PATROON = /^[a-z0-9-]{1,64}$/;
const INDEX = "actie:index";

function toegestaan(request: Request): boolean {
  const sleutels = [process.env.CRON_SECRET, process.env.SITE_API_KEY].filter(Boolean);
  if (sleutels.length === 0) return false;
  const meegegeven = request.headers.get("authorization") ?? "";
  return sleutels.some((sleutel) => meegegeven === `Bearer ${sleutel}`);
}

export async function GET(request: Request) {
  if (!toegestaan(request)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }
  if (!isKvEnabled()) {
    return NextResponse.json({ error: "Geen opslag beschikbaar." }, { status: 503 });
  }
  const slugs = await kvSMembers(INDEX);
  const paginas = await Promise.all(
    slugs.filter((slug) => SLUG_PATROON.test(slug)).map(async (slug) => {
      const pagina = await getActiepagina(slug);
      return pagina
        ? { slug, titel: pagina.titel, van: pagina.van, tot: pagina.tot, blokken: pagina.blokken.length }
        : { slug, ontbreekt: true };
    }),
  );
  return NextResponse.json({ acties: paginas });
}

export async function POST(request: Request) {
  if (!toegestaan(request)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }
  if (!isKvEnabled()) {
    return NextResponse.json({ error: "Geen opslag beschikbaar." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!SLUG_PATROON.test(slug)) {
    return NextResponse.json(
      { error: "Slug mag alleen kleine letters, cijfers en streepjes bevatten (max 64)." },
      { status: 400 },
    );
  }
  const titel = String(body.titel ?? "").trim();
  if (!titel) return NextResponse.json({ error: "Titel ontbreekt." }, { status: 400 });

  const blokken = Array.isArray(body.blokken) ? (body.blokken as Actieblok[]) : [];
  if (blokken.length === 0) {
    return NextResponse.json(
      { error: "Een actiepagina zonder blokken is een lege pagina." },
      { status: 400 },
    );
  }
  /*
   * Datums streng toetsen. Een tikfout in `tot` ("2026-13-01") zou anders een
   * actie opleveren die volgens `actieLoopt` altijd doorloopt — en niemand
   * merkt dat, want de pagina staat er gewoon.
   */
  for (const veld of ["van", "tot"] as const) {
    const waarde = body[veld];
    if (waarde === undefined || waarde === null || waarde === "") continue;
    if (Number.isNaN(Date.parse(String(waarde)))) {
      return NextResponse.json(
        { error: `Datum "${veld}" is geen geldige datum (verwacht JJJJ-MM-DD).` },
        { status: 400 },
      );
    }
  }

  const opgeslagen = await kvSetJSON(`actie:${slug}`, {
    ...body,
    slug,
    titel,
    updatedAt: new Date().toISOString(),
  });
  if (!opgeslagen) {
    return NextResponse.json({ error: "Opslaan mislukt." }, { status: 502 });
  }
  await kvSAdd(INDEX, slug);

  // Teruglezen via dezelfde weg als de pagina zelf: zo weet je meteen of de
  // controle in getActiepagina hem doorlaat, in plaats van dat je een lege
  // pagina ontdekt door hem te openen.
  const terug = await getActiepagina(slug);
  return NextResponse.json({
    ok: true,
    url: `/actie/${slug}`,
    zichtbaar: Boolean(terug),
    ...(terug ? { blokken: terug.blokken.length } : { waarschuwing: "Opgeslagen, maar de pagina toont niets — controleer titel en blokken." }),
  });
}

export async function DELETE(request: Request) {
  if (!toegestaan(request)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }
  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
  if (!SLUG_PATROON.test(slug)) {
    return NextResponse.json({ error: "Ongeldige slug." }, { status: 400 });
  }
  await kvDel(`actie:${slug}`);
  // De slug blijft in de index staan; getActiepagina geeft null en het
  // overzicht slaat hem over. Een set-verwijdering hebben we niet, en een
  // wees-slug kost niets.
  return NextResponse.json({ ok: true, verwijderd: slug });
}
