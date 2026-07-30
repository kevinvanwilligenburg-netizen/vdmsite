"use client";

import { usePrijsModus } from "@/components/prijs/PrijsWeergave";
import { BTW_TARIEF } from "@/lib/factuur";
import { euro } from "@/lib/format";

/**
 * Prijsweergave.
 *
 * De Kluspas-prijs krijgt de grote cijfers: dat is wat een klant mét pas
 * betaalt, en het is het argument om die pas te nemen. De losse prijs staat
 * er kleiner onder als referentie. Andersom — normale prijs groot, korting
 * klein eronder — verstopt precies datgene waarmee we ons onderscheiden.
 */
export function Price({
  price,
  compareAtPrice,
  kluspasPrice,
  from = false,
  size = "md",
}: {
  price: number;
  compareAtPrice?: number;
  kluspasPrice?: number;
  from?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  // Zakelijke bezoekers rekenen exclusief btw. De bedragen in de catalogus
  // zijn inclusief — dat is wat er wordt afgerekend — dus rekenen we terug,
  // net als op de factuur.
  const { modus } = usePrijsModus();
  const toon = (centen: number) =>
    euro(modus === "excl" ? Math.round(centen / (1 + BTW_TARIEF)) : centen);

  const groot =
    size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-lg" : "text-2xl";
  const klein = size === "lg" ? "text-sm" : "text-xs";

  const metKluspas = Boolean(kluspasPrice && kluspasPrice < price);

  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      {from && <span className="text-sm text-ink-soft">vanaf</span>}

      {metKluspas ? (
        <>
          <span className={`${groot} font-black tracking-tight text-brand`}>
            {toon(kluspasPrice!)}
          </span>
          <span
            className={`rounded bg-brand px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white ${
              size === "lg" ? "text-xs" : ""
            }`}
          >
            Kluspas
          </span>
          <span className={`w-full ${klein} text-ink-soft`}>
            Zonder pas <strong className="font-bold text-ink">{toon(price)}</strong>
            {compareAtPrice && compareAtPrice > price && (
              <s className="ml-1.5 font-medium text-ink-soft/70">{toon(compareAtPrice)}</s>
            )}
          </span>
        </>
      ) : (
        <>
          <span className={`${groot} font-black tracking-tight text-brand`}>
            {toon(price)}
          </span>
          {compareAtPrice && compareAtPrice > price && (
            <s className="text-sm font-medium text-ink-soft/70">{toon(compareAtPrice)}</s>
          )}
        </>
      )}

      {size === "lg" && (
        <span className="w-full text-xs text-ink-soft">
          {modus === "excl" ? "excl. btw" : "incl. btw"}
        </span>
      )}
    </div>
  );
}
