"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { euro } from "@/lib/format";

interface StoreOption {
  id: string;
  name: string;
  address: string;
  city: string;
}

export function CheckoutForm({ stores }: { stores: StoreOption[] }) {
  const { items, subtotal, hydrated } = useCart();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          customer: { firstName, lastName, email, phone },
          storeId,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            colorCode: item.color?.code,
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
          <h2 className="text-lg font-black text-ink">1. Jouw gegevens</h2>
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
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            We gebruiken je gegevens alleen voor deze bestelling, bijvoorbeeld om je
            te laten weten wanneer alles klaarligt.
          </p>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">2. Kies je afhaalwinkel</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Afhalen is altijd gratis. Vandaag besteld? Dan staat je bestelling er
            meestal vandaag nog klaar.
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

        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">3. Betalen</h2>
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
                    Kleur: RAL {item.color.code} {item.color.name}
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
            <dt className="text-ink-soft">Afhalen in de winkel</dt>
            <dd className="font-bold text-green-700">Gratis</dd>
          </div>
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
          Je betaalt {euro(subtotal)} en haalt je bestelling gratis op.
        </p>
      </aside>
    </form>
  );
}
