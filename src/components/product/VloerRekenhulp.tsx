"use client";

import { useId, useState } from "react";

import { Icon } from "@/components/icons";
import { berekenPakken, SNIJVERLIES_STANDAARD } from "@/lib/vloer";

/**
 * "Hoeveel heb ik nodig?" voor laminaat, vinyl en ondervloer.
 *
 * Een klant weet de maat van zijn kamer, niet het aantal pakken. Zonder deze
 * hulp moet hij zelf delen door 2,493 en naar boven afronden, en dat gaat mis:
 * één pak te weinig betekent een tweede rit met een half gelegde vloer, en een
 * pak uit een andere partij kan een zichtbaar kleurverschil geven.
 *
 * Daarom rekenen we met snijverlies erbij en tonen we ook wat er overblijft —
 * die restplanken zijn de reserve voor als er later één beschadigd raakt.
 */
export function VloerRekenhulp({
  perPak,
  eenheidLabel = "pak",
}: {
  perPak: number;
  eenheidLabel?: string;
}) {
  const [lengte, setLengte] = useState("");
  const [breedte, setBreedte] = useState("");
  const [directM2, setDirectM2] = useState("");
  const [extra, setExtra] = useState(SNIJVERLIES_STANDAARD);
  const idLengte = useId();
  const idBreedte = useId();
  const idOppervlak = useId();

  const getal = (waarde: string) => {
    const n = parseFloat(waarde.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  // Losse maten hebben voorrang; is er maar één ingevuld, dan telt het
  // rechtstreekse oppervlak. Zo hoeft niemand te kiezen welk vakje hij pakt.
  const uitMaten = getal(lengte) * getal(breedte);
  const oppervlak = uitMaten > 0 ? uitMaten : getal(directM2);
  const som = berekenPakken(oppervlak, perPak, extra);

  const nl = (waarde: number, decimalen = 2) =>
    waarde.toLocaleString("nl-NL", {
      minimumFractionDigits: decimalen,
      maximumFractionDigits: decimalen,
    });

  return (
    <section
      aria-labelledby={`${idOppervlak}-titel`}
      className="rounded-xl border-2 border-ink/10 p-4"
    >
      <h3
        id={`${idOppervlak}-titel`}
        className="flex items-center gap-2 font-black uppercase text-ink"
      >
        <Icon name="calculator" className="h-5 w-5 text-brand" />
        Hoeveel heb ik nodig?
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        Eén {eenheidLabel} is {nl(perPak, 3)} m². Vul je kamer in, dan rekenen we
        het aantal {eenheidLabel}ken uit.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={idLengte} className="text-xs font-bold text-ink-soft">
            Lengte (m)
          </label>
          <input
            id={idLengte}
            inputMode="decimal"
            value={lengte}
            onChange={(event) => {
              setLengte(event.target.value);
              setDirectM2("");
            }}
            placeholder="5,20"
            className="mt-1 w-full rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-semibold focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={idBreedte} className="text-xs font-bold text-ink-soft">
            Breedte (m)
          </label>
          <input
            id={idBreedte}
            inputMode="decimal"
            value={breedte}
            onChange={(event) => {
              setBreedte(event.target.value);
              setDirectM2("");
            }}
            placeholder="3,80"
            className="mt-1 w-full rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-semibold focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-2">
        <label htmlFor={idOppervlak} className="text-xs font-bold text-ink-soft">
          Of het oppervlak ineens (m²)
        </label>
        <input
          id={idOppervlak}
          inputMode="decimal"
          value={directM2}
          onChange={(event) => {
            setDirectM2(event.target.value);
            setLengte("");
            setBreedte("");
          }}
          placeholder="19,76"
          className="mt-1 w-full rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-semibold focus:border-brand focus:outline-none"
        />
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs font-bold text-ink-soft">Snijverlies</legend>
        <div className="mt-1 flex gap-2">
          {[
            { waarde: 0.05, label: "5%", uitleg: "rechthoekige kamer" },
            { waarde: 0.1, label: "10%", uitleg: "erker of schuine wand" },
            { waarde: 0.15, label: "15%", uitleg: "diagonaal gelegd" },
          ].map((optie) => (
            <button
              key={optie.waarde}
              type="button"
              aria-pressed={extra === optie.waarde}
              title={optie.uitleg}
              onClick={() => setExtra(optie.waarde)}
              className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-bold transition ${
                extra === optie.waarde
                  ? "border-brand bg-brand-light text-brand"
                  : "border-ink/10 text-ink-soft hover:border-brand hover:text-brand"
              }`}
            >
              {optie.label}
            </button>
          ))}
        </div>
      </fieldset>

      {som && (
        <div
          aria-live="polite"
          className="mt-3 rounded-lg bg-brand-light p-3 text-sm"
        >
          <p className="text-2xl font-black text-ink">
            {som.pakken} {eenheidLabel}
            {som.pakken === 1 ? "" : "ken"}
          </p>
          <p className="mt-1 text-ink-soft">
            {nl(som.oppervlak)} m² plus {Math.round(extra * 100)}% snijverlies is{" "}
            {nl(som.benodigd)} m². Dat zijn {som.pakken} {eenheidLabel}
            {som.pakken === 1 ? "" : "ken"} van {nl(perPak, 3)} m², samen{" "}
            {nl(som.geleverd)} m².
          </p>
          <p className="mt-1 text-ink-soft">
            Je houdt {nl(som.over)} m² over — handig als er later een plank
            beschadigd raakt, want een pak uit een andere partij kan iets
            afwijken in kleur.
          </p>
        </div>
      )}
    </section>
  );
}
