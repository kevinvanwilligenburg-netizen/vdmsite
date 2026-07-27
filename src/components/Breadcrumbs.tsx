import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";

export interface Crumb {
  name: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
  return (
    <nav aria-label="Kruimelpad" className="text-sm text-ink-soft">
      <JsonLd data={jsonLd} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden>›</span>}
            {item.href && index < items.length - 1 ? (
              <Link href={item.href} className="hover:text-brand hover:underline">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-ink">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
