"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { usePrijsModus } from "@/components/prijs/PrijsWeergave";
import type { Herhaling } from "@/lib/orders";

import { btwLabel, toonCenten } from "./bedrag";

/**
 * "Nog eens bestellen" bij een eerdere bestelling.
 *
 * De regels komen van de server: die zoekt elk artikel opnieuw op in de
 * catalogus en rekent met de prijs van vandaag. De browser stuurt dus geen
 * bedragen mee — een mandje dat vanuit oude ordergegevens gevuld wordt, is een
 * mandje waarin een klant zelf de prijs bepaalt.
 *
 * Wat er niet meer is, staat er met naam en reden bij. Een mandje dat
 * stilletjes korter is dan de bestelling waar het uit komt, ontdekt de klant
 * pas bij de bezorging.
 */
export function NogEensBestellen({ referentie }: { referentie: string }) {
  const { addItem, sluitBevestiging } = useCart();
  const { modus } = usePrijsModus();
  const [bezig, setBezig] = useState(false);
  const [uitkomst, setUitkomst] = useState<Herhaling | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function opnieuw() {
    setBezig(true);
    setFout(null);
    try {
      const response = await fetch("/api/account/opnieuw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestelling: referentie }),
      });
      const data = (await response.json()) as Herhaling & { error?: string };
      if (!response.ok) {
        setFout(data.error ?? "Dat lukte niet. Probeer het zo nog eens.");
        return;
      }
      for (const regel of data.regels) {
        // `eerderePrijs` is alleen voor de uitleg hieronder; die hoort niet in
        // de winkelwagen te belanden.
        const { eerderePrijs: _eerder, qty, ...artikel } = regel;
        addItem(artikel, qty);
      }
      // De pop-up "toegevoegd aan je winkelwagen" zou hier bij elk artikel
      // opengaan en eindigen op het laatste. Wat de klant moet zien is het
      // overzicht hieronder, niet het laatste blik uit de rij.
      sluitBevestiging();
      setUitkomst(data);
    } catch {
      setFout("We konden je bestelling niet ophalen. Controleer je verbinding.");
    } finally {
      setBezig(false);
    }
  }

  if (uitkomst) return <Uitkomst uitkomst={uitkomst} modus={modus} />;

  return (
    <div>
      <button
        type="button"
        onClick={opnieuw}
        disabled={bezig}
        className="rounded-lg border-2 border-ink/10 px-4 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {bezig ? "Bezig…" : "Nog eens bestellen"}
      </button>
      {fout && <p className="mt-2 text-sm font-semibold text-red-700">{fout}</p>}
    </div>
  );
}

function Uitkomst({
  uitkomst,
  modus,
}: {
  uitkomst: Herhaling;
  modus: "incl" | "excl";
}) {
  const aantal = uitkomst.regels.reduce((som, regel) => som + regel.qty, 0);
  const overgeslagen = uitkomst.overgeslagen.length;
  const duurder = uitkomst.totaalNu > uitkomst.totaalToen;
  const goedkoper = uitkomst.totaalNu < uitkomst.totaalToen;

  return (
    <div className="rounded-xl bg-brand-light p-4 text-sm">
      {uitkomst.regels.length === 0 ? (
        <p className="font-black text-ink">
          Van deze bestelling is niets meer leverbaar.
        </p>
      ) : (
        <p className="font-black text-ink">
          {aantal === 1 ? "1 artikel staat" : `${aantal} artikelen staan`} weer in je
          winkelwagen.
        </p>
      )}

      {overgeslagen > 0 && (
        <>
          <p className="mt-2 text-ink">
            {overgeslagen === 1
              ? `1 van de ${uitkomst.regelsInBestelling} artikelen is niet meer leverbaar:`
              : `${overgeslagen} van de ${uitkomst.regelsInBestelling} artikelen zijn niet meer leverbaar:`}
          </p>
          <ul className="mt-1 space-y-0.5 text-ink-soft">
            {uitkomst.overgeslagen.map((regel, index) => (
              <li key={index}>
                <span className="font-semibold text-ink">{regel.titel}</span>, {regel.reden}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Wél benoemen dat de prijs anders is. Een klant die bij het afrekenen
          een ander bedrag ziet dan hij vorige keer betaalde, wil weten waarom. */}
      {(duurder || goedkoper) && uitkomst.regels.length > 0 && (
        <p className="mt-2 text-ink">
          Je betaalt de prijs van vandaag: {toonCenten(uitkomst.totaalNu, modus)}{" "}
          {btwLabel(modus)} in plaats van {toonCenten(uitkomst.totaalToen, modus)} toen.
        </p>
      )}

      {uitkomst.regels.length > 0 && (
        <Link href="/winkelwagen" className="btn btn-primary mt-3 py-2 text-sm">
          Naar je winkelwagen
        </Link>
      )}
    </div>
  );
}
