// Sample 10-job alert used only by the template previews and test sends.
// Markup mirrors the server job-alert renderer so preview = delivered message.
const BASE = 'https://worklyindia.devs.surf';

interface SampleJob { title: string; company: string; location: string; salary: string; badge?: string; slug: string }

export const SAMPLE_ALERT_JOBS: SampleJob[] = [
  { title: 'DevOps Engineer', company: 'Vinsys IT Services', location: 'Pune', salary: 'Not disclosed', badge: '⚡ Urgent hiring', slug: 'devops-engineer' },
  { title: 'Java Developer', company: 'Persistent Systems', location: 'Hyderabad', salary: 'Not disclosed', slug: 'java-developer' },
  { title: 'BULK Hiring For Fortune 500 Clients', company: 'Impac', location: 'Noida, Gurugram, Delhi / NCR', salary: '20,833-54,167 /month', badge: '🔥 100 Vacancies', slug: 'bulk-hiring' },
  { title: 'Hiring GEN AI Automation Engineer', company: 'Info Edge', location: 'Noida', salary: 'Not disclosed', badge: '🔥 2 Vacancies', slug: 'gen-ai-automation' },
  { title: 'Analyst - Data Analytics', company: 'American Express', location: 'Gurugram, Manesar', salary: 'Not disclosed', slug: 'data-analyst' },
  { title: 'Technical Visual Reasoning Expert', company: 'Innodata India', location: 'Remote', salary: 'Not disclosed', badge: '🔥 5 Vacancies', slug: 'visual-reasoning' },
  { title: 'Analyst', company: 'Tresvista Financial Services', location: 'Gurugram', salary: 'Not disclosed', slug: 'analyst' },
  { title: 'DevOps Engineer', company: 'Barclays', location: 'Pune', salary: 'Not disclosed', slug: 'devops-barclays' },
  { title: 'React Frontend Developer', company: 'Workly India', location: 'Mumbai', salary: '35,000-60,000 /month', badge: '🏠 Hybrid', slug: 'react-developer' },
  { title: 'Customer Support Executive', company: 'Teleperformance', location: 'Ahmedabad', salary: '18,000-25,000 /month', badge: '🔥 50 Vacancies', slug: 'customer-support' },
];

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

export const sampleEmailJobsList = (name = 'Rahul Sharma'): string => {
  const cards = SAMPLE_ALERT_JOBS.map((j) =>
    `<div style="margin:0 0 14px;padding:16px 14px;border:1px solid #dfe3eb;border-radius:10px;background:#ffffff;">`
    + `<div style="float:left;width:44px;height:44px;margin:0 12px 0 0;border:1px solid #e3e8f2;border-radius:8px;background:#ffffff;text-align:center;line-height:44px;font-size:20px;font-weight:700;color:#3B5CE4;">${esc(j.company.charAt(0))}</div>`
    + `<div style="font-size:17px;line-height:1.3;font-weight:700;color:#0f1b33;">${esc(cut(j.title, 42))}</div>`
    + `<div style="margin-top:4px;font-size:14px;color:#4b5563;">${esc(cut(j.company, 34))}</div>`
    + `<div style="clear:both;"></div>`
    + `<div style="margin-top:12px;font-size:14px;font-weight:600;color:#1f2937;">📍 ${esc(j.location)}</div>`
    + `<div style="margin-top:8px;font-size:14px;font-weight:600;color:#1f2937;">₹ ${esc(j.salary)}</div>`
    + (j.badge ? `<div style="margin-top:10px;"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#f1f3f7;font-size:13px;color:#374151;">${esc(j.badge)}</span></div>` : '')
    + `<a href="${BASE}/jobs/${j.slug}" style="display:block;margin-top:14px;padding:11px 0;border-radius:24px;background:#eef2ff;color:#3B5CE4;text-align:center;text-decoration:none;font-size:15px;font-weight:700;">Apply</a>`
    + `</div>`).join('');
  const viewAll = `<div style="text-align:center;margin:20px 0 26px;"><a href="${BASE}/jobs" style="display:inline-block;padding:13px 28px;border-radius:24px;background:#3B5CE4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">View all recommendations</a></div>`;
  const profile = `<div style="margin:0 0 8px;padding:18px 16px;border-radius:10px;background:#f5f7fb;"><div style="font-size:18px;line-height:1.35;font-weight:700;color:#0f1b33;">Not getting jobs relevant to you? It's time to <span style="color:#e8860c;">update your profile!</span></div><div style="margin-top:7px;font-size:14px;line-height:1.55;color:#4b5563;">Keep your skills, preferred role and location up to date for better matches.</div><a href="${BASE}/profile" style="display:inline-block;margin-top:14px;padding:11px 22px;border-radius:24px;background:#3B5CE4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Update details</a></div>`;
  return cards + viewAll + profile;
};

export const sampleTelegramJobsList = (): string =>
  SAMPLE_ALERT_JOBS.map((j, i) =>
    `<b>${i + 1}. ${esc(cut(j.title, 48))}</b><br>🏢 ${esc(j.company)}<br>📍 ${esc(j.location)}<br>💰 ₹ ${esc(j.salary)}${j.badge ? `<br>${esc(j.badge)}` : ''}<br>👉 <a href="${BASE}/jobs/${j.slug}">Apply now</a>`,
  ).join('<br><br>━━━━━━━━━━━━<br><br>');

/** Replace the plain jobs_list sample with a full 10-job channel sample. */
export const withJobAlertSample = (values: Record<string, string>, channel: 'email' | 'telegram') =>
  'jobs_list' in values
    ? { ...values, name: 'Rahul Sharma', job_count: '10', jobs_list: channel === 'email' ? sampleEmailJobsList() : sampleTelegramJobsList() }
    : values;
