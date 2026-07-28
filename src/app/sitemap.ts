import type { MetadataRoute } from "next";

import { listPublishedPages } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";
import { getBrands, getCategories, getProducts, getStores } from "@/lib/tilroy";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, stores, pages, brands] = await Promise.all([
    getProducts(),
    getCategories(),
    getStores(),
    listPublishedPages(),
    getBrands(60),
  ]);
  const lastModified = new Date();

  const staticPages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/kleurkiezer", priority: 0.9, changeFrequency: "weekly" },
    { path: "/klusadvies", priority: 0.9, changeFrequency: "monthly" },
    { path: "/merken", priority: 0.8, changeFrequency: "weekly" },
    { path: "/winkels", priority: 0.8, changeFrequency: "monthly" },
    { path: "/bezorgen-en-afhalen", priority: 0.7, changeFrequency: "monthly" },
    { path: "/zakelijk", priority: 0.8, changeFrequency: "monthly" },
    { path: "/klantenservice", priority: 0.7, changeFrequency: "monthly" },
    { path: "/algemene-voorwaarden", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  ];

  return [
    ...staticPages.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(`/categorie/${category.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    // Sitemaps mogen 50.000 URL's bevatten; we tonen de leverbare artikelen.
    ...products
      .filter((product) => product.inStock !== false)
      .slice(0, 20000)
      .map((product) => ({
        url: absoluteUrl(`/product/${product.slug}`),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...brands.map((brand) => ({
      url: absoluteUrl(`/merk/${brand.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...stores.map((store) => ({
      url: absoluteUrl(`/winkels/${store.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...pages.map((page) => ({
      url: absoluteUrl(`/info/${page.slug}`),
      lastModified: page.updatedAt ? new Date(page.updatedAt) : lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
