import type { PaintColor } from "@/lib/types";

/**
 * Kleine hulpjes om kleuren en waaiers overal hetzelfde te benoemen, gedeeld
 * door de serverkant (de lijst met waaiers) en de kiezer in de browser.
 * Bewust zonder "use client", zodat beide kanten hem kunnen gebruiken.
 */

export interface Waaier {
  id: string;
  name: string;
  count: number;
}

/** Pseudo-waaier: zoek door alles heen. */
export const ALLE_WAAIERS = "alle";

const RAL = "ral";

/**
 * De naam van een waaier zoals we hem tonen.
 *
 * De RAL-waaier krijgt zijn naam uit de eerste kleur die we tegenkomen, en dat
 * is "RAL Classic – Geel". Als waaiernaam klopt dat niet: de waaier heet RAL
 * Classic en die gelen zijn er maar één groep uit.
 */
export function waaierNaam(waaier: { id: string; name: string }): string {
  return waaier.id === RAL ? "RAL Classic" : waaier.name;
}

/**
 * Controleert een waaier-id dat van buiten komt (uit de URL, dus). Alleen een
 * id dat echt in de lijst staat mag de kiezer sturen.
 */
export function bestaandeWaaier(
  id: string | null | undefined,
  waaiers: Waaier[],
): string | null {
  if (!id) return null;
  if (id === ALLE_WAAIERS) return ALLE_WAAIERS;
  return waaiers.some((waaier) => waaier.id === id) ? id : null;
}

/**
 * Hoe een kleur benoemd wordt: één regel om op te vallen, één om hem terug te
 * vinden.
 *
 * De waaiers zijn niet gelijk gevuld. Meestal staat de kleurcode in het
 * naamveld en is het codeveld leeg; in de Flexa Colors-waaier staat in het
 * naamveld de streepjescode van het mengblik — dertien cijfers die een klant
 * niets zeggen. Dan is de kleurcode het enige bruikbare label.
 */
export function kleurLabel(color: PaintColor): { titel: string; onder: string } {
  const naam = (color.name ?? "").trim();
  const code = (color.code ?? "").trim();
  const streepjescode = /^\d{8,14}$/.test(naam);
  const titel = streepjescode ? code || naam : naam;
  const waaier = waaierNaam({ id: color.collectionId ?? "", name: color.group ?? "" });
  const onder = [code === titel ? "" : code, waaier].filter(Boolean).join(" · ");
  return { titel, onder };
}
