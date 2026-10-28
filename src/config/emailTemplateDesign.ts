/**
 * Shared email design blocks.
 *
 * Every lifecycle email body is built from these pieces so that all templates
 * look like one designed, branded mail instead of a plain message. The markup
 * stays inside the tags and inline styles the Template Editor and the sending
 * helper allow (see src/lib/templateFormatting.ts), so the owner can still edit
 * every heading, line and button from Owner Portal → Email Templates.
 *
 * Important: blocks are kept as SIBLINGS (never nested block elements). When a
 * variable has no value at send time, the sender removes only that one block,
 * so a missing mobile number or salary can never wipe the whole card.
 */

export type EmailTone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

interface TonePalette {
  accent: string;
  soft: string;
  softBorder: string;
}

const TONES: Record<EmailTone, TonePalette> = {
  brand: { accent: '#3B5CE4', soft: '#eef2ff', softBorder: '#d7ddfb' },
  info: { accent: '#2563eb', soft: '#eff6ff', softBorder: '#d3e2fd' },
  success: { accent: '#0DB17E', soft: '#ecfdf5', softBorder: '#c9f0e2' },
  warning: { accent: '#C2700B', soft: '#fff7ed', softBorder: '#fbe3c4' },
  danger: { accent: '#D64545', soft: '#fef2f2', softBorder: '#f8d7d7' },
};

const HEADING_COLOR = '#0f1b33';
const TEXT_COLOR = '#374151';
const MUTED_COLOR = '#6b7280';
const CARD_BORDER = '#e3e8f2';

export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface EmailSection {
  title?: string;
  text?: string;
  items?: string[];
  ordered?: boolean;
}

export interface EmailContentSpec {
  /** Subject line of the mail. */
  subject: string;
  tone?: EmailTone;
  /** Small uppercase label above the heading. */
  eyebrow?: string;
  heading: string;
  /** Greeting line, usually "Hi {{name}},". */
  greeting?: string;
  intro?: string;
  detailsTitle?: string;
  details?: EmailDetailRow[];
  /** One big highlighted value: OTP, amount, interview time. */
  highlight?: { label?: string; value: string; note?: string };
  sections?: EmailSection[];
  /** Tinted strip for a tip, warning or security note. */
  note?: string;
  closing?: string;
  signoff?: string;
  cta?: { text: string; url: string };
}

const text = (value: string, style = '') =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TEXT_COLOR};${style}">${value}</p>`;

const eyebrowBlock = (value: string, tone: TonePalette) =>
  `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;color:${tone.accent};">${value.toUpperCase()}</p>`;

const headingBlock = (value: string) =>
  `<h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:700;color:${HEADING_COLOR};">${value}</h1>`;

const sectionTitle = (value: string) =>
  `<h2 style="margin:0 0 10px;font-size:17px;line-height:1.4;font-weight:700;color:${HEADING_COLOR};">${value}</h2>`;

/**
 * Clean, app-like detail row: small muted label on its own line, the value in
 * bold under it, separated from the next row by a hairline rule. No boxes.
 */
const detailRow = (row: EmailDetailRow) => {
  const label = row.label.replace(/:\s*$/, '');
  if (label.toLowerCase() === 'mobile' && row.value === '{{mobile}}') {
    return `<div style="margin:0;padding:12px 0;border-bottom:1px solid ${CARD_BORDER};"><span style="display:block;margin:0 0 3px;font-size:13px;line-height:1.4;color:${MUTED_COLOR};">${label}</span><strong style="display:block;font-size:16px;line-height:1.45;font-weight:700;"><a href="tel:{{mobile_digits}}" style="color:#2563eb;text-decoration:none;">{{mobile}}</a></strong></div><div style="margin:0;padding:12px 0;border-bottom:1px solid ${CARD_BORDER};"><span style="display:block;margin:0 0 3px;font-size:13px;line-height:1.4;color:${MUTED_COLOR};">WhatsApp</span><strong style="display:block;font-size:16px;line-height:1.45;font-weight:700;"><a href="https://wa.me/{{whatsapp_digits}}" style="color:#2563eb;text-decoration:none;">{{whatsapp}}</a></strong></div>`;
  }
  return `<div style="margin:0;padding:12px 0;border-bottom:1px solid ${CARD_BORDER};"><span style="display:block;margin:0 0 3px;font-size:13px;line-height:1.4;color:${MUTED_COLOR};">${label}</span><strong style="display:block;font-size:16px;line-height:1.45;font-weight:700;color:${HEADING_COLOR};">${row.value}</strong></div>`;
};

