/**
 * Prijsweergave: inclusief of exclusief btw.
 *
 * Deze constanten staan bewust in een gewone module en niet bij het
 * schakelaartje zelf. Dat component is een client component, en een waarde die
 * je daaruit importeert in een servercomponent is geen string maar een
 * verwijzing naar de clientmodule — `cookies().get(PRIJS_COOKIE)` zocht dus
 * naar een cookie met de naam `[object Object]` en vond nooit iets. De
 * schakelaar zette de cookie keurig, de server las hem nooit, en de knop
 * sprong bij elke herlading terug naar "incl. btw".
 */
export const PRIJS_COOKIE = "vdm-prijs";

/** Een jaar; de keuze van een zakelijke klant verandert zelden. */
export const PRIJS_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type PrijsModus = "incl" | "excl";

/** Het btw-tarief waarmee we rekenen. Bouwmaterialen en verf: hoog tarief. */
export const BTW_TARIEF = 0.21;

/** Lees de modus uit een cookiewaarde; alles wat geen "excl" is, is inclusief. */
export function prijsModusUit(waarde: string | undefined): PrijsModus {
  return waarde === "excl" ? "excl" : "incl";
}
