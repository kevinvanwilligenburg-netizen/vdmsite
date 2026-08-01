"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * De maat (sku) die de klant in het koopblok heeft gekozen.
 *
 * Het voorraadblok is een losse component onder het koopblok, maar toonde de
 * optelsom van álle maten samen: wie 2,5 L koos zag "op voorraad" terwijl
 * alleen de 250 ml ergens lag — en liep daar pas bij het afrekenen tegenaan,
 * want de checkout controleert wél per gekozen maat. Via deze context kijken
 * beide blokken naar dezelfde keuze.
 *
 * Buiten de provider (default) is de sku null en doet zetten niets; de
 * voorraadlijst valt dan terug op alle sku's van het product.
 */
const Context = createContext<{ sku: string | null; zet: (sku: string | null) => void }>({
  sku: null,
  zet: () => undefined,
});

export function useGekozenVariant() {
  return useContext(Context);
}

export function GekozenVariantProvider({ children }: { children: React.ReactNode }) {
  const [sku, zet] = useState<string | null>(null);
  const waarde = useMemo(() => ({ sku, zet }), [sku]);
  return <Context.Provider value={waarde}>{children}</Context.Provider>;
}