const highlightBlock = (
  highlight: { label?: string; value: string; note?: string },
  tone: TonePalette,
) => {
  const label = highlight.label
    ? `<span style="display:block;font-size:12px;font-weight:700;letter-spacing:1px;color:${MUTED_COLOR};">${highlight.label.toUpperCase()}</span>`
    : '';
  const note = highlight.note
    ? `<span style="display:block;margin-top:6px;font-size:13px;color:${MUTED_COLOR};">${highlight.note}</span>`
    : '';
  return `<div style="margin:0 0 18px;padding:18px;border-radius:14px;background-color:${tone.soft};border:1px solid ${tone.softBorder};text-align:center;">${label}<span style="display:block;margin-top:4px;font-size:26px;font-weight:700;letter-spacing:1px;color:${tone.accent};">${highlight.value}</span>${note}</div>`;
};

const listBlock = (items: string[], ordered?: boolean) => {
  const tag = ordered ? 'ol' : 'ul';
  const rows = items
    .map((item) => `<li style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${TEXT_COLOR};">${item}</li>`)
    .join('');
  return `<${tag} style="margin:0 0 16px;padding-left:22px;">${rows}</${tag}>`;
};

const noteBlock = (value: string, tone: TonePalette) =>
  `<div style="margin:0 0 18px;padding:14px 16px;border-radius:10px;background-color:${tone.soft};border:1px solid ${tone.softBorder};font-size:14px;line-height:1.6;color:${TEXT_COLOR};">${value}</div>`;

const dividerBlock = () => `<div style="margin:6px 0 18px;border-top:1px solid ${CARD_BORDER};"></div>`;

const buttonBlock = (cta: { text: string; url: string }, tone: TonePalette) =>
  `<p style="margin:4px 0 8px;text-align:center;line-height:1.2;"><a href="${cta.url}" style="display:inline-block;padding:14px 30px;border-radius:10px;background-color:${tone.accent};color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:1.2;">${cta.text}</a></p>`;

const SITE = 'https://worklyindia.devs.surf';

/**
 * Site-relative links are made absolute so previews and the saved default both
 * work. A link that is still a placeholder ({{confirm_link}}) is left as it is —
 * the sender replaces it with the real, signed link when the mail goes out.
 */
const absolute = (url: string) =>
  /^https?:\/\//i.test(url) || url.includes('{{')
    ? url
    : `${SITE}${url.startsWith('/') ? url : `/${url}`}`;

/** Build the complete, designed email body for one template. */
export const buildEmailBody = (spec: EmailContentSpec): string => {
  const tone = TONES[spec.tone ?? 'brand'];
  const parts: string[] = [];

  if (spec.eyebrow) parts.push(eyebrowBlock(spec.eyebrow, tone));
  parts.push(headingBlock(spec.heading));
  if (spec.greeting !== '') parts.push(text(spec.greeting ?? 'Hi {{name}},'));
  if (spec.intro) parts.push(text(spec.intro));
  if (spec.highlight) parts.push(highlightBlock(spec.highlight, tone));

  if (spec.details?.length) {
    if (spec.detailsTitle) parts.push(sectionTitle(spec.detailsTitle));
    parts.push(`<div style="margin:2px 0 0;border-top:1px solid ${CARD_BORDER};"></div>`);
    parts.push(...spec.details.map(detailRow));
    parts.push('<div style="height:16px;line-height:16px;">&nbsp;</div>');
  }

  for (const section of spec.sections ?? []) {
    if (section.title) parts.push(sectionTitle(section.title));
    if (section.text) parts.push(text(section.text));
    if (section.items?.length) parts.push(listBlock(section.items, section.ordered));
  }

  if (spec.note) parts.push(noteBlock(spec.note, tone));
  if (spec.closing) parts.push(text(spec.closing));
  parts.push(text(`${spec.signoff ?? 'Warm regards,'}<br/><strong style="color:${HEADING_COLOR};">Team Workly India</strong>`));
  if (spec.cta) {
    parts.push(dividerBlock());
    parts.push(buttonBlock({ text: spec.cta.text, url: absolute(spec.cta.url) }, tone));
  }

  return parts.join('');
};

export const emailTemplateFromSpec = (spec: EmailContentSpec) => ({
  title: spec.subject,
  body: buildEmailBody(spec),
  button_text: '',
  button_url: spec.cta ? spec.cta.url : '/',
});
