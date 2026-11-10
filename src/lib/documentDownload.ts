import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import { captureResume } from '@/lib/resumeCapture';
import { captureCoverLetter } from '@/lib/coverLetterCapture';
import { canvasToDocxBlob } from '@/lib/canvasToDocx';

export type DocFormat = 'pdf' | 'docx' | 'txt';
export type DocKind = 'resume' | 'cover_letter';

const normalizeForCapture = (raw: any) => {
  const p = raw?.personalInfo || raw?.personal || {};
  return {
    personalInfo: {
      fullName: p.fullName || 'Your Name',
      title: p.title || p.professionalTitle || '',
      email: p.email || '',
      phone: p.phone || p.mobile || '',
      address: p.address || p.location || '',
      linkedin: p.linkedin || '',
      portfolio: p.portfolio || p.website || '',
      website: p.website || p.portfolio || '',
      photoUrl: p.photoUrl || '',
    },
    summary: raw?.summary || '',
    experience: (raw?.experience || raw?.experiences || []).map((e: any, i: number) => ({
      id: e.id || String(i),
      position: e.position || e.jobTitle || '',
      company: e.company || '',
      duration: e.duration || `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`,
      description: e.description || [e.responsibilities, e.achievements].filter(Boolean).join('\n'),
    })),
    education: (raw?.education || []).map((ed: any, i: number) => ({
      id: ed.id || String(i),
      degree: ed.degree || ed.course || '',
      institution: ed.institution || ed.school || '',
      year: ed.year || `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`,
      grade: ed.grade || '',
    })),
    skills: (raw?.skills || []).map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean),
    languages: (raw?.languages || []).map((l: any) => (typeof l === 'string' ? l : `${l?.name || ''}${l?.proficiency ? ` (${l.proficiency})` : ''}`)).filter(Boolean),
    certifications: (raw?.certifications || []).map((c: any) => (typeof c === 'string' ? c : [c?.name, c?.organization].filter(Boolean).join(' - '))).filter(Boolean),
  };
};

const canvasToPdfBlob = (canvas: HTMLCanvasElement): Blob => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  return pdf.output('blob');
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const nl2br = (value: unknown): string => escapeHtml(value).replace(/\n/g, '<br />');

const templateSlug = (template: string) => (template || 'Professional').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const coverTemplateSlug = (template: string) => {
  const t = (template || '').toLowerCase().trim();
  if (t === 'ats professional') return 'ats-simple';
  if (t === 'elegant' || t === 'premium') return 'executive';
  if (t === 'classic') return 'formal';
  return templateSlug(template);
};

const normalizeResumeForPrint = (input: any) => {
  const p = input?.personalInfo || input?.personal || {};
  return {
    personalInfo: {
      fullName: p.fullName || 'Your Name',
      title: p.title || p.professionalTitle || '',
      email: p.email || '',
      phone: p.phone || p.mobile || '',
      address: p.address || p.location || '',
      linkedin: p.linkedin || '',
      portfolio: p.portfolio || p.website || '',
      website: p.website || p.portfolio || '',
      photoUrl: p.photoUrl || '',
    },
    summary: input?.summary || '',
    experience: (input?.experience || input?.experiences || []).map((e: any, i: number) => ({
      id: e.id || String(i),
      position: e.position || e.jobTitle || '',
      company: e.company || '',
      duration: e.duration || `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`,
      description: e.description || [e.responsibilities, e.achievements].filter(Boolean).join('\n'),
    })),
    education: (input?.education || []).map((ed: any, i: number) => ({
      id: ed.id || String(i),
      degree: ed.degree || ed.course || '',
      institution: ed.institution || ed.school || '',
      year: ed.year || `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`,
      grade: ed.grade || '',
    })),
    skills: (input?.skills || []).map((s: any) => typeof s === 'string' ? s : s?.name).filter(Boolean),
    languages: (input?.languages || []).map((l: any) => typeof l === 'string' ? l : `${l?.name || ''}${l?.proficiency ? ` (${l.proficiency})` : ''}`).filter(Boolean),
    certifications: (input?.certifications || []).map((c: any) => typeof c === 'string' ? c : [c?.name, c?.organization].filter(Boolean).join(' - ')).filter(Boolean),
  };
};

