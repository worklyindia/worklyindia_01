/** Only open actual web links, never executable schemes or unresolved template variables. */
export function whatsappWebHref(value?: string | null): string | undefined {
  const raw = value?.trim();
  if (!raw || /\{\{.*?\}\}/.test(raw)) return undefined;
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.includes('.') && ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}