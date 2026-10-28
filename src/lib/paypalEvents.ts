import type { PaymentEventPdfEvent } from "./paymentEventsPdf";
import { paypalEventCategory } from "./paypalEventCatalog";
export { paypalEventCategory } from "./paypalEventCatalog";

export interface PayPalEventRow {
  id: string; provider: string; event_id: string; event_type: string;
  payload: unknown; status: string; processed_at: string | null; created_at: string;
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
export function normalizePayPalEvent(row: PayPalEventRow): PaymentEventPdfEvent & { id: string; processing_status: string; processed_at: string | null } {
  const payload = object(row.payload), resource = object(payload.resource), payer = object(resource.payer);
  const directAmount = object(resource.amount), payoutAmount = object(object(resource.payout_item).amount);
  const invoiceAmount = object(object(resource.detail).metadata);
  const amount = Object.keys(directAmount).length ? directAmount : Object.keys(payoutAmount).length ? payoutAmount : object(invoiceAmount.paid_amount);
  const total = text(amount.value) ?? text(amount.total);
  const value = total === null ? NaN : Number(total);
  return {
    id: row.id, event_id: row.event_id, event_type: row.event_type, category: paypalEventCategory(row.event_type),
    account_id: text(object(resource.payee).merchant_id), entity_type: text(payload.resource_type), entity_id: text(resource.id) ?? text(resource.payout_item_id) ?? text(resource.payout_batch_id) ?? text(resource.dispute_id),
    amount_paise: Number.isFinite(value) ? value * 100 : null, currency: text(amount.currency_code) ?? text(amount.currency),
    status: text(resource.status) ?? text(resource.state) ?? row.status, processing_status: row.status, processed_at: row.processed_at,
    email: text(payer.email_address) ?? text(object(payer.payer_info).email), contact: text(object(object(payer.phone).phone_number).national_number),
    error_code: text(object(resource.status_details).reason), error_description: text(resource.reason), payload: row.payload,
    // Only the signature-verifying receiver can insert these records; browser writes are denied.
    signature_verified: true, event_created_at: text(payload.create_time), created_at: row.created_at,
  };
}
export const matchesPayPalEvent = (event: ReturnType<typeof normalizePayPalEvent>, term: string) =>
  !term || [event.event_id, event.event_type, event.entity_id, event.email, event.contact, event.status, event.processing_status]
    .some(value => value?.toLowerCase().includes(term.toLowerCase()));