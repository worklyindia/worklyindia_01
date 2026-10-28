const ENTITY_SAFE_AMP = /&(?!(?:#\d+|#x[\da-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);)/g;

export const escapeHtml = (value: string) =>
  String(value)
    .replace(ENTITY_SAFE_AMP, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeAttr = (value: string) =>
  escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const escapeHtmlAttribute = escapeAttr;

const HTML_TAG_RE = /<\/?\s*[a-z][a-z0-9-]*(?:\s[^<>]*?)?\s*\/?>/i;

const EMAIL_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'del', 'b', 'i',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote', 'pre', 'code', 'img',
]);

const EMAIL_BLOCK_TAG_RE = /<\/?\s*(?:p|div|h[1-6]|ul|ol|li|blockquote|pre)\b[^<>]*?\s*\/?>/i;

const TELEGRAM_ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'a', 'br',
  'blockquote', 'tg-spoiler',
]);

const isSafeUrl = (url: string) => /^(https?:\/\/|mailto:|tel:|tg:\/\/)/i.test(url.trim());

export const templateHasHtml = (value: string | null | undefined) => HTML_TAG_RE.test(String(value || ''));

/* Colour and simple text styling authored in a template is kept, so emails can
 * be branded. Only this safe list of properties survives, and any value that
 * could load or execute something is dropped. */
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
  'white-space', 'word-break', 'overflow-wrap',
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

function sanitizeAllowedHtml(value: string, allowedTags: Set<string>) {
  const withoutDangerousBlocks = String(value || '')
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  let output = '';
  let cursor = 0;
  const tagRe = /<\/?\s*([a-z][a-z0-9-]*)(\s[^<>]*?)?\s*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(withoutDangerousBlocks)) !== null) {
    output += escapeHtml(withoutDangerousBlocks.slice(cursor, match.index));
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
      output += href && isSafeUrl(href)
        ? `<a href="${escapeAttr(href)}"${style}>`
        : `<a${style}>`;
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

  output += escapeHtml(withoutDangerousBlocks.slice(cursor));
  return output;
}

const templateParagraphs = (value: string): string[][] =>
  String(value || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split('\n'))
    .filter((paragraph) => paragraph.some((line) => line.trim().length > 0));

export const renderEmailTemplateHtml = (value: string): string => {
  const normalized = String(value || '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return '';

  if (EMAIL_BLOCK_TAG_RE.test(normalized)) {
    // Wrap authored markup so it inherits readable email body typography.
    return `<div style="font-size:15px;line-height:1.7;color:#374151;">${sanitizeAllowedHtml(normalized, EMAIL_ALLOWED_TAGS)}</div>`;
  }

  return templateParagraphs(normalized)
    .map((lines) =>
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">${lines
        .map((line) => templateHasHtml(line) ? sanitizeAllowedHtml(line, EMAIL_ALLOWED_TAGS) : escapeHtml(line))
        .join('<br/>')}</p>`,
    )
    .join('');
};

/* A number written on a "WhatsApp :" line must open WhatsApp, not the dialer,
 * so it becomes a wa.me link instead of a native phone entity. */
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
  // or Telegram rejects the whole message with "Unsupported start tag".
  const safeHtml = linkWhatsAppNumbers(templateHasHtml(normalized)
    ? sanitizeAllowedHtml(normalized, TELEGRAM_ALLOWED_TAGS).replace(/<br\s*\/?>/gi, '\n')
    : escapeHtml(normalized));

  // Email links are supported in Telegram HTML. Phone numbers stay as text here
  // and are emitted as native phone_number entities by telegramMessagePayload.
  // Telegram silently drops a phone_number entity whose text contains spaces or
  // dashes, so spaced numbers are compacted (+91 98765 43210 -> +919876543210).
  const contactRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
  const phoneRe = /\+\d[\d\s-]{6,}\d/g;
  const tokens = safeHtml.split(/(<[^>]+>)/g);
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
    return token
      .replace(contactRe, (contact) => `<a href="mailto:${escapeAttr(contact)}">${contact}</a>`)
      .replace(phoneRe, (phone) => phone.replace(/[\s-]/g, ''));
  }).join('');
};

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
}

export interface TelegramMessagePayload {
  text: string;
  entities: TelegramMessageEntity[];
}

const decodeTelegramHtml = (value: string): string => String(value || '')
  .replace(/&#x([\da-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&');

const entityTypeForTag = (tag: string): string | null => ({
  b: 'bold', strong: 'bold', i: 'italic', em: 'italic', u: 'underline',
  s: 'strikethrough', strike: 'strikethrough', del: 'strikethrough',
  code: 'code', pre: 'pre', blockquote: 'blockquote', 'tg-spoiler': 'spoiler',
}[tag] || null);

/** Converts safe template HTML into Bot API entities. Phone numbers use
 * Telegram's native phone entity so its contact and carrier-call menu opens. */
export const telegramMessagePayload = (value: string): TelegramMessagePayload => {
  const html = renderTelegramTemplateHtml(value);
  const entities: TelegramMessageEntity[] = [];
  const stack: Array<{ tag: string; type: string; offset: number; url?: string }> = [];
  let text = '';
  const tokenRe = /<\/?\s*[a-z][^>]*>|[^<]+/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(html)) !== null) {
    const token = match[0];
    if (!token.startsWith('<')) {
      text += decodeTelegramHtml(token);
      continue;
    }
    const tag = token.match(/^<\/?\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    if (!tag) continue;
    const closing = /^<\s*\//.test(token);
    if (!closing) {
      if (tag === 'br') {
        text += '\n';
        continue;
      }
      if (tag === 'a') {
        const hrefMatch = token.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const url = decodeTelegramHtml(String(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || ''));
        const phoneUrl = url.match(/^tel:(.+)$/i)?.[1]
          || url.match(/^tg:\/\/resolve\?phone=(.+)$/i)?.[1];
        const type = phoneUrl ? 'phone_number' : /^mailto:/i.test(url) ? 'email' : 'text_link';
        stack.push({
          tag,
          type,
          offset: text.length,
          url: type === 'text_link' ? url : undefined,
        });
      } else {
        const type = entityTypeForTag(tag);
        if (type) stack.push({ tag, type, offset: text.length });
      }
      continue;
    }

    const openIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
    if (openIndex < 0) continue;
    const [open] = stack.splice(openIndex, 1);
    if (open.type === 'phone_number') {
      // Telegram ignores a phone entity containing spaces or dashes.
      const compact = text.slice(open.offset).replace(/[\s-]/g, '');
      text = text.slice(0, open.offset) + compact;
    }
    const length = text.length - open.offset;
    if (length > 0) entities.push({ type: open.type, offset: open.offset, length, ...(open.url ? { url: open.url } : {}) });
  }

  // Add native phone entities for plain, spaced international numbers.
  // JS string indexes are UTF-16 offsets, matching Telegram's Bot API.
  const phoneRe = /\+\d[\d\s-]{6,}\d/g;
  for (const phone of text.matchAll(phoneRe)) {
    const offset = phone.index;
    if (offset === undefined) continue;
    const end = offset + phone[0].length;
    const overlapsLink = entities.some((entity) =>
      ['text_link', 'email', 'phone_number'].includes(entity.type)
      && offset < entity.offset + entity.length
      && end > entity.offset);
    if (!overlapsLink) entities.push({
      type: 'phone_number',
      offset,
      length: phone[0].length,
    });
  }

  entities.sort((a, b) => a.offset - b.offset || b.length - a.length);
  return { text, entities };
};
