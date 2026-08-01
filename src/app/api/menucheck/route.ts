import { NextResponse } from "next/server";

import { applyFilters, parseFilters } from "@/lib/facets";
import { HOOFDRUBRIEKEN, isHoofdrubriek, toonbareRubriek } from "@/lib/rubrieken";
import { getMenu, getProducts, getProductsByCategory } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Controle op het hele hoofdmenu.
 *
 * Een menu dat naar een lege pagina wijst of een aantal belooft dat niet
 * klopt, kost een klant zijn vertrouwen — en het valt niemand op, want je
 * klikt zelf nooit alle honderd items af. Deze route doet dat wel, met exact
 * dezelfde filters als de categoriepagina gebruikt, zodat een verschil tussen
 * menu en pagina hier zichtbaar wordt in plaats van bij de klant.
 *
 * Gecontroleerd: lege categorieën en soorten, aantallen die niet kloppen,
 * merkfilters zonder resultaat, dubbele labels binnen één paneel, namen die
 * schreeuwen of afgekort zijn, en of de vaste rubrieken uit de balk bestaan.
 */
interface Bevinding {
  soort: string;
  waar: string;
  href?: string;
  detail: string;
}

export async function GET() {
  const [menu, alleProducten] = await Promise.all([getMenu(), getProducts()]);
  const bevindingen: Bevinding[] = [];
  const regels: { categorie: string; aantal: number; soorten: number; merken: number }[] = [];

  // 1. Staan de vaste rubrieken uit de balk er nog? Verandert Tilroy een slug,
  //    dan verdwijnt zo'n knop stilletjes uit het menu.
  const ontbrekend = HOOFDRUBRIEKEN.filter(
    (naam) => !menu.some((categorie) => isHoofdrubriek(categorie.name) && categorie.name.toLocaleLowerCase("nl") === naam.toLocaleLowerCase("nl")),
  );
  if (ontbrekend.length > 0) {
    bevindingen.push({
      soort: "vaste-rubriek-weg",
      waar: "menubalk",
      detail: `Namen uit HOOFDRUBRIEKEN die niet meer bestaan: ${ontbrekend.join(", ")}. De balk valt terug op de grootste rubrieken.`,
    });
  }

  const labelsInBalk = new Map<string, number>();

  for (const categorie of menu) {
    const producten = await getProductsByCategory(categorie.slug);
    const label = (categorie.menuLabel ?? categorie.name).toLocaleLowerCase("nl");
    labelsInBalk.set(label, (labelsInBalk.get(label) ?? 0) + 1);

    if (producten.length === 0) {
      bevindingen.push({
        soort: "lege-categorie",
        waar: categorie.name,
        href: `/categorie/${categorie.slug}`,
        detail: `Menu belooft ${categorie.count} artikelen, de pagina toont er 0.`,
      });
    } else if (producten.length !== categorie.count) {
      bevindingen.push({
        soort: "aantal-klopt-niet",
        waar: categorie.name,
        href: `/categorie/${categorie.slug}`,
        detail: `Menu zegt ${categorie.count}, de pagina toont ${producten.length}.`,
      });
    }

    if (!toonbareRubriek(categorie.name)) {
      bevindingen.push({
        soort: "geen-echte-rubriek",
        waar: categorie.name,
        detail: "Leveranciersnaam of vergaarbak; hoort niet als wegwijzer in het menu.",
      });
    }

    // 2. Elke soort narekenen met het echte filter.
    const soortLabels = new Map<string, number>();
    for (const soort of categorie.soorten) {
      const sleutel = soort.label.toLocaleLowerCase("nl");
      soortLabels.set(sleutel, (soortLabels.get(sleutel) ?? 0) + 1);

      const query = new URL(soort.href, "https://x").searchParams;
      const filters = parseFilters(Object.fromEntries(query.entries()));
      const gevonden = applyFilters(producten, filters).length;
      if (gevonden === 0) {
        bevindingen.push({
          soort: "lege-soort",
          waar: `${categorie.name} → ${soort.label}`,
          href: soort.href,
          detail: `Menu belooft ${soort.count} artikelen, het filter levert er 0.`,
        });
      } else if (gevonden !== soort.count) {
        bevindingen.push({
          soort: "aantal-klopt-niet",
          waar: `${categorie.name} → ${soort.label}`,
          href: soort.href,
          detail: `Menu zegt ${soort.count}, het filter levert ${gevonden}.`,
        });
      }

      if (schreeuwt(soort.label)) {
        bevindingen.push({
          soort: "label-leest-slecht",
          waar: `${categorie.name} → ${soort.label}`,
          detail: "Staat volledig in hoofdletters.",
        });
      } else if (afgekort(soort.label)) {
        bevindingen.push({
          soort: "label-leest-slecht",
          waar: `${categorie.name} → ${soort.label}`,
          detail: "Bevat een afkorting.",
        });
      }
    }
    for (const [sleutel, aantal] of soortLabels) {
      if (aantal > 1) {
        bevindingen.push({
          soort: "dubbel-label",
          waar: categorie.name,
          detail: `"${sleutel}" staat ${aantal}× in hetzelfde paneel.`,
        });
      }
    }

    // 3. Merkknoppen: leiden ze naar artikelen van dat merk?
    for (const merk of categorie.merken) {
      const query = new URL(merk.href, "https://x").searchParams;
      const filters = parseFilters(Object.fromEntries(query.entries()));
      const bron = merk.href.startsWith("/categorie/") ? producten : alleProducten;
      const gevonden = applyFilters(bron, filters).length;
      if (gevonden === 0) {
        bevindingen.push({
          soort: "leeg-merk",
          waar: `${categorie.name} → ${merk.label}`,
          href: merk.href,
          detail: `Menu belooft ${merk.count} artikelen, het filter levert er 0.`,
        });
      }
    }

    regels.push({
      categorie: categorie.name,
      aantal: producten.length,
      soorten: categorie.soorten.length,
      merken: categorie.merken.length,
    });
  }

  for (const [label, aantal] of labelsInBalk) {
    if (aantal > 1) {
      bevindingen.push({
        soort: "dubbel-label",
        waar: "menubalk",
        detail: `"${label}" staat ${aantal}× in het menu.`,
      });
    }
  }

  return NextResponse.json({
    ok: bevindingen.length === 0,
    aantalBevindingen: bevindingen.length,
    bevindingen,
    categorieen: regels,
  });
}

function schreeuwt(tekst: string): boolean {
  return /\p{Lu}/u.test(tekst) && tekst === tekst.toLocaleUpperCase("nl");
}

/** "Schildersger." en "Acc. elektrisch": een afkorting midden in een naam. */
function afgekort(tekst: string): boolean {
  return /\w{3,}\.(\s|$)/.test(tekst);
}
