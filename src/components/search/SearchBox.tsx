"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";

interface Suggesties {
  producten: {
    slug: string;
    naam: string;
    merk: string;
    prijs: number;
    metKluspas: boolean;
    image?: string;
    art: { icon: string; hue: number };
  }[];
  totaal: number;
  categorieen: { naam: string; href: string }[];
  merken: { naam: string; href: string; aantal: number }[];
  klus: {
    titel: string;
    adviesHref: string;
    assortimentHref: string;
    assortimentLabel: string;
  } | null;
  suggesties: string[];
}

const LEEG: Suggesties = {
  producten: [],
  totaal: 0,
  categorieen: [],
  merken: [],
  klus: null,
  suggesties: [],
};

/**
 * Zoekveld met suggesties tijdens het typen.
 *
 * Toont producten, categorieën en merken zodra er twee tekens staan, en
 * herkent klusvragen: wie "trap verven" intypt krijgt niet een lijst met
 * artikelen die toevallig "trap" heten, maar een verwijzing naar het
 * klusadvies plus het assortiment dat erbij hoort.
 *
 * Bediening met de pijltjestoetsen, Enter opent de gemarkeerde suggestie en
 * Escape sluit de lijst — anders is dit met het toetsenbord niet te doen.
 */
export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Suggesties>(LEEG);
  const [open, setOpen] = useState(false);
  const [markering, setMarkering] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);
  const lijstId = useId();

  // Ophalen met een korte pauze, zodat we niet bij elke toetsaanslag vragen.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setData(LEEG);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/zoeksuggesties?q=${encodeURIComponent(term)}`)
        .then((response) => (response.ok ? response.json() : LEEG))
        .then((result: Suggesties) => {
          setData(result);
          setMarkering(-1);
        })
        .catch(() => setData(LEEG));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  // Sluiten bij een klik buiten het zoekveld.
  useEffect(() => {
    if (!open) return;
    const buiten = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", buiten);
    return () => document.removeEventListener("mousedown", buiten);
  }, [open]);

  // Alles wat met de pijltjes te bereiken is, in de volgorde van het scherm.
  const opties: { href: string; label: string }[] = [
    ...(data.klus ? [{ href: data.klus.adviesHref, label: data.klus.titel }] : []),
    ...data.producten.map((p) => ({ href: `/product/${p.slug}`, label: p.naam })),
    ...data.categorieen.map((c) => ({ href: c.href, label: c.naam })),
    ...data.merken.map((m) => ({ href: m.href, label: m.naam })),
  ];

  const toonPaneel = open && query.trim().length >= 2 && opties.length > 0;

  function verzend(event: React.FormEvent) {
    event.preventDefault();
    if (markering >= 0 && opties[markering]) {
      setOpen(false);
      router.push(opties[markering].href);
      return;
    }
    const term = query.trim();
    if (term.length > 0) {
      setOpen(false);
      router.push(`/zoeken?q=${encodeURIComponent(term)}`);
    }
  }

  function opToets(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!toonPaneel) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMarkering((huidig) => (huidig + 1) % opties.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMarkering((huidig) => (huidig <= 0 ? opties.length - 1 : huidig - 1));
    }
  }

  let index = -1;
  const volgende = () => ++index;

  return (
    <div ref={wrapper} className="relative order-last w-full flex-1 sm:order-none sm:w-auto">
      <form action="/zoeken" role="search" onSubmit={verzend} className="flex">
        <label htmlFor="site-zoeken" className="sr-only">
          Zoeken in het assortiment
        </label>
        <input
          id="site-zoeken"
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={opToets}
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={toonPaneel}
          aria-controls={lijstId}
          aria-autocomplete="list"
          placeholder="Zoeken naar artikel, merk of klus…"
          className="w-full rounded-l-lg border-2 border-r-0 border-ink/10 px-4 py-2 outline-none transition focus:border-brand"
        />
        <button
          type="submit"
          className="rounded-r-lg bg-brand px-4 font-bold text-white transition hover:bg-brand-dark"
          aria-label="Zoeken"
        >
          <Icon name="search" className="h-5 w-5" />
        </button>
      </form>

      {toonPaneel && (
        <div
          id={lijstId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border-2 border-ink/10 bg-white shadow-lift"
        >
          {data.klus && (
            <div className="border-b border-ink/10 bg-brand-light p-3">
              <SuggestieRegel
                href={data.klus.adviesHref}
                actief={volgende() === markering}
                onKies={() => setOpen(false)}
              >
                <span className="flex items-center gap-2">
                  <Icon name="bulb" className="h-5 w-5 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block font-black text-ink">{data.klus.titel}</span>
                    <span className="block text-xs text-ink-soft">
                      Bereken wat je nodig hebt met het klusadvies
                    </span>
                  </span>
                </span>
              </SuggestieRegel>
              <Link
                href={data.klus.assortimentHref}
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-lg px-3 py-1.5 text-xs font-bold text-brand hover:underline"
              >
                Of bekijk direct alle {data.klus.assortimentLabel} →
              </Link>
            </div>
          )}

          {data.producten.length > 0 && (
            <div className="p-1.5">
              <p className="px-2 py-1 text-[11px] font-black uppercase tracking-wide text-ink-soft">
                Artikelen
              </p>
              {data.producten.map((product) => (
                <SuggestieRegel
                  key={product.slug}
                  href={`/product/${product.slug}`}
                  actief={volgende() === markering}
                  onKies={() => setOpen(false)}
                >
                  <span className="flex items-center gap-3">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-black/5">
                      <ProductArt
                        icon={product.art.icon}
                        hue={product.art.hue}
                        image={product.image}
                        size="sm"
                        label={product.naam}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {product.naam}
                      </span>
                      <span className="block text-xs text-ink-soft">{product.merk}</span>
                    </span>
                    <span className="shrink-0 text-sm font-black text-brand">
                      {euro(product.prijs)}
                      {product.metKluspas && (
                        <span className="ml-1 text-[9px] font-bold uppercase">Kluspas</span>
                      )}
                    </span>
                  </span>
                </SuggestieRegel>
              ))}
            </div>
          )}

          {(data.categorieen.length > 0 || data.merken.length > 0) && (
            <div className="border-t border-ink/10 p-1.5">
              {data.categorieen.map((categorie) => (
                <SuggestieRegel
                  key={categorie.href}
                  href={categorie.href}
                  actief={volgende() === markering}
                  onKies={() => setOpen(false)}
                >
                  <span className="text-sm">
                    In categorie <strong className="font-bold">{categorie.naam}</strong>
                  </span>
                </SuggestieRegel>
              ))}
              {data.merken.map((merk) => (
                <SuggestieRegel
                  key={merk.href}
                  href={merk.href}
                  actief={volgende() === markering}
                  onKies={() => setOpen(false)}
                >
                  <span className="text-sm">
                    Merk <strong className="font-bold">{merk.naam}</strong>{" "}
                    <span className="text-ink-soft">({merk.aantal})</span>
                  </span>
                </SuggestieRegel>
              ))}
            </div>
          )}

          {data.totaal > data.producten.length && (
            <Link
              href={`/zoeken?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setOpen(false)}
              className="block border-t border-ink/10 px-4 py-2.5 text-center text-sm font-bold text-brand hover:bg-brand-light"
            >
              Alle {data.totaal.toLocaleString("nl-NL")} resultaten bekijken →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestieRegel({
  href,
  actief,
  onKies,
  children,
}: {
  href: string;
  actief: boolean;
  onKies: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="option"
      aria-selected={actief}
      onClick={onKies}
      className={`block rounded-lg px-2 py-1.5 transition ${
        actief ? "bg-brand-light text-brand" : "hover:bg-ink/5"
      }`}
    >
      {children}
    </Link>
  );
}
