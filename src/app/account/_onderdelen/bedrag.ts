import { splitsBtw } from "@/lib/factuur";
import { euro, euros } from "@/lib/format";
import { BTW_TARIEF, type PrijsModus } from "@/lib/prijs";

/**
 * Bedragen in het account volgen de knop "incl./excl. btw".
 *
 * Een schilder die de site op excl. btw heeft staan, hoort dat in zijn eigen
 * overzicht ook terug te zien — anders staat op de productpagina € 148,25 en
 * in zijn bestellingen € 179,39, en gaat hij tellen of hij twee keer betaalt.
 *
 * De opgeslagen bedragen zijn altijd inclusief btw; dat is wat er is
 * afgerekend. Excl. btw is dus een weergave, en we rekenen terug — net als op
 * de factuur, zodat er geen cent verschil ontstaat met wat er van de rekening
 * is gegaan.
 */

/** Bedrag uit een bestelling (euro's, zoals in het ordercontract). */
export function toonEuros(bedrag: number, modus: PrijsModus): string {
  return euros(modus === "excl" ? splitsBtw(bedrag).exclusief : bedrag);
}

/** Bedrag uit de catalogus of de winkelwagen (centen). */
export function toonCenten(centen: number, modus: PrijsModus): string {
  return euro(modus === "excl" ? Math.round(centen / (1 + BTW_TARIEF)) : centen);
}

/** Het label dat bij de getoonde bedragen hoort. */
export function btwLabel(modus: PrijsModus): string {
  return modus === "excl" ? "excl. btw" : "incl. btw";
}
