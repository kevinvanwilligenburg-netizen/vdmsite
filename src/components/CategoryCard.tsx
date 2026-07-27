import Link from "next/link";

import type { Category } from "@/lib/types";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/categorie/${category.slug}`}
      className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl"
        style={{
          background: `linear-gradient(135deg, hsl(${category.hue} 85% 94%), hsl(${category.hue} 70% 86%))`,
        }}
        aria-hidden
      >
        {category.icon}
      </span>
      <span>
        <span className="block font-black text-ink group-hover:text-brand">
          {category.name}
        </span>
        <span className="block text-sm text-ink-soft">Bekijk het assortiment →</span>
      </span>
    </Link>
  );
}
