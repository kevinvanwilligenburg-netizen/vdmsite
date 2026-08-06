"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";

/**
 * ProfPas aanvragen vanaf de site.
 *
 * Hiervoor stond er alleen "stuur een verzoek naar verkoop@". Voor iemand die
 * 's avonds op zijn telefoon zit is dat een doodlopende straat: mailprogramma
 * open, zelf bedenken wat erin moet, en maar hopen dat de goede gegevens
 * meegaan. Daar sneuvelt een aanvraag.
 *
 * ⚠️ Aanvragen worden met de hand beoordeeld. Deze knop belooft dus géén
 * korting en zegt niet dat de pas klaarstaat — hij zorgt alleen dat de
 * aanvraag compleet bij verkoop aankomt.
 *
 * Het KvK- of btw-nummer wordt hier al gecontroleerd: acht cijfers voor
 * Nederland, en voor België een live controle bij het EU-register. Dat scheelt
 * verkoop de aanvragen die toch zouden afvallen, en de klant een mail met
 * "je nummer klopt niet" een dag later.
 */

const BESTEDINGEN = [
  "Minder dan € 100",
  "€ 100 – € 500",
  "€ 500 – € 1.000",
  "Meer dan € 1.000",
];

export function ProfpasAanvraag({ ingelogdAls }: { ingelogdAls?: string }) {
  const [open, setOpen] = useState(false);
  const [land, setLand] = useState<"NL" | "BE">("NL");
  const [bedrijf, setBedrijf] = useState("");
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState(ingelogdAls ?? "");
  const [telefoon, setTelefoon] = useState("");
  const [kvk, setKvk] = useState("");
  const [btw, setBtw] = useState("");
  const [besteding, setBesteding] = useState(BESTEDINGEN[1]);
  const [betaalwijze, setBetaalwijze] = useState("Vooraf");
  const [opmerking, setOpmerking] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState(false);
  const [viesStatus, setViesStatus] = useState<"leeg" | "bezig" | "geldig" | "ongeldig" | "onbeslist">(
    "leeg",
  );

  // Belgisch nummer live toetsen, net als bij het afrekenen. De klant hoort
  // meteen of het klopt in plaats van na een dag.
  const controleerBtw = () => {
    const nummer = btw.trim();
    if (!nummer) return setViesStatus("leeg");
    setViesStatus("bezig");
    fetch("/api/zakelijk/vies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ btw: nummer }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setViesStatus(data?.status ?? "onbeslist"))
      .catch(() => setViesStatus("onbeslist"));
  };

  const verstuur = async (event: React.FormEvent) => {
    event.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/profpas/aanvraag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedrijf,
          naam,
          email,
          telefoon,
          land,
          kvk,
          btw,
          besteding,
          betaalwijze,
          opmerking,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Versturen lukte niet.");
      setKlaar(true);
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Versturen lukte niet.");
    } finally {
      setBezig(false);
    }
  };

  if (klaar) {
    return (
      <div className="card border-2 border-brand/30 p-6">
        <p className="flex items-center gap-2 font-black text-ink">
          <Icon name="check" className="h-5 w-5 shrink-0 text-green-700" strokeWidth={3} />
          Je aanvraag is verstuurd
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Onze verkoopafdeling kijkt hem na en neemt contact met je op. Zodra je
          ProfPas actief is, wordt de korting bij het afrekenen vanzelf verrekend —
          je hoeft dan niets meer aan te vinken.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="card p-6">
        <h2 className="font-black text-ink">ProfPas aanvragen</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Voor bedrijven: 10% korting, altijd gratis bezorgd en betalen op factuur.
          We beoordelen elke aanvraag zelf, dus vertel even wie je bent.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary mt-4">
          Aanvraag starten
        </button>
      </div>
    );
  }

  const veld = "input w-full";
  const label = "block text-sm font-bold text-ink";

  return (
    <form onSubmit={verstuur} className="card space-y-4 p-6">
      <div>
        <h2 className="font-black text-ink">ProfPas aanvragen</h2>
        <p className="mt-1 text-sm text-ink-soft">
          We beoordelen je aanvraag met de hand. Je krijgt bericht zodra hij rond is.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="pp-bedrijf">Bedrijfsnaam</label>
          <input id="pp-bedrijf" required value={bedrijf} onChange={(e) => setBedrijf(e.target.value)} className={veld} />
        </div>
        <div>
          <label className={label} htmlFor="pp-naam">Contactpersoon</label>
          <input id="pp-naam" required value={naam} onChange={(e) => setNaam(e.target.value)} className={veld} />
        </div>
        <div>
          <label className={label} htmlFor="pp-email">E-mailadres</label>
          <input
            id="pp-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(ingelogdAls)}
            className={`${veld} ${ingelogdAls ? "bg-ink/5" : ""}`}
          />
          {ingelogdAls && (
            <p className="mt-1 text-xs text-ink-soft">
              Het adres van je account; daar hangt de pas straks aan.
            </p>
          )}
        </div>
        <div>
          <label className={label} htmlFor="pp-telefoon">Telefoon</label>
          <input id="pp-telefoon" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} className={veld} />
        </div>
        <div>
          <label className={label} htmlFor="pp-land">Land</label>
          <select id="pp-land" value={land} onChange={(e) => setLand(e.target.value as "NL" | "BE")} className={veld}>
            <option value="NL">Nederland</option>
            <option value="BE">België</option>
          </select>
        </div>
        {land === "NL" ? (
          <div>
            <label className={label} htmlFor="pp-kvk">KvK-nummer</label>
            <input
              id="pp-kvk"
              required
              inputMode="numeric"
              value={kvk}
              onChange={(e) => setKvk(e.target.value)}
              className={veld}
              placeholder="8 cijfers"
            />
          </div>
        ) : (
          <div>
            <label className={label} htmlFor="pp-btw">Btw-nummer</label>
            <input
              id="pp-btw"
              required
              value={btw}
              onChange={(e) => setBtw(e.target.value)}
              onBlur={controleerBtw}
              className={veld}
              placeholder="BE0123456789"
            />
            {viesStatus === "bezig" && <p className="mt-1 text-xs text-ink-soft">Controleren…</p>}
            {viesStatus === "geldig" && (
              <p className="mt-1 text-xs font-semibold text-green-700">Nummer bevestigd.</p>
            )}
            {viesStatus === "ongeldig" && (
              <p className="mt-1 text-xs font-semibold text-brand-dark">
                Dit nummer kent het EU-register niet.
              </p>
            )}
          </div>
        )}
        <div>
          <label className={label} htmlFor="pp-besteding">Verwachte besteding per maand</label>
          <select id="pp-besteding" value={besteding} onChange={(e) => setBesteding(e.target.value)} className={veld}>
            {BESTEDINGEN.map((optie) => (
              <option key={optie} value={optie}>{optie}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="pp-betaal">Betalen</label>
          <select id="pp-betaal" value={betaalwijze} onChange={(e) => setBetaalwijze(e.target.value)} className={veld}>
            <option value="Vooraf">Vooraf</option>
            <option value="Op factuur">Op factuur</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="pp-opmerking">Iets wat we moeten weten? (optioneel)</label>
        <textarea
          id="pp-opmerking"
          rows={2}
          value={opmerking}
          onChange={(e) => setOpmerking(e.target.value)}
          className={veld}
        />
      </div>

      {fout && (
        <p role="alert" className="text-sm font-semibold text-brand-dark">{fout}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={bezig} className="btn btn-primary disabled:opacity-60">
          {bezig ? "Versturen…" : "Aanvraag versturen"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn border-2 border-ink/10 bg-white text-ink">
          Annuleren
        </button>
      </div>
    </form>
  );
}
