"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import type { OrderStatus } from "@/lib/types";

const PAID_STATUSES: OrderStatus[] = ["paid", "ready_for_pickup", "completed"];

/**
 * Client-hulpjes op de bestelpagina:
 * - leegt de winkelwagen zodra de bestelling betaald is;
 * - ververst de pagina zolang de betaling nog openstaat;
 * - toont een "opnieuw betalen"-knop bij een mislukte betaling.
 */
export function OrderClientActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const { clear } = useCart();
  const clearedRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (PAID_STATUSES.includes(status) && !clearedRef.current) {
      clearedRef.current = true;
      clear();
    }
  }, [status, clear]);

  useEffect(() => {
    if (status !== "pending_payment") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (!response.ok) return;
        const order = (await response.json()) as { status: OrderStatus };
        if (order.status !== status) router.refresh();
      } catch {
        // netwerkfout: volgende poging afwachten
      }
    }, 3500);
    return () => window.clearInterval(timer);
  }, [status, orderId, router]);

  if (status !== "payment_failed") return null;

  async function retryPayment() {
    setRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Opnieuw betalen is nu niet mogelijk.");
      }
      window.location.href = data.checkoutUrl;
    } catch (error) {
      setRetryError(
        error instanceof Error ? error.message : "Opnieuw betalen is nu niet mogelijk.",
      );
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={retryPayment}
        disabled={retrying}
        className="btn btn-primary disabled:opacity-60"
      >
        {retrying ? "Bezig…" : "Opnieuw proberen te betalen"}
      </button>
      {retryError && (
        <p role="alert" className="text-sm font-semibold text-brand-dark">
          {retryError}
        </p>
      )}
    </div>
  );
}
