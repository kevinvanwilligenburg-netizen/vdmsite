import { NextResponse } from "next/server";

import { applyFilters, parseFilters } from "@/lib/facets";
import { getMenu, getProductsByCategory } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Controle: levert elk menu-item ook echt artikelen op?
 *
 * Een menu dat naar een lege pagina wijst kost een klant zijn vertrouwen.
 * Deze route loopt elke categorie en elke soort na met exact hetzelfde filter
 * dat de categoriepagina gebruikt, zodat een verschil tussen menu en pagina
 * hier zichtbaar wordt in plaats van bij de klant.
 */
export async function GET() {
  const menu = await getMenu();
  const leeg: { menu: string; href: string; verwacht: number; werkelijk: number }[] = [];
  const regels: { categorie: string; aantal: number; soorten: number; leegAantal: number }[] = [];

  for (const categorie of menu) {
    const producten = await getProductsByCategory(categorie.slug);
    let leegInCategorie = 0;

    if (producten.length === 0) {
      leeg.push({
        menu: categorie.name,
        href: `/categorie/${categorie.slug}`,
        verwacht: categorie.count,
        werkelijk: 0,
      });
      leegInCategorie++;
    }

    for (const soort of categorie.soorten) {
      // Precies zoals de categoriepagina het doet: uit de query lezen en
      // toepassen. Zo meten we de werkelijke uitkomst, geen benadering.
      const query = new URL(soort.href, "https://x").searchParams;
      const filters = parseFilters(Object.fromEntries(query.entries()));
      const gevonden = applyFilters(producten, filters).length;
      if (gevonden === 0) {
        leeg.push({
          menu: `${categorie.name} → ${soort.label}`,
          href: soort.href,
          verwacht: soort.count,
          werkelijk: 0,
        });
        leegInCategorie++;
      }
    }

    regels.push({
      categorie: categorie.name,
      aantal: producten.length,
      soorten: categorie.soorten.length,
      leegAantal: leegInCategorie,
    });
  }

  return NextResponse.json({ ok: leeg.length === 0, leeg, categorieen: regels });
}
