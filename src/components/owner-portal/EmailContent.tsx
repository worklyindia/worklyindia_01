import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ExternalLink } from 'lucide-react';

const addressOf = (s: string) => (s.match(/<([^>]+)>/)?.[1] || s).trim().toLowerCase();
const PERSONAL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|rediffmail|zoho)\./i;

/** Brand domain for a sender, e.g. noreply@email.openai.com -> openai.com */
export const senderDomain = (from: string) => {
  const host = addressOf(from).split('@')[1] || '';
  if (!host || PERSONAL.test(host)) return '';
  const parts = host.split('.');
  const tail = parts.slice(-2).join('.');
  return /^(co|com|org|net|gov|ac)\.[a-z]{2}$/i.test(tail) ? parts.slice(-3).join('.') : tail;
};

export function SenderAvatar({ from, name, className = 'h-10 w-10', ownLogo }: { from: string; name: string; className?: string; ownLogo?: string }) {
  const domain = senderDomain(from);
  const candidates = useMemo(() => [
    ownLogo || '',
    domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : '',
    domain ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico` : '',
  ].filter((value): value is string => Boolean(value)), [domain, ownLogo]);
  const [candidate, setCandidate] = useState(0);
  useEffect(() => setCandidate(0), [candidates.join('|')]);
  const letter = (name || '?').charAt(0).toUpperCase();
  const image = candidates[candidate];
  return <span className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-base font-semibold text-primary`} aria-hidden="true">
    {image
      ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full bg-card object-contain p-1" onError={() => setCandidate(value => value + 1)} onLoad={e => { if (e.currentTarget.naturalWidth <= 2) setCandidate(value => value + 1); }} />
      : letter}
  </span>;
}

const looksLikeHtml = (s: string) => /(?:<|&lt;)\s*(?:!doctype|html|body|table|div|p|a|img|br|span|style|td|tr|center|font)\b/i.test(s);
const IMG = /\.(?:png|jpe?g|gif|webp|avif|bmp)(?:\?[^\s]*)?$/i;
const VID = /\.(?:mp4|webm|mov|m4v|ogg)(?:\?[^\s]*)?$/i;
const youtubeId = (u: string) => u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1];

