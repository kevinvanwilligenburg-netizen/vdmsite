import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * Zoekmachines én AI-assistenten zijn welkom: steeds meer klanten vinden een
 * winkel via ChatGPT, Copilot of Gemini in plaats van via Google. De
 * bestel- en accountpagina's blijven overal buiten de index.
 */
const PRIVATE_PATHS = [
  "/api/",
  "/winkelwagen",
  "/afrekenen",
  "/bestelling/",
  "/betalen/",
  "/zoeken",
];

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
