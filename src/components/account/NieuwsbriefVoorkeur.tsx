"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";

/**
 * Nieuwsbrief aan of uit, vanuit het account.
 *
 * Eén schakelaar, geen formulier: het adres staat al vast (dat van het
 * account) en er valt verder niets te kiezen. Wie hier "aan" zet krijgt géén
 * bevestigingsmail — hij is ingelogd op dat adres, dus dat het van hem is,
 * is al aangetoond.
 *
 * De status komt uit onze eigen administratie en niet uit Resend. Dat is de
 * bron van waarheid voor toestemming; Resend is het verzendgereedschap.
 */
export function NieuwsbriefVoorkeur() {
  const [aangemeld, setAangemeld] = useState<boolean | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/nieuwsbrief")
      .then((res) => (res.ok ? res.json() : { aangemeld: false }))
      .then((data) => setAangemeld(Boolean(data.aangemeld)))
      .catch(() => setAangemeld(false));
  }, []);

  const zet = async (aan: boolean) => {
    setBezig(true);
    setFout(null);
    // Meteen omzetten zodat de knop reageert; bij een fout terugdraaien.
    const vorige = aangemeld;
    setAangemeld(aan);
    try {
      const res = await fetch("/api/account/nieuwsbrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aan }),
      });
      if (!res.ok) throw new Error("Opslaan lukte niet.");
      const data = (await res.json()) as { aangemeld?: boolean };
      setAangemeld(Boolean(data.aangemeld));
    } catch (error) {
      setAangemeld(vorige);
      setFout(error instanceof Error ? error.message : "Opslaan lukte niet.");
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="font-black text-ink">Nieuwsbrief</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Acties, klustips en nieuwe producten. Eens per maand, niet vaker.
      </p>

      {aangemeld === null ? (
        <p className="mt-4 text-sm text-ink-soft">Bezig met laden…</p>
      ) : (
        <>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={aangemeld}
              disabled={bezig}
              onChange={(event) => zet(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand disabled:opacity-50"
            />
            <span className="text-sm font-bold text-ink">
              {aangemeld ? "Je ontvangt de nieuwsbrief" : "Stuur mij de nieuwsbrief"}
            </span>
          </label>

          {aangemeld && (
            <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
              <Icon
                name="check"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700"
                strokeWidth={3}
              />
              Uitzetten kan hier, en met één klik onderaan elke nieuwsbrief.
            </p>
          )}
          {/* Wat er niet verandert. Zonder deze zin denkt iemand die zich
              afmeldt dat hij ook geen orderbevestiging meer krijgt — en dat is
              precies waarom mensen het dan maar niet doen. */}
          {!aangemeld && (
            <p className="mt-3 text-xs text-ink-soft">
              Je krijgt hoe dan ook gewoon je orderbevestiging en het bericht als
              je pakket onderweg is. Dat hoort bij je bestelling en staat hier los
              van.
            </p>
          )}
        </>
      )}

      {fout && (
        <p role="alert" className="mt-3 text-sm font-semibold text-brand-dark">
          {fout}
        </p>
      )}
    </section>
  );
}