/** Remove raw CSS / comments that leaked into a plain-text body. */
const decodeEntities = (s: string) => {
  if (!/&[#a-z0-9]+;/i.test(s)) return s;
  const t = document.createElement('textarea'); t.innerHTML = s; return t.value;
};
const cleanText = (s: string) => {
  let out = decodeEntities(s)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  // Drop @media/@font-face blocks (nested braces), then every "selector { prop: value }" rule.
  for (let i = 0; i < 3; i++) out = out.replace(/@[a-z-]+[^{};]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, '');
  out = out.replace(/[^{}\n]{0,300}\{[^{}]*:[^{}]*\}/g, '');
  return out
    .replace(/[\u200b-\u200d\u2060\ufeff\u034f\u00ad]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    // Leftover CSS selector lines like "[data-ogsc] .box h1," or "body," or "table,".
    .replace(/^[ \t]*(?=[^\n]*(?:[.#[\]*:>]|^\s*(?:html|body|table|td|th|tr|div|span|p|a|img|h[1-6]|li|ul)\b))[\w.#:*[\]="'>~+()\s-]{1,160},[ \t]*$/gm, '')
    .replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
};

/** One-line inbox preview: never show raw HTML tags or leaked CSS. */
export const previewText = (value: string) => cleanText(
  decodeEntities(value || '')
    .replace(/<(?:style|script|head)[^>]*>[\s\S]*?<\/(?:style|script|head)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).replace(/\s+/g, ' ').trim();

/** Some providers deliver HTML entity-escaped (&lt;table&gt;) — decode so it renders instead of showing code. */
const decodeEscaped = (s: string) => {
  if (!/&lt;\s*(?:html|body|table|div|p|a|img|br|span|td|tr)\b/i.test(s) || /<(?:table|div|p|body)\b/i.test(s)) return s;
  const t = document.createElement('textarea'); t.innerHTML = s; return t.value;
};

const IMG_RE = /^https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp|avif|bmp|svg)(?:[?#][^\s"'<>]*)?$/i;
const VID_RE = /^https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov|m4v|ogg)(?:[?#][^\s"'<>]*)?$/i;

type MailTheme = { color: string; bg: string; link: string };
const readTheme = (): MailTheme => {
  const r = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => { const x = r.getPropertyValue(n).trim(); return x ? `hsl(${x})` : d; };
  return { color: v('--foreground', '#111'), bg: v('--background', '#fff'), link: v('--primary', '#2563eb') };
};

const buildDoc = (raw: string, t: MailTheme) => {
  const html = decodeEscaped(raw);
  // Collect every <style> block (head + body) so email CSS & media queries survive sanitizing.
  const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(m => m[1])
    .join('\n').replace(/<\/?[a-z][^>]*>/gi, '').replace(/expression\s*\(|javascript:|@import[^;]*;/gi, '')
    // Theme owns surfaces & text colours so mail matches light/dark mode.
    .replace(/(?:background(?:-color|-image)?|(?<![-\w])color|-webkit-text-fill-color)\s*:[^;}]*;?/gi, '');
  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
  const inner = (bodyMatch ? bodyMatch[2] : html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<head[\s\S]*?<\/head>/i, '');
  // Keep body-level attributes (bgcolor/style) by wrapping them on a div.
  const bodyAttrs = bodyMatch?.[1] || '';
  const bodyStyle = bodyAttrs.match(/style\s*=\s*"([^"]*)"/i)?.[1] || '';
  const bodyBg = bodyAttrs.match(/bgcolor\s*=\s*"?([#\w]+)/i)?.[1];
  DOMPurify.removeHook('afterSanitizeAttributes');
  // Company image/video servers: upgrade http links (blocked on https pages) and load lazy images.
  const https = (u: string | null) => (u && /^http:\/\//i.test(u) ? u.replace(/^http:/i, 'https:') : u);
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    const el = node as Element;
    if (!el.tagName) return;
    for (const attr of ['src', 'poster', 'background']) { const v = el.getAttribute(attr); if (v) el.setAttribute(attr, https(v)!); }
    el.removeAttribute('bgcolor');
    if (el.tagName === 'FONT') el.removeAttribute('color');
    const rawStyle = el.getAttribute('style');
    if (el.tagName === 'A' && rawStyle) {
      const background = rawStyle.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1]?.trim();
      const color = rawStyle.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim();
      if (background && background !== 'transparent') {
        el.setAttribute('data-mail-button', 'true');
        el.setAttribute('style', `${rawStyle};--mail-button-bg:${background};--mail-button-color:${color || '#ffffff'}`);
      }
    }
    if (rawStyle != null && el.tagName !== 'A') el.setAttribute('style', rawStyle.replace(/(?:background(?:-color|-image)?|(?<![-\w])color|-webkit-text-fill-color)\s*:[^;]*;?/gi, ''));
    const style = el.getAttribute('style');
    if (style && /url\(\s*['"]?http:/i.test(style)) el.setAttribute('style', style.replace(/url\(\s*(['"]?)http:/gi, 'url($1https:'));
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer');
      // A bare link to a picture or video shows the picture/video itself.
      const href = el.getAttribute('href') || '';
      const txt = (el.textContent || '').trim();
      if (!el.querySelector('img') && (txt === href || txt.startsWith('http'))) {
        if (IMG_RE.test(href)) el.innerHTML = `<img src="${https(href)!.replace(/"/g, '%22')}" alt="" style="max-width:100%;border-radius:8px;display:block">`;
        else if (VID_RE.test(href)) el.outerHTML = `<video src="${https(href)!.replace(/"/g, '%22')}" controls playsinline preload="metadata" style="max-width:100%;border-radius:8px;display:block"></video>`;
      }
    }
    if (el.tagName === 'IMG') {
      el.setAttribute('referrerpolicy', 'no-referrer');
      el.setAttribute('loading', 'eager');
      const lazy = el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('data-lazy-src');
      if (lazy && (!el.getAttribute('src') || /^data:image\/gif/i.test(el.getAttribute('src')!))) el.setAttribute('src', https(lazy)!);
      const srcset = el.getAttribute('srcset');
      if (srcset) el.setAttribute('srcset', srcset.replace(/http:\/\//gi, 'https://'));
      // Keep the sender's intended picture size: a logo sized 48px must not stretch to full width.
      const declared = el.getAttribute('width') || '';
      const styleWidth = /(?:^|;)\s*(?:max-)?width\s*:/i.test(el.getAttribute('style') || '');
      const px = Number(declared.replace(/px$/i, ''));
      if (Number.isFinite(px) && px > 0 && !declared.includes('%')) {
        const safeStyle = (el.getAttribute('style') || '')
          .replace(/(?:^|;)\s*(?:min-|max-)?width\s*:[^;]*/gi, '')
          .replace(/(?:^|;)\s*height\s*:[^;]*/gi, '');
        el.setAttribute('style', `${safeStyle};width:${px}px!important;max-width:100%!important;height:auto!important`);
      } else if (!styleWidth && !declared) {
        el.setAttribute('data-mail-unsized', 'true');
      }
      // Inline "cid:" pictures live inside the mail file and can't load here; drop them instead of showing a broken icon.
      if (/^cid:/i.test(el.getAttribute('src') || '')) el.remove();
    }
    if (el.tagName === 'VIDEO') { el.setAttribute('controls', ''); el.setAttribute('playsinline', ''); el.setAttribute('preload', 'metadata'); }
  });
  const clean = DOMPurify.sanitize(`<div class="__em" style="${bodyStyle.replace(/"/g, '')}${bodyBg ? `;background-color:${bodyBg}` : ''}">${inner}</div>`, {
    FORCE_BODY: true,
    ADD_TAGS: ['video', 'source', 'center', 'font', 'picture'],
    ADD_ATTR: ['target', 'bgcolor', 'align', 'valign', 'background', 'controls', 'poster', 'cellpadding', 'cellspacing', 'border', 'width', 'height', 'color', 'face', 'size', 'colspan', 'rowspan', 'nowrap', 'dir', 'role', 'srcset', 'sizes', 'data-src', 'data-original', 'data-lazy-src', 'playsinline', 'preload', 'loading', 'referrerpolicy'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'base', 'meta', 'link', 'style'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/|cid):|\/\/|#)/i,
  });
  DOMPurify.removeHook('afterSanitizeAttributes');
  return `<!doctype html><html style="--mail-color:${t.color};--mail-background:${t.bg};--mail-link:${t.link};color-scheme:normal"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'"><base target="_blank"><style>html,body{margin:0;padding:0;overflow-x:hidden;background:var(--mail-background);color:inherit;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;-webkit-text-size-adjust:100%}body{padding:8px}#__wrap{transform-origin:0 0;display:inline-block;min-width:100%}img{border:0;max-width:100%;height:auto}img[data-mail-unsized]{max-height:300px;width:auto;object-fit:contain}video{max-width:100%;height:auto}table{border-collapse:collapse}td,th{vertical-align:top}a{color:inherit;text-decoration:underline}pre{white-space:pre-wrap}</style><style>${styles}</style><style>html,html body{background:var(--mail-background)!important;color:var(--mail-color)!important;word-break:break-word;overflow-wrap:anywhere}html body *{background:transparent!important;color:var(--mail-color)!important;box-shadow:none!important;-webkit-text-fill-color:var(--mail-color)!important;border-color:color-mix(in srgb,var(--mail-color) 18%,transparent)!important}html body a,html body a *{color:var(--mail-link)!important;-webkit-text-fill-color:var(--mail-link)!important}html body a[data-mail-button]{display:inline-block!important;background:var(--mail-button-bg,var(--mail-link))!important;color:var(--mail-button-color,#fff)!important;-webkit-text-fill-color:var(--mail-button-color,#fff)!important;text-decoration:none!important;border-color:transparent!important}html body a[data-mail-button] *{color:var(--mail-button-color,#fff)!important;-webkit-text-fill-color:var(--mail-button-color,#fff)!important}</style></head><body><div id="__wrap">${clean}</div></body></html>`;
};

function HtmlFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(40);
  const [theme, setTheme] = useState<MailTheme>(readTheme);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(readTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    return () => mo.disconnect();
  }, []);
  const syncTheme = useCallback(() => {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    const t = readTheme();
    doc.documentElement.style.setProperty('--mail-color', t.color);
    doc.documentElement.style.setProperty('--mail-background', t.bg);
    doc.documentElement.style.setProperty('--mail-link', t.link);
  }, []);
  // Like Gmail: shrink wide (e.g. 600px) newsletters to fit the screen instead of cutting them off.
  const measure = useCallback(() => {
    const frame = ref.current; const doc = frame?.contentDocument;
    const wrap = doc?.getElementById('__wrap') as HTMLElement | null;
    if (!frame || !doc || !wrap) return;
    const avail = frame.clientWidth - 16;
    if (avail <= 0) return;
    // Lay the email out at screen width first; only if it still overflows, lay it out wider and shrink evenly.
    wrap.style.transform = 'none';
    wrap.style.display = 'block';
    wrap.style.minWidth = '0';
    wrap.style.width = `${avail}px`;
    const layoutW = Math.max(avail, wrap.scrollWidth);
    wrap.style.width = `${layoutW}px`;
    const real = Math.max(layoutW, wrap.scrollWidth);
    const scale = real > avail ? avail / real : 1;
    wrap.style.transform = scale < 1 ? `scale(${scale})` : 'none';
    setHeight(Math.max(32, Math.ceil(wrap.scrollHeight * scale) + 16));
  }, []);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const onLoad = () => {
      syncTheme();
      measure();
      const doc = frame.contentDocument;
      doc?.querySelectorAll('img,video').forEach(el => { el.addEventListener('load', measure); el.addEventListener('loadedmetadata', measure); });
      if ('ResizeObserver' in window) { observer = new ResizeObserver(measure); observer.observe(frame); }
    };
    frame.addEventListener('load', onLoad);
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    syncTheme();
    return () => { frame.removeEventListener('load', onLoad); observer?.disconnect(); themeObserver.disconnect(); };
  }, [html, theme, measure, syncTheme]);
  // allow-same-origin (without allow-scripts) is needed only to measure height; scripts stay blocked.
  return <iframe ref={ref} title={title} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={buildDoc(html, theme)} style={{ height }} className="mt-4 w-full overflow-hidden border-0 bg-background text-foreground" scrolling="no" />;
}

function RichText({ text }: { text: string }) {
  const parts = cleanText(text).split(/(https?:\/\/[^\s<>"')\]]+)/g);
  return <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">
    {parts.map((part, i) => {
      if (!/^https?:\/\//.test(part)) return <span key={i}>{part}</span>;
      const yt = youtubeId(part);
      if (IMG.test(part)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="my-2 block"><img src={part} alt="" loading="lazy" referrerPolicy="no-referrer" className="max-h-96 max-w-full rounded-lg border border-border" /></a>;
      if (VID.test(part)) return <video key={i} src={part} controls preload="metadata" className="my-2 block max-h-96 w-full rounded-lg bg-muted" />;
      if (yt) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="relative my-2 block max-w-md overflow-hidden rounded-lg border border-border"><img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="YouTube video" className="w-full" /><span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">▶ Play</span></span></a>;
      let host = part; try { host = new URL(part).hostname.replace(/^www\./, ''); } catch { /* keep */ }
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 align-middle text-xs font-medium text-primary hover:bg-muted/70"><ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{host}</span></a>;
    })}
  </div>;
}

export function EmailContent({ html, body, title }: { html?: string; body?: string; title: string }) {
  const source = html || (body && looksLikeHtml(body) ? body : '');
  if (source) return <HtmlFrame html={source} title={title} />;
  const text = (body || '').trim();
  return text ? <RichText text={text} /> : <p className="mt-4 text-sm text-muted-foreground">(Empty message)</p>;
}
