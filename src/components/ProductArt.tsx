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
  const iconSize = size === "lg" ? "text-8xl" : size === "sm" ? "text-3xl" : "text-6xl";
  return (
    <div
      role="img"
      aria-label={label ?? "Productafbeelding"}
      className="flex aspect-square w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 85% 95%), hsl(${hue} 70% 88%))`,
      }}
    >
      <span className={`${iconSize} drop-shadow-sm`} aria-hidden>
        {icon}
      </span>
    </div>
  );
}
