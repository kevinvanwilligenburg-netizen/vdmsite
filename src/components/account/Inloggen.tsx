"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";

/**
 * Inloggen in twee stappen: e-mailadres, dan de code die daarheen gaat.
 *
 * Geen wachtwoord. Dat scheelt de klant een wachtwoord dat hij toch vergeet,
 * en ons het bewaren ervan. Het Kluspas-nummer is bewust géén inlogmiddel:
 * dat is een oplopend nummer en dus te raden.
 */
export function Inloggen() {
  const router = useRouter();
  const [stap, setStap] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function vraagCode(event: React.FormEvent) {
    event.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      const response = await fetch("/api/account/inloggen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) setFout(data.error ?? "Er ging iets mis.");
      else setStap("code");
    } catch {
      setFout("We konden je aanvraag niet versturen. Controleer je verbinding.");
    } finally {
      setBezig(false);
    }
  }

  async function controleer(event: React.FormEvent) {
    event.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      const response = await fetch("/api/account/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) setFout(data.error ?? "Die code klopt niet.");
      else router.refresh();
    } catch {
      setFout("We konden de code niet controleren. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-black uppercase text-ink">Mijn Voordeelmarkt</h1>
        <p className="mt-2 text-ink-soft">
          {stap === "email"
            ? "Log in met je e-mailadres. Je krijgt een code van ons — geen wachtwoord nodig."
            : `We hebben een code gestuurd naar ${email}. Vul hem hieronder in.`}
        </p>

        {stap === "email" ? (
          <form onSubmit={vraagCode} className="mt-6 space-y-4">
            <div>
              <label htmlFor="account-email" className="mb-1 block text-sm font-bold text-ink">
                E-mailadres
              </label>
              <input
                id="account-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input"
                placeholder="jij@voorbeeld.nl"
              />
            </div>
            <button
              type="submit"
              disabled={bezig}
              className="btn btn-primary w-full disabled:opacity-60"
            >
              {bezig ? "Bezig…" : "Stuur mij een code"}
            </button>
          </form>
        ) : (
          <form onSubmit={controleer} className="mt-6 space-y-4">
            <div>
              <label htmlFor="account-code" className="mb-1 block text-sm font-bold text-ink">
                Code uit je mail
              </label>
              <input
                id="account-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                className="input text-center text-2xl font-black tracking-[0.4em]"
                placeholder="000000"
              />
            </div>
            <button
              type="submit"
              disabled={bezig || code.length !== 6}
              className="btn btn-primary w-full disabled:opacity-60"
            >
              {bezig ? "Controleren…" : "Inloggen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStap("email");
                setCode("");
                setFout(null);
              }}
              className="w-full text-sm font-semibold text-ink-soft hover:text-brand"
            >
              Ander e-mailadres gebruiken
            </button>
          </form>
        )}

        {fout && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {fout}
          </p>
        )}

        <ul className="mt-6 space-y-2 border-t border-ink/10 pt-6 text-sm text-ink-soft">
          {[
            "Je Kluspas en kluspunten bij de hand",
            "Al je aankopen, online én uit de winkel",
            "Sneller bestellen met je bewaarde gegevens",
          ].map((punt) => (
            <li key={punt} className="flex items-start gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={3} />
              {punt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
