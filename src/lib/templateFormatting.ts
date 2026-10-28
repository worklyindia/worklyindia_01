const ENTITY_SAFE_AMP = /&(?!(?:#\d+|#x[\da-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);)/g;

/** Split authored template copy into paragraphs while preserving single line breaks. */
export const templateParagraphs = (value: string): string[][] =>
  value
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split('\n'))
    .filter((paragraph) => paragraph.some((line) => line.trim().length > 0));

export const escapeTemplateHtml = (value: string) =>
  String(value)
    .replace(ENTITY_SAFE_AMP, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeAttr = (value: string) =>
  escapeTemplateHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const escapeTemplateAttribute = escapeAttr;

const HTML_TAG_RE = /<\/?\s*[a-z][a-z0-9-]*(?:\s[^<>]*?)?\s*\/?>/i;
const EMAIL_BLOCK_TAG_RE = /<\/?\s*(?:p|div|h[1-6]|ul|ol|li|blockquote|pre)\b[^<>]*?\s*\/?>/i;

const EMAIL_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'del', 'b', 'i',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote', 'pre', 'code', 'img',
]);

const TELEGRAM_ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'a', 'br',
  'blockquote', 'tg-spoiler',
]);

const isSafeUrl = (url: string) => /^(https?:\/\/|mailto:|tel:|tg:\/\/)/i.test(url.trim());

export const templateHasHtml = (value: string | null | undefined) => HTML_TAG_RE.test(String(value || ''));

/* Colour and simple text styling authored in a template is kept, so emails can
 * be branded. Only this safe list of properties survives, and any value that
 * could load or execute something is dropped. Mirrors the sending helper in
 * supabase/functions/_shared/templateHtml.ts. */
const SAFE_STYLE_PROPS = new Set([
  'color', 'background', 'background-color', 'text-align', 'text-decoration',
  'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
  'font-size', 'font-weight', 'font-style', 'font-family', 'line-height',
  'letter-spacing', 'margin', 'margin-top', 'margin-bottom', 'margin-left',
  'margin-right', 'padding', 'padding-left', 'padding-right', 'padding-top',
  'padding-bottom', 'list-style', 'list-style-type', 'list-style-position',
  'vertical-align', 'float', 'clear', 'shape-outside', 'shape-margin',
  'border-radius', 'border', 'border-left', 'border-top', 'border-bottom',
  'border-right', 'display', 'width', 'max-width', 'height',
]);

const SAFE_STYLE_VALUE = /^[#a-z0-9\s.,()%'"\-/]+$/i;

export const safeStyleAttribute = (attrs: string): string => {
  const match = String(attrs || '').match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const declarations = String(match?.[1] ?? match?.[2] ?? '');
  if (!declarations) return '';
  const kept = declarations
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(':');
      if (separator < 1) return null;
      const prop = part.slice(0, separator).trim().toLowerCase();
      const val = part.slice(separator + 1).trim();
      if (!SAFE_STYLE_PROPS.has(prop)) return null;
      if (!SAFE_STYLE_VALUE.test(val)) return null;
      if (/url\s*\(|expression|javascript:/i.test(val)) return null;
      return `${prop}:${val}`;
    })
    .filter(Boolean)
    .join(';');
  return kept ? ` style="${escapeAttr(kept)}"` : '';
};

