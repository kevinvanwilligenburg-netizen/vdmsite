import { euro } from "@/lib/format";

export function Price({
  price,
  compareAtPrice,
  kluspasPrice,
  from = false,
  size = "md",
}: {
  price: number;
  compareAtPrice?: number;
  kluspasPrice?: number;
  from?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const priceClass =
    size === "lg"
      ? "text-3xl sm:text-4xl"
      : size === "sm"
        ? "text-lg"
        : "text-2xl";
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      {from && <span className="text-sm text-ink-soft">vanaf</span>}
      <span className={`${priceClass} font-black tracking-tight text-brand`}>
        {euro(price)}
      </span>
      {compareAtPrice && compareAtPrice > price && (
        <s className="text-sm font-medium text-ink-soft/70">{euro(compareAtPrice)}</s>
      )}
      {kluspasPrice && kluspasPrice < price && (
        <span
          className={`w-full font-semibold text-ink-soft ${size === "lg" ? "text-sm" : "text-xs"}`}
        >
          Met Kluspas{" "}
          <strong className="font-black text-ink">{euro(kluspasPrice)}</strong>
        </span>
      )}
      {size === "lg" && <span className="w-full text-xs text-ink-soft">incl. btw</span>}
    </div>
  );
}
