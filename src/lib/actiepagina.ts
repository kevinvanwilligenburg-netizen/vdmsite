import { getProducts } from "@/lib/tilroy";
import { isKvEnabled, kvGetJSON, kvSMembers } from "@/lib/kv";
import type { Product } from "@/lib/types";

/**
 * Actiepagina's: een landingspagina met teksten én producten.
 *
 * Kevin: *"maak ook een tool op een actiepagina te maken met producten en
 * teksten."* Dit is de helft die op de site hoort — het tonen. Het samenstellen
 * hoort in het dashboard, naast de banners die hij daar al beheert; dit bestand
 * legt vast wat het dashboard moet wegschrijven.
 *
 * ⚠️ EXTERN CONTRACT — het dashboard SCHRIJFT, de site LEEST:
 *   `actie:<slug>`   → Actiepagina-JSON
 *   `actie:index`    → SET met alle slugs
 *
 * Waarom niet het bestaande `page:<slug>`: dat kent alleen platte tekst. Een
 * actiepagina zonder producten is een folder zonder prijzen — je kunt er niets
 * op leggen in de winkelwagen, en dan is de hele pagina een omweg.
 *
 * Producten worden NIET in de pagina opgeslagen, alleen verwezen (sku's, of een
 * merk/categorie). Zou je titel en prijs meekopiëren, dan staat er over een week
 * een prijs op die nergens meer klopt — precies de fout die we bij de
 * verzendkosten net hebben rechtgezet.
 */

const SLUG_PATROON = /^[a-z0-9-]{1,64}$/;

/** Hoeveel producten een blok maximaal toont; anders wordt het een categorie. */
const MAX_PER_BLOK = 24;

export type Actieblok =
  | { soort: "tekst"; kop?: string; tekst: string }
  | {
      soort: "producten";
      kop?: string;
      tekst?: string;
      /** Handmatige keuze; wint van merk/categorie en houdt de volgorde aan. */
      skus?: string[];
      merk?: string;
      categorie?: string;
      maximaal?: number;
    };

export interface Actiepagina {
  slug: string;
  titel: string;
  /** Eén regel onder de kop; ook de meta-description. */
  intro?: string;
  bannerUrl?: string;
  bannerAlt?: string;
  /** Looptijd, "YYYY-MM-DD". Buiten het venster is de pagina niet zichtbaar. */
  van?: string;
  tot?: string;
  blokken: Actieblok[];
  published?: boolean;
  updatedAt?: string;
}

/** Een blok met de producten er al bij gezocht. */
export type GevuldBlok =
  | { soort: "tekst"; kop?: string; tekst: string }
  | { soort: "producten"; kop?: string; tekst?: string; producten: Product[] };

const SLEUTEL = {
  pagina: (slug: string) => `actie:${slug}`,
  index: "actie:index",
};

function tekst(waarde: unknown, max = 200): string {
  return typeof waarde === "string" ? waarde.trim().slice(0, max) : "";
}

/**
 * Loopt deze actie vandaag?
 *
 * `tot` telt inclusief die dag — net als `promo_tot` in de productfeed, waar
 * het dashboard hetzelfde doet. Twee verschillende antwoorden op "loopt de
 * actie nog" is hoe je een pagina krijgt die reclame maakt voor een prijs die
 * de kassa niet meer rekent.
 */
