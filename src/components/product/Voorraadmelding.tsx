"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";

/**
 * "Mail mij zodra dit er weer is", op een uitverkocht artikel.
 *
 * Uitverkochte artikelen zijn niet te bestellen. Zonder dit formulier is de
 * productpagina dan een doodlopende weg: de klant kwam ergens voor, ziet dat
 * het er niet is, en vertrekt. Eén regel invullen kost hem niets en levert
 * ons een klant op die terugkomt op het moment dat het er wél is.
 */
export function Voorraadmelding({
  sku,
  slug,
  naam,
}: {
  sku: string;
  slug: string;
  naam: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"leeg" | "bezig" | "gelukt" | "fout">("leeg");
  const [melding, setMelding] = useState("");

  async function verstuur(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("bezig");
    try {
      const res = await fetch("/api/voorraadmelding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, slug, naam, email: email.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Aanmelden lukte niet.");
      setStatus("gelukt");
    } catch (fout) {
      setStatus("fout");
      setMelding(fout instanceof Error ? fout.message : "Aanmelden lukte niet.");
    }
  }

  if (status === "gelukt") {
    return (
      <div className="card flex items-start gap-3 p-4">
        <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0 text-green-700" strokeWidth={3} />
        <div>
          <p className="font-black text-green-700">We geven je een seintje</p>
          <p className="text-sm text-ink-soft">
            Zodra {naam} weer binnen is, krijg je een mail op {email.trim()}. Daarna
            gooien we je adres weer weg.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={verstuur} className="card p-4">
      <p className="font-black text-ink">Nu even uitverkocht</p>
      <p className="mt-0.5 text-sm text-ink-soft">
        Laat je e-mailadres achter, dan mailen we je zodra {naam} weer op voorraad is.
      </p>
      <div className="mt-3 flex gap-2">
        <label htmlFor={`melding-${sku}`} className="sr-only">
          E-mailadres
        </label>
        <input
          id={`melding-${sku}`}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="jouw@email.nl"
          className="input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={status === "bezig"}
          className="btn btn-primary shrink-0 disabled:opacity-60"
        >
          {status === "bezig" ? "Bezig…" : "Hou me op de hoogte"}
        </button>
      </div>
      {status === "fout" && (
        <p role="alert" className="mt-2 text-sm font-semibold text-brand-dark">
          {melding}
        </p>
      )}
    </form>
  );
}
