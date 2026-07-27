"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";

export function CartBadge() {
  const { count, hydrated } = useCart();
  return (
    <Link
      href="/winkelwagen"
      className="relative inline-flex items-center gap-2 rounded-lg border-2 border-ink/10 px-3 py-2 font-bold text-ink transition hover:border-brand hover:text-brand"
    >
      <span className="text-xl" aria-hidden>
        🛒
      </span>
      <span className="hidden sm:inline">Winkelwagen</span>
      {hydrated && count > 0 && (
        <span
          aria-label={`${count} artikelen in winkelwagen`}
          className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-black text-white shadow"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
