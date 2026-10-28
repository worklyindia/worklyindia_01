// Server copy of the Payment Details sheet PDF (same rows/layout as src/lib/paymentHistoryPdf.ts),
// served from a signed link in Payment Success / Failed / Refund emails.
import { jsPDF } from 'npm:jspdf@3.0.2';
import { autoTable } from 'npm:jspdf-autotable@5.0.7';
import { paymentWorkbookFields, refundWorkbookFields, eventIdForPayment, subscriptionIdForPayment } from './paymentWorkbookFields.ts';
import { refundDisplay, refundDestination } from './refundDisplay.ts';

const enc = new TextEncoder();
const toHex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');

async function hmac(value: string): Promise<string> {
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim() || '';
  const key = await crypto.subtle.importKey('raw', enc.encode(`payment-pdf:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(value))).slice(0, 40);
}

/** Public, unguessable link that downloads the Payment Details PDF for one payment. */
export async function paymentPdfUrl(paymentId: string): Promise<string> {
  const base = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
  return `${base}/functions/v1/razorpay-webhook?pdf=${encodeURIComponent(paymentId)}&sig=${await hmac(paymentId)}`;
}

export async function verifyPaymentPdfSig(paymentId: string, sig: string): Promise<boolean> {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId) || !sig) return false;
  const expected = await hmac(paymentId);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

const METHODS: Record<string, string> = { upi: 'UPI', bank: 'Bank', netbanking: 'Netbanking', card: 'Card', wallet: 'Wallet', emi: 'EMI', paylater: 'Credit Line', cardless_emi: 'Cardless EMI' };
const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const printable = (v: string) => String(v ?? '').replace(/₹/g, 'INR ').replace(/•/g, '*').replace(/[^\x20-\x7E]/g, '');
const money = (paise: number) => `INR ${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
const at = (unix: number) => dt.format(new Date(Number(unix) * 1000));

/** Build the PDF bytes from a Razorpay payment entity plus its refunds. */
export function buildPaymentDetailsPdf(p: any, refunds: any[], label: string, meta: { eventId?: string | null; subscriptionId?: string | null; invoiceId?: string | null } = {}): Uint8Array {
  const m = String(p.method || '').toLowerCase();
  const refunded = Number(p.amount_refunded || 0);
  const status = p.status === 'failed' ? 'Failed' : refunded > 0 ? (refunded >= Number(p.amount) ? 'Refunded' : 'Partially Refunded') : p.status === 'captured' ? 'Success' : titleCase(p.status || '');
  const w = paymentWorkbookFields(p);
  const rows: Array<[string, string]> = [['Payment ID', p.id]];
  const add = (l: string, v: unknown) => { if (v !== null && v !== undefined && String(v).trim() !== '') rows.push([l, String(v)]); };
  add('Transaction ID', w.transaction_id); add('Customer ID', w.customer_id); add('Event ID', meta.eventId);
  add('Subscription ID', meta.subscriptionId); add('Invoice ID', meta.invoiceId || p.invoice_id);
  if (m) rows.push(['Method', m === 'card' && p.card?.type ? `${titleCase(p.card.type)} Card` : METHODS[m] || titleCase(m)]);
  if (p.vpa) rows.push(['Payer UPI ID', p.vpa]);
  if (p.card?.network || p.card?.last4) rows.push(['Card Details', `${p.card?.network || 'Card'}${p.card?.last4 ? ` ending ${p.card.last4}` : ''}`]);
  const bank = p.bank_name || p.bank || p.card?.issuer; if (bank) rows.push(['Bank', bank]);
  if (p.wallet) rows.push(['Provider', titleCase(p.wallet)]);
  rows.push(['Status', status], ['Amount', money(p.amount)]);
  add('Currency', w.currency); add('Description', w.description); add('Comment', p.notes?.comment);
  rows.push(['Received', at(p.created_at)]);
  add('RRN', w.rrn);
  if (p.order_id) rows.push(['Order ID', p.order_id]);
  const n = p.notes || {};
  add('Reference ID', (meta as any).referenceId || n.reference_id);
  const billing = (meta as any).billingAddress || n.billing_address;
  const shipping = (meta as any).shippingAddress || n.shipping_address;
  const gstin = (meta as any).gstin || n.gstin;
  if (p.contact || p.email || billing || shipping || gstin) {
    rows.push(['SECTION', 'CUSTOMER DETAILS']);
    if (p.contact) rows.push(['Mobile Number', p.contact]);
    if (p.email) rows.push(['Email ID', p.email]);
    add('GSTIN', gstin); add('Billing Address', billing); add('Shipping Address', shipping);
  }
  for (const r of refunds) {
    const speed = String(r.speed_processed || r.speed_requested || '').toLowerCase();
    const display = refundDisplay(r);
    const done = display.display_status === 'successful';
    const rw = refundWorkbookFields(r);
    rows.push(['SECTION', 'REFUND UPDATES'], ['Refund ID', r.id], ['Refund Speed', speed ? titleCase(speed) : 'Processing'],
      ['Refund Status', display.display_status === 'failed' ? 'Refund Failed' : done ? 'Refund Success' : 'Refund can take up to 7 days.'],
      ['Refunded Amount', money(r.amount)]);
    add('Currency', rw.currency); add('Comment', rw.comment); add('Description', rw.description);
    add('Customer ID', rw.customer_id); add('UPI Transaction ID', rw.upi_transaction_id);
    rows.push(['Refund History', display.processed_at ? `Refund processed - ${dt.format(new Date(display.processed_at))}` : `${r.status === 'failed' ? 'Refund failed' : 'Refund started'} - ${at(r.created_at)}`]);
    if (done) rows.push(['Refund Success', refundDestination({ method: p.method, vpa: p.vpa, bank_name: bank, card_network: p.card?.network, card_last4: p.card?.last4, wallet: p.wallet })]);
  }
  if (p.status === 'failed') rows.push(['Error Details', p.error_description || p.error_reason || p.error_code || 'Payment failed. No additional details were provided.']);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight(); const margin = 16;
  const ink: [number, number, number] = [17, 24, 39]; const muted: [number, number, number] = [107, 114, 128];
  const rule: [number, number, number] = [229, 231, 235]; const soft: [number, number, number] = [243, 244, 246];
  doc.setProperties({ title: `Payment Details - ${p.id}`, subject: 'Razorpay payment details', creator: 'Workly India Employee Portal' });
  doc.setFillColor(24, 128, 56); doc.rect(0, 0, width, 5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...ink); doc.text('Payment Details', margin, 18);
  doc.setFontSize(11); doc.text(printable(label), margin, 26);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(`Generated: ${dt.format(new Date())}`, margin, 33);
  doc.setDrawColor(...rule); doc.line(margin, 37, width - margin, 37);
  autoTable(doc, {
    startY: 41, margin: { top: 16, bottom: 18, left: margin, right: margin }, theme: 'plain',
    body: rows.map(([l, v]) => l === 'SECTION'
      ? [{ content: printable(v), colSpan: 2, styles: { fillColor: soft, fontStyle: 'bold', textColor: muted, cellPadding: { top: 3, right: 2, bottom: 3, left: 2 } } }]
      : [printable(l), printable(v)]) as any,
    styles: { font: 'helvetica', fontSize: 9, textColor: ink, cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 2 }, overflow: 'linebreak', valign: 'top', lineColor: rule, lineWidth: { bottom: 0.1 } as any },
    columnStyles: { 0: { cellWidth: 46, textColor: muted }, 1: { cellWidth: 128, fontStyle: 'bold' } },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setDrawColor(...rule); doc.line(margin, height - 12, width - margin, height - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text('Workly India / Payment details', margin, height - 7);
    doc.text(`Page ${i} of ${pages}`, width - margin, height - 7, { align: 'right' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

/** Fetch payment + refunds from Razorpay and render the PDF. */
export async function renderPaymentPdf(paymentId: string, label: string, supabase?: any): Promise<Uint8Array | null> {
  const id = Deno.env.get('RAZORPAY_KEY_ID')?.trim(); const secret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!id || !secret) return null;
  const headers = { Authorization: `Basic ${btoa(`${id}:${secret}`)}` };
  const [pr, rr] = await Promise.all([
    fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers }),
    fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refunds?count=100`, { headers }),
  ]);
  if (!pr.ok) return null;
  const payment = await pr.json();
  const refunds = rr.ok ? ((await rr.json()).items || []) : [];
  refunds.sort((a: any, b: any) => Number(b.created_at) - Number(a.created_at));
  const [eventId, subscriptionId] = supabase
    ? await Promise.all([eventIdForPayment(supabase, paymentId), subscriptionIdForPayment(supabase, paymentId)]) : [null, null];
  const extra: any = {};
  if (supabase) {
    const { data: refundEvents } = await supabase.from('razorpay_events').select('event_type,event_created_at,payload')
      .like('event_type', 'refund.%').eq('payload->payload->refund->entity->>payment_id', paymentId).limit(500);
    for (const refund of refunds) {
      refund.events = (refundEvents || []).filter((event: any) => (event.payload?.payload || event.payload)?.refund?.entity?.id === refund.id)
        .map((event: any) => ({ type: event.event_type, at: event.event_created_at }));
    }
    try {
      const { data: ev } = await supabase.from('razorpay_events').select('payload').eq('payload->payload->payment->entity->>id', paymentId).not('payload->payload->payment_link', 'is', null).limit(1).maybeSingle();
      const pl = ev?.payload?.payload?.payment_link?.entity;
      extra.referenceId = pl?.reference_id; extra.billingAddress = pl?.notes?.billing_address; extra.shippingAddress = pl?.notes?.shipping_address; extra.gstin = pl?.notes?.gstin;
      const uid = payment.notes?.user_id || pl?.notes?.user_id;
      if (uid && (!extra.billingAddress || !extra.shippingAddress || !extra.gstin)) {
        const { data: pp } = await supabase.from('payment_profiles').select('address,city,state,postal_code,country,shipping_address,gstin').eq('user_id', uid).maybeSingle();
        const join = (a: any) => a ? [a.address, a.city, a.state, a.postal_code, a.country].filter((x: any) => String(x || '').trim()).join(', ') : '';
        extra.billingAddress ||= join(pp) || undefined; extra.shippingAddress ||= join(pp?.shipping_address) || undefined; extra.gstin ||= pp?.gstin || undefined;
      }
    } catch { /* optional */ }
  }
  return buildPaymentDetailsPdf(payment, refunds, label, { eventId, subscriptionId, ...extra });
}