const buildResumePrintHtml = (data: unknown, template: string): string => {
  const r = normalizeResumeForPrint(data as any);
  const slug = templateSlug(template);
  const p = r.personalInfo;
  const contact = [p.email, p.phone, p.address].filter(Boolean).map(escapeHtml).join(' <span>•</span> ');
  const links = [p.linkedin, p.portfolio || p.website].filter(Boolean).map(escapeHtml).join(' <span>•</span> ');
  const photo = p.photoUrl ? `<img class="avatar-img" src="${escapeHtml(p.photoUrl)}" alt="Profile photo" />` : `<div class="avatar-fallback">${escapeHtml((p.fullName || 'YN').split(/\s+/).slice(0, 2).map((x: string) => x[0]).join('').toUpperCase())}</div>`;
  const exp = r.experience.map((e) => `<article class="item"><div class="item-head"><strong>${escapeHtml(e.position)}</strong><em>${escapeHtml(e.duration)}</em></div><div class="sub">${escapeHtml(e.company)}</div>${e.description ? `<p>${nl2br(e.description)}</p>` : ''}</article>`).join('');
  const edu = r.education.map((ed) => `<article class="item"><strong>${escapeHtml(ed.degree)}</strong><div class="sub">${escapeHtml([ed.institution, ed.year, ed.grade].filter(Boolean).join(' · '))}</div></article>`).join('');
  const chips = (arr: string[]) => arr.map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('');
  const list = (arr: string[]) => `<ul>${arr.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
  const section = (name: string, body: string) => body ? `<section><h2>${name}</h2>${body}</section>` : '';
  const mainSections = [
    section(slug === 'executive' ? 'Executive Summary' : slug === 'creative' ? 'About' : 'Professional Summary', r.summary ? `<p>${nl2br(r.summary)}</p>` : ''),
    section('Experience', exp),
    section('Education', edu),
    section('Skills', r.skills.length ? (slug === 'ats-simple' || slug === 'one-column' || slug === 'compact' ? `<p>${escapeHtml(r.skills.join(', '))}</p>` : `<div class="chips">${chips(r.skills)}</div>`) : ''),
    section('Languages', r.languages.length ? (slug === 'professional' || slug === 'two-column' ? list(r.languages) : `<p>${escapeHtml(r.languages.join(' · '))}</p>`) : ''),
    section('Certifications', r.certifications.length ? list(r.certifications) : ''),
  ].join('');
  const sidebar = `<aside class="side"><div class="avatar">${photo}</div>${section('Contact', `<p>${[p.email, p.phone, p.address, p.linkedin, p.portfolio].filter(Boolean).map(escapeHtml).join('<br />')}</p>`)}${section('Skills', r.skills.length ? list(r.skills) : '')}${section('Languages', r.languages.length ? list(r.languages) : '')}</aside>`;
  const header = `<header><h1>${escapeHtml(slug === 'ats-simple' || slug === 'compact' || slug === 'one-column' ? p.fullName.toUpperCase() : p.fullName)}</h1>${p.title ? `<div class="title">${escapeHtml(p.title)}</div>` : ''}<div class="meta">${contact}</div>${links ? `<div class="meta">${links}</div>` : ''}</header>`;
  const shell = (() => {
    if (slug === 'professional') return `<div class="resume professional">${sidebar}<main>${header}${mainSections}</main></div>`;
    if (slug === 'modern') return `<div class="resume modern"><main>${header}${mainSections}</main>${sidebar}</div>`;
    if (slug === 'two-column') return `<div class="resume two-column">${sidebar}<main>${header}${mainSections}</main></div>`;
    if (slug === 'executive') return `<div class="resume executive">${header}<main>${mainSections}</main></div>`;
    if (slug === 'fresher') return `<div class="resume fresher">${header}<main>${section('Education', edu)}${section('Professional Summary', r.summary ? `<p>${nl2br(r.summary)}</p>` : '')}${section('Skills', r.skills.length ? `<div class="chips">${chips(r.skills)}</div>` : '')}${section('Experience', exp)}${section('Certifications', r.certifications.length ? list(r.certifications) : '')}</main></div>`;
    if (slug === 'compact') return `<div class="resume compact">${header}<main>${mainSections}</main></div>`;
    if (slug === 'creative') return `<div class="resume creative"><header><div class="initial">${escapeHtml(p.fullName[0] || 'Y')}</div><div><h1>${escapeHtml(p.fullName)}</h1><div class="title">${escapeHtml(p.title || 'Creative Professional')}</div></div></header><main>${mainSections}</main></div>`;
    if (slug === 'minimal') return `<div class="resume minimal">${header}<main>${mainSections}</main></div>`;
    return `<div class="resume ats ${slug === 'one-column' ? 'one-column' : ''}">${header}<main>${mainSections}</main></div>`;
  })();
  return shell;
};

const buildCoverTextForPrint = (d: any): string => d?.bodyText || [
  new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), '',
  d?.employer?.hiringManager || 'Hiring Manager', d?.employer?.companyName || 'Company Name', '',
  d?.job?.title ? `Subject: Application for ${d.job.title}${d?.job?.id ? ` (Job ID: ${d.job.id})` : ''}` : '', '',
  d?.opening?.greeting === 'Custom' ? d?.opening?.customGreeting || 'Dear Hiring Manager,' : `${d?.opening?.greeting || 'Dear Hiring Manager'},`, '',
  d?.introduction?.whyApplying || '',
  d?.introduction?.whereFound ? `I came across this opportunity through ${d.introduction.whereFound}.` : '', '',
  d?.experience?.relevant || '', '', d?.whyCompany || '', '',
  d?.closing?.availability ? `I am available to join ${d.closing.availability}.` : '',
  d?.closing?.thankYou || '',
].filter((x) => x !== undefined).join('\n');

const buildCoverPrintHtml = (data: unknown, template: string): string => {
  const d: any = data || {};
  const p = d.personal || {};
  const slug = coverTemplateSlug(template);
  const name = p.fullName || d.signature?.typedName || 'Your Name';
  const title = d.job?.title || 'Cover Letter';
  const contact = [p.mobile, p.email, p.location].filter(Boolean).map(escapeHtml).join(' <span>•</span> ');
  const links = [p.linkedin, p.portfolio].filter(Boolean).map(escapeHtml).join(' <span>•</span> ');
  const body = buildCoverTextForPrint(d).replace(/\n+(Warm regards|Sincerely|Regards),\s*\n?.*$/i, '').trim();
  const sig = d.signature?.digitalSignatureUrl ? `<img src="${escapeHtml(d.signature.digitalSignatureUrl)}" alt="Signature" />` : '<div class="sig-line"></div>';
  const signature = `<div class="signature"><strong>Sincerely,</strong>${sig}<b>${escapeHtml(d.signature?.typedName || name)}</b></div>`;
  const bodyBlock = `<section class="letter-body">${nl2br(body)}</section>${signature}`;
  const toBox = `<aside><b>TO</b><br />${escapeHtml(d.employer?.hiringManager || 'Hiring Manager')}<br />${escapeHtml(d.employer?.companyName || 'Company Name')}<br /><br /><b>ROLE</b><br />${escapeHtml(title)}</aside>`;
  if (slug === 'professional') return `<div class="cover professional"><header><h1>${escapeHtml(name)}</h1><div>${contact}</div>${links ? `<div>${links}</div>` : ''}</header><main>${toBox}${bodyBlock}</main></div>`;
  if (slug === 'modern') return `<div class="cover modern"><main><header><div><h1>${escapeHtml(name)}</h1><b>${escapeHtml(title)}</b></div><div>${contact}${links ? `<br />${links}` : ''}</div></header>${bodyBlock}</main></div>`;
  if (slug === 'minimal') return `<div class="cover minimal"><main><header><h1>${escapeHtml(name)}</h1><div></div><p>${contact}</p></header>${bodyBlock}</main></div>`;
  if (slug === 'executive') return `<div class="cover executive"><header><h1>${escapeHtml(name)}</h1><p>${escapeHtml(title)}</p></header><main><aside>${contact}${links ? `<br />${links}` : ''}</aside>${bodyBlock}</main></div>`;
  if (slug === 'fresher') return `<div class="cover fresher"><main><header><h1>${escapeHtml(name)}</h1><p>${contact}</p></header><div class="grid">${bodyBlock}<aside><b>First-job focus</b><br />Education, enthusiasm and potential.<br /><br /><b>Applying for</b><br />${escapeHtml(title)}</aside></div></main></div>`;
  if (slug === 'creative') return `<div class="cover creative"><header><div>${escapeHtml(name[0] || 'Y')}<h1>${escapeHtml(name)}</h1></div><aside>${contact}${links ? `<br />${links}` : ''}</aside></header><main><b class="badge">${escapeHtml(title)}</b>${bodyBlock}</main></div>`;
  if (slug === 'corporate') return `<div class="cover corporate"><aside><h2>${escapeHtml(name)}</h2><b>DATE</b><br />${escapeHtml(new Date().toLocaleDateString('en-IN'))}<br /><br />${contact}</aside><main><h1>${escapeHtml(title)}</h1>${bodyBlock}</main></div>`;
  if (slug === 'formal') return `<div class="cover formal"><main><header><h1>${escapeHtml(name)}</h1><p>${contact}</p></header>${bodyBlock}</main></div>`;
  return `<div class="cover ats ${slug === 'simple' ? 'simple' : ''}"><main><header><h1>${escapeHtml(name)}</h1><p>${contact}</p></header>${bodyBlock}</main></div>`;
};

const printCss = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; overflow: hidden; }
h1,h2,p,ul { margin-top: 0; } h1,h2 { break-after: avoid; } section,.item { break-inside: avoid; }
  .resume { min-height: 297mm; font-family: Arial, Helvetica, sans-serif; color: #111827; } .resume main { padding: 12mm; } .resume h1 { font-size: 30px; margin: 0; line-height: 1.08; } .resume .title { font-size: 13px; margin-top: 5px; color: #1E3A8A; font-weight: 700; } .resume .meta { font-size: 11px; color: #475569; margin-top: 5px; } .resume h2 { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; border-bottom: 2px solid #1E3A8A; padding-bottom: 9px; line-height: 1.35; margin: 18px 0 10px; color: #1E3A8A; } .resume p,.resume li { font-size: 12px; line-height: 1.48; } .item { margin-bottom: 10px; } .item-head { display:flex; justify-content:space-between; gap:12px; font-size:13px; } .item-head em,.sub { color:#64748B; font-size:11px; } .chips { display:flex; flex-wrap:wrap; gap:6px; } .chip { font-size:11px; background:#DBEAFE; color:#1D4ED8; padding:4px 9px; border-radius: 999px; } .side { padding: 10mm 7mm; } .avatar { width: 22mm; height:22mm; border-radius:50%; overflow:hidden; margin-bottom:7mm; background:rgba(255,255,255,.14); display:flex; align-items:center; justify-content:center; font-weight:800; } .avatar-img { width:100%; height:100%; object-fit:cover; }
.professional { display:grid; grid-template-columns: 68mm 1fr; } .professional .side { background:#1E3A8A; color:#fff; } .professional .side h2 { color:#fff; border-color:#fff; } .professional .side p,.professional .side li { color:#fff; } .professional main header { background:#EEF2FF; margin:-12mm -12mm 8mm; padding:12mm; }
.modern { display:grid; grid-template-columns: 1fr 55mm; border-left:5mm solid #2563EB; } .modern .side { background:#DBEAFE; } .modern h2 { display:inline-block; border:0; background:#2563EB; color:#fff; padding:5px 10px; border-radius:4px; } .modern .chip { background:#DBEAFE; }
.two-column { display:grid; grid-template-columns: 70mm 1fr; } .two-column .side { background:#F1F5F9; border-right:2px solid #475569; } .two-column h2 { color:#111; border-color:#475569; }
.executive header { background:#0F172A; color:#fff; padding:14mm 15mm 11mm; border-bottom:4px solid #C9A84C; } .executive header .title,.executive header .meta { color:#E5E7EB; letter-spacing:.14em; text-transform:uppercase; } .executive main { padding:11mm 16mm; font-family: Georgia, Times, serif; } .executive h2 { color:#0F172A; border-color:#C9A84C; }
.fresher { padding:10mm 12mm; } .fresher header { background:#EFF6FF; border:1px solid #60A5FA; padding:8mm; } .fresher main { padding:0; } .fresher h2 { display:inline-block; background:#60A5FA; color:#fff; border:0; padding:5px 10px; }
.compact { padding:9mm 11mm; } .compact main { padding:0; } .compact h1 { font-size:21px; } .compact h2 { font-size:10px; margin:10px 0 4px; border-bottom:1px solid #1E293B; color:#1E293B; } .compact p,.compact li,.compact .item-head { font-size:10.5px; line-height:1.35; }
.creative header { display:grid; grid-template-columns:45% 55%; min-height:38mm; background:linear-gradient(90deg,#D946EF 0 45%,#FAE8FF 45%); color:#fff; padding:10mm; } .creative .initial { font-size:54px; font-weight:900; } .creative header .title { color:#581C87; } .creative h2 { background:#D946EF; color:#fff; border:0; padding:6px 10px; }
.minimal { padding:18mm 24mm; font-family: Helvetica, Arial, sans-serif; } .minimal main { padding:0; } .minimal header { text-align:center; margin-bottom:14mm; } .minimal h1 { font-weight:300; letter-spacing:.18em; text-transform:uppercase; } .minimal h2 { color:#111; border-top:1px solid #bbb; border-bottom:0; padding-top:10px; margin-top:20px; }
.ats,.one-column { padding:13mm 17mm; font-family: Arial, Helvetica, sans-serif; } .ats main,.one-column main { padding:0; } .ats header { text-align:center; border-bottom:1px solid #111; padding-bottom:5mm; margin-bottom:5mm; } .ats h1 { font-size:22px; } .ats h2,.one-column h2 { color:#111; border-color:#111; letter-spacing:0; } .ats p,.ats li { color:#000; }
.cover { min-height:297mm; font-family: Arial, Helvetica, sans-serif; } .cover h1 { margin:0; } .cover .letter-body { white-space:pre-wrap; font-size:13px; line-height:1.62; } .signature { margin-top:18px; } .signature img { display:block; max-width:42mm; max-height:14mm; margin:7px 0 4px; } .sig-line { width:42mm; height:10mm; border-bottom:1px solid #777; }
.cover.professional header { background:#1E3A8A; color:#fff; padding:12mm 14mm; } .cover.professional main { display:grid; grid-template-columns:42mm 1fr; gap:10mm; padding:10mm 14mm; } .cover.professional aside { border-right:3px solid #EEF2FF; color:#526071; font-size:12px; }
.cover.modern { border-left:5mm solid #2563EB; } .cover.modern main { padding:13mm; } .cover.modern header { display:flex; justify-content:space-between; border-bottom:2px solid #DBEAFE; padding-bottom:8mm; margin-bottom:9mm; color:#2563EB; }
.cover.minimal main { padding:18mm 22mm; } .cover.minimal header { text-align:center; margin-bottom:14mm; } .cover.minimal header div { width:32mm; border-top:1px solid #777; margin:6mm auto 3mm; } .cover.minimal h1 { letter-spacing:.18em; text-transform:uppercase; font-weight:400; font-size:22px; }
.cover.executive header { background:#0F172A; color:#fff; padding:14mm; border-bottom:4px solid #C9A84C; font-family:Georgia,Times,serif; } .cover.executive main { padding:12mm 15mm; font-family:Georgia,Times,serif; } .cover.executive aside { float:right; width:50mm; background:#F1F5F9; padding:6mm; margin-left:8mm; font-size:12px; }
.cover.fresher main { padding:12mm; } .cover.fresher header { background:#EFF6FF; border:1px solid #60A5FA; padding:8mm; margin-bottom:8mm; } .cover.fresher .grid { display:grid; grid-template-columns:1fr 42mm; gap:8mm; } .cover.fresher aside { background:#EFF6FF; padding:5mm; font-size:12px; }
.cover.creative header { display:grid; grid-template-columns:42% 58%; min-height:38mm; } .cover.creative header div { background:#D946EF; color:#fff; padding:9mm; font-size:40px; font-weight:900; } .cover.creative header aside { background:#FAE8FF; color:#76507E; padding:13mm 9mm; font-size:12px; } .cover.creative main { padding:11mm 14mm; } .cover.creative .badge { display:inline-block; background:#D946EF; color:#fff; padding:6px 12px; margin-bottom:8mm; }
.cover.corporate { display:grid; grid-template-columns:50mm 1fr; } .cover.corporate aside { background:#E0E7FF; padding:12mm 7mm; color:#1E40AF; font-size:12px; } .cover.corporate main { padding:14mm; }
.cover.formal main { padding:18mm; font-family:'Times New Roman', Times, serif; } .cover.formal header { border-bottom:1px solid #000; margin-bottom:8mm; }
.cover.ats main { padding:14mm 17mm; } .cover.ats header { border-bottom:1px solid #111; padding-bottom:5mm; margin-bottom:7mm; } .cover.ats .letter-body { font-size:12.5px; line-height:1.55; }
`;

const base64ToBlob = (b64: string, mime: string): Blob => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const IMAGE_KEY = /(image|photo|avatar|logo|signature|url)$/i;

const cleanDataImageUrl = (value: string) => {
  const comma = value.indexOf(',');
  if (comma < 0) return value.trim();
  return `${value.slice(0, comma + 1)}${value.slice(comma + 1).replace(/\s/g, '')}`;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const compressDataImageUrl = async (value: string, key: string): Promise<string> => {
  if (!/^data:image\//i.test(value)) return value;
  const lowerKey = key.toLowerCase();
  const isSignature = lowerKey.includes('signature');
  const maxW = isSignature ? 420 : 512;
  const maxH = isSignature ? 140 : 512;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(value);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', isSignature ? 0.86 : 0.82));
      } catch {
        resolve(value);
      }
    };
    img.onerror = () => resolve(value);
    img.src = value;
  });
};

