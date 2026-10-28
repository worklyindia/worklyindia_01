// Official PayPal webhook event-name catalog, checked 2026-10-15.
// https://developer.paypal.com/api/rest/webhooks/event-names/
// Unknown future events remain visible through prefix classification and Other.
export const PAYPAL_EVENT_CATALOG: Record<string, { label: string; events: string[] }> = {
  payment: { label: "Payment", events: [
    "PAYMENT.AUTHORIZATION.CREATED",
    "PAYMENT.AUTHORIZATION.VOIDED",
    "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.CAPTURE.DECLINED",
    "PAYMENT.CAPTURE.DENIED",
    "PAYMENT.CAPTURE.PENDING",
    "PAYMENT.SALE.COMPLETED",
    "PAYMENT.SALE.DENIED",
    "PAYMENT.SALE.PENDING",
    "PAYMENTS.PAYMENT.CREATED",
  ] },
  order: { label: "Order", events: [
    "CHECKOUT.CHECKOUT.BUYER-APPROVED",
    "CHECKOUT.ORDER.APPROVED",
    "CHECKOUT.ORDER.COMPLETED",
    "CHECKOUT.ORDER.PROCESSED",
    "CHECKOUT.PAYMENT-APPROVAL.REVERSED",
    "PAYMENT.ORDER.CANCELLED",
    "PAYMENT.ORDER.CREATED",
  ] },
  subscription: { label: "Subscription", events: [
    "BILLING.SUBSCRIPTION.ACTIVATED",
    "BILLING.SUBSCRIPTION.CANCELLED",
    "BILLING.SUBSCRIPTION.CREATED",
    "BILLING.SUBSCRIPTION.EXPIRED",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    "BILLING.SUBSCRIPTION.RE-ACTIVATED",
    "BILLING.SUBSCRIPTION.SUSPENDED",
    "BILLING.SUBSCRIPTION.UPDATED",
  ] },
  plan: { label: "Billing plan", events: [
    "BILLING.PLAN.ACTIVATED",
    "BILLING.PLAN.CREATED",
    "BILLING.PLAN.DEACTIVATED",
    "BILLING.PLAN.PRICING-CHANGE.ACTIVATED",
    "BILLING.PLAN.UPDATED",
  ] },
  product: { label: "Product", events: [
    "CATALOG.PRODUCT.CREATED",
    "CATALOG.PRODUCT.UPDATED",
  ] },
  invoice: { label: "Invoice", events: [
    "INVOICING.INVOICE.CANCELLED",
    "INVOICING.INVOICE.CREATED",
    "INVOICING.INVOICE.PAID",
    "INVOICING.INVOICE.REFUNDED",
    "INVOICING.INVOICE.SCHEDULED",
    "INVOICING.INVOICE.UPDATED",
  ] },
  payout: { label: "Payout", events: [
    "PAYMENT.PAYOUTS-ITEM.BLOCKED",
    "PAYMENT.PAYOUTS-ITEM.CANCELED",
    "PAYMENT.PAYOUTS-ITEM.FAILED",
    "PAYMENT.PAYOUTS-ITEM.HELD",
    "PAYMENT.PAYOUTS-ITEM.REFUNDED",
    "PAYMENT.PAYOUTS-ITEM.RETURNED",
    "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
    "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
    "PAYMENT.PAYOUTSBATCH.DENIED",
    "PAYMENT.PAYOUTSBATCH.PROCESSING",
    "PAYMENT.PAYOUTSBATCH.SUCCESS",
    "PAYMENT.REFERENCED-PAYOUT-ITEM.COMPLETED",
    "PAYMENT.REFERENCED-PAYOUT-ITEM.FAILED",
  ] },
  refund: { label: "Refund", events: [
    "PAYMENT.CAPTURE.REFUNDED",
    "PAYMENT.CAPTURE.REVERSED",
    "PAYMENT.REFUND.FAILED",
    "PAYMENT.REFUND.PENDING",
    "PAYMENT.SALE.REFUNDED",
    "PAYMENT.SALE.REVERSED",
  ] },
  dispute: { label: "Dispute", events: [
    "CUSTOMER.DISPUTE.CREATED",
    "CUSTOMER.DISPUTE.RESOLVED",
    "CUSTOMER.DISPUTE.UPDATED",
    "RISK.DISPUTE.CREATED",
  ] },
  vault: { label: "Saved methods", events: [
    "PAYMENT-TOKENIZATION.ENROLLMENT.CREATED",
    "PAYMENT-TOKENIZATION.METADATA.CHANGED",
    "PAYMENT-TOKENIZATION.PAYMENT-CREDENTIAL.CREATED",
    "PAYMENT-TOKENIZATION.PAYMENT-CREDENTIAL.UPDATED",
    "PAYMENT-TOKENIZATION.TOKEN-STATUS.CHANGED",
    "PAYMENT-TOKENIZATION.TRANSACTION.CREATED",
    "VAULT.PAYMENT-TOKEN.CREATED",
    "VAULT.PAYMENT-TOKEN.DELETED",
    "VAULT.PAYMENT-TOKEN.DELETION-INITIATED",
  ] },
  merchant: { label: "Merchant", events: [
    "CUSTOMER.MANAGED-ACCOUNT.ACCOUNT-CREATED",
    "CUSTOMER.MANAGED-ACCOUNT.ACCOUNT-STATUS-CHANGED",
    "CUSTOMER.MANAGED-ACCOUNT.ACCOUNT-UPDATED",
    "CUSTOMER.MANAGED-ACCOUNT.CREATION-FAILED",
    "CUSTOMER.MANAGED-ACCOUNT.NEGATIVE-BALANCE-DEBIT-INITIATED",
    "CUSTOMER.MANAGED-ACCOUNT.NEGATIVE-BALANCE-NOTIFIED",
    "CUSTOMER.MANAGED-ACCOUNT.RISK-ASSESSED",
    "CUSTOMER.MERCHANT-INTEGRATION.CAPABILITY-UPDATED",
    "CUSTOMER.MERCHANT-INTEGRATION.PRODUCT-SUBSCRIPTION-UPDATED",
    "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ALREADY-INTEGRATED",
    "CUSTOMER.MERCHANT-INTEGRATION.SELLER-CONSENT-GRANTED",
    "CUSTOMER.MERCHANT-INTEGRATION.SELLER-EMAIL-CONFIRMED",
    "CUSTOMER.MERCHANT-INTEGRATION.SELLER-ONBOARDING-INITIATED",
    "MERCHANT.ONBOARDING.COMPLETED",
    "MERCHANT.PARTNER-CONSENT.REVOKED",
  ] },
  account: { label: "Account", events: [
    "CUSTOMER.ACCOUNT-LIMITATION.ADDED",
    "CUSTOMER.ACCOUNT-LIMITATION.ESCALATED",
    "CUSTOMER.ACCOUNT-LIMITATION.LIFTED",
    "CUSTOMER.ACCOUNT-LIMITATION.UPDATED",
  ] },
  identity: { label: "Consent", events: [
    "IDENTITY.AUTHORIZATION-CONSENT.REVOKED",
  ] },
  other: { label: "Other", events: [
  ] },
};

