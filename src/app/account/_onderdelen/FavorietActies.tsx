"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import type { CartItem } from "@/lib/types";

/**
 * Wat je met een bewaard artikel kunt doen: in het mandje leggen of loslaten.
 *
 * De winkelwagenregel komt kant-en-klaar van de server, met de prijs van
 * vandaag uit de catalogus. Zo staat er nooit een bedrag in het mandje dat de
 * browser zelf heeft bedacht of dat nog van vorige maand is.
 */
export function InMandje({ regel }: { regel: Omit<CartItem, "qty"> }) {
  const { addItem } = useCart();
  const [toegevoegd, setToegevoegd] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addItem(regel, 1);
        setToegevoegd(true);
      }}
      disabled={toegevoegd}
      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:bg-ink/20"
    >
      {toegevoegd ? "In je mandje" : "In winkelwagen"}
    </button>
  );
}

export function VerwijderFavoriet({
  productId,
  variantId,
}: {
  productId: string;
  variantId?: string;
}) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={bezig}
        onClick={async () => {
          setBezig(true);
          setFout(null);
          try {
            const response = await fetch("/api/account/favorieten", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId, variantId }),
            });
            if (!response.ok) {
              const data = (await response.json()) as { error?: string };
              setFout(data.error ?? "Dat lukte niet.");
              return;
            }
            // De lijst komt van de server; die haalt hem opnieuw op zodat er
            // geen versie in beeld blijft die niet meer klopt.
            router.refresh();
          } catch {
            setFout("Geen verbinding. Probeer het zo nog eens.");
          } finally {
            setBezig(false);
          }
        }}
        className="text-sm font-bold text-ink-soft underline transition hover:text-brand disabled:opacity-60"
      >
        {bezig ? "Bezig…" : "Verwijderen"}
      </button>
      {fout && <span className="mt-1 text-xs font-semibold text-red-700">{fout}</span>}
    </span>
  );
}
