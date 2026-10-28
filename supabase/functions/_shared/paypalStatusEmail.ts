// Webhook-driven PayPal payment emails: Success, Failed, Refund.
// Sent only from paypal-webhook after signature verification (workbook-confirmed),
// using Owner Portal → Email Templates (paypal_payment_*). Best-effort, never throws.
import { istStampParts } from './emailFormat.ts';
import { renderEmailTemplateHtml } from './templateHtml.ts';
import { handler as sendEmailHandler } from './emailSender.ts';

export type PayPalKind = 'success' | 'failed' | 'refund';
const TEMPLATE_KEY: Record<PayPalKind, string> = {
  success: 'paypal_payment_success', failed: 'paypal_payment_failed', refund: 'paypal_payment_refund',
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const usd = (n: unknown) => `$${Number(n || 0).toFixed(2)}`;
const inr = (n: unknown) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const stamp = (iso?: string | null) => `${istStampParts(iso ? new Date(iso) : new Date()).datetime} IST`;

const row = (label: string, value: unknown, mono = false) => value === null || value === undefined || String(value).trim() === '' ? '' :
  `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f3;">
     <div style="font-size:13px;color:#6b7280;line-height:18px;">${esc(label)}</div>
     <div style="font-size:15px;color:#111827;line-height:22px;font-weight:600;${mono ? 'font-family:monospace;word-break:break-all;' : ''}">${esc(value)}</div>
   </td></tr>`;
const section = (title: string, rows: string) => rows.trim()
  ? `<div style="margin:22px 0 4px 0;font-size:12px;font-weight:700;letter-spacing:.6px;color:#6b7280;text-transform:uppercase;">${esc(title)}</div><table style="width:100%;border-collapse:collapse;">${rows}</table>` : '';

export async function sendPayPalStatusEmail(supabase: any, kind: PayPalKind, paymentRowId: string, refund?: any): Promise<void> {
  try {
    const { data: p } = await supabase.from('paypal_payments').select('*').eq('id', paymentRowId).maybeSingle();
    if (!p) return;
    const { data: tpl } = await supabase.from('email_lifecycle_templates').select('enabled,subject,body').eq('event_type', TEMPLATE_KEY[kind]).maybeSingle();
    if (tpl && tpl.enabled === false) return;

    let toEmail: string | null = null; let toName: string | null = null;
    if (p.user_id) {
      const { data: prof } = await supabase.from('profiles').select('email, full_name').eq('user_id', p.user_id).maybeSingle();
      toEmail = prof?.email || null; toName = prof?.full_name || null;
      if (!toEmail) { try { toEmail = (await supabase.auth.admin.getUserById(p.user_id)).data?.user?.email || null; } catch { /* ignore */ } }
    }
    toEmail ||= p.payer_email || null;
    if (!toEmail) { console.warn('[paypalStatusEmail] no recipient', paymentRowId); return; }

    const label = p.label || 'Workly India payment';
    const status = kind === 'success' ? 'Successful' : kind === 'failed' ? 'Failed'
      : refund?.status === 'failed' ? 'Refund Failed' : refund?.status === 'pending' ? 'Refund Pending' : 'Refunded';
    const values: Record<string, string> = {
      name: toName || p.payer_name || 'there', plan: label, status,
      amount: usd(p.amount_usd), amount_inr: inr(p.amount_inr), currency: p.currency || 'USD',
      paypal_order_id: p.paypal_order_id || '', capture_id: p.capture_id || '', order_id: p.rzp_order_id || '',
      payer_email: p.payer_email || '', payer_name: p.payer_name || '', payer_id: p.payer_id || '',
      received: stamp(p.captured_at || p.created_at), date: istStampParts(new Date(p.captured_at || p.created_at)).date,
      time: istStampParts(new Date(p.captured_at || p.created_at)).time,
      error_description: p.error_description || 'Payment declined by PayPal',
      refund_id: refund?.id || '', refund_amount: usd(refund?.amount_usd), refund_status: status,
      refund_note: refund?.note || '', refund_received: refund ? stamp(refund.processed_at || refund.created_at) : '',
      total_refunded: usd(p.refunded_usd), method: 'PayPal',
    };
    if (kind !== 'refund') { values.refund_amount = ''; values.total_refunded = ''; }
    const fill = (t: string, html = false) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => html ? esc(values[k] ?? '') : (values[k] ?? ''));

    const heading = kind === 'success' ? 'Payment Successful' : kind === 'failed' ? 'Payment Failed' : 'Payment Refund';
    const color = kind === 'success' ? '#15803d' : kind === 'failed' ? '#b91c1c' : '#1d4ed8';
    const subject = tpl?.subject?.trim() ? fill(tpl.subject) : `${heading} — ${label}`;
    const LINK = 'color:#1a73e8;text-decoration:none;font-weight:600;';
    const mailLink = (v: string) => v.includes('@') ? `<a href="mailto:${esc(v)}" style="${LINK}">${esc(v)}</a>` : esc(v);

    const top = row('PayPal Order ID', values.paypal_order_id, true) + row('Capture ID', values.capture_id, true) +
      row('Order ID', values.order_id, true) + row('Method', 'PayPal') + row('Status', status) + row('Amount', values.amount) +
      row('Amount (INR)', values.amount_inr) + row('Currency', values.currency) + row('Received', values.received);
    const payer = row('Payer Name', values.payer_name) + row('Payer ID', values.payer_id, true) + row('Email ID', values.payer_email, true);
    const refundRows = kind === 'refund' ? row('Refund ID', values.refund_id, true) + row('Refund Status', status) + row('Refunded Amount', values.refund_amount) +
      row('Total Refunded', values.total_refunded) + row('Refund Note', values.refund_note) + row('Refund processed', values.refund_received) : '';
    const errorRows = kind === 'failed' ? row('Error Details', values.error_description) : '';

    // Saved complete templates (Owner Portal) mirror Razorpay: drop any row whose value is empty,
    // together with its label and spacer lines, so no orphan labels remain.
    const rawBody = String(tpl?.body || '');
    const fullTemplate = /\{\{\s*paypal_order_id\s*\}\}/.test(rawBody);
    let savedBody = '';
    if (fullTemplate) {
      const isEmpty = (k: string) => !String(values[k] ?? '').trim();
      const hasPh = (b: string) => /\{\{\s*\w+\s*\}\}/.test(b);
      const isBrOnly = (b: string) => /^<(div|p)\b[^>]*>\s*(?:<br\s*\/?>\s*)*<\/\1>$/i.test(b);
      const blockRe = /<div\b[^>]*>(?:(?!<div\b)[\s\S])*?<\/div>|<p\b[^>]*>[\s\S]*?<\/p>/gi;
      const segs: { html: string; block: boolean }[] = [];
      let last = 0; let bm: RegExpExecArray | null;
      while ((bm = blockRe.exec(rawBody)) !== null) {
        if (bm.index > last) segs.push({ html: rawBody.slice(last, bm.index), block: false });
        segs.push({ html: bm[0], block: true }); last = bm.index + bm[0].length;
      }
      if (last < rawBody.length) segs.push({ html: rawBody.slice(last), block: false });
      const drops = segs.map((s) => s.block && [...s.html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].some(([, k]) => isEmpty(k)));
      for (let i = 1; i < segs.length; i++) {
        const j = i - 1;
        if (drops[i] && hasPh(segs[i].html) && segs[j].block && !drops[j] && !hasPh(segs[j].html) && !isBrOnly(segs[j].html) && !/border-top/.test(segs[j].html)) drops[j] = true;
      }
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].block && isBrOnly(segs[i].html) && ((i > 0 && drops[i - 1]) || (i < segs.length - 1 && drops[i + 1]))) drops[i] = true;
      }
      savedBody = segs.filter((_s, i) => !drops[i]).map((s) => s.html).join('')
        .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => k === 'payer_email' ? mailLink(values[k] || '') : esc(values[k] ?? ''));
    }

    const custom = rawBody.trim();
    const intro = custom && !fullTemplate
      ? (/<[a-z][\s\S]*>/i.test(custom) ? fill(custom, true) : esc(fill(custom)).replace(/\n/g, '<br>'))
      : `Hi ${esc(values.name)}, ${kind === 'success' ? 'your PayPal payment has been received successfully.' : kind === 'failed' ? 'your PayPal payment could not be completed. No money was taken.' : 'a refund has been issued for your PayPal payment.'}`;

    const html = fullTemplate ? renderEmailTemplateHtml(savedBody) : renderEmailTemplateHtml(`<div style="background:#ffffff;padding:16px 0;">
      <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#111827;padding:0 20px;">
        <h2 style="margin:0 0 4px 0;color:${color};font-size:22px;">${heading}</h2>
        <div style="font-size:17px;font-weight:700;margin:0 0 8px 0;">${esc(label)}</div>
        <div style="margin:0 0 6px 0;color:#4b5563;font-size:14px;">${intro}</div>
        <table style="width:100%;border-collapse:collapse;">${top}</table>
        ${section('Payer Details', payer)}
        ${section('Refund Updates', refundRows)}
        ${errorRows ? `<table style="width:100%;border-collapse:collapse;margin-top:14px;">${errorRows}</table>` : ''}
        <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;">Workly India · Payment History in your Employee portal has the full details.</p>
      </div></div>`);
    const text = `${heading} — ${label}\nStatus: ${status}\nAmount: ${values.amount}\nPayPal Order ID: ${values.paypal_order_id}`;

    const res = await sendEmailHandler(new Request('https://internal.invalid/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: toEmail, toName: toName || undefined, subject, htmlContent: html, textContent: text, audience: 'employer', templateMode: 'complete', suppressTitle: true, suppressGreeting: true }),
    }));
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.success !== true) throw new Error(`send failed [${res.status}] ${out?.error || ''}`);
    console.info('[paypalStatusEmail] sent', { paymentRowId, kind });
  } catch (e) {
    console.error('[paypalStatusEmail] failed (non-blocking):', e);
  }
}
