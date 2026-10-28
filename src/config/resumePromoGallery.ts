// Resume / Cover Letter template gallery used by the promo Email + Telegram templates.
// Keep in sync with supabase/functions/_shared/resumePromoGallery.ts (same markup).
export type PromoKind = 'resume' | 'cover';

export const PROMO_TEMPLATES: Record<PromoKind, { name: string; file: string }[]> = {
  resume: [
    { name: 'Professional', file: 'professional' }, { name: 'ATS Simple', file: 'ats-simple' },
    { name: 'Modern', file: 'modern' }, { name: 'Minimal', file: 'minimal' },
    { name: 'Executive', file: 'executive' }, { name: 'Fresher', file: 'fresher' },
    { name: 'Two Column', file: 'two-column' }, { name: 'One Column', file: 'one-column' },
    { name: 'Compact', file: 'compact' }, { name: 'Creative', file: 'creative' },
  ],
  cover: [
    { name: 'Professional', file: 'professional' }, { name: 'ATS Simple', file: 'ats-simple' },
    { name: 'Modern', file: 'modern' }, { name: 'Minimal', file: 'minimal' },
    { name: 'Executive', file: 'executive' }, { name: 'Fresher', file: 'fresher' },
    { name: 'Creative', file: 'creative' }, { name: 'Corporate', file: 'corporate' },
    { name: 'Formal', file: 'formal' }, { name: 'Simple', file: 'simple' },
  ],
};

const META = {
  resume: { folder: 'resume-templates', url: '/resume-builder/create/1', cta: 'Create Resume' },
  cover: { folder: 'cover-templates', url: '/cover-letter-builder/create/1', cta: 'Create Cover Letter' },
};

/** Email gallery: every template preview with its own Create button below it. */
export const buildPromoEmailGallery = (kind: PromoKind, imageBase: string, linkBase: string): string => {
  const m = META[kind];
  const cards = PROMO_TEMPLATES[kind].map((t) =>
    `<div style="margin:0 0 16px;padding:8px;border:1px solid #dfe3eb;border-radius:12px;background:#ffffff;text-align:center;">`
    + `<a href="${linkBase}${m.url}" style="text-decoration:none;"><img src="${imageBase}/email/${m.folder}/${t.file}.jpg?v=4" alt="${t.name} template" width="100%" style="display:block;width:100%;max-width:100%;height:auto;margin:0 auto;border:1px solid #e3e8f2;border-radius:8px;" /></a>`
    + `<div style="margin-top:10px;font-size:16px;font-weight:700;color:#0f1b33;">${t.name}</div>`
    + `<a href="${imageBase}/email/${m.folder}/${t.file}.jpg?v=4" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:15px;color:#3B5CE4;text-decoration:underline;">View Full Size</a>`
    + `<a href="${linkBase}${m.url}" style="display:block;margin-top:10px;padding:11px 0;border-radius:24px;background:#3B5CE4;color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:700;">${m.cta}</a>`
    + `</div>`).join('');
  return cards;
};

export const buildPromoTelegramList = (kind: PromoKind, linkBase: string): string => {
  const m = META[kind];
  return PROMO_TEMPLATES[kind].map((t, i) => `${i + 1}. <b>${t.name}</b>`).join('<br>')
    + `<br><br>👉 <a href="${linkBase}${m.url}">${m.cta} now</a>`;
};

/** Preview / test-send sample for the promo templates. */
export const withPromoSample = (values: Record<string, string>, channel: 'email' | 'telegram') => {
  const site = 'https://worklyindia.devs.surf';
  const imageBase = site;
  const out = { ...values };
  (['resume', 'cover'] as PromoKind[]).forEach((kind) => {
    const key = `${kind}_templates`;
    if (key in out) out[key] = channel === 'email' ? buildPromoEmailGallery(kind, imageBase, site) : buildPromoTelegramList(kind, site);
  });
  if ('developer_services' in out) out.developer_services = channel === 'email' ? buildDeveloperServicesEmail(site) : buildDeveloperServicesTelegram(site);
  return out;
};

