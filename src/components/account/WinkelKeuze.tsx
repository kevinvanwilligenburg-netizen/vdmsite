"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { useStore } from "@/components/store/StoreProvider";

/**
 * "Waar kom je meestal?" — één keer vragen bij een nieuwe klant.
 *
 * Die keuze bepaalt welke voorraad hij als eerste ziet en welke winkel bij het
 * afrekenen voorgeselecteerd staat. Hij stond alleen in de winkelkiezer in de
 * kop, en die bewaart lokaal: op een telefoon begon iedereen weer overnieuw.
 *
 * "Ik bestel liever online" is een volwaardig antwoord en geen ontwijking.
 * Zonder die knop blijft de vraag terugkomen bij klanten die nooit in de
 * winkel komen, en dat is precies het soort herhaling waar mensen moe van
 * worden.
 */
export function WinkelKeuze({
  winkels,
}: {
  winkels: { slug: string; stad: string; adres: string }[];
}) {
  const router = useRouter();
  const { setFavourite } = useStore();
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function kies(winkel: string) {
    setBezig(winkel);
    setFout(null);
    try {
      const res = await fetch("/api/account/winkel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winkel }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Bewaren lukte niet.");
      // Ook lokaal zetten, zodat de kop en de productpagina's meteen kloppen
      // zonder dat de klant hoeft te verversen.
      if (winkel !== "online") setFavourite(winkel);
      router.refresh();
    } catch (probleem) {
      setFout(probleem instanceof Error ? probleem.message : "Bewaren lukte niet.");
      setBezig(null);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2 text-lg font-black text-ink">
        <Icon name="pin" className="h-5 w-5 text-brand" />
        Waar kom je meestal?
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Dan zie je meteen wat er in jouw winkel ligt, en staat die klaar bij het
        afrekenen. Je kunt het later altijd wijzigen.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {winkels.map((winkel) => (
          <button
            key={winkel.slug}
            type="button"
            disabled={bezig !== null}
            onClick={() => kies(winkel.slug)}
            className="rounded-xl border-2 border-ink/10 p-4 text-left transition hover:border-brand disabled:opacity-60"
          >
            <span className="block font-bold text-ink">{winkel.stad}</span>
            <span className="block text-sm text-ink-soft">{winkel.adres}</span>
          </button>
        ))}
        <button
          type="button"
          disabled={bezig !== null}
          onClick={() => kies("online")}
          className="rounded-xl border-2 border-ink/10 p-4 text-left transition hover:border-brand disabled:opacity-60"
        >
          <span className="block font-bold text-ink">Ik bestel liever online</span>
          <span className="block text-sm text-ink-soft">Laat maar bezorgen</span>
        </button>
      </div>

      {fout && (
        <p role="alert" className="mt-3 text-sm font-semibold text-brand-dark">
          {fout}
        </p>
      )}
    </section>
  );
}
