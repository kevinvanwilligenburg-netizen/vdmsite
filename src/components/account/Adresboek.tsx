"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import type { Adres } from "@/lib/types";

/**
 * Adresboek in het account.
 *
 * Kevin: *"graag meerdere adressen kunnen invoeren."*
 *
 * Bewust geen "standaardadres"-vinkje: het bovenste adres is het laatst
 * gebruikte, en dat is bijna altijd het adres dat je weer wilt. Een extra
 * keuze die je moet onderhouden voegt hier niets toe.
 */

const LEEG: Adres = {
  label: "",
  bedrijf: "",
  straat: "",
  huisnummer: "",
  toevoeging: "",
  postcode: "",
  plaats: "",
  land: "NL",
};

export function Adresboek() {
  const [adressen, setAdressen] = useState<Adres[] | null>(null);
  const [formulier, setFormulier] = useState<Adres | null>(null);
  const [bewerktIndex, setBewerktIndex] = useState<number | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/adressen")
      .then((res) => (res.ok ? res.json() : { adressen: [] }))
      .then((data) => setAdressen(Array.isArray(data.adressen) ? data.adressen : []))
      .catch(() => setAdressen([]));
  }, []);

  const bewaar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formulier) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/account/adressen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adres: formulier,
          ...(bewerktIndex !== null ? { vervangIndex: bewerktIndex } : {}),
        }),
      });
      const data = (await res.json()) as { adressen?: Adres[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Opslaan lukte niet.");
      setAdressen(data.adressen ?? []);
      setFormulier(null);
      setBewerktIndex(null);
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Opslaan lukte niet.");
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async (index: number) => {
    setFout(null);
    const res = await fetch(`/api/account/adressen?index=${index}`, { method: "DELETE" });
    const data = (await res.json()) as { adressen?: Adres[]; error?: string };
    if (!res.ok) return setFout(data.error ?? "Verwijderen lukte niet.");
    setAdressen(data.adressen ?? []);
  };

  if (adressen === null) {
    return (
      <section className="card p-6">
        <h2 className="font-black text-ink">Mijn adressen</h2>
        <p className="mt-2 text-sm text-ink-soft">Bezig met laden…</p>
      </section>
    );
  }

  const veld = "input w-full";
  const label = "block text-sm font-bold text-ink";

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-ink">Mijn adressen</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Bewaar de adressen waar je vaker naartoe bestelt. Bij het afrekenen kies
            je er een, in plaats van alles opnieuw te typen.
          </p>
        </div>
        {formulier === null && (
          <button
            type="button"
            onClick={() => {
              setFormulier({ ...LEEG });
              setBewerktIndex(null);
            }}
            className="btn btn-primary shrink-0"
          >
            Adres toevoegen
          </button>
        )}
      </div>

      {fout && (
        <p role="alert" className="mt-4 text-sm font-semibold text-brand-dark">
          {fout}
        </p>
      )}

      {adressen.length > 0 && (
        <ul className="mt-4 space-y-2">
          {adressen.map((adres, index) => (
            <li
              key={`${adres.straat}-${adres.huisnummer}-${index}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border-2 border-ink/10 p-3"
            >
              <div className="min-w-0 text-sm">
                {(adres.label || adres.bedrijf) && (
                  <p className="font-black text-ink">
                    {adres.label || adres.bedrijf}
                    {adres.label && adres.bedrijf && (
                      <span className="ml-2 font-semibold text-ink-soft">{adres.bedrijf}</span>
                    )}
                  </p>
                )}
                <p className="text-ink">
                  {adres.straat} {adres.huisnummer}
                  {adres.toevoeging ? `-${adres.toevoeging}` : ""}
                </p>
                <p className="text-ink-soft">
                  {adres.postcode} {adres.plaats}
                  {adres.land === "BE" ? " (België)" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormulier({ ...LEEG, ...adres });
                    setBewerktIndex(index);
                  }}
                  className="text-sm font-bold text-brand hover:underline"
                >
                  Wijzigen
                </button>
                <button
                  type="button"
                  onClick={() => verwijder(index)}
                  className="text-sm font-bold text-ink-soft hover:text-brand-dark hover:underline"
                >
                  Verwijderen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adressen.length === 0 && formulier === null && (
        <p className="mt-4 rounded-lg bg-ink/5 px-4 py-3 text-sm text-ink-soft">
          Je hebt nog geen adressen bewaard. Na je eerste bestelling zetten we het
          bezorgadres hier automatisch neer.
        </p>
      )}

      {formulier && (
        <form onSubmit={bewaar} className="mt-5 space-y-4 border-t-2 border-ink/10 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="ad-label">Naam voor dit adres (optioneel)</label>
              <input
                id="ad-label"
                value={formulier.label ?? ""}
                onChange={(e) => setFormulier({ ...formulier, label: e.target.value })}
                className={veld}
                placeholder="Loods, Thuis, Werkadres…"
              />
            </div>
            <div>
              <label className={label} htmlFor="ad-bedrijf">Bedrijfsnaam (optioneel)</label>
              <input
                id="ad-bedrijf"
                value={formulier.bedrijf ?? ""}
                onChange={(e) => setFormulier({ ...formulier, bedrijf: e.target.value })}
                className={veld}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="ad-straat">Straat</label>
              <input
                id="ad-straat"
                required
                value={formulier.straat}
                onChange={(e) => setFormulier({ ...formulier, straat: e.target.value })}
                className={veld}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="ad-nr">Huisnummer</label>
                <input
                  id="ad-nr"
                  required
                  value={formulier.huisnummer}
                  onChange={(e) => setFormulier({ ...formulier, huisnummer: e.target.value })}
                  className={veld}
                />
              </div>
              <div>
                <label className={label} htmlFor="ad-toev">Toevoeging</label>
                <input
                  id="ad-toev"
                  value={formulier.toevoeging ?? ""}
                  onChange={(e) => setFormulier({ ...formulier, toevoeging: e.target.value })}
                  className={veld}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="ad-pc">Postcode</label>
                <input
                  id="ad-pc"
                  required
                  value={formulier.postcode}
                  onChange={(e) => setFormulier({ ...formulier, postcode: e.target.value })}
                  className={veld}
                  placeholder={formulier.land === "BE" ? "1000" : "1234 AB"}
                />
              </div>
              <div>
                <label className={label} htmlFor="ad-land">Land</label>
                <select
                  id="ad-land"
                  value={formulier.land}
                  onChange={(e) => setFormulier({ ...formulier, land: e.target.value })}
                  className={veld}
                >
                  <option value="NL">Nederland</option>
                  <option value="BE">België</option>
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="ad-plaats">Plaats</label>
              <input
                id="ad-plaats"
                required
                value={formulier.plaats}
                onChange={(e) => setFormulier({ ...formulier, plaats: e.target.value })}
                className={veld}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={bezig} className="btn btn-primary disabled:opacity-60">
              {bezig ? "Opslaan…" : bewerktIndex !== null ? "Wijziging opslaan" : "Adres bewaren"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormulier(null);
                setBewerktIndex(null);
                setFout(null);
              }}
              className="btn border-2 border-ink/10 bg-white text-ink"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs text-ink-soft">
        <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" strokeWidth={3} />
        Je adressen staan alleen bij jouw account en gaan alleen mee met een
        bestelling die je zelf plaatst.
      </p>
    </section>
  );
}
