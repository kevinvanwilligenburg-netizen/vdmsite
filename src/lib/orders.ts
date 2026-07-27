import { randomInt } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getMolliePayment } from "@/lib/mollie";
import { pushOrderToTilroy } from "@/lib/tilroy";
import type { CartItem, Order, OrderCustomer, OrderPayment } from "@/lib/types";

/**
 * Eenvoudige bestandsopslag voor bestellingen (JSON per order in .data/).
 * Prima voor lokaal draaien en demo's; vervang dit in productie door een
 * database (zie README → "Naar productie").
 */

const DATA_DIR = path.join(process.cwd(), ".data", "orders");

function isValidOrderId(id: string): boolean {
  return /^[A-Z0-9-]{6,40}$/i.test(id);
}

function orderPath(id: string): string {
  return path.join(DATA_DIR, `${id.toUpperCase()}.json`);
}

function generateOrderId(): string {
  // Geen verwarrende tekens (0/O, 1/I) in het leesbare deel.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[randomInt(alphabet.length)];
  }
  return `VDM-${suffix}`;
}

function generatePickupCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function createOrder(input: {
  items: CartItem[];
  customer: OrderCustomer;
  store: { id: string; name: string; city: string };
}): Promise<Order> {
  const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const order: Order = {
    id: generateOrderId(),
    createdAt: new Date().toISOString(),
    status: "pending_payment",
    items: input.items,
    totals: { subtotal, total: subtotal },
    customer: input.customer,
    store: input.store,
    pickupCode: generatePickupCode(),
    payment: { provider: "demo" },
  };
  await saveOrder(order);
  return order;
}

export async function saveOrder(order: Order): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(orderPath(order.id), JSON.stringify(order, null, 2), "utf8");
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!isValidOrderId(id)) return null;
  try {
    const raw = await fs.readFile(orderPath(id), "utf8");
    return JSON.parse(raw) as Order;
  } catch {
    return null;
  }
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  const order = await getOrder(id);
  if (!order) return null;
  const updated: Order = { ...order, ...patch };
  await saveOrder(updated);
  return updated;
}

const PAID_STATUSES: Order["status"][] = ["paid", "ready_for_pickup", "completed"];

export function isPaidStatus(status: Order["status"]): boolean {
  return PAID_STATUSES.includes(status);
}

/**
 * Verwerkt de uitkomst van een betaling (webhook, demo-betaling of lazy sync).
 * Idempotent: een al betaalde bestelling wordt nooit teruggezet. Bij een
 * geslaagde betaling wordt de bestelling doorgezet naar Tilroy.
 */
export async function applyPaymentResult(
  order: Order,
  result: "paid" | "failed",
  paymentInfo?: Partial<OrderPayment>,
): Promise<Order> {
  if (isPaidStatus(order.status)) return order;

  if (result === "failed") {
    return (
      (await updateOrder(order.id, {
        status: "payment_failed",
        payment: { ...order.payment, ...paymentInfo },
      })) ?? order
    );
  }

  const paid: Order =
    (await updateOrder(order.id, {
      status: "paid",
      payment: {
        ...order.payment,
        ...paymentInfo,
        paidAt: paymentInfo?.paidAt ?? new Date().toISOString(),
      },
    })) ?? order;

  const tilroySaleId = await pushOrderToTilroy(paid);
  if (tilroySaleId) {
    return (await updateOrder(paid.id, { tilroySaleId })) ?? paid;
  }
  return paid;
}

/**
 * Haalt een bestelling op en synchroniseert onderweg de Mollie-status als de
 * betaling nog openstaat. Zo werkt de flow ook zonder bereikbare webhook
 * (bijvoorbeeld op localhost).
 */
export async function getOrderSynced(id: string): Promise<Order | null> {
  const order = await getOrder(id);
  if (!order) return null;
  if (
    order.status !== "pending_payment" ||
    order.payment.provider !== "mollie" ||
    !order.payment.id
  ) {
    return order;
  }
  try {
    const payment = await getMolliePayment(order.payment.id);
    if (payment.status === "paid") {
      return applyPaymentResult(order, "paid", {
        method: payment.method ?? undefined,
        paidAt: payment.paidAt ?? undefined,
      });
    }
    if (["failed", "canceled", "expired"].includes(payment.status)) {
      return applyPaymentResult(order, "failed");
    }
  } catch (error) {
    console.error(`[mollie] status van bestelling ${id} bijwerken mislukt:`, error);
  }
  return order;
}