const shouldInlineImageUrl = (key: string, value: string) => {
  if (!IMAGE_KEY.test(key)) return false;
  if (value.startsWith('blob:')) return true;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url.pathname);
  } catch {
    return false;
  }
};

const prepareForEdge = async (value: unknown, key = ''): Promise<unknown> => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^data:image\//i.test(trimmed)) {
      return IMAGE_KEY.test(key) ? compressDataImageUrl(cleanDataImageUrl(trimmed), key) : cleanDataImageUrl(trimmed);
    }
    if (shouldInlineImageUrl(key, trimmed)) {
      try {
        const res = await fetch(trimmed);
        if (res.ok) return await compressDataImageUrl(await blobToDataUrl(await res.blob()), key);
      } catch { /* keep original if conversion fails */ }
    }
    return value;
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => prepareForEdge(item, key)));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([k, v]) => [k, await prepareForEdge(v, k)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
};

export const downloadDocument = async (params: {
  kind: DocKind;
  format: DocFormat;
  template: string;
  data: unknown;
  filename: string;
}): Promise<void> => {
  const { kind, format, template, data, filename } = params;

  // Resume PDF / DOCX → render the exact React preview offscreen and capture it.
  // Guarantees pixel-parity with what the user sees in the preview
  // (colors, sidebar layouts, typography, circular profile photo, etc.).
  if (kind === 'resume' && (format === 'pdf' || format === 'docx')) {
    const normalized = normalizeForCapture(data);
    const canvas = await captureResume(template, normalized as any);
    const blob = format === 'pdf' ? canvasToPdfBlob(canvas) : await canvasToDocxBlob(canvas);
    triggerDownload(blob, `${filename}.${format}`);
    return;
  }

  // Cover letter PDF / DOCX → same pipeline: render <CoverLetterRender />
  // offscreen and capture it, so the file matches the preview 1:1
  // (template layout, colors, fonts, signature, spacing, everything).
  if (kind === 'cover_letter' && (format === 'pdf' || format === 'docx')) {
    const canvas = await captureCoverLetter(template, data as any);
    const blob = format === 'pdf' ? canvasToPdfBlob(canvas) : await canvasToDocxBlob(canvas);
    triggerDownload(blob, `${filename}.${format}`);
    return;
  }


  // Cover letter or resume TXT → keep existing edge-function pipeline.
  const edgeData = await prepareForEdge(data);
  const { data: res, error } = await supabase.functions.invoke('generate-download', {
    body: { kind, format, template, data: edgeData },
  });
  if (error) {
    let detail = '';
    try {
      const ctx: any = (error as any).context;
      if (ctx?.text) detail = await ctx.text();
    } catch { /* ignore */ }
    throw new Error(detail || (error as any).message || 'Download failed');
  }
  if (!res?.file || !res?.mime) throw new Error(res?.error || 'Invalid response');
  const blob = base64ToBlob(res.file, res.mime);
  const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : 'txt';
  triggerDownload(blob, `${filename}.${ext}`);
};

