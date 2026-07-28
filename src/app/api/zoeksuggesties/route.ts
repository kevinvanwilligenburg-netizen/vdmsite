import { NextResponse } from "next/server";

import { klusIntentie } from "@/lib/klus-intentie";
import { getBrands, getCategories, searchProducts } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Suggesties tijdens het typen in het zoekveld.
 *
 * Geeft in één keer terug wat een klant nodig heeft om verder te komen:
 * de beste producten, passende categorieën en merken, en — als de
 * zoekopdracht een klus beschrijft ("trap verven") — een verwijzing naar
 * het klusadvies. Dat laatste is het verschil tussen een zoekmachine die
 * woorden matcht en een winkel die begrijpt wat je komt doen.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 2) {
    return NextResponse.json({ producten: [], categorieen: [], merken: [], klus: null });
  }

  const klus = klusIntentie(query);

  const [eigen, categories, brands] = await Promise.all([
    searchProducts(query, { limit: 6 }),
    getCategories(),
    getBrands(60),
  ]);

  // "Trap verven" komt in geen enkele productnaam voor, dus levert de gewone
  // zoekopdracht niets op. Herkennen we de klus, dan tonen we de artikelen
  // die er wél bij horen — dat is het antwoord dat de klant zoekt.
  const resultaat =
    eigen.total === 0 && klus
      ? await searchProducts(klus.zoekterm, { limit: 6 })
      : eigen;

  const laag = query.toLowerCase();
  const woorden = laag.split(/\s+/).filter((woord) => woord.length >= 3);

  const categorieen = categories
    .filter((category) => {
      const naam = category.name.toLowerCase();
      return woorden.some((woord) => naam.includes(woord) || woord.includes(naam));
    })
    .slice(0, 3)
    .map((category) => ({ naam: category.name, href: `/categorie/${category.slug}` }));

  const merken = brands
    .filter((brand) => {
      const naam = brand.name.toLowerCase();
      return woorden.some((woord) => naam.includes(woord) || woord.includes(naam));
    })
    .slice(0, 3)
    .map((brand) => ({ naam: brand.name, href: `/merk/${brand.slug}`, aantal: brand.count }));

  return NextResponse.json({
    producten: resultaat.products.slice(0, 6).map((product) => ({
      slug: product.slug,
      naam: product.name,
      merk: product.brand,
      prijs: product.kluspasPrice ?? product.price,
      metKluspas: Boolean(product.kluspasPrice),
      image: product.image,
      art: product.art,
    })),
    totaal: resultaat.total,
    categorieen,
    merken,
    klus,
    suggesties: resultaat.suggestions.slice(0, 3),
  });
}
