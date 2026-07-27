import type { Store } from "@/lib/types";

// Openingstijden zoals op devoordeelmarkt.nl (alle vestigingen gelijk).
const standardHours: Store["openingHours"] = [
  { day: "Maandag", hours: "08:00 – 18:00" },
  { day: "Dinsdag", hours: "08:00 – 18:00" },
  { day: "Woensdag", hours: "08:00 – 18:00" },
  { day: "Donderdag", hours: "08:00 – 18:00" },
  { day: "Vrijdag", hours: "08:00 – 18:00" },
  { day: "Zaterdag", hours: "08:00 – 17:00" },
  { day: "Zondag", hours: "Gesloten" },
];

// De vijf vestigingen van De Voordeelmarkt (bron: devoordeelmarkt.nl).
// tilroyShopId = vestigings-id in Tilroy, tevens de key in de
// voorraad-feed van het VDM-dashboard (shops: {"7827": 4, ...}).
export const demoStores: Store[] = [
  {
    id: "nijverdal",
    tilroyShopId: "7827",
    slug: "nijverdal",
    name: "De Voordeelmarkt Nijverdal",
    address: "Nijverheidsweg 2",
    postalCode: "7442 CH",
    city: "Nijverdal",
    phone: "0548 626 190",
    email: "nijverdal@devoordeelmarkt.nl",
    openingHours: standardHours,
  },
  {
    id: "apeldoorn",
    tilroyShopId: "8626",
    slug: "apeldoorn",
    name: "De Voordeelmarkt Apeldoorn",
    address: "Auroralaan 39",
    postalCode: "7321 BN",
    city: "Apeldoorn",
    phone: "055 541 3463",
    email: "apeldoorn@devoordeelmarkt.nl",
    openingHours: standardHours,
  },
  {
    id: "deventer",
    tilroyShopId: "8628",
    slug: "deventer",
    name: "De Voordeelmarkt Deventer",
    address: "Boxbergerweg 127-A",
    postalCode: "7413 EN",
    city: "Deventer",
    phone: "0570 633 012",
    email: "deventer@devoordeelmarkt.nl",
    openingHours: standardHours,
  },
  {
    id: "zutphen",
    tilroyShopId: "8629",
    slug: "zutphen",
    name: "De Voordeelmarkt Zutphen",
    address: "Gerritsenweg 2",
    postalCode: "7202 BP",
    city: "Zutphen",
    phone: "0575 540 880",
    email: "zutphen@devoordeelmarkt.nl",
    openingHours: standardHours,
  },
  {
    id: "emmen",
    tilroyShopId: "8627",
    slug: "emmen",
    name: "De Voordeelmarkt Emmen",
    address: "Nijbracht 35",
    postalCode: "7821 CB",
    city: "Emmen",
    phone: "0591 820 439",
    email: "emmen@devoordeelmarkt.nl",
    openingHours: standardHours,
  },
];

export function mapsUrl(store: Store): string {
  const query = `${store.name}, ${store.address}, ${store.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