const sanitizeAllowedHtml = (value: string, allowedTags: Set<string>) => {
  const withoutDangerousBlocks = String(value || '')
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  let output = '';
  let cursor = 0;
  const tagRe = /<\/?\s*([a-z][a-z0-9-]*)(\s[^<>]*?)?\s*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(withoutDangerousBlocks)) !== null) {
    output += escapeTemplateHtml(withoutDangerousBlocks.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const tag = String(match[1] || '').toLowerCase();
    if (!allowedTags.has(tag)) continue;

    const raw = match[0];
    const closing = /^<\s*\//.test(raw);
    if (tag === 'br') {
      output += '<br/>';
      continue;
    }
    if (closing) {
      output += `</${tag}>`;
      continue;
    }
    const attrs = match[2] || '';
    // Telegram ignores CSS, so styling is kept for email markup only.
    const style = allowedTags === EMAIL_ALLOWED_TAGS ? safeStyleAttribute(attrs) : '';
    if (tag === 'a') {
      const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = String(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || '').trim();
      output += href && isSafeUrl(href) ? `<a href="${escapeAttr(href)}"${style}>` : `<a${style}>`;
      continue;
    }
    if (tag === 'img') {
      const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const src = String(srcMatch?.[1] || srcMatch?.[2] || srcMatch?.[3] || '').trim();
      const alt = String(altMatch?.[1] || altMatch?.[2] || altMatch?.[3] || '');
      if (src && /^https?:\/\//i.test(src)) output += `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${style}/>`;
      continue;
    }
    output += `<${tag}${style}>`;
  }

  output += escapeTemplateHtml(withoutDangerousBlocks.slice(cursor));
  return output;
};

const EMAIL_ADDRESS_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** Any plain email address written in a template becomes a blue mailto link,
 * exactly like mail apps show it. Addresses already inside a link stay as they are. */
const linkifyEmailAddresses = (html: string): string => {
  const tokens = String(html || '').split(/(<[^>]+>)/g);
  let protectedDepth = 0;

  return tokens.map((token) => {
    if (!token.startsWith('<')) {
      if (protectedDepth > 0) return token;
      return token.replace(EMAIL_ADDRESS_RE, (address) =>
        `<a href="mailto:${escapeAttr(address)}" style="color:#2563eb;text-decoration:none;">${address}</a>`);
    }
    const tag = token.match(/^<\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase();
    if (!tag || !['a', 'code', 'pre'].includes(tag)) return token;
    if (/^<\s*\//.test(token)) protectedDepth = Math.max(0, protectedDepth - 1);
    else if (!/\/\s*>$/.test(token)) protectedDepth += 1;
    return token;
  }).join('');
};

const renderEmailHtml = (value: string, includeDefaultColour: boolean): string => {
  const normalized = String(value || '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return '';

  const defaultColour = includeDefaultColour ? 'color:#374151;' : '';

  if (EMAIL_BLOCK_TAG_RE.test(normalized)) {
    // Wrap authored markup so it inherits readable email body typography.
    return linkifyEmailAddresses(`<div style="font-size:15px;line-height:1.7;${defaultColour}">${sanitizeAllowedHtml(normalized, EMAIL_ALLOWED_TAGS)}</div>`);
  }

  return linkifyEmailAddresses(templateParagraphs(normalized)
    .map((lines) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;${defaultColour}">${lines
        .map((line) => templateHasHtml(line) ? sanitizeAllowedHtml(line, EMAIL_ALLOWED_TAGS) : escapeTemplateHtml(line))
        .join('<br/>')}</p>`,
    )
    .join(''));
};

/** HTML used for delivered emails keeps its dependable light-email colour. */
export const renderEmailTemplateHtml = (value: string): string => renderEmailHtml(value, true);

/** Preview copy follows the mail app theme. Only our built-in default colours
 * are replaced; colours deliberately chosen in the editor remain unchanged. */
export const renderEmailPreviewHtml = (value: string): string => renderEmailHtml(value, false)
  .replace(/color:\s*#(?:111827|0f1b33)/gi, 'color:hsl(var(--preview-email-paper-heading))')
  .replace(/color:\s*#374151/gi, 'color:hsl(var(--preview-email-paper-fg))')
  .replace(/color:\s*#6b7280/gi, 'color:hsl(var(--preview-email-paper-muted))')
  .replace(/color:\s*#(?:3b5ce4|2563eb)/gi, 'color:hsl(var(--preview-email-paper-link))')
  .replace(/background-color:\s*#(?:f3f4f6|f6f8fc|eef2ff|eff6ff|ecfdf5|fff7ed|fef2f2)/gi, 'background-color:hsl(var(--preview-email-paper-soft))')
  .replace(/(?:border|border-top):\s*1px\s+solid\s+#(?:d1d5db|e3e8f2|d7ddfb|d3e2fd|c9f0e2|fbe3c4|f8d7d7)/gi, 'border:1px solid hsl(var(--preview-email-paper-border))');

/* A number written on a "WhatsApp :" line must open WhatsApp, not the dialer,
 * so it becomes a wa.me link instead of a plain phone entity. */
const WHATSAPP_LABEL_RE = /(whatsapp[ \t]*(?:number|no\.?)?[ \t]*[:：\-–][ \t]*)(\+?\d[\d\s-]{6,}\d)/gi;

export const linkWhatsAppNumbers = (html: string): string => {
  const tokens = String(html || '').split(/(<[^>]+>)/g);
  let protectedDepth = 0;
  return tokens.map((token) => {
    if (token.startsWith('<')) {
      const tag = token.match(/^<\/?\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase();
      if (!tag || !['a', 'code', 'pre'].includes(tag)) return token;
      if (/^<\s*\//.test(token)) protectedDepth = Math.max(0, protectedDepth - 1);
      else if (!/\/\s*>$/.test(token)) protectedDepth += 1;
      return token;
    }
    if (protectedDepth > 0) return token;
    return token.replace(WHATSAPP_LABEL_RE, (match, label: string, phone: string) => {
      const digits = String(phone).replace(/\D/g, '');
      if (digits.length < 8) return match;
      return `${label}<a href="https://wa.me/${digits}">${phone}</a>`;
    });
  }).join('');
};

export const renderTelegramTemplateHtml = (value: string): string => {
  const normalized = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';
  // Telegram has no line-break tag: an authored <br> must become a real newline
  // or the whole message is rejected with "Unsupported start tag".
  return linkWhatsAppNumbers(templateHasHtml(normalized)
    ? sanitizeAllowedHtml(normalized, TELEGRAM_ALLOWED_TAGS).replace(/<br\s*\/?>/gi, '\n')
    : escapeTemplateHtml(normalized));
};


const TELEGRAM_PHONE_RE = /^\+\d[\d\s-]{6,}\d$/;

const TELEGRAM_ENTITY_RE = /(https?:\/\/[^\s<]+|tg:\/\/[^\s<]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|\+\d[\d\s-]{6,}\d|@[a-zA-Z0-9_]{1,32}|(?<![a-zA-Z0-9_])\/[a-zA-Z0-9_][a-zA-Z0-9_-]*(?:@[a-zA-Z0-9_]{1,32})?)/g;

const telegramEntityMarkup = (text: string, linkify: boolean): string => {
  let clean = text;
  let suffix = '';
  if (/^(?:https?:\/\/|tg:\/\/)/i.test(clean)) {
    const match = clean.match(/[.,!?;:)]*$/);
    suffix = match?.[0] || '';
    clean = suffix ? clean.slice(0, -suffix.length) : clean;
    if (linkify) {
      return `<a href="${escapeAttr(clean)}" target="_blank" rel="noopener noreferrer" data-telegram-entity="true">${clean}</a>${suffix}`;
    }
  }
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(clean)) {
    return linkify
      ? `<a href="mailto:${escapeAttr(clean)}" data-telegram-entity="true">${clean}</a>`
      : `<span data-telegram-entity="true">${clean}</span>`;
  }
  if (TELEGRAM_PHONE_RE.test(clean)) {
    return linkify
      ? `<a href="tel:${escapeAttr(clean.replace(/[\s-]/g, ''))}" data-telegram-entity="true">${clean}</a>`
      : `<span data-telegram-entity="true">${clean}</span>`;
  }
  if (linkify && /^@[a-zA-Z0-9_]{1,32}$/.test(clean)) {
    return `<a href="https://t.me/${escapeAttr(clean.slice(1))}" target="_blank" rel="noopener noreferrer" data-telegram-entity="true">${clean}</a>`;
  }
  return `<span data-telegram-entity="true">${clean}</span>${suffix}`;
};

/** Adds Telegram's visual entity colour without changing the message sent to Telegram. */
const decorateTelegramEntitiesWith = (safeHtml: string, linkify: boolean): string => {
  const tokens = String(safeHtml || '').split(/(<[^>]+>)/g);
  let protectedDepth = 0;

  return tokens.map((token) => {
    if (!token.startsWith('<')) {
      return protectedDepth > 0 ? token : token.replace(TELEGRAM_ENTITY_RE, (m) => telegramEntityMarkup(m, linkify));
    }
    const tag = token.match(/^<\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase();
    if (!tag || !['a', 'code', 'pre'].includes(tag)) return token;
    if (/^<\s*\//.test(token)) protectedDepth = Math.max(0, protectedDepth - 1);
    else if (!/\/\s*>$/.test(token)) protectedDepth += 1;
    return token;
  }).join('');
};

export const decorateTelegramEntities = (safeHtml: string): string => decorateTelegramEntitiesWith(safeHtml, false);

/** Preview-only: entities are real, clickable links — like messages inside the Telegram app. */
export const renderTelegramPreviewHtml = (value: string): string =>
  decorateTelegramEntitiesWith(renderTelegramTemplateHtml(value), true).replace(/\n/g, '<br/>');
