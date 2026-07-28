"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { useStore } from "@/components/store/StoreProvider";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { SAME_DAY_CUTOFF_HOUR } from "@/lib/delivery";
import { KLUSPAS_DISCOUNT_LABEL } from "@/lib/kluspas";
import { euro } from "@/lib/format";

interface StoreOption {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  /** Afhaalbelofte voor deze winkel, server-side berekend op openingstijden. */
  pickupLabel: string;
}

interface StoreAvailability {
  storeId: string;
  city: string;
  complete: boolean;
  missing: string[];
}

type Fulfilment = "delivery" | "pickup";

/** Antwoord van /api/bezorgopties: wat kan er, en wat kost het? */
interface BezorgOpties {
  standaard: { type: string; label: string; kosten: number };
  sameDay: { beschikbaar: boolean; toeslag?: number; label?: string; cutoffUur: number };
  verzending: {
    land: "NL" | "BE";
    kosten: number;
    gratisVanaf: number;
    tarief: number;
    tekort: number;
  };
}

export function CheckoutForm({ stores }: { stores: StoreOption[] }) {
  const { items, subtotal, hydrated } = useCart();
  const { favourite } = useStore();
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [houseNumberSuffix, setHouseNumberSuffix] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<StoreAvailability[] | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);
  const [country, setCountry] = useState<"NL" | "BE">("NL");
  const [sameDay, setSameDay] = useState(false);
  const [opties, setOpties] = useState<BezorgOpties | null>(null);
  const [kluspasNumber, setKluspasNumber] = useState("");
  const [kluspasOpen, setKluspasOpen] = useState(false);

  // De exacte bezorgdag hangt af van de voorraad per artikel; die bepaalt de
  // server bij het plaatsen van de bestelling. Hier tonen we alleen of de
  // 10:00-cutoff nog loopt.
  const [beforeCutoff, setBeforeCutoff] = useState(
    () => new Date().getHours() < SAME_DAY_CUTOFF_HOUR,
  );
  useEffect(() => {
    const timer = window.setInterval(
      () => setBeforeCutoff(new Date().getHours() < SAME_DAY_CUTOFF_HOUR),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  // Zodra het e-mailadres compleet is, geven we het mandje door aan het
  // dashboard. Haakt de klant daarna af, dan kan die er een herinnering over
  // sturen. Eén keer per adres, en pas als de klant even stil is.
  const gemeldRef = useRef<string>("");
  useEffect(() => {
    const adres = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adres) || adres === gemeldRef.current) return;
    if (items.length === 0) return;
    const timer = window.setTimeout(() => {
      gemeldRef.current = adres;
      fetch("/api/winkelwagen/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adres,
          items: items.map((item) => ({
            title: item.name,
            quantity: item.qty,
            price: item.unitPrice / 100,
          })),
          total: subtotal / 100,
        }),
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [email, items, subtotal]);

  // De favoriete winkel van de klant staat voorgeselecteerd.
  useEffect(() => {
    if (favourite && stores.some((store) => store.slug === favourite.slug)) {
      const match = stores.find((store) => store.slug === favourite.slug);
      if (match) setStoreId(match.id);
    }
  }, [favourite, stores]);

  // Welke winkels hebben deze hele bestelling liggen? Alleen relevant bij
  // afhalen, dus we vragen het pas als de klant daarvoor kiest.
  useEffect(() => {
    if (fulfilment !== "pickup" || items.length === 0) return;
    let active = true;
    setCheckingStock(true);
    fetch("/api/voorraad/winkels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ sku: item.sku ?? item.productId, quantity: item.qty })),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { live: boolean; stores: StoreAvailability[] } | null) => {
        if (active && data?.live) setAvailability(data.stores);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingStock(false);
      });
    return () => {
      active = false;
    };
  }, [fulfilment, items]);

  // Bezorgopties bij de server opvragen: die kent de voorraad en de klok.
  useEffect(() => {
    if (fulfilment !== "delivery" || items.length === 0) return;
    let actief = true;
    fetch("/api/bezorgopties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ sku: item.sku ?? item.productId, quantity: item.qty })),
        subtotal,
        country,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: BezorgOpties | null) => {
        if (!actief || !data) return;
        setOpties(data);
        // Is vandaag intussen niet meer mogelijk (cutoff voorbij), dan valt de
        // keuze terug op morgen in plaats van stilletjes te blijven staan.
        if (!data.sameDay.beschikbaar) setSameDay(false);
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
  }, [fulfilment, items, subtotal, country]);

  // Bedragen die op meerdere plekken in het overzicht terugkomen.
  const verzendkosten = fulfilment === "pickup" ? 0 : (opties?.verzending.kosten ?? 0);
  const toeslag = fulfilment === "delivery" && sameDay ? (opties?.sameDay.toeslag ?? 0) : 0;
  const totaal = subtotal + verzendkosten + toeslag;
  const tekortVoorGratis = fulfilment === "delivery" ? (opties?.verzending.tekort ?? 0) : 0;

  if (!hydrated) {
    return <p className="py-16 text-center text-ink-soft">Bestelgegevens laden…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <h2 className="text-xl font-black text-ink">Je winkelwagen is leeg</h2>
        <p className="mt-2 text-ink-soft">Voeg eerst artikelen toe voordat je afrekent.</p>
        <Link href="/" className="btn btn-primary mt-6">
          Naar de winkel
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfilment,
          customer: {
            firstName,
            lastName,
            email,
            phone,
            ...(fulfilment === "delivery"
              ? { street, houseNumber, houseNumberSuffix, postalCode, city, country }
              : {}),
          },
          ...(fulfilment === "pickup" ? { storeId } : {}),
          ...(fulfilment === "delivery" && sameDay ? { sameDay: true } : {}),
          ...(kluspasNumber.trim() ? { kluspasNumber: kluspasNumber.trim() } : {}),
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            colorKey: item.color?.key ?? item.color?.code,
            qty: item.qty,
          })),
        }),
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Er ging iets mis bij het plaatsen van je bestelling.");
      }
      window.location.href = data.checkoutUrl;
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Er ging iets mis bij het plaatsen van je bestelling.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">1. Bezorgen of afhalen?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                fulfilment === "delivery"
                  ? "border-brand bg-brand-light"
                  : "border-ink/10 hover:border-ink/25"
              }`}
            >
              <input
                type="radio"
                name="fulfilment"
                value="delivery"
                checked={fulfilment === "delivery"}
                onChange={() => setFulfilment("delivery")}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="truck" className="h-5 w-5 text-brand" /> Bezorgen
                  <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-black text-green-800">
                    Gratis
                  </span>
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-green-700">
                  {beforeCutoff ? "Vandaag of binnen 1 werkdag" : "Binnen 1 werkdag"}
                </span>
                <span className="block text-xs text-ink-soft">
                  {beforeCutoff
                    ? `Ligt alles in ons webshopmagazijn, dan bezorgt DHL vandaag nog (vóór ${SAME_DAY_CUTOFF_HOUR}:00 besteld). Anders verstuurt de winkel met PostNL, binnen één werkdag.`
                    : "DHL bezorgt morgen als alles in ons webshopmagazijn ligt; anders verstuurt de winkel met PostNL binnen één werkdag."}
                </span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                fulfilment === "pickup"
                  ? "border-brand bg-brand-light"
                  : "border-ink/10 hover:border-ink/25"
              }`}
            >
              <input
                type="radio"
                name="fulfilment"
                value="pickup"
                checked={fulfilment === "pickup"}
                onChange={() => setFulfilment("pickup")}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="store" className="h-5 w-5 text-brand" /> Afhalen in de winkel
                  <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-black text-green-800">
                    Gratis
                  </span>
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-green-700">
                  Binnen 2 uur klaar
                </span>
                <span className="block text-xs text-ink-soft">
                  Kan alleen in een winkel die alles op voorraad heeft.
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">2. Jouw gegevens</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="voornaam" className="mb-1 block text-sm font-bold text-ink">
                Voornaam
              </label>
              <input
                id="voornaam"
                required
                minLength={2}
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="input"
                placeholder="Voornaam"
              />
            </div>
            <div>
              <label htmlFor="achternaam" className="mb-1 block text-sm font-bold text-ink">
                Achternaam
              </label>
              <input
                id="achternaam"
                required
                minLength={2}
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="input"
                placeholder="Achternaam"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-bold text-ink">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input"
                placeholder="naam@voorbeeld.nl"
              />
            </div>
            <div>
              <label htmlFor="telefoon" className="mb-1 block text-sm font-bold text-ink">
                Telefoonnummer
              </label>
              <input
                id="telefoon"
                type="tel"
                required
                minLength={8}
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="input"
                placeholder="06 12345678"
              />
            </div>
            {fulfilment === "delivery" && (
              <>
                <div className="sm:col-span-2">
                  <label htmlFor="straat" className="mb-1 block text-sm font-bold text-ink">
                    Straatnaam
                  </label>
                  <input
                    id="straat"
                    required
                    minLength={2}
                    autoComplete="address-line1"
                    value={street}
                    onChange={(event) => setStreet(event.target.value)}
                    className="input"
                    placeholder="Voorbeeldstraat"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="huisnummer" className="mb-1 block text-sm font-bold text-ink">
                      Huisnummer
                    </label>
                    <input
                      id="huisnummer"
                      required
                      pattern=".*\d.*"
                      maxLength={8}
                      value={houseNumber}
                      onChange={(event) => setHouseNumber(event.target.value)}
                      className="input"
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <label htmlFor="toevoeging" className="mb-1 block text-sm font-bold text-ink">
                      Toevoeging{" "}
                      <span className="font-normal text-ink-soft">(optioneel)</span>
                    </label>
                    <input
                      id="toevoeging"
                      maxLength={8}
                      value={houseNumberSuffix}
                      onChange={(event) => setHouseNumberSuffix(event.target.value)}
                      className="input"
                      placeholder="A"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="postcode" className="mb-1 block text-sm font-bold text-ink">
                    Postcode
                  </label>
                  <input
                    id="postcode"
                    required
                    pattern="\d{4}\s?[A-Za-z]{2}"
                    autoComplete="postal-code"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    className="input"
                    placeholder="1234 AB"
                  />
                </div>
                <div>
                  <label htmlFor="plaats" className="mb-1 block text-sm font-bold text-ink">
                    Plaats
                  </label>
                  <input
                    id="plaats"
                    required
                    minLength={2}
                    autoComplete="address-level2"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="input"
                    placeholder="Plaats"
                  />
                </div>
                <div>
                  <label htmlFor="land" className="mb-1 block text-sm font-bold text-ink">
                    Land
                  </label>
                  <select
                    id="land"
                    value={country}
                    onChange={(event) => setCountry(event.target.value as "NL" | "BE")}
                    autoComplete="country"
                    className="input"
                  >
                    <option value="NL">Nederland</option>
                    <option value="BE">België</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            We gebruiken je gegevens alleen voor deze bestelling.
          </p>
        </section>

        {fulfilment === "pickup" && (
          <section className="card p-6">
            <h2 className="text-lg font-black text-ink">3. Kies je afhaalwinkel</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Afhalen is gratis en je bestelling staat binnen 2 uur klaar — mits
              alles in die winkel op voorraad ligt. Dat controleren we hieronder
              live voor je.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {stores.map((store) => {
                const status = availability?.find((entry) => entry.storeId === store.slug);
                const compleet = status?.complete;
                const tekort = status && !status.complete;
                return (
                  <label
                    key={store.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                      storeId === store.id
                        ? "border-brand bg-brand-light"
                        : tekort
                          ? "border-ink/10 opacity-60 hover:border-ink/25"
                          : "border-ink/10 hover:border-ink/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="store"
                      value={store.id}
                      checked={storeId === store.id}
                      onChange={() => setStoreId(store.id)}
                      className="mt-1 accent-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-bold text-ink">
                        {store.city}
                        {favourite?.slug === store.slug && (
                          <span className="rounded bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand">
                            jouw winkel
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-ink-soft">{store.address}</span>
                      {compleet && (
                        <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-green-700">
                          <Icon name="check" className="h-4 w-4 shrink-0" strokeWidth={3} />
                          {store.pickupLabel}
                        </span>
                      )}
                      {tekort && (
                        <span className="mt-1 block text-sm font-semibold text-amber-700">
                          {status.missing.length === 1
                            ? "1 artikel ligt hier niet"
                            : `${status.missing.length} artikelen liggen hier niet`}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {checkingStock && (
              <p className="mt-3 text-sm text-ink-soft">Voorraad per winkel controleren…</p>
            )}
            {availability && !availability.some((entry) => entry.complete) && (
              <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                Geen enkele winkel heeft je hele bestelling op voorraad. Kies
                bezorgen, of haal je bestelling in delen op.
              </p>
            )}
          </section>
        )}

        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">
            {fulfilment === "pickup" ? "4." : "3."} Betalen
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Je rekent veilig af via Mollie en kiest daar je betaalmethode.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["iDEAL", "Bancontact", "Creditcard", "Apple Pay"].map((method) => (
              <span
                key={method}
                className="rounded-md bg-ink/5 px-3 py-1.5 text-sm font-bold text-ink"
              >
                {method}
              </span>
            ))}
          </div>
        </section>
      </div>

      <aside className="card h-fit p-6">
        <h2 className="text-lg font-black text-ink">Jouw bestelling</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.key} className="flex justify-between gap-3">
              <span className="text-ink">
                {item.qty} × {item.name}
                {item.variantName && ` (${item.variantName})`}
                {item.color && (
                  <span className="block text-xs text-ink-soft">
                    Kleur: {[item.color.code, item.color.name].filter(Boolean).join(" ")}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold">
                {euro(item.unitPrice * item.qty)}
              </span>
            </li>
          ))}
        </ul>
        {/* Kluspas: 5% korting op het hele mandje */}
        <div className="mt-4 rounded-lg bg-brand-light p-3">
          {kluspasOpen || kluspasNumber ? (
            <>
              <label htmlFor="kluspas" className="block text-sm font-bold text-ink">
                Kluspas-nummer
              </label>
              <input
                id="kluspas"
                inputMode="numeric"
                value={kluspasNumber}
                onChange={(event) => setKluspasNumber(event.target.value)}
                className="input mt-1 bg-white"
                placeholder="Nummer op je pas"
              />
              <p className="mt-1.5 text-xs text-ink-soft">
                Je krijgt {KLUSPAS_DISCOUNT_LABEL.toLowerCase()} op je hele
                bestelling. De winkel controleert je pas bij het verwerken.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setKluspasOpen(true)}
              className="flex w-full items-center gap-2 text-left text-sm font-bold text-ink"
            >
              <Icon name="tag" className="h-4 w-4 shrink-0 text-brand" />
              Heb je een Kluspas? Bespaar {KLUSPAS_DISCOUNT_LABEL.toLowerCase()}
            </button>
          )}
        </div>

        {/* Bezorgsnelheid: morgen is gratis, vandaag kost een toeslag en kan
            alleen vóór de cutoff met voorraad in ons magazijn. Wat hier staat
            komt van de server, zodat de klant nooit iets kiest wat niet kan. */}
        {fulfilment === "delivery" && opties?.sameDay.beschikbaar && (
          <fieldset className="mt-4 border-t border-ink/10 pt-4">
            <legend className="mb-2 text-sm font-black text-ink">Wanneer wil je het hebben?</legend>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-3 text-sm transition ${
                  !sameDay ? "border-brand bg-brand-light" : "border-ink/10 hover:border-ink/30"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bezorgsnelheid"
                    checked={!sameDay}
                    onChange={() => setSameDay(false)}
                    className="accent-brand"
                  />
                  <span className="font-bold text-ink">Morgen bezorgd</span>
                </span>
                <span className="font-bold text-green-700">Gratis</span>
              </label>
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-3 text-sm transition ${
                  sameDay ? "border-brand bg-brand-light" : "border-ink/10 hover:border-ink/30"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bezorgsnelheid"
                    checked={sameDay}
                    onChange={() => setSameDay(true)}
                    className="accent-brand"
                  />
                  <span className="font-bold text-ink">Vandaag bezorgd</span>
                </span>
                <span className="font-bold text-ink">
                  + {euro(opties.sameDay.toeslag ?? 0)}
                </span>
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Vandaag bezorgen kan bij bestellingen vóór {opties.sameDay.cutoffUur}:00, zolang
              alles in ons webshopmagazijn ligt.
            </p>
          </fieldset>
        )}

        <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotaal</dt>
            <dd className="font-semibold text-ink">{euro(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              {fulfilment === "delivery" ? "Bezorging" : "Afhalen in de winkel"}
            </dt>
            <dd className={verzendkosten === 0 ? "font-bold text-green-700" : "font-semibold text-ink"}>
              {verzendkosten === 0 ? "Gratis" : euro(verzendkosten)}
            </dd>
          </div>
          {fulfilment === "delivery" && sameDay && opties?.sameDay.beschikbaar && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">Vandaag bezorgd</dt>
              <dd className="font-semibold text-ink">{euro(opties.sameDay.toeslag ?? 0)}</dd>
            </div>
          )}
          {fulfilment === "delivery" && tekortVoorGratis > 0 && (
            <p className="rounded-lg bg-brand-light px-3 py-2 text-xs font-semibold text-brand-dark">
              Nog {euro(tekortVoorGratis)} en je bezorging is gratis.
            </p>
          )}
          <div className="flex justify-between text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">{euro(totaal)}</dd>
          </div>
        </dl>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary mt-5 w-full disabled:opacity-60">
          {submitting ? "Bezig met bestellen…" : "Bestellen en betalen →"}
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">
          Je betaalt {euro(totaal)}{" "}
          {fulfilment === "pickup"
            ? "en haalt je bestelling gratis op."
            : verzendkosten === 0 && toeslag === 0
              ? "— bezorgen is gratis."
              : "inclusief bezorging."}
        </p>
        <div className="mt-4 border-t border-ink/10 pt-4">
          <TrustpilotWidget variant="micro" />
        </div>
      </aside>
    </form>
  );
}
