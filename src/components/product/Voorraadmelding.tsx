"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { WHATSAPP_NUMMER } from "@/lib/site";

/**
 * "Geef me een seintje zodra dit er weer is", op een uitverkocht artikel.
 *
 * Uitverkochte artikelen blijven gewoon staan — de klant zoekt op een maat en
 * moet zien dát we hem voeren — maar zijn niet te bestellen. Zonder dit
 * formulier is de pagina dan een doodlopende weg: hij kwam ergens voor, ziet
 * dat het er niet is, en vertrekt naar de concurrent.
 *
 * Twee wegen, omdat mensen verschillen: een mailtje, of een appje. WhatsApp
 * loopt via ons eigen nummer — de klant opent een gesprek met de winkel en
 * daar ligt zijn vraag, zichtbaar voor de collega die 'm terugbelt zodra de
 * levering binnen is. Dat vraagt geen adres van hem en geen koppeling van ons.
 */
export function Voorraadmelding({
  sku,
  slug,
  naam,
  maat,
  whatsappNummer,
}: {
  sku: string;
  slug: string;
  naam: string;
  /** De uitverkochte maat, als het om één maat gaat ("2,5 L"). */
  maat?: string;
  whatsappNummer?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"leeg" | "bezig" | "gelukt" | "fout">("leeg");
  const [melding, setMelding] = useState("");

  const omschrijving = maat ? `${naam} (${maat})` : naam;
  const nummer = (whatsappNummer ?? WHATSAPP_NUMMER ?? "").replace(/[^\d]/g, "");
  const appTekst = `Hoi! Houden jullie mij op de hoogte zodra ${omschrijving} weer op voorraad is? (artikelnummer ${sku})`;

  async function verstuur(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("bezig");
    try {
      const res = await fetch("/api/voorraadmelding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, slug, naam: omschrijving, email: email.trim() }),
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
            Zodra {omschrijving} weer binnen is, krijg je een mail op {email.trim()}. Daarna
            gooien we je adres weer weg.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={verstuur} className="card p-4">
      <p className="font-black text-ink">
        {maat ? `${maat} is nu uitverkocht` : "Nu even uitverkocht"}
      </p>
      <p className="mt-0.5 text-sm text-ink-soft">
        Laat je e-mailadres achter of stuur ons een appje, dan laten we het weten
        zodra {omschrijving} weer op voorraad is.
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
      {nummer && (
        <a
          href={`https://wa.me/${nummer}?text=${encodeURIComponent(appTekst)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline"
        >
          <Icon name="chat" className="h-4 w-4" />
          Liever via WhatsApp
        </a>
      )}
      {status === "fout" && (
        <p role="alert" className="mt-2 text-sm font-semibold text-brand-dark">
          {melding}
        </p>
      )}
    </form>
  );
}
