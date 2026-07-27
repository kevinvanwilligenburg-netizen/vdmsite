"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoPayButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"paid" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function complete(outcome: "paid" | "failed") {
    setBusy(outcome);
    setError(null);
    try {
      const response = await fetch("/api/demo-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "De demo-betaling kon niet worden verwerkt.");
      }
      router.push(`/bestelling/${orderId}`);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "De demo-betaling kon niet worden verwerkt.",
      );
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => complete("paid")}
        disabled={busy !== null}
        className="btn w-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
      >
        {busy === "paid" ? "Verwerken…" : "Betaling geslaagd"}
      </button>
      <button
        type="button"
        onClick={() => complete("failed")}
        disabled={busy !== null}
        className="btn w-full border-2 border-ink/15 text-ink hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {busy === "failed" ? "Verwerken…" : "Betaling mislukt"}
      </button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brand-dark">
          {error}
        </p>
      )}
    </div>
  );
}
