// Webhook-driven Employee payment emails: Payment Success, Payment Failed, Payment Refund.
// Subject = the same plan name shown as the Payment Details sheet header; body mirrors the sheet rows.
// Sent only from razorpay-webhook, always from the Employee (employer) mailbox. Best-effort, never throws.
import { istStampParts } from './emailFormat.ts';
import { paymentPdfUrl } from './paymentDetailsPdf.ts';
import { ensureInvoiceForPayment } from './razorpayInvoice.ts';
import { renderEmailTemplateHtml } from './templateHtml.ts';
import { handler as sendEmailHandler } from './emailSender.ts';
import { hasPaymentEmailCore } from './paymentEmailDispatch.ts';
import { paymentWorkbookFields, refundWorkbookFields, eventIdForPayment, subscriptionIdForPayment } from './paymentWorkbookFields.ts';

const TEMPLATE_KEY: Record<Kind, string> = { success: 'payment_success', failed: 'payment_failed', refund: 'payment_refund' };

type Kind = 'success' | 'failed' | 'refund';

const METHOD_NAMES: Record<string, string> = {
  upi: 'UPI', bank: 'Bank', netbanking: 'Netbanking', card: 'Card', wallet: 'Wallet',
  emi: 'EMI', paylater: 'Credit Line', cardless_emi: 'Cardless EMI', bank_transfer: 'Bank Transfer',
};
const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const inr = (paise: number) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (unix?: number) => `${istStampParts(unix ? new Date(unix * 1000) : new Date()).datetime} IST`;

function methodLabel(p: any): string {
  const m = String(p.method || '').toLowerCase();
  if (m === 'card' && p.card?.type === 'debit') return 'Debit Card';
  if (m === 'card' && p.card?.type === 'credit') return 'Credit Card';
  return METHOD_NAMES[m] || titleCase(m || 'Online');
}

function addBusinessDaysIST(from: Date, days: number): Date {
  const IST = 5.5 * 3600_000;
  const d = new Date(from.getTime() + IST);
  let added = 0;
  while (added < days) { d.setUTCDate(d.getUTCDate() + 1); const wd = d.getUTCDay(); if (wd !== 0 && wd !== 6) added++; }
  return new Date(d.getTime() - IST);
}

/** Resolve the plan label (same as the Payment Details sheet header) and owning user for a payment. */
export async function resolvePayment(supabase: any, payment: any): Promise<{ userId: string | null; label: string }> {
  const orderId = payment.order_id;
  if (orderId) {
    const sources: Array<{ table: string; extra?: string; label: (r: any) => string }> = [
      { table: 'job_boosts', label: () => 'Job Visibility Plan' },
      { table: 'verification_purchases', label: () => 'Profile Verification' },
      { table: 'ai_chat_subscriptions', label: () => 'AI Chat Subscription' },
      { table: 'donations', label: () => 'Donation' },
      { table: 'pending_payments', extra: ',purpose', label: (r) => (r.purpose ? titleCase(String(r.purpose).trim()) : 'Service Payment') },
      { table: 'transactions', label: () => 'Previous Service Purchase' },
    ];
    for (const s of sources) {
      const { data } = await supabase.from(s.table).select(`user_id${s.extra || ''}`).eq('razorpay_order_id', orderId).limit(1).maybeSingle();
      if (data?.user_id) return { userId: data.user_id, label: s.label(data) };
    }
  }
  const [{ data: call }, { data: sub }] = await Promise.all([
    supabase.from('api_call_purchases').select('user_id,source').eq('payment_id', payment.id).limit(1).maybeSingle(),
    supabase.from('api_subscriptions').select('user_id').eq('payment_id', payment.id).limit(1).maybeSingle(),
  ]);
  if (call?.user_id) return { userId: call.user_id, label: call.source === 'topup' ? 'API Auto-Top-Up' : 'Increase API Calls' };
  if (sub?.user_id) return { userId: sub.user_id, label: 'API Subscription' };
  const n = payment.notes || {};
  const hint = String(n.plan || n.plan_name || n.purpose || n.item_name || n.package_name || payment.description || '').trim();
  return { userId: n.user_id || null, label: hint && !/^payment$/i.test(hint) ? titleCase(hint) : 'Workly India Service' };
}

