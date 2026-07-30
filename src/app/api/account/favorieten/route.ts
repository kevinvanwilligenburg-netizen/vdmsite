import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  bewaarFavoriet,
  emailVanSessie,
  favorietKey,
  haalFavorieten,
  SESSIE_COOKIE,
  verwijderFavoriet,
} from "@/lib/account";
import { isKvEnabled } from "@/lib/kv";
import { getProductById } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Bewaarde artikelen van de ingelogde klant.
 *
 * Het e-mailadres komt uit de sessie, nooit uit het verzoek: anders kan
 * iedereen het lijstje van een ander lezen of volschrijven door een adres mee
 * te sturen. Het Kluspas-nummer geeft hier dus ook geen toegang — dat is een
 * oplopend nummer en zou dit lek juist openzetten.
 */

async function huidigEmail(): Promise<string | null> {
  return emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
}

/**
 * Alleen artikelen die we echt verkopen komen in de lijst.
 *
 * Zonder deze controle is dit een route waarmee een ingelogde klant vrije
 * tekst in onze opslag kan zetten, en staan er straks regels in het overzicht
 * die nergens naar wijzen.
 */
async function controleerArtikel(
  productId: string,
  variantId: string | undefined,
): Promise<{ productId: string; variantId?: string } | null> {
  const product = await getProductById(productId);
  if (!product) return null;
  if (!variantId) return { productId: product.id };
  const variant = (product.variants ?? []).find((kandidaat) => kandidaat.id === variantId);
  return variant ? { productId: product.id, variantId: variant.id } : null;
}

export async function GET() {
  const email = await huidigEmail();
  if (!email) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }
  const favorieten = await haalFavorieten(email);
  return NextResponse.json({
    favorieten,
    sleutels: favorieten.map((item) => favorietKey(item.productId, item.variantId)),
  });
}

export async function POST(request: Request) {
  return schrijf(request, "bewaren");
}

export async function DELETE(request: Request) {
  return schrijf(request, "verwijderen");
}

async function schrijf(request: Request, wat: "bewaren" | "verwijderen") {
  const email = await huidigEmail();
  if (!email) {
    return NextResponse.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  if (!isKvEnabled()) {
    return NextResponse.json(
      { error: "Bewaren lukt nu even niet. Probeer het later opnieuw." },
      { status: 503 },
    );
  }

  let body: { productId?: string; variantId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const productId = String(body.productId ?? "").trim();
  const variantId = String(body.variantId ?? "").trim() || undefined;
  if (!productId) {
    return NextResponse.json({ error: "Geen artikel opgegeven." }, { status: 400 });
  }

  // Bij verwijderen niet toetsen aan de catalogus: een artikel dat uit het
  // assortiment is, moet je juist nog uit je lijstje kunnen halen.
  const artikel =
    wat === "bewaren"
      ? await controleerArtikel(productId, variantId)
      : { productId, variantId };
  if (!artikel) {
    return NextResponse.json(
      { error: "Dit artikel staat niet meer in ons assortiment." },
      { status: 404 },
    );
  }

  const lijst =
    wat === "bewaren"
      ? await bewaarFavoriet(email, artikel.productId, artikel.variantId)
      : await verwijderFavoriet(email, artikel.productId, artikel.variantId);

  if (!lijst) {
    return NextResponse.json(
      { error: "We konden je lijstje nu niet bijwerken. Probeer het zo nog eens." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    aantal: lijst.length,
    sleutels: lijst.map((item) => favorietKey(item.productId, item.variantId)),
  });
}
