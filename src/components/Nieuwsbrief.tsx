"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";

/**
 * Aanmelden voor de nieuwsbrief.
 *
 * Eén veld en een knop. Geen naam vragen: elk extra veld kost aanmeldingen, en
 * we hebben de naam niet nodig om een actie te mailen.
 *
 * De toestemmingstekst staat er zichtbaar bij en niet in kleine lettertjes
 * achter een link. Dat is geen vormkwestie — toestemming moet "geïnformeerd"
 * zijn, en tekst die je moet zoeken telt niet mee.
 */
export function Nieuwsbrief({
  bron = "footer",
  donker = false,
}: {
  bron?: "footer" | "account";
  /** In de footer staat alles op zwart; daar moet de tekst wit zijn. */
  donker?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const verstuur = async (event: React.FormEvent) => {
    event.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/nieuwsbrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, bron }),
      });
      const data = (await res.json()) as { ok?: boolean; bericht?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Aanmelden lukte niet.");
      setKlaar(data.bericht ?? "Check je mail om je aanmelding te bevestigen.");
      setEmail("");
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Aanmelden lukte niet.");
    } finally {
      setBezig(false);
    }
  };

  const kop = donker ? "text-white" : "text-ink";
  const zacht = donker ? "text-white/70" : "text-ink-soft";

  if (klaar) {
    return (
      <p className={`flex items-start gap-2 text-sm font-semibold ${kop}`}>
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
        {klaar}
      </p>
    );
  }

  return (
    <form onSubmit={verstuur} className="w-full">
      <label htmlFor="nb-email" className={`block text-sm font-black ${kop}`}>
        Nieuwsbrief
      </label>
      <p className={`mt-1 text-sm ${zacht}`}>
        Acties, klustips en nieuwe producten. Eens per maand, niet vaker.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="nb-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input min-w-0 flex-1"
          placeholder="jouw@email.nl"
          autoComplete="email"
        />
        <button type="submit" disabled={bezig} className="btn btn-primary shrink-0 disabled:opacity-60">
          {bezig ? "Bezig…" : "Aanmelden"}
        </button>
      </div>
      {fout && (
        <p role="alert" className="mt-2 text-sm font-semibold text-brand-dark">
          {fout}
        </p>
      )}
      <p className={`mt-2 text-xs ${zacht}`}>
        Je krijgt eerst een mail om je aanmelding te bevestigen. Afmelden kan met
        één klik in elke nieuwsbrief.
      </p>
    </form>
  );
}