export const copyPlainText = async (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { ta.remove(); }
};

export const downloadPlainText = (filename: string, text: string): void => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${filename}.txt`);
};

const printCanvasInPage = (canvas: HTMLCanvasElement, rootId: string, styleId: string, imgAlt: string) => {
  const cleanupExistingPrintNodes = () => {
    document.getElementById(rootId)?.remove();
    document.getElementById(styleId)?.remove();
  };
  cleanupExistingPrintNodes();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Print image creation failed')), 'image/png');
  }).then((blob) => {
    const objectUrl = URL.createObjectURL(blob);
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @page { size: A4; margin: 0; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body > *:not(#${rootId}) { display: none !important; }
        #${rootId} { display: block !important; position: static !important; width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: hidden !important; }
        #${rootId} img { display: block !important; width: 210mm !important; height: 297mm !important; margin: 0 !important; object-fit: fill !important; }
      }
    `;
    const root = document.createElement('div');
    root.id = rootId;
    root.style.display = 'none';
    const img = document.createElement('img');
    img.alt = imgAlt;
    img.src = objectUrl;
    root.appendChild(img);
    document.head.appendChild(style);
    document.body.appendChild(root);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      cleanupExistingPrintNodes();
      window.removeEventListener('afterprint', cleanup);
    };

    img.onload = () => {
      window.addEventListener('afterprint', cleanup, { once: true });
      window.focus();
      window.print();
      setTimeout(cleanup, 20000);
    };
    img.onerror = cleanup;
  });
};

