import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";
import { getCategories, getProducts, getStores } from "@/lib/tilroy";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, stores] = await Promise.all([
    getProducts(),
    getCategories(),
    getStores(),
  ]);
  const lastModified = new Date();

  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "daily", priority: 1 },
    {
      url: absoluteUrl("/kleurkiezer"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/winkels"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...categories.map((category) => ({
      url: absoluteUrl(`/categorie/${category.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/product/${product.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...stores.map((store) => ({
      url: absoluteUrl(`/winkels/${store.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
