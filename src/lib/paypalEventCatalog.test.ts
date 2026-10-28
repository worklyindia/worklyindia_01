import { expect, test } from "bun:test";
import { PAYPAL_EVENT_CATALOG, paypalEventCategory } from "./paypalEventCatalog";
import { matchesPayPalEvent, normalizePayPalEvent } from "./paypalEvents";

test("All 90 distinct official PayPal webhook event names are selectable", () => {
  const events = Object.values(PAYPAL_EVENT_CATALOG).flatMap(group => group.events);
  expect(events.length).toBe(90);
  expect(new Set(events).size).toBe(90);
});

for (const [event, category] of [
  ["PAYMENT.CAPTURE.DECLINED", "payment"],
  ["PAYMENTS.PAYMENT.CREATED", "payment"],
  ["PAYMENT.ORDER.CREATED", "order"],
  ["CHECKOUT.PAYMENT-APPROVAL.REVERSED", "order"],
  ["BILLING.SUBSCRIPTION.RE-ACTIVATED", "subscription"],
  ["BILLING.PLAN.PRICING-CHANGE.ACTIVATED", "plan"],
  ["CATALOG.PRODUCT.UPDATED", "product"],
  ["INVOICING.INVOICE.SCHEDULED", "invoice"],
  ["INVOICING.INVOICE.REFUNDED", "invoice"],
  ["PAYMENT.PAYOUTS-ITEM.REFUNDED", "payout"],
  ["PAYMENT.REFERENCED-PAYOUT-ITEM.COMPLETED", "payout"],
  ["PAYMENT.REFUND.FAILED", "refund"],
  ["RISK.DISPUTE.CREATED", "dispute"],
  ["VAULT.PAYMENT-TOKEN.DELETION-INITIATED", "vault"],
  ["PAYMENT-TOKENIZATION.TOKEN-STATUS.CHANGED", "vault"],
  ["CUSTOMER.MANAGED-ACCOUNT.ACCOUNT-CREATED", "merchant"],
  ["CUSTOMER.ACCOUNT-LIMITATION.ADDED", "account"],
  ["IDENTITY.AUTHORIZATION-CONSENT.REVOKED", "identity"],
] as const) {
  test(`${event} retains its PayPal product group`, () => {
    expect(PAYPAL_EVENT_CATALOG[category].events).toContain(event);
    expect(paypalEventCategory(event)).toBe(category);
  });
}

test("Future and unknown webhook events remain searchable without a whitelist", () => {
  const event = normalizePayPalEvent({ id: "row-1", provider: "paypal", event_id: "WH-FUTURE-123",
    event_type: "NEWPRODUCT.NEW.EVENT", payload: { resource: { id: "RES-123" } },
    status: "processed", processed_at: null, created_at: "2026-10-15T07:26:00Z" });
  expect(event.category).toBe("other");
  expect(matchesPayPalEvent(event, "newproduct")).toBe(true);
  expect(matchesPayPalEvent(event, "wh-future-123")).toBe(true);
  expect(matchesPayPalEvent(event, "absent-456")).toBe(false);
  expect(paypalEventCategory("VAULT.PAYMENT-TOKEN.FUTURE")).toBe("vault");
});