export const printPlainText = (title: string, text: string, options?: { kind?: DocKind; template?: string; data?: unknown }): void => {
  // Resume print → render the real React preview offscreen so print matches
  // the preview exactly. Uses an in-page overlay (not a popup) to avoid
  // Android Chrome suspending the opener and leaving users stuck.
  if (options?.kind === 'resume') {
    const normalized = normalizeForCapture(options.data);
    void captureResume(options.template || 'Professional', normalized as any)
      .then((canvas) => printCanvasInPage(canvas, 'resume-print-root', 'resume-print-style', 'Resume'))
      .catch((e) => {
        console.error('Print render failed', e);
        toast.error('Resume print ready nahi ho paya. Please PDF download try kare.');
      });
    return;
  }

  // Cover letter print → same offscreen-capture pipeline so print matches the
  // preview 1:1 (template layout, colors, fonts, signature, spacing).
  if (options?.kind === 'cover_letter') {
    void captureCoverLetter(options.template || 'Professional', options.data as any)
      .then((canvas) => printCanvasInPage(canvas, 'cover-letter-print-root', 'cover-letter-print-style', 'Cover Letter'))
      .catch((e) => {
        console.error('Print render failed', e);
        toast.error('Cover letter print ready nahi ho paya. Please PDF download try kare.');
      });
    return;
  }

  // Plain-text fallback (e.g. TXT-style print with no template context).
  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
${printCss}
pre { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.55; white-space: pre-wrap; padding: 18mm 16mm; margin: 0; }
</style></head><body><div class="page"><pre>${escapeHtml(text)}</pre></div></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
};
