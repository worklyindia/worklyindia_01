import { expect, test } from "bun:test";
import { normalizePayPalEvent, type PayPalEventRow } from "./paypalEvents";
import { collectPayPalEvents, filterPayPalEvents, payPalCategoryCounts, payPalStatBoxes } from "./paypalEventStats";

const row = (id: string, type: string, amount = "10.00", currency = "USD"): PayPalEventRow => ({
  id, provider: "paypal", event_id: `WH-${id}`, event_type: type, status: "processed", processed_at: null,
  created_at: "2026-10-15T07:00:00Z", payload: { resource: { id, amount: { value: amount, currency_code: currency } } },
});

test("Totals include every private page, not just 100 or the 1000-row limit", async () => {
  const rows = Array.from({ length: 1205 }, (_, i) => row(String(i), i < 1001 ? "CHECKOUT.ORDER.APPROVED" : "INVOICING.INVOICE.PAID"));
  const events = await collectPayPalEvents(async (offset, size) => rows.slice(offset, offset + size));
  expect(events?.length).toBe(1205);
  const counts = payPalCategoryCounts(events ?? []);
  expect(counts.order).toBe(1001); expect(counts.invoice).toBe(204); expect(counts.all).toBe(1205);
  const orders = filterPayPalEvents(events ?? [], "order", "all", "");
  expect(payPalStatBoxes(orders, "order")[1].count).toBe(1001);
});

test("Category summaries use matching event types and respect search", () => {
  const events = [row("one", "CHECKOUT.ORDER.APPROVED"), row("two", "CHECKOUT.ORDER.COMPLETED"), row("three", "INVOICING.INVOICE.PAID")].map(normalizePayPalEvent);
  const filtered = filterPayPalEvents(events, "order", "all", "two");
  const boxes = payPalStatBoxes(filtered, "order");
  expect(boxes[0].count).toBe(1); expect(boxes[1].count).toBe(0); expect(boxes[2].count).toBe(1);
  expect(payPalCategoryCounts(events).invoice).toBe(1);
});

test("Captured totals never combine currencies or count pending payments", () => {
  const events = [row("a", "PAYMENT.CAPTURE.COMPLETED", "12.34"), row("b", "PAYMENT.CAPTURE.COMPLETED", "7.00", "EUR"), row("c", "PAYMENT.CAPTURE.PENDING", "100")].map(normalizePayPalEvent);
  expect(payPalStatBoxes(events, "all")[2].amounts).toEqual({ USD: 1234, EUR: 700 });
  expect(payPalStatBoxes(events, "payment")[3].count).toBe(1);
});

test("Repeated lifecycle notification for one capture does not inflate money totals", () => {
  const a = row("capture", "PAYMENT.CAPTURE.COMPLETED", "5.00");
  const b = { ...a, id: "row-2", event_id: "WH-2" };
  expect(payPalStatBoxes([a, b].map(normalizePayPalEvent), "all")[2].amounts).toEqual({ USD: 500 });
});

test("Payout summary reads the payout item amount and never counts the batch twice", () => {
  const item = { ...row("item", "PAYMENT.PAYOUTS-ITEM.SUCCEEDED"), payload: { resource: { payout_item_id: "item", payout_item: { amount: { value: "25.50", currency: "USD" } } } } };
  const events = [item, row("batch", "PAYMENT.PAYOUTSBATCH.SUCCESS", "25.50")].map(normalizePayPalEvent);
  expect(payPalStatBoxes(events, "payout")[3].amounts).toEqual({ USD: 2550 });
});

test("All PayPal product categories have four applicable summary metrics", () => {
  for (const category of ["all", "payment", "order", "subscription", "plan", "product", "invoice", "payout", "refund", "dispute", "vault", "merchant", "account", "identity", "other"]) {
    expect(payPalStatBoxes([], category).length).toBe(4);
    expect(payPalStatBoxes([], category)[0].count).toBe(0);
  }
});