import type { Store } from "@/lib/types";

const standardHours: Store["openingHours"] = [
  { day: "Maandag", hours: "09:00 – 18:00" },
  { day: "Dinsdag", hours: "09:00 – 18:00" },
  { day: "Woensdag", hours: "09:00 – 18:00" },
  { day: "Donderdag", hours: "09:00 – 18:00" },
  { day: "Vrijdag", hours: "09:00 – 21:00" },
  { day: "Zaterdag", hours: "09:00 – 17:00" },
  { day: "Zondag", hours: "Gesloten" },
];

const sundayOpenHours: Store["openingHours"] = standardHours.map((entry) =>
  entry.day === "Zondag" ? { day: "Zondag", hours: "12:00 – 17:00" } : entry,
);

// Demo-winkeldata: wordt vervangen door de winkels uit Tilroy zodra
// TILROY_API_KEY is ingesteld (zie lib/tilroy.ts).
export const demoStores: Store[] = [
  {
    id: "goes",
    slug: "goes",
    name: "De Voordeelmarkt Goes",
    address: "Grote Markt 12",
    postalCode: "4461 AJ",
    city: "Goes",
    phone: "0113 - 21 20 20",
    openingHours: sundayOpenHours,
  },
  {
    id: "middelburg",
    slug: "middelburg",
    name: "De Voordeelmarkt Middelburg",
    address: "Langeviele 8",
    postalCode: "4331 LT",
    city: "Middelburg",
    phone: "0118 - 63 40 40",
    openingHours: standardHours,
  },
  {
    id: "vlissingen",
    slug: "vlissingen",
    name: "De Voordeelmarkt Vlissingen",
    address: "Walstraat 45",
    postalCode: "4381 GE",
    city: "Vlissingen",
    phone: "0118 - 41 55 55",
    openingHours: sundayOpenHours,
  },
  {
    id: "terneuzen",
    slug: "terneuzen",
    name: "De Voordeelmarkt Terneuzen",
    address: "Noordstraat 22",
    postalCode: "4531 GG",
    city: "Terneuzen",
    phone: "0115 - 61 30 30",
    openingHours: standardHours,
  },
  {
    id: "zierikzee",
    slug: "zierikzee",
    name: "De Voordeelmarkt Zierikzee",
    address: "Havenpark 3",
    postalCode: "4301 JG",
    city: "Zierikzee",
    phone: "0111 - 41 25 25",
    openingHours: standardHours,
  },
  {
    id: "hulst",
    slug: "hulst",
    name: "De Voordeelmarkt Hulst",
    address: "Steenstraat 15",
    postalCode: "4561 AR",
    city: "Hulst",
    phone: "0114 - 31 45 45",
    openingHours: standardHours,
  },
];

export function mapsUrl(store: Store): string {
  const query = `${store.name}, ${store.address}, ${store.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