export function actieLoopt(pagina: Actiepagina, nu: number = Date.now()): boolean {
  const grens = (waarde?: string) => {
    const tijd = waarde ? Date.parse(waarde) : Number.NaN;
    return Number.isNaN(tijd) ? null : tijd;
  };
  const van = grens(pagina.van);
  const tot = grens(pagina.tot);
  if (van !== null && nu < van) return false;
  if (tot !== null && nu > tot + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

/** Leest en controleert wat het dashboard heeft weggeschreven. */
function leesPagina(ruw: unknown, slug: string): Actiepagina | null {
  if (!ruw || typeof ruw !== "object") return null;
  const bron = ruw as Record<string, unknown>;
  const titel = tekst(bron.titel ?? bron.title, 120);
  if (!titel) return null;

  const blokkenRuw = Array.isArray(bron.blokken) ? bron.blokken : [];
  const blokken: Actieblok[] = [];
  for (const item of blokkenRuw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const blok = item as Record<string, unknown>;
    const kop = tekst(blok.kop, 120) || undefined;
    if (blok.soort === "tekst") {
      const inhoud = tekst(blok.tekst, 4000);
      if (inhoud) blokken.push({ soort: "tekst", kop, tekst: inhoud });
      continue;
    }
    if (blok.soort === "producten") {
      const skus = Array.isArray(blok.skus)
        ? blok.skus.map((s) => tekst(s, 40)).filter(Boolean).slice(0, MAX_PER_BLOK)
        : undefined;
      const merk = tekst(blok.merk, 60) || undefined;
      const categorie = tekst(blok.categorie, 60) || undefined;
      // Een productblok zonder enige verwijzing zou een lege kop op de pagina
      // zetten. Dan liever helemaal niet tonen.
      if (!skus?.length && !merk && !categorie) continue;
      const maximaal = Number(blok.maximaal);
      blokken.push({
        soort: "producten",
        kop,
        tekst: tekst(blok.tekst, 1000) || undefined,
        ...(skus?.length ? { skus } : {}),
        ...(merk ? { merk } : {}),
        ...(categorie ? { categorie } : {}),
        ...(Number.isFinite(maximaal) && maximaal > 0
          ? { maximaal: Math.min(MAX_PER_BLOK, Math.floor(maximaal)) }
          : {}),
      });
    }
  }
  if (blokken.length === 0) return null;

  return {
    slug,
    titel,
    intro: tekst(bron.intro ?? bron.description, 300) || undefined,
    bannerUrl: tekst(bron.bannerUrl, 500) || undefined,
    bannerAlt: tekst(bron.bannerAlt, 200) || undefined,
    van: tekst(bron.van, 30) || undefined,
    tot: tekst(bron.tot, 30) || undefined,
    blokken,
    published: bron.published !== false,
    updatedAt: tekst(bron.updatedAt, 40) || undefined,
  };
}

export async function getActiepagina(slug: string): Promise<Actiepagina | null> {
  if (!isKvEnabled() || !SLUG_PATROON.test(slug)) return null;
  const pagina = leesPagina(await kvGetJSON<unknown>(SLEUTEL.pagina(slug)), slug);
  if (!pagina || pagina.published === false) return null;
  return pagina;
}

/** Alle lopende, gepubliceerde acties — voor het overzicht en de sitemap. */
export async function getLopendeActies(): Promise<Actiepagina[]> {
  if (!isKvEnabled()) return [];
  const slugs = (await kvSMembers(SLEUTEL.index)).filter((slug) => SLUG_PATROON.test(slug));
  if (slugs.length === 0) return [];
  const paginas = await Promise.all(slugs.map((slug) => getActiepagina(slug)));
  return paginas
    .filter((pagina): pagina is Actiepagina => Boolean(pagina) && actieLoopt(pagina!))
    .sort((a, b) => a.titel.localeCompare(b.titel, "nl"));
}

/**
 * Zoekt de producten bij elk blok op.
 *
 * Eén keer de catalogus ophalen voor alle blokken samen: die staat in de cache,
 * maar per blok opnieuw filteren over duizenden producten is zonde.
 *
 * Producten die niet meer bestaan verdwijnen stil. Een actiepagina die naar een
 * artikel wijst dat uit het assortiment is, hoort geen kapotte kaart te tonen —
 * die hoort er gewoon één minder te hebben.
 */
export async function vulBlokken(blokken: Actieblok[]): Promise<GevuldBlok[]> {
  const heeftProducten = blokken.some((blok) => blok.soort === "producten");
  const alles = heeftProducten ? await getProducts() : [];

  const perSku = new Map<string, Product>();
  if (heeftProducten) {
    for (const product of alles) {
      perSku.set(product.sku, product);
      for (const variant of product.variants ?? []) perSku.set(variant.sku, product);
    }
  }

  const gelijk = (a: string | undefined, b: string) =>
    (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

  return blokken.map((blok): GevuldBlok => {
    if (blok.soort === "tekst") return blok;

    const grens = blok.maximaal ?? MAX_PER_BLOK;
    let producten: Product[];

    if (blok.skus?.length) {
      // Handmatige keuze houdt de volgorde van het dashboard aan, en een sku
      // die twee keer in de lijst staat telt één keer.
      const gezien = new Set<string>();
      producten = blok.skus
        .map((sku) => perSku.get(sku))
        .filter((product): product is Product => {
          if (!product || gezien.has(product.id)) return false;
          gezien.add(product.id);
          return true;
        });
    } else {
      producten = alles.filter(
        (product) =>
          (!blok.merk || gelijk(product.brand, blok.merk)) &&
          (!blok.categorie || gelijk(product.category, blok.categorie)),
      );
      // Bij een merk- of categorieblok kiest niemand de volgorde, dus zetten
      // we de artikelen met het grootste voordeel vooraan — dat is waar een
      // actiepagina voor is.
      producten.sort((a, b) => voordeel(b) - voordeel(a));
    }

    return { soort: "producten", kop: blok.kop, tekst: blok.tekst, producten: producten.slice(0, grens) };
  });
}

/** Hoeveel scheelt dit artikel met de doorgestreepte prijs, in centen? */
function voordeel(product: Product): number {
  const vanaf = product.compareAtPrice ?? 0;
  return vanaf > product.price ? vanaf - product.price : 0;
}
