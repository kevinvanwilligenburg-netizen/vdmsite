"use client";

import { useState } from "react";

/**
 * Een artikel bewaren of weer loslaten.
 *
 * De knop stuurt alleen het artikel mee; bij wie het hoort bepaalt de server
 * aan de hand van de sessie. Zou de browser het e-mailadres meesturen, dan kon
 * iedereen het lijstje van een ander volschrijven.
 */
export function BewaarKnop({
  productId,
  variantId,
  bewaard: startBewaard,
  onGewijzigd,
}: {
  productId: string;
  variantId?: string;
  bewaard: boolean;
  /** Zodat een lijst zichzelf kan verversen nadat er iets af gaat. */
  onGewijzigd?: () => void;
}) {
  const [bewaard, setBewaard] = useState(startBewaard);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function schakel() {
    setBezig(true);
    setFout(null);
    const nieuw = !bewaard;
    try {
      const response = await fetch("/api/account/favorieten", {
        method: nieuw ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFout(data.error ?? "Dat lukte niet.");
        return;
      }
      setBewaard(nieuw);
      onGewijzigd?.();
    } catch {
      setFout("Geen verbinding. Probeer het zo nog eens.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={schakel}
        disabled={bezig}
        aria-pressed={bewaard}
        className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition disabled:opacity-60 ${
          bewaard
            ? "border-brand bg-brand-light text-brand"
            : "border-ink/10 text-ink-soft hover:border-brand hover:text-brand"
        }`}
      >
        {bezig ? "Bezig…" : bewaard ? "Bewaard" : "Bewaren"}
      </button>
      {fout && <span className="mt-1 text-xs font-semibold text-red-700">{fout}</span>}
    </span>
  );
}
