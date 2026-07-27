const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function euro(cents: number): string {
  return euroFormatter.format(cents / 100);
}

export function discountPct(price: number, compareAtPrice: number): number {
  return Math.round((1 - price / compareAtPrice) * 100);
}
