"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "vdm-winkel-v1";

export interface StoreOption {
  slug: string;
  city: string;
  address: string;
  name: string;
}

interface StoreContextValue {
  stores: StoreOption[];
  /** De gekozen winkel, of null zolang de klant nog niets koos. */
  favourite: StoreOption | null;
  hydrated: boolean;
  setFavourite: (slug: string) => void;
  clearFavourite: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Onthoudt de favoriete winkel van de klant (lokaal in de browser, net als de
 * winkelwagen). Die keuze stuurt de voorraadweergave op productpagina's, de
 * afhaalbelofte en de voorselectie bij het afrekenen.
 */
export function StoreProvider({
  stores,
  children,
}: {
  stores: StoreOption[];
  children: ReactNode;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && stores.some((store) => store.slug === stored)) setSlug(stored);
    } catch {
      // opslag geblokkeerd; dan kiest de klant deze sessie opnieuw
    }
    setHydrated(true);
  }, [stores]);

  const setFavourite = useCallback((next: string) => {
    setSlug(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // niet erg: de keuze geldt dan alleen deze sessie
    }
  }, []);

  const clearFavourite = useCallback(() => {
    setSlug(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
  }, []);

  const value = useMemo<StoreContextValue>(() => {
    const favourite = stores.find((store) => store.slug === slug) ?? null;
    return { stores, favourite, hydrated, setFavourite, clearFavourite };
  }, [stores, slug, hydrated, setFavourite, clearFavourite]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore moet binnen een StoreProvider gebruikt worden");
  }
  return context;
}
