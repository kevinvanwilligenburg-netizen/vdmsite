"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Inloggen zonder de pagina te verlaten.
 *
 * Op de checkout stond een knop naar de accountpagina om de korting te
 * krijgen. Dat is een sprong weg van het afrekenen op het moment dat de klant
 * er bijna is — en wie wegklikt komt lang niet altijd terug, ook niet met een
 * `verder`-parameter die hem netjes terugbrengt.
 *
 * Dezelfde twee stappen, maar dan hier: adres, code, klaar. Na het inloggen
 * verversen we de pagina zodat de server de korting doorrekent; het ingevulde
 * bestelformulier blijft staan, want dat leeft in dezelfde component-state.
 */
export function InlogInline({
  startEmail = "",
  onKlaar,
}: {
  /** Voorvullen met het adres dat de klant al invulde voor de bestelling. */
  startEmail?: string;
  onKlaar?: () => void;
}) {
  const router = useRouter();
  const [stap, setStap] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(startEmail);
  const [code, setCode] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function vraagCode(event?: React.SyntheticEvent) {
    event?.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/account/inloggen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) setFout(data.error ?? "Er ging iets mis.");
      else setStap("code");
    } catch {
      setFout("We konden je aanvraag niet versturen.");
    } finally {
      setBezig(false);
    }
  }

  async function controleer(event?: React.SyntheticEvent) {
    event?.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/account/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFout(data.error ?? "Die code klopt niet.");
      } else {
        onKlaar?.();
        router.refresh();
      }
    } catch {
      setFout("We konden de code niet controleren.");
    } finally {
      setBezig(false);
    }
  }

  /*
   * Bewust GEEN <form>: dit blok staat middenin het afrekenformulier, en een
   * formulier in een formulier is ongeldige HTML. De browser knipte het
   * buitenste formulier daar stuk en React gooide bij de hydratiefout de
   * complete boom opnieuw op — waarbij de fontklasse op <html> verdween en
   * de hele site in Times New Roman stond. Enter werkt via onKeyDown, mét
   * preventDefault zodat Enter hier niet stiekem de bestelling afrekent.
   */
  return stap === "email" ? (
    <div className="mt-2 space-y-2">
      <label htmlFor="inline-email" className="sr-only">
        E-mailadres
      </label>
      {/*
        Geen `required` en geen `pattern`, hoe verleidelijk ook.

        Dit blok staat binnen het <form> van de checkout (zie de toelichting
        hieronder). De browser valideert bij het afrekenen élk veld in dat
        formulier, dus een leeg inlogveld hield de hele bestelling tegen met
        "vul dit veld in" — terwijl inloggen hier optioneel is en alleen om de
        Kluspas-korting gaat. Kevin: "stuur mij een code veld is verplicht maar
        dat hoeft niet."

        Wat er wél moet gebeuren bewaken we in JavaScript: de knop hieronder
        controleert het adres en de code-knop staat pas aan bij zes cijfers.
      */}
      <input
        id="inline-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input bg-white"
        placeholder="jouw@email.nl"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void vraagCode();
          }
        }}
      />
      <button
        type="button"
        onClick={() => void vraagCode()}
        disabled={bezig || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
        className="btn btn-primary w-full py-2 text-sm disabled:opacity-60"
      >
        {bezig ? "Bezig…" : "Stuur mij een code"}
      </button>
      <p className="text-xs text-ink-soft">
        Geen wachtwoord nodig. Je krijgt een code van zes cijfers per mail.
      </p>
      {fout && (
        <p role="alert" className="text-sm font-semibold text-brand-dark">
          {fout}
        </p>
      )}
    </div>
  ) : (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-ink-soft">
        We hebben een code gestuurd naar {email}.
      </p>
      <label htmlFor="inline-code" className="sr-only">
        Code uit je mail
      </label>
      <input
        id="inline-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        className="input bg-white text-center text-xl font-black tracking-[0.3em]"
        placeholder="000000"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (code.length === 6) void controleer();
          }
        }}
      />
      <button
        type="button"
        onClick={() => void controleer()}
        disabled={bezig || code.length !== 6}
        className="btn btn-primary w-full py-2 text-sm disabled:opacity-60"
      >
        {bezig ? "Controleren…" : "Korting toepassen"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStap("email");
          setCode("");
          setFout(null);
        }}
        className="w-full text-xs font-semibold text-ink-soft hover:text-brand"
      >
        Ander e-mailadres
      </button>
      {fout && (
        <p role="alert" className="text-sm font-semibold text-brand-dark">
          {fout}
        </p>
      )}
    </div>
  );
}
