import { getColorCollections, searchColors } from "@/lib/colors";
import { pickVariant, sizesOf } from "@/lib/paint-bases";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getProducts } from "@/lib/tilroy";
import type { PaintColor, Product } from "@/lib/types";

/**
 * Google Shopping-feed met kleurvarianten: elk mengbaar Sikkens-product krijgt
 * één regel per kleur ("Sikkens Rubbol SB — Museumgroen"), zodat iemand die op
 * een kleurnaam zoekt ons product vindt in plaats van alleen "Rubbol SB".
 *
 * ⚠️ Geen punt in het routepad (dus niet /shopping-feed.xml): Vercel behandelt
 * een segment met extensie als statisch bestand en draait de route dan nooit.
 * Die fout heeft ons bij de doofinder-feed maanden een 404 gekost.
 *
 * Ontwerpkeuzes:
 * - De prijs per kleurregel komt uit dezelfde functie als de productpagina
 *   (pickVariant: kleur → lichtheid → mengbasis → blik). De regel in de feed
 *   en de pagina waar de klant landt kunnen dus niet uiteenlopen — Google
 *   keurt items af waarvan de prijs niet klopt met de landingspagina.
 * - De link zet de kleur voor via ?kleur=<sleutel>; de productpagina leest
 *   die al. Wie op "Sikkens museumgroen" klikt, ziet museumgroen aan staan.
 * - Standaard de eerste 500 kleuren: eerst Populair, dan RAL Classic, daarna
 *   de Sikkens-waaiers (waar de namen als museumgroen vandaan komen) tot de
 *   grens vol is. Meer kan met ?limit=, een andere waaier met ?waaier=
 *   (herhaalbaar) — zo kunnen er later losse feeds per waaier naast staan,
 *   want Merchant Center accepteert meerdere feedbronnen.
 * - Eén regel per product+kleur, geprijsd op de kleinste maat — dat is ook
 *   de prijs die de pagina opent. item_group_id bindt de kleuren aan elkaar.
 */

export const revalidate = 3600;

const STANDAARD_LIMIET = 500;
const MAX_LIMIET = 5000;
/** Ruim boven wat Merchant aankan slaat de rem aan; log wat er afvalt. */
const MAX_REGELS = 50000;

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function idVorm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);
}

/**
 * Kort, stabiel achtervoegsel zodat twee lange kleursleutels die na afkappen
 * op elkaar lijken tóch een eigen id houden. 260 van de 13.000 regels deelden
 * anders een id — en Google gooit bij een dubbele id beide regels weg.
 */
function vingerafdruk(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  // De volledige hash, niet afgekapt: kleursleutels die alleen achteraan
  // verschillen ("…d5-05-45" naast "…d5-05-75") verschillen vooral in de lage
  // bits, en juist die vielen bij afkappen weg — 52 botsingen op 13.000.
  return h.toString(36);
}

/** Kleurnaam zoals hij in een titel hoort: "RAL 9010 Zuiver wit", "Museumgroen". */
function kleurTitel(kleur: PaintColor): string {
  const code = kleur.code?.trim();
  const naam = kleur.name?.trim();
  if (code && naam && !naam.toLowerCase().includes(code.toLowerCase())) {
    return `${code} ${naam}`;
  }
  return naam || code || "";
}

async function kleurenset(gevraagd: string[], limiet: number): Promise<PaintColor[]> {
  const collections = await getColorCollections();
  // Volgorde bepaalt wie de 500 haalt: Populair en RAL zijn waar klanten om
  // vragen; de Sikkens-waaiers leveren de kleurnámen (museumgroen) die het
  // verschil maken in de zoekresultaten.
  const volgorde =
    gevraagd.length > 0
      ? gevraagd
      : [
          "populair",
          "ral",
          ...collections
            .filter((c) => /sikkens/i.test(c.id) || /sikkens/i.test(c.name))
            .map((c) => c.id),
        ];

  const gekozen: PaintColor[] = [];
  const gezien = new Set<string>();
  const neem = (kleur: PaintColor): void => {
    if (gekozen.length >= limiet) return;
    // Op code ontdubbelen: RAL 9010 zit ook in Populair en in de
    // Sikkens-RAL-waaiers, en drie regels voor dezelfde kleur zijn voor
    // Google duplicaten.
    const sleutel = (kleur.code || kleur.key).toLowerCase();
    if (gezien.has(sleutel)) return;
    gezien.add(sleutel);
    gekozen.push(kleur);
  };
  // Een kleur mét naam ("Monumentengroen") verslaat een kale code
  // ("F8.41.80"): op namen wordt gezocht, en de grote 4041-waaier met alleen
  // codes at anders het hele budget op vóór de waaiers met echte namen aan
  // de beurt kwamen.
  const heeftNaam = (kleur: PaintColor): boolean => {
    const naam = (kleur.name ?? "").trim().toLowerCase();
    const code = (kleur.code ?? "").trim().toLowerCase();
    return naam.length > 2 && naam !== code && !/^[a-z]{0,2}[\d.,]+/.test(naam);
  };

  const perWaaier = await Promise.all(
    volgorde.map((id) => searchColors({ collectionId: id, limit: 600 })),
  );
  for (const { colors } of perWaaier) for (const kleur of colors) if (heeftNaam(kleur)) neem(kleur);
  for (const { colors } of perWaaier) for (const kleur of colors) neem(kleur);
  return gekozen;
}

