import { Icon } from "@/components/icons";

export function ProductArt({
  icon,
  hue,
  size = "md",
  label,
}: {
  icon: string;
  hue: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const iconSize =
    size === "lg" ? "h-28 w-28" : size === "sm" ? "h-8 w-8" : "h-16 w-16";
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
