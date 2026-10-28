/**
 * Email body editing helpers.
 *
 * The editor is a single rich-text document (one message box). Everything the
 * owner types or inserts lives in one HTML string, so what they see in the box
 * is what the email looks like.
 */

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const escapeAttr = (value: string) => escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const safeUrl = (value: string) => {
  const url = value.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  if (url.startsWith('/')) return `https://worklyindia.com${url}`;
  return '';
};

const ALLOWED_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'span', 'a',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ul', 'ol', 'li', 'blockquote', 'img',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background', 'background-color', 'text-align', 'text-decoration',
  'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
  'font-size', 'font-weight', 'font-style', 'font-family', 'line-height',
  'letter-spacing', 'margin', 'margin-top', 'margin-bottom', 'padding',
  'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
  'list-style', 'list-style-type', 'list-style-position', 'vertical-align',
  'margin-left', 'margin-right', 'float', 'clear', 'shape-outside', 'shape-margin',
  'border-radius', 'border', 'border-top', 'border-left', 'border-bottom', 'border-right',
  'display', 'width', 'max-width', 'height',
]);

const safeStyle = (value: string) => value
  .split(';')
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => {
    const separator = part.indexOf(':');
    if (separator < 1) return '';
    const property = part.slice(0, separator).trim().toLowerCase();
    const styleValue = part.slice(separator + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(property)) return '';
    if (!/^[#a-z0-9\s.,()%'"\-/]+$/i.test(styleValue) || /url\s*\(|expression|javascript:/i.test(styleValue)) return '';
    return `${property}:${styleValue}`;
  })
  .filter(Boolean)
  .join(';');

/** Clean the editor markup: keeps email-safe tags, styles, links and images. */
export const sanitizeEmailDocumentHtml = (value: string): string => {
  if (typeof DOMParser === 'undefined') return escapeHtml(value);
  const documentNode = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
  const root = documentNode.body.firstElementChild;
  if (!root) return '';

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    if (!(node instanceof HTMLElement)) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return '';
    const content = Array.from(node.childNodes).map(walk).join('');
    if (tag === 'br') return '<br/>';
    const style = safeStyle(node.getAttribute('style') || '');
    const styleAttribute = style ? ` style="${escapeAttr(style)}"` : '';

    if (tag === 'img') {
      const src = (node.getAttribute('src') || '').trim();
      if (!/^https?:\/\//i.test(src)) return '';
      return `<img src="${escapeAttr(src)}" alt="${escapeAttr(node.getAttribute('alt') || '')}"${styleAttribute} />`;
    }
    if (!ALLOWED_TAGS.has(tag)) return content;

    const normalized = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag;
    if (normalized === 'a') {
      const href = safeUrl(node.getAttribute('href') || '');
      return href ? `<a href="${escapeAttr(href)}"${styleAttribute}>${content}</a>` : content;
    }
    return `<${normalized}${styleAttribute}>${content}</${normalized}>`;
  };

  return Array.from(root.childNodes).map(walk).join('').trim();
};

/** Turn plain text (older templates) into editable paragraphs. */
export const toEmailDocumentHtml = (value: string): string => {
  const normalized = String(value || '').replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return '<p style="margin:0 0 16px;">&nbsp;</p>';
  if (/<\/?[a-z][\s\S]*>/i.test(normalized)) return sanitizeEmailDocumentHtml(normalized);
  return normalized
    .split(/\n{2,}/)
    .filter((part) => part.trim())
    .map((part) => `<p style="margin:0 0 16px;">${escapeHtml(part).replace(/\n/g, '<br/>')}</p>`)
    .join('');
};

export type EmailSnippet = 'heading' | 'button' | 'box' | 'divider' | 'spacer' | 'list';

/** Ready-made pieces inserted straight where the cursor is. */
export const emailSnippetHtml = (snippet: EmailSnippet): string => {
  if (snippet === 'heading') return '<h2 style="margin:0 0 12px;font-size:20px;line-height:1.35;font-weight:700;color:#111827;">Your heading</h2>';
  if (snippet === 'button') return '<p style="margin:0 0 16px;text-align:center;"><a href="https://worklyindia.com/" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">Open Workly India</a></p>';
  if (snippet === 'box') return '<div style="margin:0 0 16px;padding:16px;border-radius:8px;background-color:#f3f4f6;">Add your card content here.</div>';
  if (snippet === 'divider') return '<div style="margin:16px 0;border-top:1px solid #d1d5db;"></div><p style="margin:0 0 16px;">&nbsp;</p>';
  if (snippet === 'list') return '<ul style="margin:0 0 16px;padding-left:20px;"><li>First point</li><li>Second point</li></ul>';
  return '<div style="height:24px;line-height:24px;">&nbsp;</div>';
};

export const emailImageHtml = (url: string) =>
  `<p style="margin:0 0 16px;text-align:center;"><img src="${escapeAttr(url)}" alt="" style="display:inline-block;width:100%;max-width:100%;border-radius:8px;" /></p>`;

export interface EmailButtonOptions {
  text: string;
  url: string;
  backgroundColor: string;
  textColor: string;
  /** Free text size in px, chosen with a slider. */
  fontSize: number;
  /** Side padding in px — makes the button wider or narrower. */
  paddingX: number;
  /** Top/bottom padding in px — makes the button taller or shorter. */
  paddingY: number;
  radius: number;
  alignment: 'left' | 'center' | 'right';
  wrapText?: boolean;
}

export const clampButtonFontSize = (value: number) => Math.max(10, Math.min(34, Math.round(value)));
export const clampButtonPaddingX = (value: number) => Math.max(4, Math.min(60, Math.round(value)));
export const clampButtonPaddingY = (value: number) => Math.max(2, Math.min(34, Math.round(value)));

/** Build a conservative, inline-styled button that works in common email clients. */
export const emailButtonHtml = ({
  text,
  url,
  backgroundColor,
  textColor,
  fontSize,
  paddingX,
  paddingY,
  radius,
  alignment,
  wrapText = false,
}: EmailButtonOptions) => {
  const href = safeUrl(url);
  if (!text.trim() || !href) return '';
  const padding = `${clampButtonPaddingY(paddingY)}px ${clampButtonPaddingX(paddingX)}px`;
  const size = `${clampButtonFontSize(fontSize)}px`;
  const wraps = wrapText && alignment !== 'center';
  const floatStyle = wraps
    ? `float:${alignment};margin-left:${alignment === 'right' ? '4px' : '0'};margin-right:${alignment === 'left' ? '4px' : '0'};margin-bottom:2px;`
    : '';
  return `<p style="margin:0;padding:0;text-align:${alignment};line-height:${wraps ? '0' : '1.2'};"><a href="${escapeAttr(href)}" style="display:inline-block;${floatStyle}padding:${padding};border-radius:${Math.max(0, Math.min(30, radius))}px;background-color:${escapeAttr(backgroundColor)};color:${escapeAttr(textColor)};text-decoration:none;font-size:${size};font-weight:700;line-height:1.2;">${escapeHtml(text.trim())}</a></p>`;
};