const eventCategories = new Map(Object.entries(PAYPAL_EVENT_CATALOG).flatMap(([category, config]) => config.events.map(event => [event, category] as const)));

export function paypalEventCategory(type: string): string {
  const known = eventCategories.get(type);
  if (known) return known;
  if (type.startsWith("INVOICING.")) return "invoice";
  if (type.startsWith("PAYMENT.PAYOUT") || type.startsWith("PAYMENT.REFERENCED-PAYOUT")) return "payout";
  if (type.startsWith("CHECKOUT.") || type.startsWith("PAYMENT.ORDER.")) return "order";
  if (type.startsWith("BILLING.SUBSCRIPTION.")) return "subscription";
  if (type.startsWith("BILLING.PLAN.")) return "plan";
  if (type.startsWith("CATALOG.")) return "product";
  if (type.startsWith("VAULT.") || type.startsWith("PAYMENT-TOKENIZATION.")) return "vault";
  if (type.startsWith("CUSTOMER.DISPUTE.") || type.startsWith("RISK.DISPUTE.")) return "dispute";
  if (type.startsWith("CUSTOMER.ACCOUNT-LIMITATION.")) return "account";
  if (type.startsWith("MERCHANT.") || type.startsWith("CUSTOMER.MERCHANT-INTEGRATION.") || type.startsWith("CUSTOMER.MANAGED-ACCOUNT.")) return "merchant";
  if (type.startsWith("IDENTITY.")) return "identity";
  if (type.includes("REFUND") || type.includes("REVERSED")) return "refund";
  if (type.startsWith("PAYMENT.") || type.startsWith("PAYMENTS.")) return "payment";
  return "other";
}
