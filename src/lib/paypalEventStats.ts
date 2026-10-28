import { matchesPayPalEvent, normalizePayPalEvent, type PayPalEventRow } from "./paypalEvents";

export type PayPalEvent = ReturnType<typeof normalizePayPalEvent>;
export type PayPalStatBox = { label: string; count?: number; amounts?: Record<string, number>; risk?: boolean };
export const isPayPalRiskEvent = (type: string) => /DENIED|DECLINED|FAILED|CANCELED|CANCELLED|EXPIRED|SUSPENDED|REVERSED|BLOCKED|RISK\.DISPUTE\.CREATED/.test(type);

// Scan every private page against a fixed upper timestamp; never present a loaded-page count as a total.
export async function collectPayPalEvents(readPage: (offset: number, size: number) => Promise<PayPalEventRow[]>, isCurrent: () => boolean = () => true): Promise<PayPalEvent[] | null> {
  const events: PayPalEvent[] = [], seen = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const rows = await readPage(offset, 500);
    if (!isCurrent()) return null;
    for (const row of rows) {
      if (seen.has(row.event_id)) continue;
      seen.add(row.event_id); events.push(normalizePayPalEvent(row));
    }
    if (rows.length < 500) return events;
  }
}

export function filterPayPalEvents(events: PayPalEvent[], category: string, eventType: string, search: string) {
  return events.filter(e => (category === "all" || e.category === category) && (eventType === "all" || e.event_type === eventType) && matchesPayPalEvent(e, search.trim()));
}

export function payPalCategoryCounts(events: PayPalEvent[]) {
  const counts: Record<string, number> = { all: events.length };
  for (const event of events) counts[event.category] = (counts[event.category] ?? 0) + 1;
  return counts;
}

export function payPalStatBoxes(events: PayPalEvent[], category: string): PayPalStatBox[] {
  const is = (...types: string[]) => (event: PayPalEvent) => types.includes(event.event_type);
  const count = (label: string, predicate: (event: PayPalEvent) => boolean, risk = false): PayPalStatBox => ({ label, count: events.filter(predicate).length, risk });
  const amount = (label: string, predicate: (event: PayPalEvent) => boolean): PayPalStatBox => {
    const amounts: Record<string, number> = {}, seen = new Set<string>();
    for (const event of events.filter(predicate)) {
      if (event.amount_paise === null || !event.currency) continue;
      const key = `${event.event_type}:${event.entity_id ?? event.event_id}`;
      if (seen.has(key)) continue;
      seen.add(key); amounts[event.currency] = (amounts[event.currency] ?? 0) + event.amount_paise;
    }
    return { label, amounts };
  };
  const total = count("Events", () => true), risk = count("Risk", e => isPayPalRiskEvent(e.event_type), true);
  const captured = amount("Captured", is("PAYMENT.CAPTURE.COMPLETED", "PAYMENT.SALE.COMPLETED"));
  const refunded = amount("Refunded", is("PAYMENT.CAPTURE.REFUNDED", "PAYMENT.SALE.REFUNDED"));
  const map: Record<string, PayPalStatBox[]> = {
    payment: [total, risk, captured, count("Pending", is("PAYMENT.CAPTURE.PENDING", "PAYMENT.SALE.PENDING"))],
    order: [total, count("Approved", is("CHECKOUT.ORDER.APPROVED", "CHECKOUT.CHECKOUT.BUYER-APPROVED")), count("Completed", is("CHECKOUT.ORDER.COMPLETED", "CHECKOUT.ORDER.PROCESSED")), risk],
    subscription: [total, count("Activated", is("BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.RE-ACTIVATED")), count("Cancelled", is("BILLING.SUBSCRIPTION.CANCELLED"), true), count("Failed", is("BILLING.SUBSCRIPTION.PAYMENT.FAILED"), true)],
    plan: [total, count("Created", is("BILLING.PLAN.CREATED")), count("Activated", is("BILLING.PLAN.ACTIVATED", "BILLING.PLAN.PRICING-CHANGE.ACTIVATED")), count("Deactivated", is("BILLING.PLAN.DEACTIVATED"))],
    product: [total, count("Created", is("CATALOG.PRODUCT.CREATED")), count("Updated", is("CATALOG.PRODUCT.UPDATED")), count("Processed", e => e.processing_status === "processed")],
    invoice: [total, count("Paid", is("INVOICING.INVOICE.PAID")), count("Cancelled", is("INVOICING.INVOICE.CANCELLED"), true), amount("Paid amount", is("INVOICING.INVOICE.PAID"))],
    payout: [total, count("Succeeded", is("PAYMENT.PAYOUTS-ITEM.SUCCEEDED", "PAYMENT.REFERENCED-PAYOUT-ITEM.COMPLETED")), risk, amount("Paid out", is("PAYMENT.PAYOUTS-ITEM.SUCCEEDED", "PAYMENT.REFERENCED-PAYOUT-ITEM.COMPLETED"))],
    refund: [total, count("Completed", is("PAYMENT.CAPTURE.REFUNDED", "PAYMENT.SALE.REFUNDED")), count("Failed", is("PAYMENT.REFUND.FAILED"), true), refunded],
    dispute: [total, count("Created", is("CUSTOMER.DISPUTE.CREATED", "RISK.DISPUTE.CREATED")), count("Updated", is("CUSTOMER.DISPUTE.UPDATED")), count("Resolved", is("CUSTOMER.DISPUTE.RESOLVED"))],
    vault: [total, count("Created", is("VAULT.PAYMENT-TOKEN.CREATED", "PAYMENT-TOKENIZATION.ENROLLMENT.CREATED", "PAYMENT-TOKENIZATION.PAYMENT-CREDENTIAL.CREATED")), count("Updated", is("PAYMENT-TOKENIZATION.METADATA.CHANGED", "PAYMENT-TOKENIZATION.PAYMENT-CREDENTIAL.UPDATED", "PAYMENT-TOKENIZATION.TOKEN-STATUS.CHANGED")), count("Deleted", is("VAULT.PAYMENT-TOKEN.DELETED"))],
    merchant: [total, count("Onboarded", is("MERCHANT.ONBOARDING.COMPLETED", "CUSTOMER.MANAGED-ACCOUNT.ACCOUNT-CREATED")), count("Updated", e => e.event_type.endsWith("UPDATED") || e.event_type.endsWith("CHANGED")), risk],
    account: [total, count("Added", is("CUSTOMER.ACCOUNT-LIMITATION.ADDED")), count("Escalated", is("CUSTOMER.ACCOUNT-LIMITATION.ESCALATED"), true), count("Lifted", is("CUSTOMER.ACCOUNT-LIMITATION.LIFTED"))],
    identity: [total, count("Revoked", is("IDENTITY.AUTHORIZATION-CONSENT.REVOKED")), count("Processed", e => e.processing_status === "processed"), count("Pending", e => e.processing_status !== "processed")],
    other: [total, count("Processed", e => e.processing_status === "processed"), risk, count("Pending", e => e.processing_status !== "processed")],
  };
  return map[category] ?? [total, risk, captured, refunded];
}