function regelVoor(product: Product, kleur: PaintColor): string | null {
  const maat = sizesOf(product)[0];
  const variant = pickVariant(product, maat, kleur);
  const prijs = variant?.price ?? product.price;
  if (!prijs || prijs <= 0) return null;
  // Zonder foto keurt Google het item af; dan liever niet insturen.
  if (!product.image) return null;

  const titelKleur = kleurTitel(kleur);
  const link = absoluteUrl(
    `/product/${product.slug}?kleur=${encodeURIComponent(kleur.key)}`,
  );
  const voorradig = product.inStock !== false;

  return [
    "<item>",
    `<g:id>${xml(
      `${product.id}-${idVorm(kleur.code || kleur.key)}-${vingerafdruk(kleur.key)}`,
    )}</g:id>`,
    `<g:item_group_id>${xml(product.id)}</g:item_group_id>`,
    `<g:title>${xml(`${product.name}, ${titelKleur}`)}</g:title>`,
    `<g:description>${xml(
      `${product.name} in ${titelKleur}, gratis op kleur gemengd door onze verfspecialist. ${
        voorradig ? "Vandaag besteld, morgen in huis of gratis afhalen." : ""
      }`.trim(),
    )}</g:description>`,
    `<g:link>${xml(link)}</g:link>`,
    `<g:image_link>${xml(product.image!)}</g:image_link>`,
    // Tweede afbeelding: het kleurvlak zelf. Deze regels gaan over één
    // specifieke kleur ("Sikkens Rubbol in Museumgroen"), maar de foto toont
    // altijd hetzelfde blik. In Google Shopping staan zo tientallen
    // identieke plaatjes naast elkaar; met dit vlak ziet iemand meteen welke
    // kleur hij aanklikt.
    ...(kleur.hex
      ? [
          `<g:additional_image_link>${xml(
            absoluteUrl(
              `/api/kleurplaatje?hex=${encodeURIComponent(kleur.hex)}&code=${encodeURIComponent(
                kleur.code ?? "",
              )}&naam=${encodeURIComponent(kleur.name ?? "")}`,
            ),
          )}</g:additional_image_link>`,
        ]
      : []),
    `<g:availability>${voorradig ? "in stock" : "out of stock"}</g:availability>`,
    `<g:price>${(prijs / 100).toFixed(2)} EUR</g:price>`,
    // Kevin: Google krijgt altijd de Kluspas-prijs te zien. Als sale_price,
    // zodat Google 'm als dé prijs toont terwijl de gewone prijs ernaast
    // blijft bestaan — allebei staan ook zo op de landingspagina.
    ...(variant?.kluspasPrice && variant.kluspasPrice < prijs
      ? [`<g:sale_price>${(variant.kluspasPrice / 100).toFixed(2)} EUR</g:sale_price>`]
      : []),
    `<g:brand>${xml(product.brand)}</g:brand>`,
    `<g:mpn>${xml(variant?.sku ?? product.sku)}</g:mpn>`,
    `<g:condition>new</g:condition>`,
    `<g:color>${xml(titelKleur)}</g:color>`,
    `<g:product_type>${xml("Verf en Beits")}</g:product_type>`,
    "</item>",
  ].join("");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gevraagd = url.searchParams.getAll("waaier");
  const ruwLimiet = Number(url.searchParams.get("limit"));
  const limiet =
    Number.isFinite(ruwLimiet) && ruwLimiet > 0
      ? Math.min(Math.floor(ruwLimiet), MAX_LIMIET)
      : STANDAARD_LIMIET;
  // Standaard Sikkens (daar vroeg Kevin om); ?merk= voor later.
  const merk = (url.searchParams.get("merk") ?? "sikkens").toLowerCase();

  const [producten, kleuren] = await Promise.all([
    getProducts(),
    kleurenset(gevraagd, limiet),
  ]);

  const mengbaar = producten.filter(
    (product) =>
      product.colorMixable && product.brand.trim().toLowerCase() === merk,
  );

  const regels: string[] = [];
  let overgeslagen = 0;
  for (const product of mengbaar) {
    for (const kleur of kleuren) {
      if (regels.length >= MAX_REGELS) {
        overgeslagen++;
        continue;
      }
      const regel = regelVoor(product, kleur);
      if (regel) regels.push(regel);
    }
  }
  if (overgeslagen > 0) {
    console.warn(`[shopping-feed] ${overgeslagen} regels boven het plafond weggelaten`);
  }

  const body = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
    "<channel>",
    `<title>${xml(`${SITE_NAME}, verf op kleur`)}</title>`,
    `<link>${xml(absoluteUrl("/"))}</link>`,
    `<description>${xml(
      "Mengverf per kleur: elke regel is een product in een specifieke kleur, gemengd door onze verfspecialist.",
    )}</description>`,
    ...regels,
    "</channel>",
    "</rss>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Een uur op de CDN; Merchant haalt de feed doorgaans dagelijks op.
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
