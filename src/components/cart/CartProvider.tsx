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

import {
  euroWaarde,
  volgToegevoegd,
  volgVerwijderd,
  type AnalyticsItem,
} from "@/lib/analytics";

/**
 * Een winkelwagenregel in de vorm die de meettags verwachten.
 *
 * De prijs gaat naar euro's: onze bedragen staan in centen, GA4 en Meta
 * rekenen in de valuta zelf. Een mandje van € 24,95 dat als 2495 doorkomt,
 * maakt van je Ads-rapport een fantasie.
 */
function alsAnalyticsItem(item: {
  productId: string;
  name: string;
  variantName?: string;
  unitPrice: number;
  qty: number;
}): AnalyticsItem {
  return {
    item_id: item.productId,
    item_name: item.name,
    ...(item.variantName ? { item_variant: item.variantName } : {}),
    price: euroWaarde(item.unitPrice),
    quantity: item.qty,
  };
}

import type { CartItem } from "@/lib/types";

const STORAGE_KEY = "vdm-cart-v1";

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  /**
   * Het laatst toegevoegde artikel, voor de bevestiging die daarna opent.
   * `null` zodra die bevestiging gesloten is.
   */
  laatstToegevoegd: CartItem | null;
  sluitBevestiging: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // corrupt of geblokkeerd localStorage: start met lege wagen
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // opslag niet beschikbaar; winkelwagen werkt dan alleen in deze sessie
    }
  }, [items, hydrated]);

  const [laatstToegevoegd, setLaatstToegevoegd] = useState<CartItem | null>(null);

  const addItem = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    const aantal = Math.max(1, Math.min(99, qty));
    setItems((prev) => {
      const index = prev.findIndex((entry) => entry.key === item.key);
      if (index >= 0) {
        const next = [...prev];
        next[index] = {
          ...next[index],
          qty: Math.min(99, next[index].qty + aantal),
        };
        return next;
      }
      return [...prev, { ...item, qty: aantal }];
    });
    setLaatstToegevoegd({ ...item, qty: aantal });
    // Hier en niet in de knoppen: de winkelwagen wordt vanaf de productpagina,
    // de kleurkiezer, het klusadvies en de bijverkoop gevuld. Eén plek betekent
    // dat er nooit een route bijkomt die stilletjes niet meet.
    volgToegevoegd(alsAnalyticsItem({ ...item, qty: aantal }));
  }, []);

  const sluitBevestiging = useCallback(() => setLaatstToegevoegd(null), []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((entry) => entry.key !== key)
        : prev.map((entry) =>
            entry.key === key ? { ...entry, qty: Math.min(99, qty) } : entry,
          ),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const weg = prev.find((entry) => entry.key === key);
      if (weg) volgVerwijderd(alsAnalyticsItem(weg));
      return prev.filter((entry) => entry.key !== key);
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    return {
      items,
      count,
      subtotal,
      hydrated,
      addItem,
      setQty,
      removeItem,
      clear,
      laatstToegevoegd,
      sluitBevestiging,
    };
  }, [
    items,
    hydrated,
    addItem,
    setQty,
    removeItem,
    clear,
    laatstToegevoegd,
    sluitBevestiging,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart moet binnen een CartProvider gebruikt worden");
  }
  return context;
}
