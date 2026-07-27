const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

/** Formatteer een bedrag in CENTEN (catalogus/winkelwagen). */
export function euro(cents: number): string {
  return euroFormatter.format(cents / 100);
}

/** Formatteer een bedrag in EURO'S (bestellingen volgens het ordercontract). */
export function euros(amount: number): string {
  return euroFormatter.format(amount);
}

export function discountPct(price: number, compareAtPrice: number): number {
  return Math.round((1 - price / compareAtPrice) * 100);
}
