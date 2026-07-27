import { getStockByStore } from "@/lib/tilroy";
import type { Product } from "@/lib/types";

export async function StockList({ product }: { product: Product }) {
  const stock = await getStockByStore(product);
  const availableCount = stock.filter((entry) => entry.qty > 0).length;

  return (
    <details className="card group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-ink">
        <span>
          📍 Voorraad in de winkel{" "}
          <span className="font-semibold text-ink-soft">
            – op voorraad in {availableCount} van de {stock.length} winkels
          </span>
        </span>
        <span className="transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <ul className="mt-3 divide-y divide-ink/5">
        {stock.map(({ store, qty }) => (
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
        Voorraad wordt vernieuwd via ons kassasysteem. Je betaalt pas bij het
        plaatsen van je bestelling; de winkel legt je artikelen apart.
      </p>
    </details>
  );
}
