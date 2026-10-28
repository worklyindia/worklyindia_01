// Supabase Auth "Send SMS" hook — phone OTPs are delivered on WhatsApp instead of SMS.
// Supabase calls POST /functions/v1/whatsapp-cloud-api/sms-hook with a Standard Webhooks
// signature (SEND_SMS_HOOK_SECRET). Job seekers get the code from the Job seekers WhatsApp
// number, employers from the Employers WhatsApp number (picked by user_metadata.user_type).
const encoder = new TextEncoder();

function decodeSecret(secret: string): Uint8Array<ArrayBuffer> {
  const m = secret.match(/^v1,whsec_(.+)$/);
  if (!m) return encoder.encode(secret) as Uint8Array<ArrayBuffer>;
  const bin = atob(m[1]);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function verifySmsHook(req: Request, body: string): Promise<boolean> {
  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET') || '';
  const id = req.headers.get('webhook-id') || '';
  const ts = req.headers.get('webhook-timestamp') || '';
  const sig = req.headers.get('webhook-signature') || '';
  if (!secret || !id || !ts || !sig) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = await crypto.subtle.importKey('raw', decodeSecret(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig.split(' ').filter((s) => s.startsWith('v1,')).some((s) => safeEqual(s.slice(3), expected));
}

export const hookError = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
