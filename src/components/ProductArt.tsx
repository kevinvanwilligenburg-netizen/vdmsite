import Image from "next/image";

import { Icon } from "@/components/icons";

/**
 * Productafbeelding: de echte foto uit de feed, of anders een gekleurd
 * icoonvlak als terugval.
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
  if (image) {
    return (
      <div className="relative aspect-square w-full bg-white">
        <Image
          src={image}
          alt={label ?? "Productafbeelding"}
          fill
          sizes={size === "lg" ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 640px) 50vw, 25vw"}
          className="object-contain p-3"
          priority={priority}
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