// ---- Developer platform promo (employers / company developers) ----
export const DEVELOPER_SERVICES: { icon: string; name: string; text: string; url: string; cta: string }[] = [
  { icon: '💼', name: 'Jobs API', text: 'Show live Workly India jobs on your own website or app with full job details. Search by keyword, location and category, and every Apply button sends candidates to Workly India to apply.', url: '/developers/job-docs', cta: 'Read Jobs API Docs' },
  { icon: '✉️', name: 'Email API', text: 'Send branded transactional emails from your own domain with delivery logs, templates and webhooks.', url: '/developers/email-docs', cta: 'Read Email API Docs' },
  { icon: '💬', name: 'WhatsApp Business API', text: 'Send approved template messages, reply to customers and receive delivery updates on your official WhatsApp number.', url: '/developers/whatsapp-docs', cta: 'Read WhatsApp Docs' },
  { icon: '📸', name: 'Instagram & Facebook Inbox', text: 'Bring Instagram DMs and Facebook Page messages into one inbox and answer them through the API.', url: '/developers/instagram-docs', cta: 'Read Social Inbox Docs' },
  { icon: '🔐', name: 'Workly India (OAuth)', text: 'Let users securely sign in to your website or app with their Workly India account and connect their name, email and profile.', url: '/developers/oauth', cta: 'Read OAuth Docs' },
  { icon: '🧩', name: 'Website Chat Widget', text: 'Connect WhatsApp, Instagram, Facebook and Email widgets to your website with a simple no-code setup. Give your trusted team convenient access to your connected inboxes from your private admin page.', url: '/developers/widget-docs', cta: 'Read Widget Docs' },
  { icon: '👥', name: 'Sub-Accounts & API Keys', text: 'Build with the Workly India Partner Program and provide WhatsApp, Instagram, Facebook and Email services for your clients. Connect their business workflows with Workly India through dedicated sub-accounts and API keys.', url: '/developers/sub-accounts', cta: 'Manage Sub-Accounts' },
];

/** Email: one card per developer service, each with its own docs button. */
export const buildDeveloperServicesEmail = (linkBase: string): string =>
  DEVELOPER_SERVICES.map((s) =>
    `<div style="margin:0 0 14px;padding:16px;border:1px solid #dfe3eb;border-radius:12px;background:#ffffff;text-align:left;">`
    + `<div style="font-size:17px;font-weight:700;color:#0f1b33;">${s.icon} ${s.name}</div>`
    + `<div style="margin-top:6px;font-size:15px;line-height:1.55;color:#4b5563;">${s.text}</div>`
    + `<a href="${linkBase}${s.url}" style="display:block;margin-top:12px;padding:11px 0;border-radius:24px;background:#3B5CE4;color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:700;">${s.cta}</a>`
    + `</div>`).join('')
  + `<div style="margin:0 0 14px;padding:16px;border:1px solid #dfe3eb;border-radius:12px;background:#ffffff;text-align:left;">`
  + `<div style="font-size:16px;font-weight:700;color:#0f1b33;">Ready to build?</div>`
  + `<div style="margin-top:6px;font-size:14px;line-height:1.55;color:#4b5563;">Create your free API key, test every endpoint and only pay for what you use.</div>`
  + `<a href="${linkBase}/developers" style="display:block;margin-top:12px;padding:11px 0;border-radius:24px;background:#3B5CE4;color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:700;">Open Developer Portal</a>`
  + `</div>`;

export const buildDeveloperServicesTelegram = (linkBase: string): string =>
  DEVELOPER_SERVICES.map((s) => `${s.icon} <b>${s.name}</b> — <a href="${linkBase}${s.url}">Docs</a>`).join('<br>')
  + `<br><br>👉 <a href="${linkBase}/developers">Open Developer Portal</a>`;
