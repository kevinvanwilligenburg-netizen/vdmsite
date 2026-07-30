import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Price } from "@/components/Price";
import { ProductArt } from "@/components/ProductArt";
import { SESSIE_COOKIE, emailVanSessie, haalFavorieten } from "@/lib/account";
import { isKvEnabled } from "@/lib/kv";
import { PRIJS_COOKIE, prijsModusUit } from "@/lib/prijs";
import { getProducts } from "@/lib/tilroy";
import type { CartItem, Product, ProductVariant } from "@/lib/types";

import { AccountNav } from "../_onderdelen/AccountNav";
import { InMandje, VerwijderFavoriet } from "../_onderdelen/FavorietActies";
import { btwLabel } from "../_onderdelen/bedrag";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bewaarde artikelen",
  robots: { index: false, follow: false },
};

/**
 * De winkelwagenregel die bij een bewaard artikel hoort.
 *
 * Hier gemaakt en niet in de browser: de prijs komt uit de catalogus van dit
 * moment. Een lijstje van drie maanden oud mag geen bedrag van drie maanden
 * geleden in het mandje leggen.
 */
function cartRegel(product: Product, variant?: ProductVariant): Omit<CartItem, "qty"> {
  // Prijs, pasprijs en afhaalbeperking horen bij de gekozen maat; nemen we ze
  // van het product, dan staat bij 2,5 liter de korting van het potje.
  const kluspasUnitPrice = variant ? variant.kluspasPrice : product.kluspasPrice;
  const pickupOnly = variant?.pickupOnly ?? product.pickupOnly;

  return {
    key: `${product.id}:${variant?.id ?? ""}:`,
    productId: product.id,
    sku: variant?.sku ?? product.sku,
    slug: product.slug,
    name: product.name,
    ...(variant ? { variantId: variant.id, variantName: variant.name } : {}),
    unitPrice: variant?.price ?? product.price,
    ...(kluspasUnitPrice ? { kluspasUnitPrice } : {}),
    icon: product.art.icon,
    hue: product.art.hue,
    ...(pickupOnly ? { pickupOnly } : {}),
    ...(product.image ? { image: product.image } : {}),
  };
}

export default async function FavorietenPage() {
  const email = await emailVanSessie(cookies().get(SESSIE_COOKIE)?.value);
  if (!email) redirect("/account?verder=/account/favorieten");

  const modus = prijsModusUit(cookies().get(PRIJS_COOKIE)?.value);
  const [favorieten, producten] = await Promise.all([haalFavorieten(email), getProducts()]);
  const perId = new Map<string, Product>(producten.map((product) => [product.id, product]));

  const regels = favorieten.map((favoriet) => {
    const product = perId.get(favoriet.productId);
    const variant = favoriet.variantId
      ? (product?.variants ?? []).find((kandidaat) => kandidaat.id === favoriet.variantId)
      : undefined;
    return { favoriet, product, variant };
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Mijn Voordeelmarkt", href: "/account" },
          { name: "Bewaard" },
        ]}
      />

      <header>
        <h1 className="text-3xl font-black uppercase text-ink">Bewaarde artikelen</h1>
        <p className="mt-2 text-ink-soft">
          Bewaard bij je account, niet in deze browser — je vindt ze dus ook terug op
          je telefoon. Prijzen {btwLabel(modus)}, zoals ze vandaag in de winkel staan.
        </p>
      </header>

      <AccountNav actief="/account/favorieten" />

      {!isKvEnabled() && (
        <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink-soft">
          Bewaren werkt nu niet: onze opslag is niet bereikbaar.
        </p>
      )}

      {regels.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-black text-ink">Je hebt nog niets bewaard</p>
          <p className="mt-1 text-sm text-ink-soft">
            Bij je bestellingen kun je een artikel bewaren, zodat je het hier terugvindt
            als je het weer nodig hebt.
          </p>
          <Link href="/account/bestellingen" className="btn btn-primary mt-4">
            Naar je bestellingen
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {regels.map(({ favoriet, product, variant }) => (
            <li
              key={`${favoriet.productId}:${favoriet.variantId ?? ""}`}
              className="card flex gap-4 p-4"
            >
              {product ? (
                <>
                  <Link
                    href={`/product/${product.slug}`}
                    className="w-24 shrink-0 overflow-hidden rounded-lg"
                  >
                    <ProductArt
                      icon={product.art.icon}
                      hue={product.art.hue}
                      image={product.image}
                      size="sm"
                      label={product.name}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${product.slug}`}
                      className="line-clamp-2 font-bold text-ink hover:text-brand"
                    >
                      {product.name}
                    </Link>
                    {variant && (
                      <p className="text-xs text-ink-soft">{variant.name}</p>
                    )}
                    <div className="mt-1">
                      <Price
                        price={variant?.price ?? product.price}
                        compareAtPrice={variant ? variant.compareAtPrice : product.compareAtPrice}
                        kluspasPrice={variant ? variant.kluspasPrice : product.kluspasPrice}
                        size="sm"
                        from={!variant && (product.variants?.length ?? 0) > 1}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {/* Mengverf en artikelen waarvan de maat nog gekozen moet
                          worden gaan naar de productpagina: die keuze horen wij
                          niet voor de klant te maken. */}
                      {product.colorMixable || (!variant && (product.variants?.length ?? 0) > 1) ? (
                        <Link
                          href={`/product/${product.slug}`}
                          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white transition hover:bg-brand-dark"
                        >
                          {product.colorMixable ? "Kies je kleur" : "Kies je maat"}
                        </Link>
                      ) : (
                        <InMandje regel={cartRegel(product, variant)} />
                      )}
                      <VerwijderFavoriet
                        productId={favoriet.productId}
                        variantId={favoriet.variantId}
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Uit het assortiment. Niet stilletjes weghalen: dan denkt de
                   klant dat wij zijn lijstje kwijt zijn. */
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">Dit artikel verkopen we niet meer</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Bel of mail ons gerust — vaak hebben we iets wat hetzelfde doet.
                  </p>
                  <div className="mt-3">
                    <VerwijderFavoriet
                      productId={favoriet.productId}
                      variantId={favoriet.variantId}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
