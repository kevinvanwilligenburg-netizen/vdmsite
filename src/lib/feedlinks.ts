import { absoluteUrl, DASHBOARD_API_URL } from "@/lib/site";
import { getProducts } from "@/lib/tilroy";

/**
 * De linkmap voor de Google-feed van het dashboard.
 *
 * Het dashboard maakt een eigen Shopping-feed met één regel per Tilroy-artikel,
 * maar het weet niet op welke pagina zo'n artikel bij ons terechtkomt: onze
 * slugs komen uit de productnaam en veranderen mee als die naam verandert.
 * Daarom leveren wij de adressen aan; artikelen zonder link laat het dashboard
 * uit de feed vallen, liever een kortere feed dan afkeuringen.
 *
 * Er staat nu nog een map van de oude site in ("/nl/<slug>?colour=…"). Die
 * adressen werken vandaag en gaan stuk op het moment dat het domein naar deze
 * site wijst — en onze adressen doen tot dat moment precies het omgekeerde.
 * Daarom staat dit achter een knop en niet in een cron: hij hoort één keer te
 * draaien, bij de omschakeling.
 *
 * Sleutel is het kale Tilroy-sku-nummer. Eén productpagina dekt bij ons alle
 * maten, dus elke variant-sku van een groep wijst naar dezelfde pagina; anders
 * missen de losse blikformaten hun link.
 */
export interface LinkmapResultaat {
  verstuurd: number;
  producten: number;
  doel: string;
  antwoord: string;
}

export async function bouwLinkmap(): Promise<Record<string, string>> {
  const producten = await getProducts();
  const links: Record<string, string> = {};

  for (const product of producten) {
    const adres = absoluteUrl(`/product/${product.slug}`);
    const sleutels = new Set<string>();
    if (product.sku) sleutels.add(product.sku);
    for (const variant of product.variants ?? []) {
      if (variant.sku) sleutels.add(variant.sku);
      /*
       * Ook het fabriekswit-artikel, dat bij ons geen eigen pagina heeft maar
       * een kleurkeuze op déze pagina is.
       *
       * Zonder dit viel het uit de linkmap en hield het in de Google-feed zijn
       * oude /nl/-adres — en dat platform bestaat sinds de domeinomzetting niet
       * meer. Gemeten in één feedpagina van 500: precies vier ontbrekende
       * sku's, alle vier Sikkens-wit, alle vier mét voorraad en foto. Dus wél
       * geadverteerd, niet te bereiken.
       */
      if (variant.wit?.sku) sleutels.add(variant.wit.sku);
    }
    for (const sleutel of sleutels) links[sleutel] = adres;
  }

  return links;
}

export async function stuurLinkmap(): Promise<LinkmapResultaat> {
  const sleutel = process.env.SITE_API_KEY;
  if (!sleutel) throw new Error("SITE_API_KEY ontbreekt; het dashboard weigert dan alles.");

  const links = await bouwLinkmap();
  const producten = new Set(Object.values(links)).size;
  const doel = `${DASHBOARD_API_URL}/api/feed-links`;

  const res = await fetch(doel, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sleutel}`,
    },
    body: JSON.stringify({ site: "vdm", links }),
    signal: AbortSignal.timeout(30000),
  });

  const antwoord = (await res.text()).slice(0, 300);
  if (!res.ok) {
    throw new Error(`Dashboard gaf ${res.status}: ${antwoord}`);
  }

  return { verstuurd: Object.keys(links).length, producten, doel, antwoord };
}
