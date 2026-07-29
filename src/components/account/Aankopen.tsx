"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { euro } from "@/lib/format";
import type { Aankoop } from "@/lib/account";

/**
 * Aankopen uit de webshop en uit de winkel, door elkaar.
 *
 * De webshopbestellingen komen van de server mee en staan er dus meteen. De
 * winkelaankopen halen we daarna op: het dashboard doorloopt daarvoor een
 * jaar verkopen en dat kan tientallen seconden duren. Zo kijkt de klant niet
 * naar een leeg scherm te wachten op iets wat hij misschien niet eens heeft.
 */
export function Aankopen({ webshop }: { webshop: Aankoop[] }) {
  const [winkel, setWinkel] = useState<Aankoop[] | null>(null);
  const [mislukt, setMislukt] = useState(false);

  useEffect(() => {
    let actief = true;
    fetch("/api/account/aankopen")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { aankopen?: Aankoop[] }) => {
        if (actief) setWinkel(data.aankopen ?? []);
      })
      .catch(() => {
        if (actief) setMislukt(true);
      });
    return () => {
      actief = false;
    };
  }, []);

  const alles = [...webshop, ...(winkel ?? [])].sort(
    (a, b) => Date.parse(b.datum) - Date.parse(a.datum),
  );

  const punten = (winkel ?? []).reduce((som, aankoop) => som + (aankoop.punten ?? 0), 0);
  const kentPunten = (winkel ?? []).some((aankoop) => typeof aankoop.punten === "number");

  return (
    <div className="space-y-4">
      {kentPunten && punten > 0 && (
        <div className="card flex items-baseline justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
              Kluspunten gespaard
            </p>
            <p className="text-xs text-ink-soft">
              Opgeteld uit je aankopen. Het officiële saldo staat op je kassabon.
            </p>
          </div>
          <p className="text-3xl font-black text-brand">{punten.toLocaleString("nl-NL")}</p>
        </div>
      )}

      {alles.length === 0 && winkel !== null ? (
        <div className="card p-8 text-center">
          <p className="font-black text-ink">Nog geen aankopen gevonden</p>
          <p className="mt-1 text-sm text-ink-soft">
            Zodra je bestelt of in de winkel koopt met je Kluspas, staat het hier.
          </p>
          <Link href="/" className="btn btn-primary mt-4">
            Naar de winkel
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {alles.map((aankoop) => (
            <li key={`${aankoop.bron}-${aankoop.id}`} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 font-black text-ink">
                  <Icon
                    name={aankoop.bron === "webshop" ? "truck" : "store"}
                    className="h-4 w-4 text-brand"
                  />
                  {aankoop.bron === "webshop"
                    ? `Bestelling ${aankoop.referentie ?? ""}`
                    : `Winkel ${aankoop.winkel ?? ""}`}
                </p>
                <p className="text-sm text-ink-soft">{datumKort(aankoop.datum)}</p>
              </div>

              <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                {aankoop.regels.slice(0, 4).map((regel, index) => (
                  <li key={index} className="flex justify-between gap-3">
                    <span className="truncate">
                      {regel.aantal}× {regel.titel}
                    </span>
                    <span className="shrink-0">{euro(Math.round(regel.bedrag * 100))}</span>
                  </li>
                ))}
                {aankoop.regels.length > 4 && (
                  <li className="text-xs">en nog {aankoop.regels.length - 4} artikelen</li>
                )}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
                <span className="text-sm font-semibold text-ink-soft">
                  {aankoop.status ?? "Afgerekend in de winkel"}
                  {typeof aankoop.punten === "number" && aankoop.punten > 0 && (
                    <span className="ml-2 text-brand">+{aankoop.punten} punten</span>
                  )}
                </span>
                <span className="font-black text-ink">
                  {euro(Math.round(aankoop.bedrag * 100))}
                </span>
              </div>

              {aankoop.bron === "webshop" && aankoop.referentie && (
                <Link
                  href={`/bestelling/${aankoop.referentie}`}
                  className="mt-2 inline-block text-sm font-bold text-brand hover:underline"
                >
                  Bekijk bestelling →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {winkel === null && !mislukt && (
        <p className="rounded-xl bg-brand-light px-4 py-3 text-sm font-semibold text-ink">
          We halen je winkelaankopen erbij…
        </p>
      )}
      {mislukt && (
        <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink-soft">
          Je aankopen uit de winkel konden we nu niet ophalen. Je webshopbestellingen
          staan hierboven; probeer het later nog eens.
        </p>
      )}
    </div>
  );
}

function datumKort(waarde: string): string {
  const datum = new Date(waarde);
  if (Number.isNaN(datum.getTime())) return waarde;
  return datum.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