const LINK = 'color:#1a73e8;text-decoration:none;font-weight:600;';
const contactLink = (key: string, value: unknown) => {
  const v = String(value ?? '').trim();
  if (!v) return esc(v);
  if (key === 'mobile') return `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}" style="${LINK}">${esc(v)}</a>`;
  if (key === 'email' && v.includes('@')) return `<a href="mailto:${esc(v)}" style="${LINK}">${esc(v)}</a>`;
  return esc(v);
};
const row = (label: string, value: unknown, mono = false, linkKey = '') => value === null || value === undefined || value === '' ? '' :
  `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f3;">
     <div style="font-size:13px;color:#6b7280;line-height:18px;">${esc(label)}</div>
     <div style="font-size:15px;color:#111827;line-height:22px;font-weight:600;${mono ? 'font-family:monospace;word-break:break-all;' : ''}">${linkKey ? contactLink(linkKey, value) : esc(value)}</div>
   </td></tr>`;
const section = (title: string, rows: string) => rows.trim()
  ? `<div style="margin:22px 0 4px 0;font-size:12px;font-weight:700;letter-spacing:.6px;color:#6b7280;text-transform:uppercase;">${esc(title)}</div><table style="width:100%;border-collapse:collapse;">${rows}</table>` : '';

export async function sendPaymentStatusEmail(supabase: any, kind: Kind, payment: any, refund?: any): Promise<void> {
  try {
    if (!payment?.id) return;
    // Owner Portal → Email Templates controls on/off, subject and message content.
    const { data: tpl } = await supabase.from('email_lifecycle_templates').select('enabled,subject,body,button_text').eq('event_type', TEMPLATE_KEY[kind]).maybeSingle();
    if (tpl && tpl.enabled === false) return;
    const { userId, label } = await resolvePayment(supabase, payment);
    let toEmail: string | null = payment.email || null;
    let toName: string | null = null;
    if (userId) {
      const { data: prof } = await supabase.from('profiles').select('email, full_name').eq('user_id', userId).maybeSingle();
      toEmail = prof?.email || toEmail;
      toName = prof?.full_name || null;
      if (!toEmail) { try { toEmail = (await supabase.auth.admin.getUserById(userId)).data?.user?.email || null; } catch { /* ignore */ } }
    }
    if (!toEmail || toEmail.endsWith('@razorpay.com') || toEmail === 'void@razorpay.com') { console.warn('[paymentStatusEmail] no recipient'); return; }

    const m = String(payment.method || '').toLowerCase();
    const methodDetail = m === 'upi' ? row('Payer UPI ID', payment.vpa, true)
      : m === 'card' ? row('Card Details', `${payment.card?.network || 'Card'}${payment.card?.last4 ? ` •• ${payment.card.last4}` : ''}`) + row('Bank', payment.card?.issuer || payment.bank_name)
      : ['bank', 'netbanking'].includes(m) ? row('Bank', payment.bank_name || payment.bank)
      : ['wallet', 'paylater', 'cardless_emi'].includes(m) ? row('Provider', titleCase(String(payment.wallet || payment.provider || payment.bank || '')))
      : '';
    const wb = paymentWorkbookFields(payment);
    const rw = refund ? refundWorkbookFields(refund) : null;
    // Bank references and failure descriptions are optional in real webhook payloads.
    // Render whichever details exist, rather than suppressing the entire status email.
    if (!hasPaymentEmailCore(payment)) { console.warn('[paymentStatusEmail] skipped: invalid payment core', payment.id, kind); return; }
    const [eventId, subscriptionId] = await Promise.all([eventIdForPayment(supabase, payment.id), subscriptionIdForPayment(supabase, payment.id)]);
    const rrn = wb.rrn;
    const totalRefunded = Number(payment.amount_refunded || 0);
    const statusText = kind === 'success' ? 'Successful' : kind === 'failed' ? 'Failed'
      : refund?.status === 'failed' ? 'Refund Failed'
      : totalRefunded > 0 && totalRefunded < Number(payment.amount) ? `Refunded ${inr(totalRefunded)}` : 'Refunded';
    const statusColor = kind === 'success' ? '#15803d' : kind === 'failed' ? '#b91c1c' : '#1d4ed8';
    // Payment-link workbook fields (Reference ID, Billing/Shipping Address), with Payment Profile fallback.
    const pn = payment.notes || {};
    let referenceId: string = String(pn.reference_id || '');
    let billingAddress: string = String(pn.billing_address || '');
    let shippingAddress: string = String(pn.shipping_address || '');
    let gstin: string = String(pn.gstin || '');
    try {
      if (!referenceId || !billingAddress || !shippingAddress) {
        const { data: ev } = await supabase.from('razorpay_events').select('payload').eq('payload->payload->payment->entity->>id', payment.id).not('payload->payload->payment_link', 'is', null).limit(1).maybeSingle();
        const pl = ev?.payload?.payload?.payment_link?.entity;
        referenceId ||= String(pl?.reference_id || '');
        billingAddress ||= String(pl?.notes?.billing_address || '');
        shippingAddress ||= String(pl?.notes?.shipping_address || '');
        gstin ||= String(pl?.notes?.gstin || '');
      }
      if (userId && (!billingAddress || !shippingAddress || !gstin)) {
        const { data: pp } = await supabase.from('payment_profiles').select('address,city,state,postal_code,country,shipping_address,gstin').eq('user_id', userId).maybeSingle();
        const join = (a: any) => a ? [a.address, a.city, a.state, a.postal_code, a.country].filter((x: any) => String(x || '').trim()).join(', ') : '';
        billingAddress ||= join(pp);
        shippingAddress ||= join(pp?.shipping_address);
        gstin ||= String(pp?.gstin || '');
      }
    } catch { /* optional */ }


    const top = row('Payment ID', payment.id, true) + row('Transaction ID', wb.transaction_id, true) + row('Customer ID', wb.customer_id, true) +
      row('Event ID', eventId, true) + row('Subscription ID', subscriptionId, true) + row('Invoice ID', payment.invoice_id, true) +
      row('Method', methodLabel(payment)) + methodDetail +
      row('Status', statusText) + row('Amount', inr(payment.amount)) + row('Currency', wb.currency) + row('Description', wb.description) +
      row('Received', when(payment.created_at)) +
      row('RRN', rrn, true) + row('Order ID', payment.order_id, true) + row('Reference ID', referenceId, true);
    const customer = row('Mobile Number', payment.contact, true, 'mobile') + row('Email ID', payment.email || toEmail, true, 'email') +
      row('GSTIN', gstin, true) + row('Billing Address', billingAddress) + row('Shipping Address', shippingAddress);

    let refundRows = '';
    if (kind === 'refund' && refund) {
      const speed = String(refund.speed_processed || refund.speed_requested || '').toLowerCase();
      const created = new Date(Number(refund.created_at || Date.now() / 1000) * 1000);
      const done = refund.status === 'processed' && (speed === 'instant' || Date.now() >= addBusinessDaysIST(created, 7).getTime());
      refundRows = row('Refund ID', refund.id, true) +
        row('Refund Speed', speed === 'instant' ? 'Instant' : speed ? 'Normal' : 'Processing') +
        row('Refund Status', refund.status === 'failed' ? 'Refund Failed' : done ? 'Refund Success' : 'Refund can take up to 7 business days.') +
        row('Refunded Amount', inr(refund.amount)) + row('Currency', rw?.currency) + row('Comment', rw?.comment) +
        row('Description', rw?.description) + row('Customer ID', rw?.customer_id, true) + row('UPI Transaction ID', rw?.upi_transaction_id, true) +
        row('Refund processed', when(refund.created_at));
    }
    const errorRows = kind === 'failed'
      ? row('Error Details', payment.error_description || payment.error_reason || 'Payment failed. No additional details were provided.') + row('Error Code', payment.error_code, true) : '';

    const heading = kind === 'success' ? 'Payment Successful' : kind === 'failed' ? 'Payment Failed' : 'Payment Refund';
    const intro = kind === 'success' ? 'your payment has been received successfully.'
      : kind === 'failed' ? 'your payment could not be completed. No money was taken, or any deducted amount will be returned by your bank.'
      : 'a refund has been issued for your payment.';
    const fill = (t: string) => t.replace(/\{\{\s*plan\s*\}\}/gi, label).replace(/\{\{\s*amount\s*\}\}/gi, inr(payment.amount)).replace(/\{\{\s*payment_id\s*\}\}/gi, payment.id);
    const subject = tpl?.subject ? fill(tpl.subject) : `${heading} — ${label}`;
    const fullTemplate = tpl?.body?.includes('{{payment_id}}');
    const introText = tpl?.body && !fullTemplate ? esc(fill(tpl.body)) : `Hi ${esc(toName || 'there')}, ${intro}`;
    const pdfUrl = await paymentPdfUrl(payment.id);
    // Razorpay's official invoice (only for captured/refunded payments; never for failed).
    let invoiceUrl: string | null = null;
    if (kind !== 'failed') {
      try {
        const inv: any = await ensureInvoiceForPayment(supabase, payment, { userId, label });
        if (inv?.short_url && !['cancelled', 'deleted', 'expired', 'draft', 'error'].includes(String(inv.status))) invoiceUrl = inv.short_url;
      } catch { /* invoice optional */ }
    }
    const speed = String(refund?.speed_processed || refund?.speed_requested || '').toLowerCase();
    const refundCreated = new Date(Number(refund?.created_at || Date.now() / 1000) * 1000);
    const refundDone = refund?.status === 'processed' && (speed === 'instant' || Date.now() >= addBusinessDaysIST(refundCreated, 7).getTime());
    const values: Record<string, string> = {
      name: toName || 'there', plan: label, payment_id: payment.id, order_id: payment.order_id || '',
      amount: inr(payment.amount), transaction_id: wb.transaction_id || '', customer_id: wb.customer_id || '', event_id: eventId || '',
      subscription_id: subscriptionId || '', invoice_id: payment.invoice_id || '', currency: wb.currency || '', description: wb.description || '',
      refund_currency: rw?.currency || '', refund_comment: rw?.comment || '', refund_description: rw?.description || '',
      refund_customer_id: rw?.customer_id || '', refund_upi_transaction_id: rw?.upi_transaction_id || '', method: methodLabel(payment), vpa: payment.vpa || '',
      card_details: m === 'card' ? `${payment.card?.network || 'Card'}${payment.card?.last4 ? ` •• ${payment.card.last4}` : ''}` : '',
      bank: ['card', 'bank', 'netbanking'].includes(m) ? payment.bank_name || payment.bank || payment.card?.issuer || '' : '',
      provider: ['wallet', 'paylater', 'cardless_emi'].includes(m) ? titleCase(String(payment.wallet || payment.provider || payment.bank || '')) : '',
      status: statusText,
      received: when(payment.created_at), rrn: rrn || '', mobile: payment.contact || '', email: payment.email || toEmail,
      refund_id: refund?.id || '', refund_speed: speed === 'instant' ? 'Instant' : speed ? 'Normal' : 'Processing',
      refund_status: refund?.status === 'failed' ? 'Refund Failed' : refundDone ? 'Refund Success' : 'Refund can take up to 7 business days.',
      refund_amount: inr(totalRefunded || refund?.amount), refund_received: when(refund?.created_at),
      error_description: payment.error_description || payment.error_reason || payment.error_code || 'Payment failed. No additional details were provided.',
      error_code: payment.error_code || '', pdf_url: pdfUrl, invoice_url: invoiceUrl || '',
      gstin, reference_id: referenceId, billing_address: billingAddress, shipping_address: shippingAddress,
      date: istStampParts(new Date(Number(payment.created_at || Date.now() / 1000) * 1000)).date,
      time: istStampParts(new Date(Number(payment.created_at || Date.now() / 1000) * 1000)).time,
    };
    // Saved complete templates are the message. Drop every row/paragraph whose workbook value is
    // missing (no "—" lines), and drop the Download PDF / Invoice buttons entirely.
    const isEmptyKey = (key: string) => key in values ? !String(values[key] || '').trim() : true;
    const dropBlock = (block: string) =>
      /\{\{\s*(?:pdf_url|invoice_url)\s*\}\}|>\s*Download\s+(?:Invoice\s+)?PDF\s*</i.test(block) ||
      (m !== 'upi' && /\{\{\s*vpa\s*\}\}/.test(block)) ||
      [...block.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].some(([, key]) => isEmptyKey(key));
    // Split into blocks so a dropped value also removes its label row and surrounding
    // blank spacers — a missing value must never leave an orphan label behind.
    const rawBody = String(tpl?.body || '');
    const blockRe = /<div\b[^>]*>(?:(?!<div\b)[\s\S])*?<\/div>|<p\b[^>]*>[\s\S]*?<\/p>/gi;
    const isBrOnly = (b: string) => /^<div\b[^>]*>\s*(?:<br\s*\/?>\s*)*<\/div>$/i.test(b) || /^<p\b[^>]*>\s*(?:<br\s*\/?>\s*)*<\/p>$/i.test(b);
    const hasPh = (b: string) => /\{\{\s*\w+\s*\}\}/.test(b);
    const segs: { html: string; block: boolean }[] = [];
    let lastIdx = 0; let bm: RegExpExecArray | null;
    while ((bm = blockRe.exec(rawBody)) !== null) {
      if (bm.index > lastIdx) segs.push({ html: rawBody.slice(lastIdx, bm.index), block: false });
      segs.push({ html: bm[0], block: true });
      lastIdx = bm.index + bm[0].length;
    }
    if (lastIdx < rawBody.length) segs.push({ html: rawBody.slice(lastIdx), block: false });
    const drops = segs.map((s) => s.block && dropBlock(s.html));
    // A dropped value hides the label directly above it (labels never contain placeholders).
    for (let i = 0; i < segs.length; i++) {
      if (!drops[i] || !hasPh(segs[i].html)) continue;
      const j = i - 1;
      if (j >= 0 && segs[j].block && !drops[j] && !hasPh(segs[j].html) && !isBrOnly(segs[j].html) && !/border-top/.test(segs[j].html)) drops[j] = true;
    }
    // Blank spacer lines next to removed rows go too.
    for (let i = 0; i < segs.length; i++) {
      if (!segs[i].block || !isBrOnly(segs[i].html)) continue;
      if ((i > 0 && drops[i - 1]) || (i < segs.length - 1 && drops[i + 1])) drops[i] = true;
    }
    const savedBody = segs.filter((_s, i) => !drops[i]).map((s) => s.html).join('')
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => (key === 'mobile' || key === 'email') ? contactLink(key, values[key]) || '' : esc(values[key] || ''));
    const extraRows = (/\{\{\s*gstin\s*\}\}/.test(tpl?.body || '') ? '' : row('GSTIN', gstin, true)) + (/\{\{\s*reference_id\s*\}\}/.test(tpl?.body || '') ? '' : row('Reference ID', referenceId, true)) +
      (/\{\{\s*billing_address\s*\}\}/.test(tpl?.body || '') ? '' : row('Billing Address', billingAddress)) +
      (/\{\{\s*shipping_address\s*\}\}/.test(tpl?.body || '') ? '' : row('Shipping Address', shippingAddress));
    const extraBlock = extraRows ? `<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;padding:0 20px;">${section('Address & Reference', extraRows)}</div>` : '';
    const html = fullTemplate ? renderEmailTemplateHtml(savedBody + extraBlock) : `<div style="background:#ffffff;padding:16px 0;">
      <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#111827;padding:0 20px;">
        <h2 style="margin:0 0 4px 0;color:${statusColor};font-size:22px;">${heading}</h2>
        <div style="font-size:17px;font-weight:700;margin:0 0 8px 0;">${esc(label)}</div>
        <p style="margin:0 0 6px 0;color:#4b5563;font-size:14px;">${introText}</p>
        <table style="width:100%;border-collapse:collapse;">${top}</table>
        ${section('Customer Details', customer)}
        ${section('Refund Updates', refundRows)}
        ${(errorRows ? `<table style="width:100%;border-collapse:collapse;margin-top:14px;">${errorRows}</table>` : '')}
        <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;">Workly India · Payment History in your Employee portal has the full details.</p>
      </div></div>`;
    const text = `${heading} — ${label}. Payment ID: ${payment.id}. Amount: ${inr(payment.amount)}.`;

    // templateMode 'complete': the template already has its own heading and greeting, so the
    // mail shell must not repeat the subject or "Hi name" above it.
    // Reuse the website sender in-process after webhook signature validation.
    // No nested function URL, elevated caller token or separately deployed hub required.
    const response = await sendEmailHandler(new Request('https://internal.invalid/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: toEmail, toName: toName || undefined, subject, htmlContent: html, textContent: text, audience: 'employer', templateMode: 'complete', suppressTitle: true, suppressGreeting: true }),
    }));
    const result = await response.json();
    if (!response.ok || result?.success !== true) throw new Error(`Payment email send failed [${response.status}]: ${result?.error || 'Sender did not confirm acceptance'}`);
    console.info('[paymentStatusEmail] sender accepted', { paymentId: payment.id, kind, messageId: result.messageId, provider: result.provider });
  } catch (e) {
    console.error('[paymentStatusEmail] failed (non-blocking):', e);
  }
}
