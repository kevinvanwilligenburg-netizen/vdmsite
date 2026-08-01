/**
 * Categorieën die vast in de menubalk staan, in deze volgorde.
 *
 * Sinds de indeling van Tilroy wordt gevolgd zijn er 58 categorieën; die
 * passen niet op één regel. De rest zit achter "Alle categorieën". Deze zes
 * dekken samen driekwart van het assortiment.
 *
 * Deze lijst staat bewust in een eigen bestand en niet bij de catalogus: het
 * menu draait in de browser, en `lib/product-feed` trekt de Redis-client en
 * `node:crypto` mee. Dat brak de build met "Reading from node:assert is not
 * handled by plugins" — een foutmelding die niet verraadt dat het om een
 * import in een client-component gaat.
 *
 * ⚠️ De slugs komen uit Tilroy. Verandert daar een categorienaam, dan wijst
 * een regel hier naar niets en verdwijnt die stilletjes uit de balk; het menu
 * slaat onbekende slugs over. Controleer na een naamswijziging of er nog zes
 * rubrieken staan.
 */
export const HOOFDRUBRIEKEN = [
  "lakken",
  "muurverf",
  "schildersger-en-schuurpapier",
  "behang",
  "bevestigingsmaterialen",
  "handgereedschap",
];

/**
 * Namen die in de kassa als categorie staan maar er geen zijn: leveranciers
 * (Euromat), inkoopsoorten (Partijhandel) en vergaarbakken (Diversen). Ze
 * horen niet in het menu, niet in het kruimelpad en niet als "Type" in de
 * specificaties — "Home › Euromat › Glitsa vloerlak" zegt een klant niets.
 *
 * Staat hier en niet bij de catalogus, om dezelfde reden als de lijst
 * hierboven: dit wordt ook vanuit de browser gebruikt.
 */
const GEEN_RUBRIEK = new Set([
  "euromat",
  "partij-verf",
  "partijhandel",
  "diversen",
  "toebehoren",
  "verf",
]);

export function toonbareRubriek(naam: string): boolean {
  return !GEEN_RUBRIEK.has(naam.trim().toLocaleLowerCase("nl"));
}
