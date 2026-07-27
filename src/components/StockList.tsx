import { Icon } from "@/components/icons";
import { getStockByStore } from "@/lib/tilroy";
import type { Product } from "@/lib/types";

export async function StockList({ product }: { product: Product }) {
  const stock = await getStockByStore(product);
  const availableCount = stock.stores.filter((entry) => entry.qty > 0).length;
  const deliverable =
    stock.webshopQty === null ? product.inStock !== false : stock.webshopQty > 0;

  return (
    <details className="card group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-ink">
        <span className="flex items-center gap-2">
          <Icon name="pin" className="h-5 w-5 shrink-0 text-brand" />
          <span>
            Voorraad in de winkel{" "}
            <span className="font-semibold text-ink-soft">
              – op voorraad in {availableCount} van de {stock.stores.length} winkels
            </span>
          </span>
        </span>
        <span className="transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <Icon
          name="truck"
          className={`h-5 w-5 shrink-0 ${deliverable ? "text-green-700" : "text-ink-soft"}`}
        />
        <span className={deliverable ? "font-semibold text-green-700" : "text-ink-soft"}>
          {deliverable ? "Leverbaar — wordt bezorgd" : "Tijdelijk niet leverbaar voor bezorging"}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-ink/5">
        {stock.stores.map(({ store, qty }) => (
          <li key={store.id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-semibold text-ink">{store.city}</span>
            {qty > 2 ? (
              <span className="font-bold text-green-700">● Op voorraad</span>
            ) : qty > 0 ? (
              <span className="font-bold text-amber-600">● Nog {qty} stuks</span>
            ) : (
              <span className="font-semibold text-ink-soft">○ Uitverkocht</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-ink-soft">
        {stock.live
          ? "Voorraad komt live uit ons kassasysteem."
          : "Voorraad is een indicatie; in de winkel weten we het zeker."}{" "}
        Je betaalt bij het plaatsen van je bestelling; de winkel legt je
        artikelen apart.
      </p>
    </details>
  );
}
