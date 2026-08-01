import { ralColors } from "@/lib/ral";
import type { Product, RalColor } from "@/lib/types";

/**
 * Indexeerbare kleurpagina's (/kleuren/ral/…).
 *
 * De kleurkiezer is een applicatie: één URL, alles client-side. Voor Google
 * bestaat er daardoor geen pagina "RAL 9010" — terwijl "ral 9010 verf" en
 * "ral 7016 kozijnen" precies de zoektermen zijn waar concurrenten losse
 * landingspagina's voor hebben. Deze module geeft elke RAL-kleur een eigen,
 * statisch te renderen pagina met de mengbare producten erbij.
 *
 * Bewust alleen RAL Classic (213 kleuren): dat is de waaier waar de winkel op
 * mengt en waar op gezocht wordt. De 18.000 merkkleuren uit de dashboard-feed
 * krijgen géén eigen pagina — duizenden bijna lege pagina's zijn precies het
 * "thin content" waar Google een site voor terugzet.
 */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** "ral-9010-zuiver-wit" — code voorop, zodat de URL leesbaar én uniek is. */
export function ralSlug(color: RalColor): string {
  return `ral-${color.code}-${slugify(color.name)}`;
}

export function alleRalKleuren(): RalColor[] {
  return ralColors;
}

/**
 * Kleur bij een slug. De code is leidend: verandert een kleurnaam ooit van
 * schrijfwijze, dan blijft de oude URL werken (de pagina rendert de canonieke
 * naam, de canonical-tag wijst naar de juiste slug).
 */
export function findRalBySlug(slug: string): RalColor | undefined {
  const code = slug.match(/^ral-(\d{4})(?:-|$)/)?.[1];
  if (!code) return undefined;
  return ralColors.find((color) => color.code === code);
}

/** Hex → "234, 230, 202" voor de RGB-vermelding op de kleurpagina. */
export function hexNaarRgb(hex: string): string | null {
  const value = hex.replace("#", "");
  if (value.length < 6) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `${r}, ${g}, ${b}`;
}

/** Verwante kleuren: dezelfde kleurgroep, de dichtstbijzijnde codes eerst. */
export function verwanteRalKleuren(color: RalColor, limit = 8): RalColor[] {
  const eigen = Number(color.code);
  return ralColors
    .filter((kandidaat) => kandidaat.group === color.group && kandidaat.code !== color.code)
    .sort((a, b) => Math.abs(Number(a.code) - eigen) - Math.abs(Number(b.code) - eigen))
    .slice(0, limit);
}

export interface MengproductKeuze {
  /** Soortnaam uit de feed ("Muurverf", "Lakken"). */
  soort: string;
  product: Product;
}

/**
 * Per verfsoort één mengbaar product om op de kleurpagina te tonen, met de
 * kleur alvast in de link (?kleur=ral:9010 — de productpagina leest die uit).
 *
 * De keuze per soort: leverbaar, met foto, en dan de laagste vanaf-prijs —
 * de kleurpagina is een etalage, geen assortimentslijst.
 */
export function mengproductenPerSoort(products: Product[], limit = 6): MengproductKeuze[] {
  const perSoort = new Map<string, Product[]>();
  for (const product of products) {
    if (!product.colorMixable || product.inStock === false) continue;
    const soort = product.attributes?.subcategorie ?? "Overige verf";
    const lijst = perSoort.get(soort);
    if (lijst) lijst.push(product);
    else perSoort.set(soort, [product]);
  }

  return [...perSoort.entries()]
    // Grootste soorten eerst: dat zijn de schappen waar klanten voor komen.
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([soort, lijst]) => ({
      soort,
      product: [...lijst].sort((a, b) => {
        const aScore = a.image ? 1 : 0;
        const bScore = b.image ? 1 : 0;
        return bScore - aScore || a.price - b.price;
      })[0],
    }));
}
