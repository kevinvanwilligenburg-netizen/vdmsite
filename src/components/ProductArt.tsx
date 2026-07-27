"use client";

import Image from "next/image";
import { useState } from "react";

import { Icon } from "@/components/icons";

/**
 * Productafbeelding: de echte foto uit de feed, of een gekleurd icoonvlak.
 *
 * De feed bouwt de afbeeldings-URL op uit de productnaam, ook als er in
 * Tilroy helemaal geen foto staat. Ongeveer één op de acht links geeft dan
 * een 403. Zo'n mislukking mag geen gat in de pagina achterlaten, dus vallen
 * we netjes terug op het icoon.
 */
export function ProductArt({
  icon,
  hue,
  image,
  size = "md",
  label,
  priority = false,
}: {
  icon: string;
  hue: number;
  image?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    return (
      <div className="relative aspect-square w-full bg-white">
        <Image
          src={image}
          alt={label ?? "Productafbeelding"}
          fill
          sizes={size === "lg" ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 640px) 50vw, 25vw"}
          className="object-contain p-3"
          priority={priority}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  const iconSize = size === "lg" ? "h-28 w-28" : size === "sm" ? "h-8 w-8" : "h-16 w-16";
  return (
    <div
      role="img"
      aria-label={label ?? "Productafbeelding"}
      className="flex aspect-square w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 85% 95%), hsl(${hue} 70% 88%))`,
        color: `hsl(${hue} 45% 38%)`,
      }}
    >
      <Icon name={icon} className={iconSize} strokeWidth={1.6} />
    </div>
  );
}
