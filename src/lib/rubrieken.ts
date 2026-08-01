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
 * Op naam en niet op slug. De slugs waren ooit leesbaar ("lakken"), maar sinds
 * de hoofdgroepen van Tilroy zijn het codes (g1000). Alle zes regels wezen
 * daardoor naar niets en de balk viel stilletjes terug op "de grootste
 * rubrieken" — wat er toevallig goed uitzag, maar niets met deze keuze te
 * maken had. /api/menucheck meldt het nu als een rubriek niet meer bestaat.
 */
export const HOOFDRUBRIEKEN = [
  "Verf en Beits",
  "Verfbenodigdheden",
  "IJzerwaren",
  "Behang en wandbekleding",
  "Lijmen en kitten",
  "Gereedschap",
];

/** Staat deze rubriek vast in de balk? Vergelijkt op naam, hoofdletterloos. */
export function isHoofdrubriek(naam: string): boolean {
  const gezocht = naam.trim().toLocaleLowerCase("nl");
  return HOOFDRUBRIEKEN.some((vast) => vast.toLocaleLowerCase("nl") === gezocht);
}

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
