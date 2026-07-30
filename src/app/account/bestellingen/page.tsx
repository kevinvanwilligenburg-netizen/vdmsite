import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  SESSIE_COOKIE,
  emailVanSessie,
  favorietKey,
  haalFavorieten,
} from "@/lib/account";
import { getOrdersByEmail } from "@/lib/orders";
import { PRIJS_COOKIE, prijsModusUit } from "@/lib/prijs";
import { getProducts } from "@/lib/tilroy";
import { isPaidStatus, type Product } from "@/lib/types";

import { AccountNav } from "../_onderdelen/AccountNav";
import { BewaarKnop } from "../_onderdelen/BewaarKnop";
import { NogEensBestellen } from "../_onderdelen/NogEensBestellen";
import { btwLabel, toonEuros } from "../_onderdelen/bedrag";
import { datumLang, statusTekst } from "../_onderdelen/opmaak";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Je bestellingen",
  robots: { index: false, follow: false },
};

export default async function BestellingenPage() {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  // Niet ingelogd? Dan het inlogscherm, met de weg terug hierheen. Deze pagina
  // toont bestellingen van één klant en heeft dus een sessie nodig.
  if (!email) redirect("/account?verder=/account/bestellingen");

  const modus = prijsModusUit(cookies().get(PRIJS_COOKIE)?.value);

  const [orders, producten, favorieten] = await Promise.all([
    getOrdersByEmail(email, 25),
    getProducts(),
    haalFavorieten(email),
  ]);

  const perId = new Map<string, Product>(producten.map((product) => [product.id, product]));
  const bewaard = new Set(
    favorieten.map((item) => favorietKey(item.productId, item.variantId)),
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Mijn Voordeelmarkt", href: "/account" },
          { name: "Bestellingen" },
        ]}
      />

      <header>
        <h1 className="text-3xl font-black uppercase text-ink">Je bestellingen</h1>
        <p className="mt-2 text-ink-soft">
          Alles wat je in de webshop bestelde. Bedragen {btwLabel(modus)}.
        </p>
      </header>

      <AccountNav actief="/account/bestellingen" />

      {orders.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-black text-ink">Nog geen webshopbestellingen</p>
          <p className="mt-1 text-sm text-ink-soft">
            Wat je in de winkel kocht staat op je overzicht, bij je aankopen.
          </p>
          <Link href="/" className="btn btn-primary mt-4">
            Naar de winkel
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-black text-ink">Bestelling {order.reference}</p>
                  <p className="text-sm text-ink-soft">
                    {datumLang(order.createdAt)} · {statusTekst(order.paymentStatus)}
                  </p>
                </div>
                <p className="font-black text-ink">{toonEuros(order.total, modus)}</p>
              </div>

              <ul className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                {order.items.map((item) => {
                  const product = perId.get(item.productId);
                  // Alleen bewaren wat we nog verkopen; een knop die de server
                  // toch weigert is erger dan geen knop.
                  const variant = item.variantId
                    ? (product?.variants ?? []).find(
                        (kandidaat) => kandidaat.id === item.variantId,
                      )
                    : undefined;
                  const magBewaren = Boolean(product) && (!item.variantId || Boolean(variant));

                  return (
                    <li key={item.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="min-w-0 flex-1 text-sm text-ink">
                        <span className="font-bold">{item.quantity}×</span>{" "}
                        {product ? (
                          <Link
                            href={`/product/${product.slug}`}
                            className="hover:text-brand hover:underline"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                        {item.variantLabel && (
                          <span className="text-ink-soft"> · {item.variantLabel}</span>
                        )}
                        {item.color && (
                          <span className="text-ink-soft">
                            {" "}
                            · {[item.color.code, item.color.name].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm text-ink-soft">
                        {toonEuros(item.price * item.quantity, modus)}
                      </span>
                      {magBewaren && product && (
                        <BewaarKnop
                          productId={product.id}
                          variantId={variant?.id}
                          bewaard={bewaard.has(favorietKey(product.id, variant?.id))}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-ink/10 pt-4">
                <NogEensBestellen referentie={order.reference} />
                <Link
                  href={`/bestelling/${order.reference}`}
                  className="text-sm font-bold text-brand hover:underline"
                >
                  Bekijk bestelling →
                </Link>
                {/* Alleen bij een betaalde bestelling: anders wijst de link
                    naar een factuur voor geld dat nooit binnenkwam. */}
                {isPaidStatus(order.paymentStatus) && (
                  <Link
                    href={`/bestelling/${order.reference}/factuur`}
                    className="text-sm font-bold text-brand hover:underline"
                  >
                    Factuur →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
