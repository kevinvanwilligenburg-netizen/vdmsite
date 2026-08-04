/**
 * E-commerce-events naar de dataLayer.
 *
 * In Tag Manager staan veertien GA4-eventtags, drie Google Ads-conversietags,
 * zes Meta-pixels en een reeks Squeezely-triggers klaar. Die luisteren
 * allemaal naar dataLayer-events: view_item, add_to_cart, begin_checkout,
 * purchase. Deze site pushte er geen enkele, dus sinds de omzetting kwamen er
 * wel bezoekers binnen maar werd er geen enkele aankoop gemeten — en dan biedt
 * Google Ads op campagnes zonder terugkoppeling.
 *
 * De vorm is die van GA4 Enhanced Ecommerce, want daar zijn de bestaande tags
 * op gebouwd. Bedragen in EURO'S met een punt, niet in centen.
 *
 * Waarom eerst `ecommerce: null`: de dataLayer onthoudt waarden tussen pushes
 * door. Zonder die opschoning lekt het mandje van de vorige stap in de
 * volgende gebeurtenis, en dan meldt "purchase" ook nog de artikelen die de
 * klant onderweg had weggehaald. Google schrijft dit zelf voor en het is de
 * klassieke fout in dit soort koppelingen.
 */

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
}

interface DataLayerVenster {
  dataLayer?: Record<string, unknown>[];
}

function push(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const venster = window as unknown as DataLayerVenster;
  // Zonder Tag Manager bestaat de dataLayer niet; dan maken we hem niet aan.
  // Een array die naar niemand luistert groeit alleen maar.
  if (!Array.isArray(venster.dataLayer)) return;
  venster.dataLayer.push({ ecommerce: null });
  venster.dataLayer.push(payload);
}

/** Centen naar euro's, want de tags rekenen in euro's. */
export function euroWaarde(centen: number): number {
  return Math.round(centen) / 100;
}

export function volgBekekenArtikel(item: AnalyticsItem): void {
  push({
    event: "view_item",
    ecommerce: { currency: "EUR", value: item.price * item.quantity, items: [item] },
  });
}

export function volgToegevoegd(item: AnalyticsItem): void {
  push({
    event: "add_to_cart",
    ecommerce: { currency: "EUR", value: item.price * item.quantity, items: [item] },
  });
}

export function volgVerwijderd(item: AnalyticsItem): void {
  push({
    event: "remove_from_cart",
    ecommerce: { currency: "EUR", value: item.price * item.quantity, items: [item] },
  });
}

export function volgMandje(items: AnalyticsItem[], waarde: number): void {
  push({ event: "view_cart", ecommerce: { currency: "EUR", value: waarde, items } });
}

export function volgAfrekenenGestart(items: AnalyticsItem[], waarde: number): void {
  push({ event: "begin_checkout", ecommerce: { currency: "EUR", value: waarde, items } });
}

/**
 * De aankoop.
 *
 * `transaction_id` is het bestelnummer en niet iets willekeurigs: Google en
 * Meta ontdubbelen daarop. Herlaadt een klant de bedankpagina, dan telt de
 * aankoop maar één keer mee.
 */
export function volgAankoop(params: {
  bestelnummer: string;
  waarde: number;
  verzendkosten: number;
  items: AnalyticsItem[];
}): void {
  push({
    event: "purchase",
    ecommerce: {
      transaction_id: params.bestelnummer,
      currency: "EUR",
      value: params.waarde,
      shipping: params.verzendkosten,
      items: params.items,
    },
  });
}
