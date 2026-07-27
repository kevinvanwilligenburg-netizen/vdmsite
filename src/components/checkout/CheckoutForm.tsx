"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { SAME_DAY_CUTOFF_HOUR } from "@/lib/delivery";
import { euro } from "@/lib/format";

interface StoreOption {
  id: string;
  name: string;
  address: string;
  city: string;
}

type Fulfilment = "delivery" | "pickup";

export function CheckoutForm({ stores }: { stores: StoreOption[] }) {
  const { items, subtotal, hydrated } = useCart();
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
              ? { street, houseNumber, houseNumberSuffix, postalCode, city }
              : {}),
          },
          ...(fulfilment === "pickup" ? { storeId } : {}),
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
                <span className="block text-sm text-ink-soft">
                  Vaak dezelfde dag klaar. Je krijgt een afhaalcode.
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
              Afhalen is altijd gratis. Vandaag besteld? Dan staat je bestelling
              er meestal vandaag nog klaar.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {stores.map((store) => (
                <label
                  key={store.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                    storeId === store.id
                      ? "border-brand bg-brand-light"
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
                  <span>
                    <span className="block font-bold text-ink">{store.city}</span>
                    <span className="block text-sm text-ink-soft">{store.address}</span>
                  </span>
                </label>
              ))}
            </div>
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
        <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              {fulfilment === "delivery" ? "Bezorging (DHL)" : "Afhalen in de winkel"}
            </dt>
            <dd className="font-bold text-green-700">Gratis</dd>
          </div>
          {fulfilment === "delivery" && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">Bezorgd</dt>
              <dd className="font-semibold text-ink">
                {beforeCutoff ? "Vandaag of binnen 1 werkdag" : "Binnen 1 werkdag"}
              </dd>
            </div>
          )}
          <div className="flex justify-between text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">{euro(subtotal)}</dd>
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
          Je betaalt {euro(subtotal)}{" "}
          {fulfilment === "delivery"
            ? "— bezorgen is gratis."
            : "en haalt je bestelling gratis op."}
        </p>
        <div className="mt-4 border-t border-ink/10 pt-4">
          <TrustpilotWidget variant="micro" />
        </div>
      </aside>
    </form>
  );
}
