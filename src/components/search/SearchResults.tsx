"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export function SearchResults({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  const results = useMemo(() => {
    if (!query) return [];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((product) => {
      const haystack = [
        product.name,
        product.brand,
        product.shortDescription,
        product.category,
        ...(product.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [products, query]);

  if (!query) {
    return (
      <p className="py-12 text-center text-ink-soft">
        Typ hierboven een zoekterm, bijvoorbeeld <strong>muurverf</strong> of{" "}
        <strong>accuboormachine</strong>.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-6 text-ink-soft" role="status">
        {results.length === 0
          ? `Geen resultaten voor “${query}”.`
          : `${results.length} ${results.length === 1 ? "resultaat" : "resultaten"} voor “${query}”:`}
      </p>
      {results.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
