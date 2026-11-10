import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import {
  Document as DocxDocument,
  Packer as DocxPacker,
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
  ImageRun as DocxImageRun,
  AlignmentType as DocxAlignmentType,
  BorderStyle as DocxBorderStyle,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType as DocxWidthType,
  ShadingType as DocxShadingType,
  VerticalAlign as DocxVerticalAlign,
} from "https://esm.sh/docx@8.5.0";
import { CANONICAL_DOMAIN } from "../_shared/domain.ts";
import { templateStyle as docTemplateStyle } from "../_shared/templateStyle.ts";

// ---------------------------------------------------------------
// Safe image fetch: never crashes PDF generation on a bad image URL.
// Returns { bytes, mime } or null (fetch failure, timeout, or unsupported type).
// ---------------------------------------------------------------
async function safeFetchImageBytes(
  url?: string | null,
): Promise<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null> {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();
  const detect = (buf: Uint8Array): 'image/png' | 'image/jpeg' | null => {
    if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    return null;
  };
  // data: URL support (signatures, cropped photos are stored as data URLs client-side)
  if (/^data:image\//i.test(clean)) {
    try {
      const comma = clean.indexOf(',');
      if (comma < 0) return null;
      const meta = clean.slice(5, comma).toLowerCase();
      const payload = clean.slice(comma + 1).replace(/\s/g, '');
      let bytes: Uint8Array;
      if (meta.includes(';base64')) {
        const bin = atob(payload);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        bytes = new TextEncoder().encode(decodeURIComponent(payload));
      }
      const mimeFromMeta = meta.includes('png') ? 'image/png'
        : (meta.includes('jpeg') || meta.includes('jpg')) ? 'image/jpeg'
        : null;
      const mime = detect(bytes) || mimeFromMeta;
      if (!mime) return null;
      if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) return null;
      return { bytes, mime };
    } catch { return null; }
  }
  if (!/^https?:\/\//i.test(clean)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(clean, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const buf = new Uint8Array(await res.arrayBuffer());
    const magic = detect(buf);
    if (magic) return { bytes: buf, mime: magic };
    if (ct.includes('png') || ct.includes('jpeg') || ct.includes('jpg')) return null;
    return null;
  } catch (_e) {
    return null;
  }
}

type BrandAssets = {
  brand_name?: string | null;
  logo_url?: string | null;
  logo_dark_url?: string | null;
  favicon_url?: string | null;
};

type ResumeBrandingContext = {
  brandName: string;
  brandLogoUrl?: string;
  userFullName?: string;
  userPhotoUrl?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ COLOR PALETTE ============
const COLORS = {
  brand: { r: 139 / 255, g: 92 / 255, b: 246 / 255 },       // Purple #8B5CF6
  brandDark: { r: 109 / 255, g: 40 / 255, b: 217 / 255 },   // Dark Purple #6D28D9
  brandLight: { r: 167 / 255, g: 139 / 255, b: 250 / 255 }, // Light Purple #A78BFA
  success: { r: 22 / 255, g: 163 / 255, b: 74 / 255 },      // Green #16A34A
  danger: { r: 220 / 255, g: 38 / 255, b: 38 / 255 },       // Red #DC2626
  info: { r: 37 / 255, g: 99 / 255, b: 235 / 255 },         // Blue #2563EB
  teal: { r: 20 / 255, g: 184 / 255, b: 166 / 255 },        // Teal #14B8A6
  warning: { r: 234 / 255, g: 179 / 255, b: 8 / 255 },      // Yellow #EAB308
  muted: { r: 108 / 255, g: 117 / 255, b: 125 / 255 },      // Gray #6C757D
  dark: { r: 33 / 255, g: 37 / 255, b: 41 / 255 },          // Dark #212529
  light: { r: 248 / 255, g: 250 / 255, b: 252 / 255 },      // Light BG #F8FAFC
  stripe: { r: 243 / 255, g: 244 / 255, b: 246 / 255 },     // Table stripe #F3F4F6
  white: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 },
};

// Level badge colors for certificates
const LEVEL_COLORS: Record<string, { r: number; g: number; b: number }> = {
  Expert: { r: 147 / 255, g: 51 / 255, b: 234 / 255 },
  Advanced: { r: 59 / 255, g: 130 / 255, b: 246 / 255 },
  Intermediate: { r: 234 / 255, g: 179 / 255, b: 8 / 255 },
  Beginner: { r: 34 / 255, g: 197 / 255, b: 94 / 255 },
};

// Status colors for badges
const STATUS_COLORS: Record<string, { bg: { r: number; g: number; b: number }; text: { r: number; g: number; b: number } }> = {
  success: { bg: { r: 220 / 255, g: 252 / 255, b: 231 / 255 }, text: COLORS.success },
  completed: { bg: { r: 220 / 255, g: 252 / 255, b: 231 / 255 }, text: COLORS.success },
  approved: { bg: { r: 220 / 255, g: 252 / 255, b: 231 / 255 }, text: COLORS.success },
  hired: { bg: { r: 237 / 255, g: 233 / 255, b: 254 / 255 }, text: COLORS.brand },
  shortlisted: { bg: { r: 220 / 255, g: 252 / 255, b: 231 / 255 }, text: COLORS.success },
  pending: { bg: { r: 254 / 255, g: 249 / 255, b: 195 / 255 }, text: { r: 161 / 255, g: 98 / 255, b: 7 / 255 } },
  processing: { bg: { r: 254 / 255, g: 249 / 255, b: 195 / 255 }, text: { r: 161 / 255, g: 98 / 255, b: 7 / 255 } },
  applied: { bg: { r: 254 / 255, g: 249 / 255, b: 195 / 255 }, text: { r: 161 / 255, g: 98 / 255, b: 7 / 255 } },
  reviewed: { bg: { r: 255 / 255, g: 237 / 255, b: 213 / 255 }, text: { r: 194 / 255, g: 65 / 255, b: 12 / 255 } },
  failed: { bg: { r: 254 / 255, g: 226 / 255, b: 226 / 255 }, text: COLORS.danger },
  rejected: { bg: { r: 254 / 255, g: 226 / 255, b: 226 / 255 }, text: COLORS.danger },
};

interface DownloadRequest {
  type: 'pdf' | 'csv' | 'json';
  filename: string;
  data: Record<string, unknown> | unknown[];
  template?: string;
  config?: TemplateConfig;
}

interface ResumeData {
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    linkedin?: string;
    portfolio?: string;
    title?: string;
    website?: string;
  };
  summary: string;
  experience: Array<{
    id?: string;
    position: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{
    id?: string;
    degree: string;
    institution: string;
    year: string;
    grade?: string;
  }>;
  skills: string[];
  languages: string[];
  certifications: string[];
}

interface TemplateConfig {
  title?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  // Resume specific
  resumeTemplate?: string;
  resumeData?: ResumeData;
  // Wallet statement specific
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  totalCredits?: number;
  totalDebits?: number;
  currentBalance?: number;
  // Certificate specific
  certificateNumber?: string;
  skillName?: string;
  level?: string;
  score?: number;
  issuedAt?: string;
  expiresAt?: string;
  verificationUrl?: string;
  // Applicants specific
  jobTitle?: string;
  totalApplicants?: number;
  // Cover letter specific
  coverLetterContent?: string;
  coverLetterTemplate?: string;
  applicantName?: string;
  applicationDate?: string;
  // Summary boxes
  summaryBoxes?: Array<{
    label: string;
    value: string | number;
    color: 'green' | 'red' | 'blue' | 'purple' | 'gray';
  }>;
  // Table columns
  columns?: Array<{
    key: string;
    header: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
    colorize?: boolean;
  }>;
}

// ============================================================
// Resume + Cover Letter builders (merged from
// generate-resume-document and generate-cover-letter-document)
// ============================================================

type ResumeDocData = {
  personal?: {
    fullName?: string; professionalTitle?: string; email?: string; mobile?: string;
    location?: string; linkedin?: string; portfolio?: string; photoUrl?: string;
  };
  summary?: string;
  experiences?: Array<{ jobTitle?: string; company?: string; startDate?: string; endDate?: string; currentlyWorking?: boolean; responsibilities?: string; achievements?: string }>;
  education?: Array<{ course?: string; school?: string; startYear?: string; endYear?: string; grade?: string }>;
  skills?: Array<{ name?: string }>;
  languages?: Array<{ name?: string; proficiency?: string }>;
  certifications?: Array<{ name?: string; organization?: string }>;
};

function normalizeResumeDocData(input: any): ResumeDocData {
  if (!input || typeof input !== 'object') return {};
  if (input.personal || input.experiences) return input as ResumeDocData;

  const p = input.personalInfo || {};
  return {
    personal: {
      fullName: p.fullName,
      professionalTitle: p.title || p.professionalTitle,
      email: p.email,
      mobile: p.phone || p.mobile,
      location: p.address || p.location,
      linkedin: p.linkedin,
      portfolio: p.portfolio || p.website,
      photoUrl: p.photoUrl,
    },
    summary: input.summary,
    experiences: (input.experience || input.experiences || []).map((e: any) => ({
      jobTitle: e.jobTitle || e.position,
      company: e.company,
      startDate: e.startDate || e.duration,
      endDate: e.endDate,
      currentlyWorking: e.currentlyWorking,
      responsibilities: e.responsibilities || e.description,
      achievements: e.achievements,
    })),
    education: (input.education || []).map((ed: any) => ({
      course: ed.course || ed.degree,
      school: ed.school || ed.institution,
      startYear: ed.startYear || ed.year,
      endYear: ed.endYear,
      grade: ed.grade,
    })),
    skills: (input.skills || []).map((s: any) => typeof s === 'string' ? { name: s } : s),
    languages: (input.languages || []).map((l: any) => {
      if (typeof l !== 'string') return l;
      const match = l.match(/^(.*?)\s*\((.*?)\)$/);
      return { name: match?.[1] || l, proficiency: match?.[2] || '' };
    }),
    certifications: (input.certifications || []).map((c: any) => typeof c === 'string' ? { name: c } : c),
  };
}

type CoverDocData = {
  personal?: { fullName?: string; email?: string; mobile?: string; location?: string; linkedin?: string; portfolio?: string };
  employer?: { hiringManager?: string; designation?: string; companyName?: string; companyAddress?: string };
  job?: { title?: string; id?: string };
  opening?: { greeting?: string; customGreeting?: string };
  introduction?: { whyApplying?: string; whereFound?: string };
  experience?: { years?: string; currentTitle?: string; currentCompany?: string; relevant?: string };
  skills?: { skills?: string[]; certifications?: string; achievements?: string };
  whyCompany?: string;
  closing?: { availability?: string; thankYou?: string };
  signature?: { typedName?: string; digitalSignatureUrl?: string };
  bodyText?: string;
};

// ---------------------------------------------------------------
// Small shared PDF helpers
// ---------------------------------------------------------------
const wrapText = (text: string, size: number, font: any, maxWidth: number): string[] => {
  const words = (text || '').replace(/\s+/g, ' ').split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const cand = line ? line + ' ' + w : w;
    if (font.widthOfTextAtSize(cand, size) > maxWidth) {
      if (line) lines.push(line);
      line = w;
    } else line = cand;
  }
  if (line) lines.push(line);
  return lines;
};

async function embedSafeImage(doc: any, url?: string | null) {
  const got = await safeFetchImageBytes(url);
  if (!got) return null;
  try {
    return got.mime === 'image/png' ? await doc.embedPng(got.bytes) : await doc.embedJpg(got.bytes);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------
// RESUME PDF — layout-aware. Each templateStyle.resumeLayout gets
// its own distinct structure (sidebar / one-col / banner / etc).
// ---------------------------------------------------------------
async function buildResumePdf(data: ResumeDocData, template: string): Promise<Uint8Array> {
  data = normalizeResumeDocData(data);
  const style = docTemplateStyle(template);
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const isSerif = style.font === 'serif';
  const fontRegular = await doc.embedFont(isSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(isSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(isSerif ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique);
  const accent = rgb(style.accent[0], style.accent[1], style.accent[2]);
  const black = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);
  const white = rgb(1, 1, 1);
  const softAccent = style.secondaryHex
    ? rgb(parseInt(style.secondaryHex.slice(0, 2), 16) / 255, parseInt(style.secondaryHex.slice(2, 4), 16) / 255, parseInt(style.secondaryHex.slice(4, 6), 16) / 255)
    : rgb(0.96, 0.96, 0.97);
  const W = 595.28, H = 841.89;
  const p = data.personal || {};
  const name = (p.fullName || 'Your Name').trim();
  const title = (p.professionalTitle || '').trim();
  const photoImg = await embedSafeImage(doc, p.photoUrl);

  const drawSectionLabel = (
    x: number, y: number, label: string, width: number,
    variant: 'bar' | 'underline' | 'block' | 'plain' | 'chip',
    color = accent,
  ): number => {
    let yy = y;
    if (variant === 'block') {
      page.drawRectangle({ x, y: yy - 12, width, height: 16, color });
      page.drawText(label.toUpperCase(), { x: x + 6, y: yy - 9, size: 9, font: fontBold, color: white });
      yy -= 20;
    } else if (variant === 'chip') {
      const tw = fontBold.widthOfTextAtSize(label.toUpperCase(), 9);
      page.drawRectangle({ x, y: yy - 12, width: tw + 12, height: 14, color });
      page.drawText(label.toUpperCase(), { x: x + 6, y: yy - 9, size: 9, font: fontBold, color: white });
      yy -= 18;
    } else if (variant === 'bar') {
      page.drawRectangle({ x, y: yy - 2, width: 3, height: 10, color });
      page.drawText(label.toUpperCase(), { x: x + 8, y: yy, size: 10, font: fontBold, color });
      yy -= 14;
    } else if (variant === 'underline') {
      page.drawText(label.toUpperCase(), { x, y: yy, size: 10, font: fontBold, color });
      yy -= 3;
      page.drawLine({ start: { x, y: yy }, end: { x: x + width, y: yy }, thickness: 0.6, color });
      yy -= 10;
    } else {
      page.drawText(label.toUpperCase(), { x, y: yy, size: 10, font: fontBold, color });
      yy -= 12;
    }
    return yy;
  };

  const drawParagraph = (x: number, y: number, text: string, width: number, size: number, font: any, color = black, lineGap?: number): number => {
    const gap = lineGap ?? size + 3;
    for (const para of (text || '').split(/\n+/)) {
      for (const ln of wrapText(para, size, font, width)) {
        if (y < 40) return y;
        page.drawText(ln, { x, y, size, font, color });
        y -= gap;
      }
    }
    return y;
  };

  const contactLine = [p.mobile, p.email, p.location].filter(Boolean).join('  •  ');
  const linkLine = [p.linkedin, p.portfolio].filter(Boolean).join('  •  ');
  const layout = style.resumeLayout;

  // === Sidebar layouts (Professional, Two Column, Modern) ===
  if (layout === 'sidebar-left' || layout === 'sidebar-right') {
    const isProfessional = style.key === 'professional';
    const isTwoColumn = style.key === 'two-column';
    const sidebarW = isTwoColumn ? 210 : layout === 'sidebar-left' ? 190 : 180;
    const sidebarX = layout === 'sidebar-left' ? 0 : W - sidebarW;
    const mainX = layout === 'sidebar-left' ? sidebarW + 28 : 32;
    const mainW = W - sidebarW - 48;
    page.drawRectangle({ x: sidebarX, y: 0, width: sidebarW, height: H, color: isProfessional ? accent : softAccent });
    if (isTwoColumn) page.drawLine({ start: { x: sidebarW, y: 0 }, end: { x: sidebarW, y: H }, thickness: 0.8, color: accent });
    let sy = H - 36;
    if (photoImg) {
      const size = 90;
      const scale = size / Math.max(photoImg.width, photoImg.height);
      const w = photoImg.width * scale, h = photoImg.height * scale;
      page.drawImage(photoImg, { x: sidebarX + (sidebarW - w) / 2, y: sy - h, width: w, height: h });
      sy -= h + 14;
    }
    const sideText = isProfessional ? white : black;
    const sideAccent = isProfessional ? white : accent;
    const sideVariant: 'underline' | 'bar' = isProfessional ? 'underline' : 'bar';
    sy = drawSectionLabel(sidebarX + 16, sy, 'Contact', sidebarW - 32, sideVariant, sideAccent);
    for (const c of [p.mobile, p.email, p.location, p.linkedin, p.portfolio].filter(Boolean) as string[]) {
      sy = drawParagraph(sidebarX + 16, sy, c, sidebarW - 32, 8.5, fontRegular, sideText, 11);
      sy -= 2;
    }
    if (data.skills?.length) {
      sy -= 6;
      sy = drawSectionLabel(sidebarX + 16, sy, 'Skills', sidebarW - 32, sideVariant, sideAccent);
      for (const s of data.skills) {
        if (!s.name) continue;
        page.drawCircle({ x: sidebarX + 20, y: sy + 3, size: 1.5, color: sideAccent });
        page.drawText(s.name, { x: sidebarX + 26, y: sy, size: 9, font: fontRegular, color: sideText });
        sy -= 12;
      }
    }
    if (data.languages?.length) {
      sy -= 6;
      sy = drawSectionLabel(sidebarX + 16, sy, 'Languages', sidebarW - 32, sideVariant, sideAccent);
      for (const l of data.languages) {
        page.drawText(`${l.name || ''}${l.proficiency ? ' — ' + l.proficiency : ''}`, { x: sidebarX + 16, y: sy, size: 8.5, font: fontRegular, color: sideText });
        sy -= 11;
      }
    }
    if (data.certifications?.length) {
      sy -= 6;
      sy = drawSectionLabel(sidebarX + 16, sy, 'Certifications', sidebarW - 32, sideVariant, sideAccent);
      for (const c of data.certifications) {
        sy = drawParagraph(sidebarX + 16, sy, `• ${[c.name, c.organization].filter(Boolean).join(' — ')}`, sidebarW - 32, 8.5, fontRegular, sideText, 11);
        sy -= 2;
      }
    }
    let y = H - 36;
    if (isProfessional) {
      page.drawRectangle({ x: mainX - 12, y: H - 92, width: mainW + 12, height: 58, color: softAccent });
    }
    page.drawText(isTwoColumn ? name : name.toUpperCase(), { x: mainX, y, size: isTwoColumn ? 24 : 22, font: fontBold, color: black });
    y -= 20;
    if (title) { page.drawText(title, { x: mainX, y, size: 12, font: fontItalic, color: accent }); y -= 16; }
    page.drawLine({ start: { x: mainX, y }, end: { x: mainX + mainW, y }, thickness: isTwoColumn ? 0.6 : 1.2, color: isTwoColumn ? muted : accent });
    y -= 16;
    const mainVariant: 'bar' | 'underline' = isTwoColumn ? 'underline' : 'bar';
    if (data.summary) {
      y = drawSectionLabel(mainX, y, isTwoColumn ? 'Summary' : 'Profile', mainW, mainVariant, isTwoColumn ? black : accent);
      y = drawParagraph(mainX, y, data.summary, mainW, 10, fontRegular);
      y -= 8;
    }
    if (data.experiences?.length) {
      y = drawSectionLabel(mainX, y, 'Experience', mainW, mainVariant, isTwoColumn ? black : accent);
      for (const e of data.experiences) {
        if (y < 60) break;
        page.drawText([e.jobTitle, e.company].filter(Boolean).join(' — '), { x: mainX, y, size: 10.5, font: fontBold, color: black });
        const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
        if (dates.trim()) {
          const dw = fontItalic.widthOfTextAtSize(dates, 9);
          page.drawText(dates, { x: mainX + mainW - dw, y, size: 9, font: fontItalic, color: muted });
        }
        y -= 13;
        y = drawParagraph(mainX + 4, y, [e.responsibilities, e.achievements].filter(Boolean).join('\n'), mainW - 4, 9.5, fontRegular);
        y -= 5;
      }
    }
    if (data.education?.length) {
      y = drawSectionLabel(mainX, y, 'Education', mainW, mainVariant, isTwoColumn ? black : accent);
      for (const ed of data.education) {
        if (y < 40) break;
        page.drawText([ed.course, ed.school].filter(Boolean).join(' — '), { x: mainX, y, size: 10.5, font: fontBold, color: black });
        const yr = `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`;
        if (yr.trim()) {
          const yw = fontItalic.widthOfTextAtSize(yr, 9);
          page.drawText(yr, { x: mainX + mainW - yw, y, size: 9, font: fontItalic, color: muted });
        }
        y -= 13;
        if (ed.grade) y = drawParagraph(mainX + 4, y, ed.grade, mainW - 4, 9, fontRegular, muted);
        y -= 4;
      }
    }
    return await doc.save();
  }

  // === Banner-serif (Executive) ===
  if (layout === 'banner-serif') {
    const bandH = 110;
    page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: accent });
    page.drawLine({ start: { x: 0, y: H - bandH - 1.5 }, end: { x: W, y: H - bandH - 1.5 }, thickness: 1.2, color: rgb(0.79, 0.66, 0.38) });
    let y = H - 44;
    page.drawText(name, { x: 40, y, size: 26, font: fontBold, color: style.invertHeader ? white : black });
    y -= 22;
    if (title) { page.drawText(title.toUpperCase(), { x: 40, y, size: 10, font: fontRegular, color: style.invertHeader ? rgb(0.85, 0.85, 0.9) : muted }); y -= 16; }
    if (contactLine) { page.drawText(contactLine, { x: 40, y, size: 9, font: fontRegular, color: style.invertHeader ? rgb(0.9, 0.9, 0.95) : muted }); y -= 12; }
    y = H - bandH - 24;
    const M = 46, mw = W - M * 2;
    if (data.summary) { y = drawSectionLabel(M, y, 'Executive Summary', mw, 'underline'); y = drawParagraph(M, y, data.summary, mw, 10.5, fontRegular); y -= 8; }
    if (data.experiences?.length) {
      y = drawSectionLabel(M, y, 'Professional Experience', mw, 'underline');
      for (const e of data.experiences) {
        if (y < 60) break;
        page.drawText([e.jobTitle, e.company].filter(Boolean).join(' — '), { x: M, y, size: 11, font: fontBold, color: black });
        const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
        if (dates.trim()) { const dw = fontItalic.widthOfTextAtSize(dates, 9.5); page.drawText(dates, { x: M + mw - dw, y, size: 9.5, font: fontItalic, color: muted }); }
        y -= 14;
        y = drawParagraph(M, y, [e.responsibilities, e.achievements].filter(Boolean).join('\n'), mw, 10, fontRegular);
        y -= 5;
      }
    }
    if (data.education?.length) {
      y = drawSectionLabel(M, y, 'Education', mw, 'underline');
      for (const ed of data.education) {
        if (y < 40) break;
        page.drawText([ed.course, ed.school].filter(Boolean).join(' — '), { x: M, y, size: 10.5, font: fontBold, color: black });
        y -= 12;
        if (ed.grade) y = drawParagraph(M, y, ed.grade, mw, 9.5, fontItalic, muted);
        y -= 4;
      }
    }
    if (data.skills?.length && y > 60) {
      y = drawSectionLabel(M, y, 'Core Competencies', mw, 'underline');
      y = drawParagraph(M, y, data.skills.map((s) => s.name).filter(Boolean).join('   ·   '), mw, 10, fontRegular);
    }
    return await doc.save();
  }

  // === Fresher-cards ===
  if (layout === 'fresher-cards') {
    const M = 44, mw = W - M * 2;
    page.drawRectangle({ x: M, y: H - 130, width: mw, height: 100, color: softAccent, borderColor: accent, borderWidth: 0.8 });
    let textX = M + 20;
    if (photoImg) {
      const size = 74;
      const scale = size / Math.max(photoImg.width, photoImg.height);
      const w = photoImg.width * scale, h = photoImg.height * scale;
      page.drawImage(photoImg, { x: M + 16, y: H - 116, width: w, height: h });
      textX = M + 16 + w + 16;
    }
    let y = H - 60;
    page.drawText(name, { x: textX, y, size: 22, font: fontBold, color: accent });
    y -= 18;
    if (title) { page.drawText(title, { x: textX, y, size: 11, font: fontRegular, color: black }); y -= 14; }
    if (contactLine) { page.drawText(contactLine, { x: textX, y, size: 9, font: fontRegular, color: muted }); y -= 12; }
    y = H - 150;
    if (data.education?.length) {
      y = drawSectionLabel(M, y, 'Education', mw, 'chip');
      for (const ed of data.education) {
        if (y < 40) break;
        page.drawRectangle({ x: M, y: y - 32, width: mw, height: 36, color: softAccent });
        page.drawText([ed.course, ed.school].filter(Boolean).join(' — '), { x: M + 12, y: y - 8, size: 10.5, font: fontBold, color: black });
        const yr = `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`;
        page.drawText([yr, ed.grade].filter(Boolean).join('  •  '), { x: M + 12, y: y - 22, size: 9, font: fontRegular, color: muted });
        y -= 44;
      }
    }
    if (data.summary) { y = drawSectionLabel(M, y, 'About Me', mw, 'chip'); y = drawParagraph(M, y, data.summary, mw, 10, fontRegular); y -= 8; }
    if (data.skills?.length) {
      y = drawSectionLabel(M, y, 'Skills', mw, 'chip');
      let cx = M;
      for (const tag of data.skills.map((s) => s.name).filter(Boolean) as string[]) {
        const tw = fontRegular.widthOfTextAtSize(tag, 9) + 14;
        if (cx + tw > M + mw) { cx = M; y -= 18; }
        page.drawRectangle({ x: cx, y: y - 3, width: tw, height: 14, color: softAccent, borderColor: accent, borderWidth: 0.5 });
        page.drawText(tag, { x: cx + 7, y, size: 9, font: fontRegular, color: accent });
        cx += tw + 6;
      }
      y -= 22;
    }
    if (data.experiences?.length && y > 50) {
      y = drawSectionLabel(M, y, 'Experience', mw, 'chip');
      for (const e of data.experiences) {
        if (y < 40) break;
        page.drawText([e.jobTitle, e.company].filter(Boolean).join(' — '), { x: M, y, size: 10, font: fontBold, color: black });
        y -= 12;
        y = drawParagraph(M + 4, y, [e.responsibilities, e.achievements].filter(Boolean).join('\n'), mw - 4, 9.5, fontRegular);
        y -= 4;
      }
    }
    return await doc.save();
  }

  // === Compact-dense ===
  if (layout === 'compact-dense') {
    const M = 32, mw = W - M * 2;
    let y = H - M;
    page.drawText(name.toUpperCase(), { x: M, y, size: 16, font: fontBold, color: black });
    y -= 14;
    const meta = [title, contactLine, linkLine].filter(Boolean).join('  |  ');
    if (meta) { y = drawParagraph(M, y, meta, mw, 8.5, fontRegular, muted, 10); }
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: accent }); y -= 8;
    const smallSection = (label: string) => {
      page.drawText(label.toUpperCase(), { x: M, y, size: 8.5, font: fontBold, color: accent });
      y -= 3;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.3, color: muted });
      y -= 8;
    };
    if (data.summary) { smallSection('Summary'); y = drawParagraph(M, y, data.summary, mw, 8.5, fontRegular, black, 10); y -= 4; }
    if (data.experiences?.length) {
      smallSection('Experience');
      for (const e of data.experiences) {
        if (y < 30) break;
        const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
        page.drawText(`${e.jobTitle || ''} · ${e.company || ''}${dates.trim() ? '  (' + dates + ')' : ''}`, { x: M, y, size: 9, font: fontBold, color: black });
        y -= 11;
        y = drawParagraph(M + 4, y, [e.responsibilities, e.achievements].filter(Boolean).join(' '), mw - 4, 8.5, fontRegular, black, 10);
        y -= 3;
      }
    }
    if (data.education?.length) {
      smallSection('Education');
      for (const ed of data.education) {
        if (y < 24) break;
        const yr = `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`;
        page.drawText(`${ed.course || ''} · ${ed.school || ''}${yr.trim() ? '  (' + yr + ')' : ''}${ed.grade ? '  — ' + ed.grade : ''}`, { x: M, y, size: 8.5, font: fontRegular, color: black });
        y -= 11;
      }
    }
    if (data.skills?.length && y > 30) {
      smallSection('Skills');
      const colW = mw / 2;
      const skills = data.skills.map((s) => s.name).filter(Boolean) as string[];
      for (let i = 0; i < skills.length; i += 2) {
        if (y < 20) break;
        page.drawText(`• ${skills[i]}`, { x: M, y, size: 8.5, font: fontRegular, color: black });
        if (skills[i + 1]) page.drawText(`• ${skills[i + 1]}`, { x: M + colW, y, size: 8.5, font: fontRegular, color: black });
        y -= 11;
      }
    }
    if (data.languages?.length && y > 20) { smallSection('Languages'); y = drawParagraph(M, y, data.languages.map((l) => `${l.name} (${l.proficiency})`).join(' · '), mw, 8.5, fontRegular, black, 10); }
    if (data.certifications?.length && y > 20) { smallSection('Certifications'); y = drawParagraph(M, y, data.certifications.map((c) => [c.name, c.organization].filter(Boolean).join(' — ')).join(' · '), mw, 8.5, fontRegular, black, 10); }
    return await doc.save();
  }

  // === Creative-blocks ===
  if (layout === 'creative-blocks') {
    page.drawRectangle({ x: 0, y: H - 140, width: W * 0.55, height: 140, color: accent });
    page.drawRectangle({ x: W * 0.55, y: H - 140, width: W * 0.45, height: 140, color: softAccent });
    if (photoImg) {
      const size = 78;
      const scale = size / Math.max(photoImg.width, photoImg.height);
      const w = photoImg.width * scale, h = photoImg.height * scale;
      page.drawImage(photoImg, { x: 40, y: H - 40 - h, width: w, height: h });
      page.drawText(name.toUpperCase(), { x: 40 + w + 14, y: H - 70, size: 16, font: fontBold, color: white });
    } else {
      const initial = (name[0] || 'A').toUpperCase();
      page.drawText(initial, { x: 40, y: H - 100, size: 60, font: fontBold, color: white });
      page.drawText(name.toUpperCase(), { x: 40, y: H - 118, size: 14, font: fontBold, color: white });
    }
    if (title) page.drawText(title, { x: W * 0.55 + 20, y: H - 60, size: 12, font: fontBold, color: accent });
    let cy = H - 80;
    for (const c of [p.mobile, p.email, p.location, p.linkedin].filter(Boolean) as string[]) {
      page.drawText(c, { x: W * 0.55 + 20, y: cy, size: 9, font: fontRegular, color: black });
      cy -= 12;
    }
    let y = H - 160;
    const M = 40, mw = W - M * 2;
    const cSection = (label: string, color = accent) => {
      page.drawRectangle({ x: M, y: y - 12, width: mw, height: 18, color });
      page.drawText(label.toUpperCase(), { x: M + 10, y: y - 8, size: 10, font: fontBold, color: white });
      y -= 24;
    };
    if (data.summary) { cSection('About'); y = drawParagraph(M, y, data.summary, mw, 10, fontRegular); y -= 6; }
    if (data.experiences?.length) {
      cSection('Experience');
      for (const e of data.experiences) {
        if (y < 60) break;
        page.drawText([e.jobTitle, e.company].filter(Boolean).join(' @ '), { x: M, y, size: 11, font: fontBold, color: accent });
        y -= 13;
        y = drawParagraph(M, y, [e.responsibilities, e.achievements].filter(Boolean).join('\n'), mw, 9.5, fontRegular);
        y -= 5;
      }
    }
    if (data.skills?.length) {
      cSection('Skills', rgb(style.accent[0] * 0.85, style.accent[1] * 0.85, style.accent[2] * 0.85));
      let cx = M;
      for (const s of data.skills.map((x) => x.name).filter(Boolean) as string[]) {
        const tw = fontBold.widthOfTextAtSize(s, 9) + 14;
        if (cx + tw > M + mw) { cx = M; y -= 20; }
        page.drawRectangle({ x: cx, y: y - 4, width: tw, height: 16, color: softAccent });
        page.drawText(s, { x: cx + 7, y, size: 9, font: fontBold, color: accent });
        cx += tw + 6;
      }
      y -= 24;
    }
    if (data.education?.length && y > 40) {
      cSection('Education');
      for (const ed of data.education) {
        if (y < 30) break;
        page.drawText([ed.course, ed.school].filter(Boolean).join(' — '), { x: M, y, size: 10, font: fontBold, color: black });
        y -= 12;
      }
    }
    return await doc.save();
  }

  // === Minimal: centered header, generous whitespace, thin dividers ===
  if (style.key === 'minimal') {
    const M = 58, mw = W - M * 2;
    let y = H - 66;
    const nameW = fontBold.widthOfTextAtSize(name, 21);
    page.drawText(name, { x: (W - nameW) / 2, y, size: 21, font: fontBold, color: black });
    y -= 20;
    if (title) {
      const titleW = fontRegular.widthOfTextAtSize(title, 10.5);
      page.drawText(title, { x: (W - titleW) / 2, y, size: 10.5, font: fontRegular, color: muted });
      y -= 16;
    }
    const meta = [contactLine, linkLine].filter(Boolean).join('  ·  ');
    if (meta) {
      for (const ln of wrapText(meta, 8.5, fontRegular, mw)) {
        const lw = fontRegular.widthOfTextAtSize(ln, 8.5);
        page.drawText(ln, { x: (W - lw) / 2, y, size: 8.5, font: fontRegular, color: muted });
        y -= 12;
      }
    }
    y -= 12;
    const minSection = (label: string) => {
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.35, color: rgb(0.78, 0.78, 0.78) });
      y -= 13;
      page.drawText(label.toUpperCase(), { x: M, y, size: 8.5, font: fontBold, color: black });
      y -= 18;
    };
    if (data.summary) { minSection('Summary'); y = drawParagraph(M, y, data.summary, mw, 10, fontRegular); y -= 16; }
    if (data.experiences?.length) {
      minSection('Experience');
      for (const e of data.experiences) {
        if (y < 40) break;
        page.drawText([e.jobTitle, e.company].filter(Boolean).join(' — '), { x: M, y, size: 10.5, font: fontBold, color: black });
        const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
        if (dates.trim()) { const dw = fontRegular.widthOfTextAtSize(dates, 8.5); page.drawText(dates, { x: M + mw - dw, y, size: 8.5, font: fontRegular, color: muted }); }
        y -= 14;
        y = drawParagraph(M, y, [e.responsibilities, e.achievements].filter(Boolean).join('\n'), mw, 9.5, fontRegular);
        y -= 12;
      }
    }
    if (data.education?.length) {
      minSection('Education');
      for (const ed of data.education) {
        if (y < 30) break;
        page.drawText([ed.course, ed.school].filter(Boolean).join(' — '), { x: M, y, size: 10, font: fontBold, color: black });
        y -= 14;
        if (ed.grade) y = drawParagraph(M, y, ed.grade, mw, 9, fontRegular, muted);
        y -= 8;
      }
    }
    if (data.skills?.length && y > 40) { minSection('Skills'); y = drawParagraph(M, y, data.skills.map((s) => s.name).filter(Boolean).join('  ·  '), mw, 9.5, fontRegular); }
    return await doc.save();
  }

  // === One Column: ATS-friendly, readable full-width structure ===
  if (style.key === 'one-column') {
    const M = 42, mw = W - M * 2;
    let y = H - 46;
    page.drawText(name.toUpperCase(), { x: M, y, size: 19, font: fontBold, color: black });
    y -= 15;
    const meta = [title, contactLine, linkLine].filter(Boolean).join(' | ');
    if (meta) y = drawParagraph(M, y, meta, mw, 9, fontRegular, black, 11);
    y -= 5;
    const ocSection = (label: string) => {
      page.drawText(label.toUpperCase(), { x: M, y, size: 10, font: fontBold, color: black });
      y -= 4;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: black });
      y -= 11;
    };
    if (data.summary) { ocSection('Summary'); y = drawParagraph(M, y, data.summary, mw, 10, fontRegular); y -= 7; }
    if (data.experiences?.length) {
      ocSection('Experience');
      for (const e of data.experiences) {
        if (y < 40) break;
        const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
        page.drawText([e.jobTitle, e.company].filter(Boolean).join(' — '), { x: M, y, size: 10.5, font: fontBold, color: black });
        if (dates.trim()) { const dw = fontRegular.widthOfTextAtSize(dates, 9); page.drawText(dates, { x: M + mw - dw, y, size: 9, font: fontRegular, color: black }); }
        y -= 13;
        y = drawParagraph(M, y, [e.responsibilities, e.achievements].filter(Boolean).join('\n'), mw, 9.5, fontRegular);
        y -= 5;
      }
    }
    if (data.education?.length) {
      ocSection('Education');
      for (const ed of data.education) {
        if (y < 30) break;
        page.drawText([ed.course, ed.school].filter(Boolean).join(' — '), { x: M, y, size: 10, font: fontBold, color: black });
        y -= 12;
        if (ed.grade) y = drawParagraph(M, y, ed.grade, mw, 9, fontRegular);
        y -= 4;
      }
    }
    if (data.skills?.length && y > 30) { ocSection('Skills'); y = drawParagraph(M, y, data.skills.map((s) => s.name).filter(Boolean).join(', '), mw, 9.5, fontRegular); }
    if (data.languages?.length && y > 30) { ocSection('Languages'); y = drawParagraph(M, y, data.languages.map((l) => `${l.name}${l.proficiency ? ' (' + l.proficiency + ')' : ''}`).join(', '), mw, 9.5, fontRegular); }
    if (data.certifications?.length && y > 30) { ocSection('Certifications'); y = drawParagraph(M, y, data.certifications.map((c) => [c.name, c.organization].filter(Boolean).join(' — ')).join(', '), mw, 9.5, fontRegular); }
    return await doc.save();
  }

  // === Default: one-col-plain and one-col-underline ===
  const isUnderline = layout === 'one-col-underline';
  const M = 44, mw = W - M * 2;
  let y = H - M;
  page.drawText(isUnderline ? name : name.toUpperCase(), { x: M, y, size: 20, font: fontBold, color: black });
  y -= 18;
  if (title) { page.drawText(title, { x: M, y, size: 11, font: fontRegular, color: isUnderline ? accent : muted }); y -= 14; }
  if (contactLine) { page.drawText(contactLine, { x: M, y, size: 9, font: fontRegular, color: muted }); y -= 12; }
  if (linkLine) { page.drawText(linkLine, { x: M, y, size: 9, font: fontRegular, color: muted }); y -= 12; }
  if (isUnderline) { y -= 4; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: accent }); y -= 12; } else { y -= 8; }
  const sect = (label: string) => { y = drawSectionLabel(M, y, label, mw, isUnderline ? 'underline' : 'plain', isUnderline ? accent : black); };
  if (data.summary) { sect('Professional Summary'); y = drawParagraph(M, y, data.summary, mw, 10, fontRegular); y -= 6; }
  if (data.experiences?.length) {
    sect('Experience');
    for (const e of data.experiences) {
      if (y < 40) break;
      page.drawText([e.jobTitle, e.company].filter(Boolean).join(' — '), { x: M, y, size: 10.5, font: fontBold, color: black });
      const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
      if (dates.trim()) { const dw = fontItalic.widthOfTextAtSize(dates, 9); page.drawText(dates, { x: M + mw - dw, y, size: 9, font: fontItalic, color: muted }); }
      y -= 13;
      y = drawParagraph(M + 4, y, [e.responsibilities, e.achievements].filter(Boolean).join('\n'), mw - 4, 10, fontRegular);
      y -= 4;
    }
  }
  if (data.education?.length) {
    sect('Education');
    for (const ed of data.education) {
      if (y < 30) break;
      page.drawText([ed.course, ed.school].filter(Boolean).join(' — '), { x: M, y, size: 10.5, font: fontBold, color: black });
      const yr = `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`;
      if (yr.trim()) { const yw = fontItalic.widthOfTextAtSize(yr, 9); page.drawText(yr, { x: M + mw - yw, y, size: 9, font: fontItalic, color: muted }); }
      y -= 13;
      if (ed.grade) y = drawParagraph(M + 4, y, ed.grade, mw - 4, 9.5, fontRegular, muted);
      y -= 4;
    }
  }
  if (data.skills?.length) { sect('Skills'); y = drawParagraph(M, y, data.skills.map((s) => s.name).filter(Boolean).join(' • '), mw, 10, fontRegular); y -= 4; }
  if (data.languages?.length && y > 30) { sect('Languages'); y = drawParagraph(M, y, data.languages.map((l) => `${l.name} (${l.proficiency})`).join(' • '), mw, 10, fontRegular); }
  if (data.certifications?.length && y > 30) { sect('Certifications'); for (const c of data.certifications) { if (y < 20) break; y = drawParagraph(M, y, `• ${[c.name, c.organization].filter(Boolean).join(' — ')}`, mw, 10, fontRegular); } }
  return await doc.save();
}

async function buildResumeDocx(data: ResumeDocData, template: string): Promise<Uint8Array> {
  data = normalizeResumeDocData(data);
  const style = docTemplateStyle(template);
  const font = style.font === 'serif' ? 'Georgia' : style.key === 'ats-simple' || style.key === 'one-column' ? 'Arial' : style.key === 'creative' ? 'Trebuchet MS' : 'Calibri';
  const p = data.personal || {};
  const contact = [p.mobile, p.email, p.location].filter(Boolean).join('  •  ');
  const links = [p.linkedin, p.portfolio].filter(Boolean).join('  •  ');
  const name = p.fullName || 'Your Name';
  const soft = style.secondaryHex || 'F5F5F5';
  const dark = style.key === 'ats-simple' || style.key === 'one-column' || style.key === 'minimal' ? '111111' : style.accentHex;
  const plain = style.key === 'ats-simple' || style.key === 'one-column';
  const noBorders = { top: { style: 'none' as any, size: 0, color: 'FFFFFF' }, bottom: { style: 'none' as any, size: 0, color: 'FFFFFF' }, left: { style: 'none' as any, size: 0, color: 'FFFFFF' }, right: { style: 'none' as any, size: 0, color: 'FFFFFF' } };
  const pageWidth = 11906;
  const contentW = 10000;
  const run = (text: string, opts: any = {}) => new DocxTextRun({ text, font, ...opts });
  const para = (text = '', opts: any = {}, runOpts: any = {}) => new DocxParagraph({ ...opts, children: [run(text, runOpts)] });
  const splitParas = (text?: string, opts: any = {}, runOpts: any = {}) => (text || '').split(/\n+/).filter(Boolean).map((line) => para(line, opts, runOpts));
  const heading = (label: string, mode: 'bar' | 'underline' | 'block' | 'plain' | 'chip' = 'underline') => {
    if (mode === 'block') return new DocxParagraph({ spacing: { before: 220, after: 120 }, shading: { fill: style.accentHex, type: DocxShadingType.CLEAR }, children: [run(label.toUpperCase(), { bold: true, size: 20, color: 'FFFFFF' })] });
    if (mode === 'chip') return new DocxParagraph({ spacing: { before: 180, after: 100 }, children: [run(`  ${label.toUpperCase()}  `, { bold: true, size: 19, color: 'FFFFFF', shading: { fill: style.accentHex, type: DocxShadingType.CLEAR } as any })] });
    if (mode === 'bar') return new DocxParagraph({ spacing: { before: 220, after: 90 }, border: { left: { color: style.accentHex, size: 16, space: 6, style: DocxBorderStyle.SINGLE } }, children: [run(label.toUpperCase(), { bold: true, size: 21, color: style.accentHex })] });
    if (mode === 'plain') return new DocxParagraph({ spacing: { before: 170, after: 70 }, border: { bottom: { color: '111111', size: 4, space: 1, style: DocxBorderStyle.SINGLE } }, children: [run(label.toUpperCase(), { bold: true, size: 20, color: '111111' })] });
    return new DocxParagraph({ spacing: { before: 220, after: 90 }, border: { bottom: { color: dark, size: style.key === 'minimal' ? 2 : 6, space: 1, style: DocxBorderStyle.SINGLE } }, children: [run(label.toUpperCase(), { bold: true, size: style.key === 'minimal' ? 18 : 21, color: dark })] });
  };
  const experienceParas = (compact = false) => (data.experiences || []).flatMap((e) => {
    const title = [e.jobTitle, e.company].filter(Boolean).join(plain ? ' - ' : ' — ');
    const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
    return [
      new DocxParagraph({ spacing: { before: compact ? 60 : 90, after: 30 }, children: [run(title, { bold: true, size: compact ? 18 : 21, color: '111111' }), ...(dates.trim() ? [run(`   ${dates}`, { italics: !plain, size: compact ? 16 : 18, color: '666666' })] : [])] }),
      ...splitParas([e.responsibilities, e.achievements].filter(Boolean).join('\n'), { spacing: { after: compact ? 30 : 60 } }, { size: compact ? 17 : 20, color: '222222' }),
    ];
  });
  const educationParas = (compact = false) => (data.education || []).flatMap((ed) => {
    const yr = `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`;
    return [
      new DocxParagraph({ spacing: { before: compact ? 40 : 70, after: 20 }, children: [run([ed.course, ed.school].filter(Boolean).join(plain ? ', ' : ' — '), { bold: !plain, size: compact ? 17 : 20 }), ...(yr.trim() ? [run(`   ${yr}`, { italics: true, size: compact ? 16 : 18, color: '666666' })] : [])] }),
      ...(ed.grade ? [para(ed.grade, { spacing: { after: 40 } }, { size: compact ? 16 : 18, color: '555555' })] : []),
    ];
  });
  const skillText = data.skills?.map((s) => s.name).filter(Boolean).join(plain ? ', ' : '  •  ') || '';
  const langText = data.languages?.map((l) => `${l.name}${l.proficiency ? ' (' + l.proficiency + ')' : ''}`).filter(Boolean).join(plain ? ', ' : '  •  ') || '';
  const certText = data.certifications?.map((c) => [c.name, c.organization].filter(Boolean).join(' — ')).filter(Boolean).join(plain ? ', ' : '  •  ') || '';
  const mainSections = (order: string[], mode: 'bar' | 'underline' | 'block' | 'plain' | 'chip' = 'underline', compact = false) => {
    const out: any[] = [];
    for (const item of order) {
      if (item === 'summary' && data.summary) out.push(heading(style.key === 'executive' ? 'Executive Summary' : 'Professional Summary', mode), ...splitParas(data.summary, { spacing: { after: compact ? 60 : 90 } }, { size: compact ? 17 : 20 }));
      if (item === 'education' && data.education?.length) out.push(heading('Education', mode), ...educationParas(compact));
      if (item === 'experience' && data.experiences?.length) out.push(heading('Experience', mode), ...experienceParas(compact));
      if (item === 'skills' && skillText) out.push(heading('Skills', mode), para(skillText, { spacing: { after: compact ? 50 : 80 } }, { size: compact ? 17 : 20 }));
      if (item === 'languages' && langText) out.push(heading('Languages', mode), para(langText, { spacing: { after: 60 } }, { size: compact ? 17 : 19 }));
      if (item === 'certifications' && certText) out.push(heading('Certifications', mode), para(certText, { spacing: { after: 60 } }, { size: compact ? 17 : 19 }));
    }
    return out;
  };
  const sideChildren = (darkSide = false) => [
    heading('Contact', darkSide ? 'underline' : 'bar'),
    ...[p.mobile, p.email, p.location, p.linkedin, p.portfolio].filter(Boolean).map((x) => para(String(x), { spacing: { after: 80 } }, { size: 17, color: darkSide ? 'FFFFFF' : '111111' })),
    ...(skillText ? [heading('Skills', darkSide ? 'underline' : 'bar'), para(skillText.replace(/  •  /g, '\n'), { spacing: { after: 80 } }, { size: 17, color: darkSide ? 'FFFFFF' : '111111' })] : []),
    ...(langText ? [heading('Languages', darkSide ? 'underline' : 'bar'), para(langText, {}, { size: 17, color: darkSide ? 'FFFFFF' : '111111' })] : []),
  ];
  const cell = (children: any[], width: number, fill?: string, margins = { top: 220, bottom: 220, left: 220, right: 220 }) => new DocxTableCell({ width: { size: width, type: DocxWidthType.DXA }, shading: fill ? { fill, type: DocxShadingType.CLEAR } : undefined, verticalAlign: DocxVerticalAlign.TOP, margins, borders: noBorders, children: children.length ? children : [para()] });
  const table = (cells: any[], widths: number[]) => new DocxTable({ width: { size: widths.reduce((a, b) => a + b, 0), type: DocxWidthType.DXA }, columnWidths: widths, borders: noBorders, rows: [new DocxTableRow({ children: cells })] });

  let children: any[] = [];
  let margin = { top: 720, right: 720, bottom: 720, left: 720 };

  if (style.resumeLayout === 'sidebar-left' || style.resumeLayout === 'sidebar-right') {
    const isPro = style.key === 'professional';
    const sideFill = isPro ? style.accentHex : soft;
    const side = sideChildren(isPro);
    const main = [
      para(style.key === 'two-column' ? name : name.toUpperCase(), { spacing: { after: 70 } }, { bold: true, size: style.key === 'two-column' ? 42 : 38, color: '111111' }),
      ...(p.professionalTitle ? [para(p.professionalTitle, { spacing: { after: 140 } }, { italics: true, size: 22, color: style.accentHex })] : []),
      ...mainSections(['summary', 'experience', 'education', 'certifications'], style.key === 'two-column' ? 'underline' : 'bar'),
    ];
    const widths = style.key === 'two-column' ? [3400, 6600] : [3000, 7000];
    const cells = style.resumeLayout === 'sidebar-right' ? [cell(main, widths[1]), cell(side, widths[0], sideFill)] : [cell(side, widths[0], sideFill), cell(main, widths[1])];
    children = [table(cells, style.resumeLayout === 'sidebar-right' ? [widths[1], widths[0]] : widths)];
  } else if (style.resumeLayout === 'banner-serif') {
    margin = { top: 0, right: 760, bottom: 760, left: 760 };
    children = [
      new DocxTable({ width: { size: pageWidth, type: DocxWidthType.DXA }, columnWidths: [pageWidth], borders: noBorders, rows: [new DocxTableRow({ children: [cell([
        para(name, { spacing: { after: 100 } }, { bold: true, size: 48, color: 'FFFFFF' }),
        ...(p.professionalTitle ? [para(p.professionalTitle.toUpperCase(), {}, { size: 20, color: 'E5E7EB' })] : []),
        ...(contact ? [para(contact, { spacing: { before: 80 } }, { size: 17, color: 'E5E7EB' })] : []),
      ], pageWidth, style.accentHex, { top: 520, bottom: 420, left: 760, right: 760 })] })] }),
      ...mainSections(['summary', 'experience', 'education', 'skills'], 'underline'),
    ];
  } else if (style.resumeLayout === 'fresher-cards') {
    children = [
      new DocxTable({ width: { size: contentW, type: DocxWidthType.DXA }, columnWidths: [contentW], borders: { top: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE }, bottom: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE }, left: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE }, right: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE } }, rows: [new DocxTableRow({ children: [cell([para(name, { spacing: { after: 80 } }, { bold: true, size: 40, color: style.accentHex }), ...(p.professionalTitle ? [para(p.professionalTitle, {}, { size: 21 })] : []), ...(contact ? [para(contact, { spacing: { before: 60 } }, { size: 17, color: '555555' })] : [])], contentW, soft)] })] }),
      ...mainSections(['education', 'summary', 'skills', 'experience', 'certifications'], 'chip'),
    ];
  } else if (style.resumeLayout === 'compact-dense') {
    margin = { top: 520, right: 560, bottom: 520, left: 560 };
    children = [
      para(name.toUpperCase(), { spacing: { after: 40 } }, { bold: true, size: 30 }),
      para([p.professionalTitle, contact, links].filter(Boolean).join(' | '), { border: { bottom: { color: style.accentHex, size: 4, space: 1, style: DocxBorderStyle.SINGLE } }, spacing: { after: 60 } }, { size: 16, color: '555555' }),
      ...mainSections(['summary', 'experience', 'education', 'skills', 'languages', 'certifications'], 'plain', true),
    ];
  } else if (style.resumeLayout === 'creative-blocks') {
    children = [
      table([
        cell([para((name[0] || 'A').toUpperCase(), {}, { bold: true, size: 72, color: 'FFFFFF' }), para(name.toUpperCase(), {}, { bold: true, size: 26, color: 'FFFFFF' })], 4300, style.accentHex),
        cell([...(p.professionalTitle ? [para(p.professionalTitle, { spacing: { after: 90 } }, { bold: true, size: 24, color: style.accentHex })] : []), ...(contact ? [para(contact, {}, { size: 18 })] : []), ...(links ? [para(links, {}, { size: 18, color: '555555' })] : [])], 5700, soft),
      ], [4300, 5700]),
      ...mainSections(['summary', 'experience', 'skills', 'education', 'certifications'], 'block'),
    ];
  } else if (style.key === 'minimal') {
    margin = { top: 980, right: 1100, bottom: 900, left: 1100 };
    children = [
      para(name.toUpperCase(), { alignment: DocxAlignmentType.CENTER, spacing: { after: 80 } }, { bold: false, size: 36, characterSpacing: 30 }),
      ...(p.professionalTitle ? [para(p.professionalTitle, { alignment: DocxAlignmentType.CENTER, spacing: { after: 70 } }, { size: 20, color: '666666' })] : []),
      ...(contact ? [para(contact, { alignment: DocxAlignmentType.CENTER, border: { bottom: { color: '999999', size: 2, space: 8, style: DocxBorderStyle.SINGLE } }, spacing: { after: 280 } }, { size: 17, color: '777777' })] : []),
      ...mainSections(['summary', 'experience', 'education', 'skills'], 'underline'),
    ];
  } else if (style.key === 'one-column' || style.key === 'ats-simple') {
    children = [
      para(style.key === 'ats-simple' ? name : name.toUpperCase(), { alignment: style.key === 'ats-simple' ? DocxAlignmentType.CENTER : DocxAlignmentType.LEFT, spacing: { after: 50 } }, { bold: true, size: style.key === 'ats-simple' ? 32 : 36 }),
      ...(p.professionalTitle ? [para(p.professionalTitle, { alignment: style.key === 'ats-simple' ? DocxAlignmentType.CENTER : DocxAlignmentType.LEFT }, { size: 20 })] : []),
      ...(contact ? [para(contact, { alignment: style.key === 'ats-simple' ? DocxAlignmentType.CENTER : DocxAlignmentType.LEFT, border: { bottom: { color: '111111', size: 4, space: 8, style: DocxBorderStyle.SINGLE } }, spacing: { after: 120 } }, { size: 17 })] : []),
      ...mainSections(['summary', 'experience', 'education', 'skills', 'languages', 'certifications'], 'plain'),
    ];
  } else {
    children = [
      para(name, { spacing: { after: 50 } }, { bold: true, size: 40 }),
      ...(p.professionalTitle ? [para(p.professionalTitle, {}, { size: 21, color: style.accentHex })] : []),
      ...(contact ? [para(contact, { spacing: { after: 120 } }, { size: 18, color: '555555' })] : []),
      ...mainSections(['summary', 'experience', 'education', 'skills', 'languages', 'certifications'], 'underline'),
    ];
  }

  const doc = new DocxDocument({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin } }, children }] });
  const buf = await DocxPacker.toBuffer(doc);
  return new Uint8Array(buf);
}

function buildResumeTxt(data: ResumeDocData): string {
  data = normalizeResumeDocData(data);
  const p = data.personal || {};
  const lines: string[] = [];
  lines.push((p.fullName || 'Your Name').toUpperCase());
  if (p.professionalTitle) lines.push(p.professionalTitle);
  const contact = [p.mobile, p.email, p.location].filter(Boolean).join(' • ');
  if (contact) lines.push(contact);
  const links = [p.linkedin, p.portfolio].filter(Boolean).join(' • ');
  if (links) lines.push(links);
  lines.push('');
  if (data.summary) { lines.push('PROFESSIONAL SUMMARY'); lines.push(data.summary); lines.push(''); }
  if (data.experiences?.length) {
    lines.push('EXPERIENCE');
    for (const e of data.experiences) {
      const t = [e.jobTitle, e.company].filter(Boolean).join(' — ');
      const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
      lines.push(`${t}${dates.trim() ? '  (' + dates + ')' : ''}`);
      if (e.responsibilities) lines.push(e.responsibilities);
      if (e.achievements) lines.push(e.achievements);
      lines.push('');
    }
  }
  if (data.education?.length) {
    lines.push('EDUCATION');
    for (const ed of data.education) {
      const l = [ed.course, ed.school].filter(Boolean).join(' — ');
      const yr = `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`;
      lines.push(`${l}${yr.trim() ? '  (' + yr + ')' : ''}`);
      if (ed.grade) lines.push(ed.grade);
    }
    lines.push('');
  }
  if (data.skills?.length) { lines.push('SKILLS'); lines.push(data.skills.map((s) => s.name).filter(Boolean).join(' • ')); lines.push(''); }
  if (data.languages?.length) { lines.push('LANGUAGES'); lines.push(data.languages.map((l) => `${l.name} (${l.proficiency})`).join(' • ')); lines.push(''); }
  if (data.certifications?.length) {
    lines.push('CERTIFICATIONS');
    for (const c of data.certifications) lines.push(`• ${[c.name, c.organization].filter(Boolean).join(' — ')}`);
  }
  return lines.join('\n');
}

function buildCoverBodyText(d: CoverDocData): string {
  if (d.bodyText) return d.bodyText;
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const g = d.opening || {};
  const greeting = g.greeting === 'Custom'
    ? (g.customGreeting || 'Dear Hiring Manager')
    : g.greeting === 'Dear Mr./Ms. [Name]'
      ? (g.customGreeting ? `Dear ${g.customGreeting}` : 'Dear Hiring Manager')
      : (g.greeting || 'Dear Hiring Manager');
  const lines: string[] = [];
  lines.push(date, '');
  const emp = d.employer || {};
  if (emp.hiringManager) lines.push(emp.hiringManager);
  if (emp.designation) lines.push(emp.designation);
  if (emp.companyName) lines.push(emp.companyName);
  if (emp.companyAddress) lines.push(emp.companyAddress);
  lines.push('');
  if (d.job?.title) { lines.push(`Subject: Application for ${d.job.title}${d.job.id ? ' (Job ID: ' + d.job.id + ')' : ''}`); lines.push(''); }
  lines.push(`${greeting},`, '');
  const intro = [d.introduction?.whyApplying, d.introduction?.whereFound ? `I came across this opportunity through ${d.introduction?.whereFound}.` : ''].filter(Boolean).join(' ');
  if (intro) { lines.push(intro); lines.push(''); }
  const exp = [
    d.experience?.years ? `With ${d.experience?.years} of professional experience,` : '',
    (d.experience?.currentTitle || d.experience?.currentCompany) ? `currently serving as ${d.experience?.currentTitle}${d.experience?.currentCompany ? ' at ' + d.experience?.currentCompany : ''},` : '',
    d.experience?.relevant ? `I have ${d.experience?.relevant}.` : '',
  ].filter(Boolean).join(' ');
  if (exp) { lines.push(exp); lines.push(''); }
  if (d.skills?.skills?.length) lines.push(`My key skills include ${d.skills.skills.join(', ')}.`);
  if (d.skills?.certifications) lines.push(`Certifications: ${d.skills.certifications}.`);
  if (d.skills?.achievements) lines.push(`Notable achievements: ${d.skills.achievements}.`);
  if (d.skills?.skills?.length || d.skills?.certifications || d.skills?.achievements) lines.push('');
  if (d.whyCompany) { lines.push(d.whyCompany); lines.push(''); }
  if (d.closing?.availability) lines.push(`I am available to join ${d.closing.availability}.`);
  if (d.closing?.thankYou) lines.push(d.closing.thankYou);
  lines.push('', 'Sincerely,');
  lines.push(d.signature?.typedName || d.personal?.fullName || '');
  return lines.join('\n');
}

// ---------------------------------------------------------------
// COVER LETTER PDF — layout-aware, embeds signature image.
// ---------------------------------------------------------------
async function buildCoverPdf(d: CoverDocData, template: string): Promise<Uint8Array> {
  const style = docTemplateStyle(template);
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const isSerif = style.font === 'serif';
  const fontRegular = await doc.embedFont(isSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(isSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const accent = rgb(style.accent[0], style.accent[1], style.accent[2]);
  const black = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);
  const white = rgb(1, 1, 1);
  const softAccent = style.secondaryHex
    ? rgb(parseInt(style.secondaryHex.slice(0, 2), 16) / 255, parseInt(style.secondaryHex.slice(2, 4), 16) / 255, parseInt(style.secondaryHex.slice(4, 6), 16) / 255)
    : rgb(0.96, 0.96, 0.97);
  const W = 595.28, H = 841.89;
  const p = d.personal || {};
  const name = p.fullName || d.signature?.typedName || 'Your Name';
  const contact = [p.mobile, p.email, p.location].filter(Boolean).join('  •  ');
  const links = [p.linkedin, p.portfolio].filter(Boolean).join('  •  ');
  const signatureImg = await embedSafeImage(doc, d.signature?.digitalSignatureUrl);
  const layout = style.coverLayout;

  let M = 48, bodyStartY = H - 60;
  let contentX = M, contentW = W - M * 2;

  if (layout === 'header-band') {
    const bandH = 90;
    page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: accent });
    page.drawText(name, { x: M, y: H - 42, size: 22, font: fontBold, color: style.invertHeader ? white : black });
    if (contact) page.drawText(contact, { x: M, y: H - 62, size: 9, font: fontRegular, color: style.invertHeader ? rgb(0.9, 0.9, 0.95) : muted });
    if (links) page.drawText(links, { x: M, y: H - 76, size: 9, font: fontRegular, color: style.invertHeader ? rgb(0.9, 0.9, 0.95) : muted });
    bodyStartY = H - bandH - 22;
  } else if (layout === 'accent-left-bar') {
    page.drawRectangle({ x: 0, y: 0, width: 6, height: H, color: accent });
    M = 44;
    contentX = M;
    contentW = W - M - 30;
    page.drawText(name, { x: M, y: H - 50, size: 22, font: fontBold, color: black });
    if (contact) page.drawText(contact, { x: M, y: H - 70, size: 9, font: fontRegular, color: muted });
    if (links) page.drawText(links, { x: M, y: H - 84, size: 9, font: fontRegular, color: muted });
    bodyStartY = H - 110;
  } else if (layout === 'centered-hairline') {
    const nw = fontBold.widthOfTextAtSize(name, 22);
    page.drawText(name, { x: (W - nw) / 2, y: H - 60, size: 22, font: fontBold, color: black });
    if (contact) { const cw = fontRegular.widthOfTextAtSize(contact, 9); page.drawText(contact, { x: (W - cw) / 2, y: H - 78, size: 9, font: fontRegular, color: muted }); }
    if (links) { const lw = fontRegular.widthOfTextAtSize(links, 9); page.drawText(links, { x: (W - lw) / 2, y: H - 92, size: 9, font: fontRegular, color: muted }); }
    page.drawLine({ start: { x: W * 0.35, y: H - 104 }, end: { x: W * 0.65, y: H - 104 }, thickness: 0.4, color: accent });
    bodyStartY = H - 128;
  } else if (layout === 'banner-serif') {
    const bandH = 100;
    page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: accent });
    page.drawLine({ start: { x: 0, y: H - bandH - 1.5 }, end: { x: W, y: H - bandH - 1.5 }, thickness: 1.2, color: rgb(0.79, 0.66, 0.38) });
    page.drawText(name, { x: 40, y: H - 46, size: 26, font: fontBold, color: style.invertHeader ? white : black });
    if (contact) page.drawText(contact, { x: 40, y: H - 72, size: 9, font: fontRegular, color: style.invertHeader ? rgb(0.9, 0.9, 0.95) : muted });
    bodyStartY = H - bandH - 22;
  } else if (layout === 'fresher-card') {
    page.drawRectangle({ x: 40, y: H - 110, width: W - 80, height: 80, color: softAccent, borderColor: accent, borderWidth: 0.6 });
    page.drawText(name, { x: 60, y: H - 60, size: 20, font: fontBold, color: accent });
    if (contact) page.drawText(contact, { x: 60, y: H - 82, size: 9, font: fontRegular, color: black });
    if (links) page.drawText(links, { x: 60, y: H - 96, size: 9, font: fontRegular, color: muted });
    bodyStartY = H - 130;
  } else if (layout === 'creative-split') {
    page.drawRectangle({ x: 0, y: H - 100, width: W * 0.45, height: 100, color: accent });
    page.drawText(name.toUpperCase(), { x: 30, y: H - 55, size: 20, font: fontBold, color: white });
    page.drawText('Cover Letter', { x: 30, y: H - 78, size: 10, font: fontRegular, color: rgb(0.9, 0.9, 0.95) });
    if (contact) page.drawText(contact, { x: W * 0.45 + 20, y: H - 55, size: 9, font: fontRegular, color: black });
    if (links) page.drawText(links, { x: W * 0.45 + 20, y: H - 70, size: 9, font: fontRegular, color: muted });
    bodyStartY = H - 120;
  } else if (layout === 'sidebar-meta') {
    const colW = 150;
    page.drawRectangle({ x: 0, y: 0, width: colW, height: H, color: softAccent });
    let sy = H - 50;
    page.drawText(name, { x: 20, y: sy, size: 14, font: fontBold, color: accent });
    sy -= 24;
    page.drawText('DATE', { x: 20, y: sy, size: 8, font: fontBold, color: muted }); sy -= 12;
    page.drawText(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), { x: 20, y: sy, size: 9, font: fontRegular, color: black }); sy -= 18;
    for (const [label, val] of [['PHONE', p.mobile], ['EMAIL', p.email], ['LOCATION', p.location], ['LINKEDIN', p.linkedin], ['PORTFOLIO', p.portfolio]] as [string, string | undefined][]) {
      if (!val) continue;
      page.drawText(label, { x: 20, y: sy, size: 8, font: fontBold, color: muted }); sy -= 11;
      for (const ln of wrapText(val, 9, fontRegular, colW - 30)) { page.drawText(ln, { x: 20, y: sy, size: 9, font: fontRegular, color: black }); sy -= 11; }
      sy -= 6;
    }
    contentX = colW + 24;
    contentW = W - contentX - 40;
    bodyStartY = H - 50;
  } else if (layout === 'formal-serif') {
    page.drawText(name, { x: M, y: H - 60, size: 18, font: fontBold, color: black });
    if (contact) page.drawText(contact, { x: M, y: H - 76, size: 9.5, font: fontRegular, color: black });
    if (links) page.drawText(links, { x: M, y: H - 90, size: 9.5, font: fontRegular, color: black });
    page.drawLine({ start: { x: M, y: H - 100 }, end: { x: W - M, y: H - 100 }, thickness: 0.8, color: black });
    bodyStartY = H - 118;
  } else if (layout === 'simple-clean') {
    M = 54;
    contentX = M;
    contentW = W - M * 2;
    page.drawText(name, { x: M, y: H - 58, size: 20, font: fontBold, color: black });
    if (contact) page.drawText(contact, { x: M, y: H - 76, size: 9, font: fontRegular, color: muted });
    if (links) page.drawText(links, { x: M, y: H - 90, size: 9, font: fontRegular, color: muted });
    page.drawLine({ start: { x: M, y: H - 104 }, end: { x: W - M, y: H - 104 }, thickness: 0.5, color: muted });
    page.drawText(d.job?.title || 'Cover Letter', { x: M, y: H - 126, size: 11, font: fontBold, color: muted });
    bodyStartY = H - 154;
  } else {
    page.drawText(name, { x: M, y: H - 50, size: 18, font: fontBold, color: black });
    if (contact) page.drawText(contact, { x: M, y: H - 66, size: 9, font: fontRegular, color: muted });
    if (links) page.drawText(links, { x: M, y: H - 80, size: 9, font: fontRegular, color: muted });
    bodyStartY = H - 100;
  }

  let body = buildCoverBodyText(d);
  const typedName = (d.signature?.typedName || p.fullName || '').trim();
  body = body.replace(/\n+(Warm regards|Sincerely|Regards),\s*\n?.*$/i, '');

  const compact = body.length > 1600;
  const size = compact ? 9.5 : 10.5;
  const lineGap = compact ? 13 : 14.5;
  let y = bodyStartY;
  for (const para of body.split(/\n/)) {
    if (!para.trim()) { y -= lineGap * 0.6; continue; }
    const isSubject = para.startsWith('Subject:');
    const f = isSubject ? fontBold : fontRegular;
    for (const ln of wrapText(para, size, f, contentW)) {
      if (y < 140) break;
      page.drawText(ln, { x: contentX, y, size, font: f, color: black });
      y -= lineGap;
    }
  }

  y = Math.max(y, 130);
  y -= 8;
  page.drawText('Sincerely,', { x: contentX, y, size, font: fontBold, color: black });
  y -= 6;
  if (signatureImg) {
    const maxW = 160, maxH = 46;
    const scale = Math.min(maxW / signatureImg.width, maxH / signatureImg.height);
    const w = signatureImg.width * scale, h = signatureImg.height * scale;
    page.drawImage(signatureImg, { x: contentX, y: y - h, width: w, height: h });
    y -= h + 4;
  } else {
    y -= 30;
  }
  if (typedName) page.drawText(typedName, { x: contentX, y, size, font: fontBold, color: black });

  return await doc.save();
}

async function buildCoverDocx(d: CoverDocData, template: string): Promise<Uint8Array> {
  const style = docTemplateStyle(template);
  const font = style.font === 'serif' ? 'Georgia' : style.key === 'creative' ? 'Trebuchet MS' : 'Calibri';
  const p = d.personal || {};
  const name = p.fullName || d.signature?.typedName || 'Your Name';
  const noBorders = { top: { style: 'none' as any, size: 0, color: 'FFFFFF' }, bottom: { style: 'none' as any, size: 0, color: 'FFFFFF' }, left: { style: 'none' as any, size: 0, color: 'FFFFFF' }, right: { style: 'none' as any, size: 0, color: 'FFFFFF' } };
  const soft = style.secondaryHex || 'F5F5F5';
  const run = (text: string, opts: any = {}) => new DocxTextRun({ text, font, ...opts });
  const para = (text = '', opts: any = {}, runOpts: any = {}) => new DocxParagraph({ ...opts, children: [run(text, runOpts)] });
  const cell = (children: any[], width: number, fill?: string, margins = { top: 220, bottom: 220, left: 220, right: 220 }) => new DocxTableCell({ width: { size: width, type: DocxWidthType.DXA }, shading: fill ? { fill, type: DocxShadingType.CLEAR } : undefined, verticalAlign: DocxVerticalAlign.TOP, margins, borders: noBorders, children: children.length ? children : [para()] });
  const table = (cells: any[], widths: number[]) => new DocxTable({ width: { size: widths.reduce((a, b) => a + b, 0), type: DocxWidthType.DXA }, columnWidths: widths, borders: noBorders, rows: [new DocxTableRow({ children: cells })] });
  const contact = [p.mobile, p.email, p.location].filter(Boolean).join('  •  ');
  const links = [p.linkedin, p.portfolio].filter(Boolean).join('  •  ');
  let body = buildCoverBodyText(d);
  body = body.replace(/\n+(Warm regards|Sincerely|Regards),\s*\n?.*$/i, '');
  const bodyParas = body.split(/\n/).map((line) => new DocxParagraph({
    spacing: { after: line.trim() ? 90 : 130 },
    children: [run(line, { size: style.key === 'formal' ? 23 : 22, bold: line.startsWith('Subject:'), color: line.startsWith('Subject:') ? style.accentHex : '111111' })],
  }));
  const typedName = (d.signature?.typedName || p.fullName || '').trim();
  const signatureChildren: any[] = [para('Sincerely,', { spacing: { before: 160, after: 80 } }, { size: 22, bold: true })];
  const sig = await safeFetchImageBytes(d.signature?.digitalSignatureUrl);
  if (sig) {
    try {
      signatureChildren.push(new DocxParagraph({ spacing: { before: 30, after: 50 }, children: [new DocxImageRun({ type: sig.mime === 'image/png' ? 'png' : 'jpg', data: sig.bytes, transformation: { width: 160, height: 46 } } as any)] }));
    } catch { /* ignore */ }
  } else {
    signatureChildren.push(new DocxParagraph({ spacing: { after: 50 }, border: { bottom: { color: '777777', size: 4, space: 1, style: DocxBorderStyle.SINGLE } }, children: [run(' ', { size: 22 })] }));
  }
  if (typedName) signatureChildren.push(para(typedName, {}, { size: 22, bold: true }));
  const letter = [...bodyParas, ...signatureChildren];
  const meta = [
    para('TO', { spacing: { after: 60 } }, { size: 16, bold: true, color: style.accentHex }),
    para(d.employer?.hiringManager || 'Hiring Manager', { spacing: { after: 40 } }, { size: 18 }),
    para(d.employer?.companyName || 'Company Name', { spacing: { after: 180 } }, { size: 18 }),
    para('ROLE', { spacing: { after: 60 } }, { size: 16, bold: true, color: style.accentHex }),
    para(d.job?.title || 'Cover Letter', {}, { size: 18 }),
  ];

  let children: any[] = [];
  let margin = { top: 900, right: 900, bottom: 900, left: 900 };

  if (style.coverLayout === 'header-band') {
    margin = { top: 0, right: 820, bottom: 820, left: 820 };
    children = [
      new DocxTable({ width: { size: 11906, type: DocxWidthType.DXA }, columnWidths: [11906], borders: noBorders, rows: [new DocxTableRow({ children: [cell([
        para(name, { spacing: { after: 90 } }, { bold: true, size: 44, color: 'FFFFFF' }),
        ...(contact ? [para(contact, {}, { size: 18, color: 'E5E7EB' })] : []),
        ...(links ? [para(links, {}, { size: 18, color: 'E5E7EB' })] : []),
      ], 11906, style.accentHex, { top: 520, bottom: 420, left: 820, right: 820 })] })] }),
      table([cell(meta, 2600), cell(letter, 7400)], [2600, 7400]),
    ];
  } else if (style.coverLayout === 'accent-left-bar') {
    children = [table([
      cell([], 260, style.accentHex, { top: 0, bottom: 0, left: 0, right: 0 }),
      cell([para(name, { spacing: { after: 60 } }, { bold: true, size: 44, color: style.accentHex }), para(d.job?.title || 'Cover Letter', { spacing: { after: 90 } }, { bold: true, size: 22 }), ...(contact ? [para(contact, { border: { bottom: { color: soft, size: 12, space: 8, style: DocxBorderStyle.SINGLE } }, spacing: { after: 240 } }, { size: 18, color: '555555' })] : []), ...letter], 9740),
    ], [260, 9740])];
  } else if (style.coverLayout === 'centered-hairline') {
    margin = { top: 1100, right: 1100, bottom: 900, left: 1100 };
    children = [para(name.toUpperCase(), { alignment: DocxAlignmentType.CENTER, spacing: { after: 110 } }, { size: 34, characterSpacing: 30 }), ...(contact ? [para(contact, { alignment: DocxAlignmentType.CENTER, border: { bottom: { color: style.accentHex, size: 3, space: 10, style: DocxBorderStyle.SINGLE } }, spacing: { after: 300 } }, { size: 17, color: '666666' })] : []), ...letter.map((x) => x)];
  } else if (style.coverLayout === 'banner-serif') {
    margin = { top: 0, right: 820, bottom: 820, left: 820 };
    children = [
      new DocxTable({ width: { size: 11906, type: DocxWidthType.DXA }, columnWidths: [11906], borders: noBorders, rows: [new DocxTableRow({ children: [cell([para(name, { spacing: { after: 120 } }, { bold: true, size: 50, color: style.invertHeader ? 'FFFFFF' : '111111' }), para((d.job?.title || 'Cover Letter').toUpperCase(), {}, { size: 19, color: style.invertHeader ? 'E5E7EB' : '555555', characterSpacing: 20 })], 11906, style.accentHex, { top: 560, bottom: 460, left: 820, right: 820 })] })] }),
      table([cell([para('CONTACT', { spacing: { after: 70 } }, { bold: true, size: 17 }), para(contact, {}, { size: 17, color: '555555' }), ...(links ? [para(links, {}, { size: 17, color: '555555' })] : [])], 3000, soft), cell(letter, 7000)], [3000, 7000]),
    ];
  } else if (style.coverLayout === 'fresher-card') {
    children = [
      new DocxTable({ width: { size: 10000, type: DocxWidthType.DXA }, columnWidths: [10000], borders: { top: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE }, bottom: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE }, left: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE }, right: { color: style.accentHex, size: 6, style: DocxBorderStyle.SINGLE } }, rows: [new DocxTableRow({ children: [cell([para(name, { spacing: { after: 70 } }, { bold: true, size: 42, color: style.accentHex }), ...(contact ? [para(contact, {}, { size: 18 })] : [])], 10000, soft)] })] }),
      table([cell(letter, 7000), cell([para('FIRST-JOB FOCUS', { spacing: { after: 70 } }, { bold: true, size: 17, color: style.accentHex }), para('Education, enthusiasm and potential.', { spacing: { after: 180 } }, { size: 17, color: '555555' }), para('APPLYING FOR', { spacing: { after: 70 } }, { bold: true, size: 17, color: style.accentHex }), para(d.job?.title || 'Cover Letter', {}, { size: 17 })], 3000, soft)], [7000, 3000]),
    ];
  } else if (style.coverLayout === 'creative-split') {
    margin = { top: 720, right: 720, bottom: 720, left: 720 };
    children = [table([
      cell([para((name[0] || 'Y').toUpperCase(), {}, { bold: true, size: 76, color: 'FFFFFF' }), para(name, {}, { bold: true, size: 32, color: 'FFFFFF' })], 4200, style.accentHex),
      cell([para(contact, { spacing: { after: 70 } }, { size: 18, color: '555555' }), ...(links ? [para(links, {}, { size: 18, color: '555555' })] : [])], 5800, soft),
    ], [4200, 5800]), para(`  ${(d.job?.title || 'Cover Letter').toUpperCase()}  `, { spacing: { before: 250, after: 180 } }, { bold: true, size: 20, color: 'FFFFFF', shading: { fill: style.accentHex, type: DocxShadingType.CLEAR } as any }), ...letter];
  } else if (style.coverLayout === 'sidebar-meta') {
    margin = { top: 720, right: 720, bottom: 720, left: 720 };
    children = [table([
      cell([para(name, { spacing: { after: 220 } }, { bold: true, size: 28, color: style.accentHex }), para('DATE', { spacing: { after: 60 } }, { bold: true, size: 16, color: '666666' }), para(new Date().toLocaleDateString('en-IN'), { spacing: { after: 180 } }, { size: 17 }), para(contact, {}, { size: 17 })], 3200, soft),
      cell([para(d.job?.title || 'Cover Letter', { spacing: { after: 220 } }, { bold: true, size: 34, color: style.accentHex }), ...letter], 6800),
    ], [3200, 6800])];
  } else if (style.coverLayout === 'formal-serif') {
    margin = { top: 980, right: 980, bottom: 900, left: 980 };
    children = [para(name, { spacing: { after: 60 } }, { bold: true, size: 34 }), ...(contact ? [para(contact, { border: { bottom: { color: '000000', size: 4, space: 8, style: DocxBorderStyle.SINGLE } }, spacing: { after: 260 } }, { size: 18 })] : []), ...letter];
  } else if (style.coverLayout === 'simple-clean') {
    margin = { top: 980, right: 1040, bottom: 900, left: 1040 };
    children = [
      para(name, { spacing: { after: 55 } }, { bold: true, size: 36, color: '111111' }),
      ...(contact ? [para(contact, { spacing: { after: 70 } }, { size: 17, color: '555555' })] : []),
      para(d.job?.title || 'Cover Letter', { border: { top: { color: '777777', size: 3, space: 8, style: DocxBorderStyle.SINGLE } }, spacing: { before: 30, after: 220 } }, { bold: true, size: 18, color: '555555' }),
      ...letter,
    ];
  } else {
    children = [para(name, { spacing: { after: 60 } }, { bold: true, size: 36 }), ...(contact ? [para(contact, { border: { bottom: { color: '111111', size: 4, space: 8, style: DocxBorderStyle.SINGLE } }, spacing: { after: 200 } }, { size: 18 })] : []), ...letter];
  }

  const doc = new DocxDocument({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin } }, children }] });
  const buf = await DocxPacker.toBuffer(doc);
  return new Uint8Array(buf);
}

const bytesToB64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

async function handleDocDownload(reqBody: any): Promise<Response> {
  const kind = reqBody?.kind as 'resume' | 'cover_letter';
  const format = String(reqBody?.format || '').toLowerCase();
  const template = String(reqBody?.template || 'Professional');
  const data = reqBody?.data || {};
  if (!['pdf', 'docx', 'txt'].includes(format)) {
    return new Response(JSON.stringify({ error: 'Invalid format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (format === 'txt') {
    const text = kind === 'resume' ? buildResumeTxt(data) : buildCoverBodyText(data);
    return new Response(JSON.stringify({ file: btoa(unescape(encodeURIComponent(text))), mime: 'text/plain; charset=utf-8' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const bytes = kind === 'resume'
    ? (format === 'pdf' ? await buildResumePdf(data, template) : await buildResumeDocx(data, template))
    : (format === 'pdf' ? await buildCoverPdf(data, template) : await buildCoverDocx(data, template));
  return new Response(JSON.stringify({
    file: bytesToB64(bytes),
    mime: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Peek the JSON body once so we can route resume / cover-letter requests
  // (merged from the old generate-resume-document and
  // generate-cover-letter-document functions) without auth overhead.
  let rawBody: any = {};
  try { rawBody = await req.json(); } catch { rawBody = {}; }

  try {
    if (rawBody?.kind === 'resume' || rawBody?.kind === 'cover_letter') {
      return await handleDocDownload(rawBody);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, filename, data, template, config }: DownloadRequest = rawBody;

    const needsResumeBranding = type === 'pdf' && (template?.startsWith('resume') || template === 'resume');
    const resumeBranding = needsResumeBranding
      ? await getResumeBrandingContext(supabaseClient, user.id)
      : undefined;

    if (!type || !filename) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, filename' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let fileContent: string | Uint8Array;
    let contentType: string;
    let fileExtension: string;

    switch (type) {
      case 'csv':
        fileContent = generateEnhancedCSV(data || [], config);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
      case 'json':
        fileContent = generateEnhancedJSON(data || {}, config);
        contentType = 'application/json';
        fileExtension = 'json';
        break;
      case 'pdf':
        fileContent = await generateAdvancedPDF(data || {}, template, config, resumeBranding);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid file type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const timestamp = Date.now();
    const uniqueFilename = `${user.id}/${timestamp}-${filename}.${fileExtension}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('temp-downloads')
      .upload(uniqueFilename, fileContent, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('temp-downloads')
      .createSignedUrl(uniqueFilename, 300);

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError);
      await supabaseClient.storage.from('temp-downloads').remove([uniqueFilename]);
      return new Response(
        JSON.stringify({ error: 'Failed to create download link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deleteFile = async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      try {
        await supabaseClient.storage.from('temp-downloads').remove([uniqueFilename]);
        console.log(`Deleted temporary file: ${uniqueFilename}`);
      } catch (e) {
        console.error(`Failed to delete file ${uniqueFilename}:`, e);
      }
    };

    deleteFile();

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: signedUrlData.signedUrl,
        filename: `${filename}.${fileExtension}`,
        expiresIn: 300,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-download:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getResumeBrandingContext(
  supabaseClient: any,
  userId: string
): Promise<ResumeBrandingContext> {
  let brand: BrandAssets | null = null;
  try {
    const { data } = await supabaseClient.rpc('get_brand_assets');
    brand = (data as unknown as BrandAssets) || null;
  } catch {
    // ignore
  }

  let profile: { full_name?: string | null; profile_image_url?: string | null } | null = null;
  try {
    const { data } = await supabaseClient
      .from('profiles')
      .select('full_name, profile_image_url')
      .eq('user_id', userId)
      .maybeSingle();
    profile = (data as any) || null;
  } catch {
    // ignore
  }

  const brandName = brand?.brand_name || 'Workly India';
  const brandLogoUrl = brand?.logo_url || brand?.logo_dark_url || brand?.favicon_url || undefined;

  return {
    brandName,
    brandLogoUrl,
    userFullName: profile?.full_name || undefined,
    userPhotoUrl: profile?.profile_image_url || undefined,
  };
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  // Delegates to safeFetchImageBytes so data: URLs (photos/signatures stored
  // as base64 by the client) and non-PNG/JPEG remote images no longer crash
  // the PDF pipeline via embedPng/embedJpg.
  const got = await safeFetchImageBytes(url);
  if (!got) return null;
  return { bytes: got.bytes, contentType: got.mime };
}

// ============ ENHANCED CSV GENERATION ============
function generateEnhancedCSV(data: Record<string, unknown> | unknown[], config?: TemplateConfig): string {
  const BOM = '\uFEFF';
  const rows: string[] = [];

  if (config) {
    rows.push('WORKLY INDIA');
    rows.push(config.title || 'Data Export');
    rows.push(`Generated: ${formatDate(new Date())}`);
    rows.push('');

    if (config.summaryBoxes && config.summaryBoxes.length > 0) {
      rows.push('=== SUMMARY ===');
      config.summaryBoxes.forEach(box => {
        rows.push(`${box.label}:,${box.value}`);
      });
      rows.push('');
    }

    rows.push('=== DATA ===');
  }

  if (!Array.isArray(data)) {
    data = [data];
  }

  if (data.length === 0) {
    return BOM + rows.join('\n');
  }

  let headers: string[];
  if (config?.columns) {
    headers = config.columns.map(col => col.header);
  } else {
    const allKeys = new Set<string>();
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item as object).forEach(key => allKeys.add(key));
      }
    });
    headers = Array.from(allKeys);
  }

  rows.push(headers.map(h => escapeCSVValue(h)).join(','));

  data.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      const row = config?.columns
        ? config.columns.map(col => {
            const value = (item as Record<string, unknown>)[col.key];
            return escapeCSVValue(value);
          })
        : headers.map(header => {
            const value = (item as Record<string, unknown>)[header];
            return escapeCSVValue(value);
          });
      rows.push(row.join(','));
    }
  });

  return BOM + rows.join('\n');
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = typeof value === 'object' 
    ? JSON.stringify(value) 
    : String(value);
  
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

// ============ ENHANCED JSON GENERATION ============
function generateEnhancedJSON(data: Record<string, unknown> | unknown[], config?: TemplateConfig): string {
  const output = {
    meta: {
      generator: 'Workly India',
      title: config?.title || 'Data Export',
      generatedAt: new Date().toISOString(),
      totalRecords: Array.isArray(data) ? data.length : 1,
    },
    summary: config?.summaryBoxes?.reduce((acc, box) => {
      acc[box.label.toLowerCase().replace(/\s+/g, '_')] = box.value;
      return acc;
    }, {} as Record<string, unknown>) || {},
    data: data,
  };

  return JSON.stringify(output, null, 2);
}

// ============ ADVANCED PDF GENERATION ============
async function generateAdvancedPDF(
  data: Record<string, unknown> | unknown[],
  template?: string,
  config?: TemplateConfig,
  resumeBranding?: ResumeBrandingContext
): Promise<Uint8Array> {
  if (template === 'resume' || template?.startsWith('resume')) {
    const resumeTemplate = config?.resumeTemplate || template?.replace(/^resume-/, '') || 'Professional';
    return await buildResumePdf((config?.resumeData || data) as any, resumeTemplate);
  }

  if (template === 'cover-letter') {
    const coverTemplate = config?.coverLetterTemplate || 'Professional';
    return await buildCoverPdf({
      bodyText: config?.coverLetterContent || '',
      personal: { fullName: config?.applicantName || '' },
      signature: { typedName: config?.applicantName || '' },
    }, coverTemplate);
  }

  const isLandscape = config?.orientation === 'landscape' || template === 'certificate';
  
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;
  const margin = 40;
  
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;
  
  const ensureSpace = (neededHeight: number) => {
    if (yPosition - neededHeight < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
      drawBrandHeader(page, helveticaBold, helvetica, pageWidth, config?.title || 'Workly India', true);
      yPosition -= 50;
    }
  };

  // Route to appropriate template
  switch (template) {
    case 'resume':
    case 'resume-professional':
    case 'resume-creative':
    case 'resume-minimalist':
      await drawResumePDF(pdfDoc, page, helvetica, helveticaBold, pageWidth, pageHeight, margin, config, resumeBranding);
      break;
    case 'certificate':
      await drawCertificate(page, helvetica, helveticaBold, pageWidth, pageHeight, config);
      break;
    case 'cover-letter':
      await drawCoverLetterPDF(pdfDoc, page, helvetica, helveticaBold, pageWidth, pageHeight, margin, config);
      break;
    case 'wallet-statement':
    case 'wallet-history':
      yPosition = drawBrandHeader(page, helveticaBold, helvetica, pageWidth, config?.title || 'Points Wallet Statement');
      yPosition = drawUserInfoBox(page, helvetica, helveticaBold, yPosition, margin, pageWidth, config);
      yPosition = drawSummaryBoxes(page, helvetica, helveticaBold, yPosition, margin, config);
      yPosition = drawStyledTable(page, pdfDoc, helvetica, helveticaBold, yPosition, margin, pageWidth, pageHeight, data, config, ensureSpace);
      break;
    case 'applicants-list':
      yPosition = drawBrandHeader(page, helveticaBold, helvetica, pageWidth, config?.jobTitle ? `${config.jobTitle} - Applicants` : 'Job Applicants');
      yPosition = drawSubtitle(page, helvetica, yPosition, margin, `Total: ${config?.totalApplicants || (Array.isArray(data) ? data.length : 0)} applicants`);
      yPosition = drawStyledTable(page, pdfDoc, helvetica, helveticaBold, yPosition, margin, pageWidth, pageHeight, data, config, ensureSpace);
      break;
    case 'referral-members':
      yPosition = drawBrandHeader(page, helveticaBold, helvetica, pageWidth, config?.title || 'Referral Members Report');
      yPosition = drawSubtitle(page, helvetica, yPosition, margin, `Total: ${Array.isArray(data) ? data.length : 0} members`);
      yPosition = drawSummaryBoxes(page, helvetica, helveticaBold, yPosition, margin, config);
      yPosition = drawStyledTable(page, pdfDoc, helvetica, helveticaBold, yPosition, margin, pageWidth, pageHeight, data, config, ensureSpace);
      break;
    case 'referral-history':
      yPosition = drawBrandHeader(page, helveticaBold, helvetica, pageWidth, config?.title || 'Referral Transaction History');
      yPosition = drawSubtitle(page, helvetica, yPosition, margin, `Total: ${Array.isArray(data) ? data.length : 0} transactions`);
      yPosition = drawSummaryBoxes(page, helvetica, helveticaBold, yPosition, margin, config);
      yPosition = drawStyledTable(page, pdfDoc, helvetica, helveticaBold, yPosition, margin, pageWidth, pageHeight, data, config, ensureSpace);
      break;
    default:
      yPosition = drawBrandHeader(page, helveticaBold, helvetica, pageWidth, config?.title || 'Data Export');
      yPosition = drawStyledTable(page, pdfDoc, helvetica, helveticaBold, yPosition, margin, pageWidth, pageHeight, data, config, ensureSpace);
  }

  // Add footer to all pages (except resume which has its own)
  if (!template?.startsWith('resume')) {
    const pages = pdfDoc.getPages();
    pages.forEach((p, index) => {
      drawFooter(p, helvetica, pageWidth, index + 1, pages.length);
    });
  }

  return await pdfDoc.save();
}

// ============ RESUME PDF GENERATION ============
async function drawResumePDF(
  pdfDoc: any,
  page: any,
  regularFont: any,
  boldFont: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  config?: TemplateConfig,
  resumeBranding?: ResumeBrandingContext
): Promise<void> {
  const resumeData = config?.resumeData;
  if (!resumeData) {
    // Fallback if no resume data
    page.drawText('No resume data provided', { x: margin, y: pageHeight - 100, size: 16, font: boldFont });
    return;
  }

  const templateType = config?.resumeTemplate || 'professional';

  switch (templateType) {
    case 'creative':
      await drawCreativeResume(pdfDoc, page, regularFont, boldFont, pageWidth, pageHeight, margin, resumeData, resumeBranding);
      break;
    case 'minimalist':
      await drawMinimalistResume(pdfDoc, page, regularFont, boldFont, pageWidth, pageHeight, margin, resumeData, resumeBranding);
      break;
    case 'professional':
    default:
      await drawProfessionalResume(pdfDoc, page, regularFont, boldFont, pageWidth, pageHeight, margin, resumeData, resumeBranding);
  }
}

// ============ PROFESSIONAL RESUME TEMPLATE (Premium Design) ============
async function drawProfessionalResume(
  pdfDoc: any,
  page: any,
  regularFont: any,
  boldFont: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  data: ResumeData,
  branding?: ResumeBrandingContext
): Promise<void> {
  let y = pageHeight;
  const contentWidth = pageWidth - 2 * margin;
  const leftColWidth = Math.floor(contentWidth * 0.65);
  const rightColWidth = contentWidth - leftColWidth - 20;
  const sidebarX = margin + leftColWidth + 20;

  // ========== ELEGANT HEADER SECTION ==========
  const headerHeight = 95;
  
  // Premium gradient header (deep navy blue to slate)
  for (let i = 0; i < 25; i++) {
    const gradientRatio = i / 25;
    const r = 0.12 * (1 - gradientRatio) + 0.18 * gradientRatio;
    const g = 0.15 * (1 - gradientRatio) + 0.22 * gradientRatio;
    const b = 0.25 * (1 - gradientRatio) + 0.35 * gradientRatio;
    
    page.drawRectangle({
      x: 0,
      y: pageHeight - headerHeight + (i * headerHeight / 25),
      width: pageWidth,
      height: headerHeight / 25 + 1,
      color: rgb(r, g, b),
    });
  }

  // Accent line at bottom of header
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight - 3,
    width: pageWidth,
    height: 3,
    color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
  });

  // Name (large, bold, white)
  y = pageHeight - 32;
  const nameText = data.personalInfo.fullName.toUpperCase();
  page.drawText(nameText, {
    x: margin,
    y: y,
    size: 26,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Brand logo/name + user photo (top-right)
  try {
    const brandName = branding?.brandName || 'Workly India';
    const headerTopY = pageHeight - 28;
    let rightX = pageWidth - margin;

    // User photo
    if (branding?.userPhotoUrl) {
      const img = await fetchImageBytes(branding.userPhotoUrl);
      if (img) {
        const embedded = img.contentType.includes('png')
          ? await pdfDoc.embedPng(img.bytes)
          : await pdfDoc.embedJpg(img.bytes);
        const size = 30;
        rightX -= size;
        page.drawImage(embedded, {
          x: rightX,
          y: headerTopY - 18,
          width: size,
          height: size,
        });
        rightX -= 8;
      }
    }

    // Brand logo
    if (branding?.brandLogoUrl) {
      const img = await fetchImageBytes(branding.brandLogoUrl);
      if (img) {
        const embedded = img.contentType.includes('png')
          ? await pdfDoc.embedPng(img.bytes)
          : await pdfDoc.embedJpg(img.bytes);
        const size = 16;
        rightX -= size;
        page.drawImage(embedded, {
          x: rightX,
          y: headerTopY - 6,
          width: size,
          height: size,
        });
        rightX -= 6;
      }
    }

    // Brand name
    const brandTextWidth = boldFont.widthOfTextAtSize(brandName, 10);
    rightX -= brandTextWidth;
    page.drawText(brandName, {
      x: rightX,
      y: headerTopY,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
  } catch {
    // ignore
  }

  // Professional Title
  if (data.personalInfo.title) {
    y -= 22;
    page.drawText(data.personalInfo.title, {
      x: margin,
      y: y,
      size: 13,
      font: regularFont,
      color: rgb(0.85, 0.88, 0.95),
    });
  }

  // Contact Information Row
  y -= 22;
  const contactItems = [
    data.personalInfo.email,
    data.personalInfo.phone,
    data.personalInfo.address,
  ].filter(Boolean);

  let contactX = margin;
  contactItems.forEach((item, index) => {
    const separator = index > 0 ? '  |  ' : '';
    const text = separator + item;
    page.drawText(text, {
      x: contactX,
      y: y,
      size: 9,
      font: regularFont,
      color: rgb(0.78, 0.82, 0.9),
    });
    contactX += regularFont.widthOfTextAtSize(text, 9);
  });

  // ========== MAIN CONTENT AREA (Two Columns) ==========
  y = pageHeight - headerHeight - 25;
  const mainX = margin;

  // ========== LEFT COLUMN ==========
  
  // Professional Summary with elegant border
  if (data.summary && data.summary.length > 10) {
    // Section header with underline
    page.drawText('PROFESSIONAL SUMMARY', {
      x: mainX,
      y: y,
      size: 11,
      font: boldFont,
      color: rgb(0.15, 0.18, 0.28),
    });
    
    // Elegant underline
    page.drawRectangle({
      x: mainX,
      y: y - 4,
      width: 100,
      height: 2,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    y -= 18;
    y = drawWrappedText(page, regularFont, data.summary, mainX, y, leftColWidth, 10, { r: 0.3, g: 0.33, b: 0.38 });
    y -= 18;
  }

  // Work Experience Section
  if (data.experience && data.experience.length > 0) {
    page.drawText('WORK EXPERIENCE', {
      x: mainX,
      y: y,
      size: 11,
      font: boldFont,
      color: rgb(0.15, 0.18, 0.28),
    });
    
    page.drawRectangle({
      x: mainX,
      y: y - 4,
      width: 100,
      height: 2,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    y -= 18;

    data.experience.forEach((exp, index) => {
      // Check if we need a new page
      if (y < margin + 100) {
        const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        page = newPage;
      }

      // Timeline connector
      page.drawCircle({
        x: mainX + 5,
        y: y - 3,
        size: 5,
        color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
      });
      
      // Inner circle (white)
      page.drawCircle({
        x: mainX + 5,
        y: y - 3,
        size: 3,
        color: rgb(1, 1, 1),
      });

      if (index < data.experience.length - 1) {
        page.drawLine({
          start: { x: mainX + 5, y: y - 10 },
          end: { x: mainX + 5, y: y - 55 },
          thickness: 1,
          color: rgb(0.85, 0.88, 0.92),
        });
      }

      // Position Title
      page.drawText(exp.position, {
        x: mainX + 18,
        y: y,
        size: 11,
        font: boldFont,
        color: rgb(0.15, 0.18, 0.28),
      });
      y -= 14;

      // Company and Duration
      const companyDuration = `${exp.company}  |  ${exp.duration}`;
      page.drawText(companyDuration, {
        x: mainX + 18,
        y: y,
        size: 9,
        font: regularFont,
        color: rgb(0.45, 0.48, 0.55),
      });
      y -= 14;

      // Description with bullet point
      if (exp.description) {
        page.drawCircle({
          x: mainX + 22,
          y: y + 3,
          size: 2,
          color: rgb(0.5, 0.53, 0.6),
        });
        y = drawWrappedText(page, regularFont, exp.description, mainX + 28, y, leftColWidth - 30, 9, { r: 0.4, g: 0.43, b: 0.5 });
      }
      y -= 12;
    });
    y -= 5;
  }

  // Education Section
  if (data.education && data.education.length > 0) {
    if (y < margin + 80) {
      const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      page = newPage;
    }

    page.drawText('EDUCATION', {
      x: mainX,
      y: y,
      size: 11,
      font: boldFont,
      color: rgb(0.15, 0.18, 0.28),
    });
    
    page.drawRectangle({
      x: mainX,
      y: y - 4,
      width: 60,
      height: 2,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    y -= 18;

    data.education.forEach((edu) => {
      // Degree icon
      page.drawCircle({
        x: mainX + 5,
        y: y - 2,
        size: 4,
        color: rgb(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b),
      });

      page.drawText(edu.degree, {
        x: mainX + 15,
        y: y,
        size: 10,
        font: boldFont,
        color: rgb(0.2, 0.23, 0.3),
      });
      y -= 13;

      const eduDetails = `${edu.institution}  |  ${edu.year}${edu.grade ? `  |  ${edu.grade}` : ''}`;
      page.drawText(eduDetails, {
        x: mainX + 15,
        y: y,
        size: 9,
        font: regularFont,
        color: rgb(0.45, 0.48, 0.55),
      });
      y -= 16;
    });
  }

  // ========== RIGHT COLUMN (Sidebar) ==========
  let sideY = pageHeight - headerHeight - 25;

  // Skills Section with professional bars
  if (data.skills && data.skills.length > 0) {
    page.drawText('SKILLS', {
      x: sidebarX,
      y: sideY,
      size: 10,
      font: boldFont,
      color: rgb(0.15, 0.18, 0.28),
    });
    
    page.drawRectangle({
      x: sidebarX,
      y: sideY - 4,
      width: 40,
      height: 2,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    sideY -= 18;

    data.skills.slice(0, 10).forEach((skill, index) => {
      page.drawText(skill, {
        x: sidebarX,
        y: sideY,
        size: 9,
        font: regularFont,
        color: rgb(0.25, 0.28, 0.35),
      });
      sideY -= 13;

      // Skill progress bar background
      page.drawRectangle({
        x: sidebarX,
        y: sideY + 2,
        width: rightColWidth - 10,
        height: 5,
        color: rgb(0.92, 0.93, 0.95),
      });

      // Skill bar fill (professional gradient effect)
      const fillPercent = 0.7 + (Math.sin(index * 0.8) * 0.15) + 0.15;
      page.drawRectangle({
        x: sidebarX,
        y: sideY + 2,
        width: (rightColWidth - 10) * fillPercent,
        height: 5,
        color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
      });
      sideY -= 12;
    });
    sideY -= 12;
  }

  // Languages Section
  if (data.languages && data.languages.length > 0) {
    page.drawText('LANGUAGES', {
      x: sidebarX,
      y: sideY,
      size: 10,
      font: boldFont,
      color: rgb(0.15, 0.18, 0.28),
    });
    
    page.drawRectangle({
      x: sidebarX,
      y: sideY - 4,
      width: 60,
      height: 2,
      color: rgb(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b),
    });
    
    sideY -= 18;

    data.languages.forEach((lang) => {
      page.drawCircle({
        x: sidebarX + 4,
        y: sideY + 3,
        size: 3,
        color: rgb(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b),
      });

      page.drawText(lang, {
        x: sidebarX + 12,
        y: sideY,
        size: 9,
        font: regularFont,
        color: rgb(0.3, 0.33, 0.4),
      });
      sideY -= 15;
    });
    sideY -= 10;
  }

  // Certifications Section
  if (data.certifications && data.certifications.length > 0) {
    page.drawText('CERTIFICATIONS', {
      x: sidebarX,
      y: sideY,
      size: 10,
      font: boldFont,
      color: rgb(0.15, 0.18, 0.28),
    });
    
    page.drawRectangle({
      x: sidebarX,
      y: sideY - 4,
      width: 80,
      height: 2,
      color: rgb(COLORS.warning.r, COLORS.warning.g, COLORS.warning.b),
    });
    
    sideY -= 18;

    data.certifications.slice(0, 5).forEach((cert) => {
      // Certificate badge
      page.drawRectangle({
        x: sidebarX,
        y: sideY - 3,
        width: 4,
        height: 12,
        color: rgb(COLORS.warning.r, COLORS.warning.g, COLORS.warning.b),
      });

      const certText = truncateText(cert, rightColWidth - 15, 8);
      page.drawText(certText, {
        x: sidebarX + 10,
        y: sideY,
        size: 8,
        font: regularFont,
        color: rgb(0.3, 0.33, 0.4),
      });
      sideY -= 16;
    });
  }

  // Premium Footer
  const footerY = margin - 5;
  
  // Subtle line
  page.drawLine({
    start: { x: margin, y: footerY + 12 },
    end: { x: pageWidth - margin, y: footerY + 12 },
    thickness: 0.5,
    color: rgb(0.88, 0.9, 0.92),
  });

  const footerBrand = branding?.brandName || 'Workly India';
  page.drawText(`Resume generated by ${footerBrand}`, {
    x: margin,
    y: footerY,
    size: 7,
    font: regularFont,
    color: rgb(0.6, 0.62, 0.68),
  });
}

// ============ CREATIVE RESUME TEMPLATE (Premium Modern Design) ============
async function drawCreativeResume(
  pdfDoc: any,
  page: any,
  regularFont: any,
  boldFont: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  data: ResumeData,
  branding?: ResumeBrandingContext
): Promise<void> {
  let y = pageHeight;
  const contentWidth = pageWidth - 2 * margin;
  const leftSidebarWidth = 180;
  const mainContentX = margin + leftSidebarWidth + 25;
  const mainContentWidth = contentWidth - leftSidebarWidth - 25;

  // ========== FULL-HEIGHT LEFT SIDEBAR ==========
  // Beautiful gradient sidebar (Purple → Teal → Blue)
  for (let i = 0; i < 50; i++) {
    const ratio = i / 50;
    let r, g, b;
    
    if (ratio < 0.33) {
      const localRatio = ratio * 3;
      r = COLORS.brand.r * (1 - localRatio) + COLORS.brandDark.r * localRatio;
      g = COLORS.brand.g * (1 - localRatio) + COLORS.brandDark.g * localRatio;
      b = COLORS.brand.b * (1 - localRatio) + COLORS.brandDark.b * localRatio;
    } else if (ratio < 0.66) {
      const localRatio = (ratio - 0.33) * 3;
      r = COLORS.brandDark.r * (1 - localRatio) + COLORS.info.r * localRatio;
      g = COLORS.brandDark.g * (1 - localRatio) + COLORS.info.g * localRatio;
      b = COLORS.brandDark.b * (1 - localRatio) + COLORS.info.b * localRatio;
    } else {
      const localRatio = (ratio - 0.66) * 3;
      r = COLORS.info.r * (1 - localRatio) + COLORS.teal.r * localRatio;
      g = COLORS.info.g * (1 - localRatio) + COLORS.teal.g * localRatio;
      b = COLORS.info.b * (1 - localRatio) + COLORS.teal.b * localRatio;
    }
    
    page.drawRectangle({
      x: 0,
      y: (i * pageHeight / 50),
      width: leftSidebarWidth + margin,
      height: pageHeight / 50 + 1,
      color: rgb(r, g, b),
    });
  }

  // ========== SIDEBAR CONTENT (White text on gradient) ==========
  let sideY = pageHeight - 45;

  // Brand logo/name + user photo (top of sidebar)
  try {
    const brandName = branding?.brandName || 'Workly India';
    let x = margin - 5;
    const yTop = pageHeight - 28;

    if (branding?.brandLogoUrl) {
      const img = await fetchImageBytes(branding.brandLogoUrl);
      if (img) {
        const embedded = img.contentType.includes('png')
          ? await pdfDoc.embedPng(img.bytes)
          : await pdfDoc.embedJpg(img.bytes);
        page.drawImage(embedded, {
          x,
          y: yTop,
          width: 14,
          height: 14,
        });
        x += 18;
      }
    }

    page.drawText(brandName, {
      x,
      y: yTop + 2,
      size: 9,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    if (branding?.userPhotoUrl) {
      const img = await fetchImageBytes(branding.userPhotoUrl);
      if (img) {
        const embedded = img.contentType.includes('png')
          ? await pdfDoc.embedPng(img.bytes)
          : await pdfDoc.embedJpg(img.bytes);
        page.drawImage(embedded, {
          x: margin + 115,
          y: yTop - 2,
          width: 26,
          height: 26,
        });
      }
    }
  } catch {
    // ignore
  }

  // Name in sidebar (stylized)
  const nameParts = data.personalInfo.fullName.split(' ');
  nameParts.forEach((part, index) => {
    page.drawText(part.toUpperCase(), {
      x: margin - 5,
      y: sideY,
      size: index === 0 ? 20 : 18,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    sideY -= 24;
  });

  // Title
  if (data.personalInfo.title) {
    sideY -= 5;
    page.drawText(data.personalInfo.title, {
      x: margin - 5,
      y: sideY,
      size: 10,
      font: regularFont,
      color: rgb(0.9, 0.92, 0.95),
    });
    sideY -= 30;
  }

  // Contact Section
  page.drawText('CONTACT', {
    x: margin - 5,
    y: sideY,
    size: 9,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  
  // Underline accent
  page.drawRectangle({
    x: margin - 5,
    y: sideY - 4,
    width: 45,
    height: 2,
    color: rgb(1, 1, 1),
  });
  
  sideY -= 20;

  if (data.personalInfo.email) {
    page.drawText(data.personalInfo.email, {
      x: margin - 5,
      y: sideY,
      size: 8,
      font: regularFont,
      color: rgb(0.92, 0.94, 0.98),
    });
    sideY -= 14;
  }

  if (data.personalInfo.phone) {
    page.drawText(data.personalInfo.phone, {
      x: margin - 5,
      y: sideY,
      size: 8,
      font: regularFont,
      color: rgb(0.92, 0.94, 0.98),
    });
    sideY -= 14;
  }

  if (data.personalInfo.address) {
    const addrLines = wrapTextToLines(data.personalInfo.address, leftSidebarWidth - 30, 8);
    addrLines.forEach(line => {
      page.drawText(line, {
        x: margin - 5,
        y: sideY,
        size: 8,
        font: regularFont,
        color: rgb(0.92, 0.94, 0.98),
      });
      sideY -= 12;
    });
  }
  sideY -= 15;

  // Skills Section in Sidebar
  if (data.skills && data.skills.length > 0) {
    page.drawText('SKILLS', {
      x: margin - 5,
      y: sideY,
      size: 9,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    
    page.drawRectangle({
      x: margin - 5,
      y: sideY - 4,
      width: 35,
      height: 2,
      color: rgb(1, 1, 1),
    });
    
    sideY -= 20;

    data.skills.slice(0, 8).forEach((skill, index) => {
      page.drawText(skill, {
        x: margin - 5,
        y: sideY,
        size: 8,
        font: regularFont,
        color: rgb(0.95, 0.96, 0.98),
      });
      sideY -= 12;

      // Skill bar background (transparent white)
      page.drawRectangle({
        x: margin - 5,
        y: sideY + 2,
        width: leftSidebarWidth - 30,
        height: 4,
        color: rgb(1, 1, 1),
        opacity: 0.3,
      });

      // Skill bar fill
      const fillPercent = 0.75 + (Math.cos(index * 0.7) * 0.2);
      page.drawRectangle({
        x: margin - 5,
        y: sideY + 2,
        width: (leftSidebarWidth - 30) * fillPercent,
        height: 4,
        color: rgb(1, 1, 1),
      });
      sideY -= 12;
    });
    sideY -= 15;
  }

  // Languages in Sidebar
  if (data.languages && data.languages.length > 0) {
    page.drawText('LANGUAGES', {
      x: margin - 5,
      y: sideY,
      size: 9,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    
    page.drawRectangle({
      x: margin - 5,
      y: sideY - 4,
      width: 60,
      height: 2,
      color: rgb(1, 1, 1),
    });
    
    sideY -= 20;

    data.languages.forEach((lang) => {
      page.drawCircle({
        x: margin,
        y: sideY + 3,
        size: 3,
        color: rgb(1, 1, 1),
      });

      page.drawText(lang, {
        x: margin + 10,
        y: sideY,
        size: 8,
        font: regularFont,
        color: rgb(0.95, 0.96, 0.98),
      });
      sideY -= 14;
    });
    sideY -= 15;
  }

  // Certifications in Sidebar
  if (data.certifications && data.certifications.length > 0) {
    page.drawText('CERTIFICATIONS', {
      x: margin - 5,
      y: sideY,
      size: 9,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    
    page.drawRectangle({
      x: margin - 5,
      y: sideY - 4,
      width: 80,
      height: 2,
      color: rgb(1, 1, 1),
    });
    
    sideY -= 18;

    data.certifications.slice(0, 4).forEach((cert) => {
      const certText = truncateText(cert, leftSidebarWidth - 25, 7);
      page.drawText(certText, {
        x: margin - 5,
        y: sideY,
        size: 7,
        font: regularFont,
        color: rgb(0.9, 0.92, 0.95),
      });
      sideY -= 12;
    });
  }

  // ========== MAIN CONTENT AREA (Right side) ==========
  y = pageHeight - 45;

  // About Me / Summary Section
  if (data.summary && data.summary.length > 10) {
    page.drawText('ABOUT ME', {
      x: mainContentX,
      y: y,
      size: 12,
      font: boldFont,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    // Decorative underline
    page.drawRectangle({
      x: mainContentX,
      y: y - 5,
      width: 50,
      height: 3,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    y -= 22;

    // Summary card with subtle background
    const summaryHeight = Math.min(65, 30 + (data.summary.length / 6));
    page.drawRectangle({
      x: mainContentX,
      y: y - summaryHeight + 12,
      width: mainContentWidth,
      height: summaryHeight,
      color: rgb(0.97, 0.98, 0.99),
    });

    y = drawWrappedText(page, regularFont, data.summary, mainContentX + 10, y, mainContentWidth - 20, 10, { r: 0.3, g: 0.33, b: 0.38 });
    y -= 25;
  }

  // Experience Section
  if (data.experience && data.experience.length > 0) {
    page.drawText('EXPERIENCE', {
      x: mainContentX,
      y: y,
      size: 12,
      font: boldFont,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    page.drawRectangle({
      x: mainContentX,
      y: y - 5,
      width: 65,
      height: 3,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    y -= 22;

    const expColors = [COLORS.brand, COLORS.info, COLORS.teal, COLORS.success];

    data.experience.forEach((exp, index) => {
      if (y < margin + 100) {
        const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        page = newPage;
      }

      const accentColor = expColors[index % expColors.length];

      // Dynamic left accent bar (computed from actual item height so it won't overlap next sections)
      const itemStartY = y;

      // Position
      page.drawText(exp.position, {
        x: mainContentX + 12,
        y: y,
        size: 11,
        font: boldFont,
        color: rgb(0.15, 0.18, 0.25),
      });
      y -= 14;

      // Company and Duration
      page.drawText(`${exp.company}  |  ${exp.duration}`, {
        x: mainContentX + 12,
        y: y,
        size: 9,
        font: regularFont,
        color: rgb(0.45, 0.48, 0.55),
      });
      y -= 13;

      // Description
      if (exp.description) {
        y = drawWrappedText(page, regularFont, exp.description, mainContentX + 12, y, mainContentWidth - 20, 9, { r: 0.4, g: 0.43, b: 0.5 });
      }

      const itemEndY = y;
      const barTop = itemStartY + 2;
      // Keep the bar within the experience block and leave breathing room below
      // so it never visually clashes with the next section heading (e.g., EDUCATION).
      const barBottom = itemEndY + 4;
      const barHeight = Math.max(22, barTop - barBottom);
      page.drawRectangle({
        x: mainContentX,
        y: barBottom,
        width: 4,
        height: barHeight,
        color: rgb(accentColor.r, accentColor.g, accentColor.b),
      });
      y -= 15;
    });
  }

  // Education Section
  if (data.education && data.education.length > 0) {
    if (y < margin + 80) {
      const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      page = newPage;
    }

    page.drawText('EDUCATION', {
      x: mainContentX,
      y: y,
      size: 12,
      font: boldFont,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    page.drawRectangle({
      x: mainContentX,
      y: y - 5,
      width: 60,
      height: 3,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    
    y -= 22;

    data.education.forEach((edu) => {
      page.drawCircle({
        x: mainContentX + 5,
        y: y - 2,
        size: 4,
        color: rgb(COLORS.teal.r, COLORS.teal.g, COLORS.teal.b),
      });

      page.drawText(edu.degree, {
        x: mainContentX + 15,
        y: y,
        size: 10,
        font: boldFont,
        color: rgb(0.2, 0.23, 0.3),
      });
      y -= 13;

      page.drawText(`${edu.institution}  |  ${edu.year}${edu.grade ? `  |  ${edu.grade}` : ''}`, {
        x: mainContentX + 15,
        y: y,
        size: 9,
        font: regularFont,
        color: rgb(0.45, 0.48, 0.55),
      });
      y -= 18;
    });
  }

  // Footer in main content area
  const creativeFooterBrand = branding?.brandName || 'Workly India';
  page.drawText(`Creative Resume by ${creativeFooterBrand}`, {
    x: mainContentX,
    y: margin - 8,
    size: 7,
    font: regularFont,
    color: rgb(0.55, 0.58, 0.65),
  });
}

// Helper function to wrap text into lines
function wrapTextToLines(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > maxChars) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============ MINIMALIST RESUME TEMPLATE (Premium Clean Design) ============
async function drawMinimalistResume(
  pdfDoc: any,
  page: any,
  regularFont: any,
  boldFont: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  data: ResumeData,
  branding?: ResumeBrandingContext
): Promise<void> {
  let y = pageHeight - margin - 10;
  const contentWidth = pageWidth - 2 * margin;
  const leftColWidth = Math.floor(contentWidth * 0.65);
  const rightColWidth = contentWidth - leftColWidth - 30;
  const rightColX = margin + leftColWidth + 30;

  // ========== ELEGANT HEADER ==========
  // Name (large, elegant typography)
  // IMPORTANT: Keep the border OUT of the name box.
  // Anchor the border at a safe header-top position and place the name below it.
  const nameFontSize = 28;
  const nameText = data.personalInfo.fullName.toUpperCase();
  const nameHeight = typeof boldFont?.heightAtSize === 'function'
    ? boldFont.heightAtSize(nameFontSize)
    : nameFontSize;

  // NOTE: pdf-lib font metrics can vary across environments; using a larger
  // safety gap prevents the top border from visually intersecting the name.
  const topBorderY = pageHeight - margin - 4;
  const nameY = topBorderY - Math.max(nameHeight, nameFontSize) - 12;

  page.drawRectangle({
    x: margin,
    y: topBorderY,
    width: contentWidth,
    height: 2,
    color: rgb(0.12, 0.14, 0.18),
  });

  page.drawText(nameText, {
    x: margin,
    y: nameY,
    size: nameFontSize,
    font: boldFont,
    color: rgb(0.12, 0.14, 0.18),
  });

  // Brand logo/name + user photo (top-right)
  try {
    const brandName = branding?.brandName || 'Workly India';
    let x = pageWidth - margin;
    const yTop = topBorderY + 6;

    if (branding?.userPhotoUrl) {
      const img = await fetchImageBytes(branding.userPhotoUrl);
      if (img) {
        const embedded = img.contentType.includes('png')
          ? await pdfDoc.embedPng(img.bytes)
          : await pdfDoc.embedJpg(img.bytes);
        const size = 24;
        x -= size;
        page.drawImage(embedded, { x, y: yTop, width: size, height: size });
        x -= 8;
      }
    }

    if (branding?.brandLogoUrl) {
      const img = await fetchImageBytes(branding.brandLogoUrl);
      if (img) {
        const embedded = img.contentType.includes('png')
          ? await pdfDoc.embedPng(img.bytes)
          : await pdfDoc.embedJpg(img.bytes);
        const size = 12;
        x -= size;
        page.drawImage(embedded, { x, y: yTop + 6, width: size, height: size });
        x -= 6;
      }
    }

    const brandTextWidth = boldFont.widthOfTextAtSize(brandName, 9);
    x -= brandTextWidth;
    page.drawText(brandName, {
      x,
      y: yTop + 8,
      size: 9,
      font: boldFont,
      color: rgb(0.12, 0.14, 0.18),
    });
  } catch {
    // ignore
  }

  y = nameY;

  // Professional Title
  if (data.personalInfo.title) {
    y -= 25;
    page.drawText(data.personalInfo.title, {
      x: margin,
      y: y,
      size: 12,
      font: regularFont,
      color: rgb(0.45, 0.48, 0.55),
    });
  }

  // Thin separator line
  y -= 18;
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: pageWidth - margin, y: y },
    thickness: 0.5,
    color: rgb(0.12, 0.14, 0.18),
  });

  // Contact info in elegant row
  y -= 15;
  const contactParts = [
    data.personalInfo.email,
    data.personalInfo.phone,
    data.personalInfo.address,
  ].filter(Boolean);

  const contactText = contactParts.join('   |   ');
  page.drawText(contactText, {
    x: margin,
    y: y,
    size: 9,
    font: regularFont,
    color: rgb(0.35, 0.38, 0.45),
  });

  // Light separator
  y -= 18;
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: pageWidth - margin, y: y },
    thickness: 0.3,
    color: rgb(0.85, 0.87, 0.9),
  });

  y -= 25;

  // ========== TWO COLUMN LAYOUT ==========
  let leftY = y;
  let rightY = y;

  // ========== LEFT COLUMN ==========
  
  // Professional Summary
  if (data.summary && data.summary.length > 10) {
    page.drawText('PROFILE', {
      x: margin,
      y: leftY,
      size: 10,
      font: boldFont,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    // Subtle underline
    page.drawLine({
      start: { x: margin, y: leftY - 4 },
      end: { x: margin + 40, y: leftY - 4 },
      thickness: 1.5,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    leftY -= 18;
    leftY = drawWrappedText(page, regularFont, data.summary, margin, leftY, leftColWidth, 10, { r: 0.35, g: 0.38, b: 0.45 });
    leftY -= 22;
  }

  // Experience Section
  if (data.experience && data.experience.length > 0) {
    page.drawText('EXPERIENCE', {
      x: margin,
      y: leftY,
      size: 10,
      font: boldFont,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    page.drawLine({
      start: { x: margin, y: leftY - 4 },
      end: { x: margin + 65, y: leftY - 4 },
      thickness: 1.5,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    leftY -= 18;

    data.experience.forEach((exp) => {
      if (leftY < margin + 80) {
        const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
        leftY = pageHeight - margin;
        page = newPage;
      }

      // Position title
      page.drawText(exp.position, {
        x: margin,
        y: leftY,
        size: 10,
        font: boldFont,
        color: rgb(0.18, 0.2, 0.25),
      });
      leftY -= 13;

      // Company
      page.drawText(exp.company, {
        x: margin,
        y: leftY,
        size: 9,
        font: regularFont,
        color: rgb(0.25, 0.28, 0.35),
      });

      // Duration (right aligned within left column)
      const durationWidth = regularFont.widthOfTextAtSize(exp.duration, 9);
      page.drawText(exp.duration, {
        x: margin + leftColWidth - durationWidth,
        y: leftY,
        size: 9,
        font: regularFont,
        color: rgb(0.5, 0.53, 0.6),
      });
      leftY -= 14;

      // Description with bullet
      if (exp.description) {
        page.drawCircle({
          x: margin + 3,
          y: leftY + 3,
          size: 2,
          color: rgb(0.5, 0.53, 0.6),
        });
        leftY = drawWrappedText(page, regularFont, exp.description, margin + 10, leftY, leftColWidth - 10, 9, { r: 0.4, g: 0.43, b: 0.5 });
      }
      leftY -= 14;
    });
    leftY -= 5;
  }

  // Education Section
  if (data.education && data.education.length > 0) {
    page.drawText('EDUCATION', {
      x: margin,
      y: leftY,
      size: 10,
      font: boldFont,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    page.drawLine({
      start: { x: margin, y: leftY - 4 },
      end: { x: margin + 60, y: leftY - 4 },
      thickness: 1.5,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    leftY -= 18;

    data.education.forEach((edu) => {
      page.drawText(edu.degree, {
        x: margin,
        y: leftY,
        size: 10,
        font: boldFont,
        color: rgb(0.18, 0.2, 0.25),
      });
      leftY -= 13;

      const eduInfo = `${edu.institution}${edu.year ? `  |  ${edu.year}` : ''}${edu.grade ? `  |  ${edu.grade}` : ''}`;
      page.drawText(eduInfo, {
        x: margin,
        y: leftY,
        size: 9,
        font: regularFont,
        color: rgb(0.45, 0.48, 0.55),
      });
      leftY -= 16;
    });
  }

  // ========== RIGHT COLUMN ==========
  
  // Skills Section
  if (data.skills && data.skills.length > 0) {
    page.drawText('SKILLS', {
      x: rightColX,
      y: rightY,
      size: 10,
      font: boldFont,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    page.drawLine({
      start: { x: rightColX, y: rightY - 4 },
      end: { x: rightColX + 35, y: rightY - 4 },
      thickness: 1.5,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    rightY -= 18;

    data.skills.forEach((skill) => {
      page.drawCircle({
        x: rightColX + 3,
        y: rightY + 3,
        size: 2,
        color: rgb(0.35, 0.38, 0.45),
      });

      page.drawText(skill, {
        x: rightColX + 10,
        y: rightY,
        size: 9,
        font: regularFont,
        color: rgb(0.3, 0.33, 0.4),
      });
      rightY -= 14;
    });
    rightY -= 15;
  }

  // Languages Section
  if (data.languages && data.languages.length > 0) {
    page.drawText('LANGUAGES', {
      x: rightColX,
      y: rightY,
      size: 10,
      font: boldFont,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    page.drawLine({
      start: { x: rightColX, y: rightY - 4 },
      end: { x: rightColX + 60, y: rightY - 4 },
      thickness: 1.5,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    rightY -= 18;

    data.languages.forEach((lang) => {
      page.drawCircle({
        x: rightColX + 3,
        y: rightY + 3,
        size: 2,
        color: rgb(0.35, 0.38, 0.45),
      });

      page.drawText(lang, {
        x: rightColX + 10,
        y: rightY,
        size: 9,
        font: regularFont,
        color: rgb(0.3, 0.33, 0.4),
      });
      rightY -= 14;
    });
    rightY -= 15;
  }

  // Certifications Section
  if (data.certifications && data.certifications.length > 0) {
    page.drawText('CERTIFICATIONS', {
      x: rightColX,
      y: rightY,
      size: 10,
      font: boldFont,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    page.drawLine({
      start: { x: rightColX, y: rightY - 4 },
      end: { x: rightColX + 85, y: rightY - 4 },
      thickness: 1.5,
      color: rgb(0.12, 0.14, 0.18),
    });
    
    rightY -= 18;

    data.certifications.slice(0, 5).forEach((cert) => {
      page.drawCircle({
        x: rightColX + 3,
        y: rightY + 3,
        size: 2,
        color: rgb(0.35, 0.38, 0.45),
      });

      const certText = truncateText(cert, rightColWidth - 15, 8);
      page.drawText(certText, {
        x: rightColX + 10,
        y: rightY,
        size: 8,
        font: regularFont,
        color: rgb(0.3, 0.33, 0.4),
      });
      rightY -= 13;
    });
  }

  // ========== ELEGANT FOOTER ==========
  const footerY = margin;
  
  // Clean bottom border
  page.drawRectangle({
    x: margin,
    y: footerY,
    width: contentWidth,
    height: 2,
    color: rgb(0.12, 0.14, 0.18),
  });

  // Branding (subtle, right aligned)
  const minimalistFooterBrand = branding?.brandName || 'Workly India';
  page.drawText(minimalistFooterBrand, {
    x: pageWidth - margin - regularFont.widthOfTextAtSize(minimalistFooterBrand, 7),
    y: footerY - 12,
    size: 7,
    font: regularFont,
    color: rgb(0.55, 0.58, 0.65),
  });
}

// ============ RESUME HELPER FUNCTIONS ============
function drawSectionHeader(
  page: any,
  boldFont: any,
  title: string,
  x: number,
  y: number,
  color: { r: number; g: number; b: number }
): number {
  page.drawText(title, {
    x: x,
    y: y,
    size: 11,
    font: boldFont,
    color: rgb(color.r, color.g, color.b),
  });

  // Underline
  page.drawLine({
    start: { x: x, y: y - 4 },
    end: { x: x + 60, y: y - 4 },
    thickness: 2,
    color: rgb(color.r, color.g, color.b),
  });

  return y - 18;
}

function drawWrappedText(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  color: { r: number; g: number; b: number }
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  const lineHeight = fontSize + 3;
  const avgCharWidth = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / avgCharWidth);

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (testLine.length > maxChars) {
      if (line) {
        page.drawText(line, {
          x: x,
          y: currentY,
          size: fontSize,
          font: font,
          color: rgb(color.r, color.g, color.b),
        });
        currentY -= lineHeight;
      }
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) {
    page.drawText(line, {
      x: x,
      y: currentY,
      size: fontSize,
      font: font,
      color: rgb(color.r, color.g, color.b),
    });
    currentY -= lineHeight;
  }

  return currentY;
}

// ============ PDF DRAWING HELPERS ============
function drawBrandHeader(
  page: any,
  boldFont: any,
  regularFont: any,
  pageWidth: number,
  title: string,
  isSecondary = false
): number {
  const margin = 40;
  let y = page.getHeight() - margin;

  if (!isSecondary) {
    page.drawText('WORKLY INDIA', {
      x: margin,
      y: y,
      size: 14,
      font: boldFont,
      color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
    });
    y -= 20;
  }

  page.drawText(title, {
    x: margin,
    y: y,
    size: isSecondary ? 14 : 20,
    font: boldFont,
    color: rgb(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b),
  });
  y -= 15;

  page.drawText(`Generated: ${formatDate(new Date())}`, {
    x: margin,
    y: y,
    size: 9,
    font: regularFont,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });
  y -= 20;

  return y;
}

function drawSubtitle(page: any, font: any, y: number, margin: number, text: string): number {
  page.drawText(text, {
    x: margin,
    y: y,
    size: 10,
    font: font,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });
  return y - 20;
}

function drawUserInfoBox(
  page: any,
  regularFont: any,
  boldFont: any,
  yPosition: number,
  margin: number,
  pageWidth: number,
  config?: TemplateConfig
): number {
  if (!config?.userName && !config?.userEmail) return yPosition;

  const boxHeight = 30;
  const boxWidth = pageWidth - 2 * margin;

  page.drawRectangle({
    x: margin,
    y: yPosition - boxHeight,
    width: boxWidth,
    height: boxHeight,
    color: rgb(COLORS.light.r, COLORS.light.g, COLORS.light.b),
  });

  let textY = yPosition - 12;
  page.drawText(`Account Holder: ${config.userName || 'User'}`, {
    x: margin + 8,
    y: textY,
    size: 9,
    font: regularFont,
    color: rgb(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b),
  });

  if (config.userEmail) {
    page.drawText(`Email: ${config.userEmail}`, {
      x: margin + 8,
      y: textY - 12,
      size: 9,
      font: regularFont,
      color: rgb(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b),
    });
  }

  if (config.userPhone) {
    page.drawText(`Phone: ${config.userPhone}`, {
      x: margin + 200,
      y: textY,
      size: 9,
      font: regularFont,
      color: rgb(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b),
    });
  }

  return yPosition - boxHeight - 15;
}

function drawSummaryBoxes(
  page: any,
  regularFont: any,
  boldFont: any,
  yPosition: number,
  margin: number,
  config?: TemplateConfig
): number {
  if (!config?.summaryBoxes || config.summaryBoxes.length === 0) {
    if (config?.totalCredits !== undefined) {
      const boxes = [
        { label: 'Total Credits', value: `+${config.totalCredits?.toLocaleString() || 0}`, color: 'green' as const },
        { label: 'Total Debits', value: `-${config.totalDebits?.toLocaleString() || 0}`, color: 'red' as const },
        { label: 'Balance', value: `${config.currentBalance?.toLocaleString() || 0}`, color: 'blue' as const },
      ];
      config.summaryBoxes = boxes;
    } else {
      return yPosition;
    }
  }

  const boxWidth = 80;
  const boxHeight = 35;
  const gap = 8;
  let x = margin;

  const colorMap = {
    green: { bg: { r: 220 / 255, g: 252 / 255, b: 231 / 255 }, text: COLORS.success },
    red: { bg: { r: 254 / 255, g: 226 / 255, b: 226 / 255 }, text: COLORS.danger },
    blue: { bg: { r: 219 / 255, g: 234 / 255, b: 254 / 255 }, text: COLORS.info },
    purple: { bg: { r: 237 / 255, g: 233 / 255, b: 254 / 255 }, text: COLORS.brand },
    gray: { bg: COLORS.stripe, text: COLORS.muted },
  };

  config.summaryBoxes.forEach((box) => {
    const colors = colorMap[box.color] || colorMap.gray;

    page.drawRectangle({
      x: x,
      y: yPosition - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(colors.bg.r, colors.bg.g, colors.bg.b),
    });

    page.drawText(box.label, {
      x: x + 6,
      y: yPosition - 12,
      size: 7,
      font: regularFont,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
    });

    page.drawText(String(box.value), {
      x: x + 6,
      y: yPosition - 26,
      size: 11,
      font: boldFont,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
    });

    x += boxWidth + gap;
  });

  return yPosition - boxHeight - 20;
}

function drawStyledTable(
  page: any,
  pdfDoc: any,
  regularFont: any,
  boldFont: any,
  yPosition: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  data: Record<string, unknown> | unknown[],
  config?: TemplateConfig,
  ensureSpace?: (height: number) => void
): number {
  if (!Array.isArray(data) || data.length === 0) return yPosition;

  const tableWidth = pageWidth - 2 * margin;
  const rowHeight = 18;
  const headerHeight = 22;
  const cellPadding = 4;

  const columns = config?.columns || Object.keys(data[0] as object).slice(0, 7).map(key => ({
    key,
    header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    width: undefined,
    align: 'left' as const,
  }));

  const totalDefinedWidth = columns.reduce((sum, col) => sum + (col.width || 0), 0);
  const undefinedCount = columns.filter(col => !col.width).length;
  const remainingWidth = tableWidth - totalDefinedWidth;
  const defaultWidth = undefinedCount > 0 ? remainingWidth / undefinedCount : 0;

  const colWidths = columns.map(col => col.width || defaultWidth);

  page.drawRectangle({
    x: margin,
    y: yPosition - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: rgb(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b),
  });

  let xPos = margin + cellPadding;
  columns.forEach((col, i) => {
    const headerText = truncateText(col.header, colWidths[i] - cellPadding * 2, 9);
    page.drawText(headerText, {
      x: xPos,
      y: yPosition - 15,
      size: 9,
      font: boldFont,
      color: rgb(COLORS.white.r, COLORS.white.g, COLORS.white.b),
    });
    xPos += colWidths[i];
  });

  yPosition -= headerHeight;

  const maxRows = 150;
  const rowsToRender = data.slice(0, maxRows);

  rowsToRender.forEach((row, rowIndex) => {
    if (ensureSpace) ensureSpace(rowHeight);

    if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: yPosition - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: rgb(COLORS.stripe.r, COLORS.stripe.g, COLORS.stripe.b),
      });
    }

    page.drawLine({
      start: { x: margin, y: yPosition - rowHeight },
      end: { x: margin + tableWidth, y: yPosition - rowHeight },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    });

    xPos = margin + cellPadding;
    columns.forEach((col, colIndex) => {
      const rawValue = (row as Record<string, unknown>)[col.key];
      const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);
      const displayValue = truncateText(value, colWidths[colIndex] - cellPadding * 2, 8);

      let textColor = rgb(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b);
      const shouldColorize = ('colorize' in col && col.colorize) || col.key.toLowerCase().includes('credit') || col.key.toLowerCase().includes('debit') || col.key.toLowerCase().includes('points');
      if (shouldColorize) {
        if (value.startsWith('+') || (col.key.toLowerCase().includes('credit') && value)) {
          textColor = rgb(COLORS.success.r, COLORS.success.g, COLORS.success.b);
        } else if (value.startsWith('-') || (col.key.toLowerCase().includes('debit') && value)) {
          textColor = rgb(COLORS.danger.r, COLORS.danger.g, COLORS.danger.b);
        }
      }

      const lowerValue = value.toLowerCase();
      if (col.key.toLowerCase().includes('status') && STATUS_COLORS[lowerValue]) {
        textColor = rgb(STATUS_COLORS[lowerValue].text.r, STATUS_COLORS[lowerValue].text.g, STATUS_COLORS[lowerValue].text.b);
      }

      page.drawText(displayValue, {
        x: xPos,
        y: yPosition - 12,
        size: 8,
        font: regularFont,
        color: textColor,
      });
      xPos += colWidths[colIndex];
    });

    yPosition -= rowHeight;
  });

  if (data.length > maxRows) {
    yPosition -= 10;
    page.drawText(`... and ${data.length - maxRows} more rows (download CSV for full data)`, {
      x: margin,
      y: yPosition,
      size: 8,
      font: regularFont,
      color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
    });
    yPosition -= 15;
  }

  return yPosition;
}

async function drawCertificate(
  page: any,
  regularFont: any,
  boldFont: any,
  pageWidth: number,
  pageHeight: number,
  config?: TemplateConfig
): Promise<void> {
  const margin = 30;

  page.drawRectangle({
    x: margin,
    y: margin,
    width: pageWidth - 2 * margin,
    height: pageHeight - 2 * margin,
    borderColor: rgb(COLORS.info.r, COLORS.info.g, COLORS.info.b),
    borderWidth: 3,
  });

  page.drawRectangle({
    x: margin + 8,
    y: margin + 8,
    width: pageWidth - 2 * margin - 16,
    height: pageHeight - 2 * margin - 16,
    borderColor: rgb(0.58, 0.77, 0.99),
    borderWidth: 1,
  });

  let y = pageHeight - 60;

  page.drawText('WORKLY INDIA', {
    x: pageWidth / 2 - 60,
    y: y,
    size: 32,
    font: boldFont,
    color: rgb(COLORS.brandDark.r, COLORS.brandDark.g, COLORS.brandDark.b),
  });
  y -= 25;

  page.drawText('Certificate of Achievement', {
    x: pageWidth / 2 - 80,
    y: y,
    size: 16,
    font: regularFont,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });
  y -= 15;

  page.drawLine({
    start: { x: pageWidth / 2 - 60, y: y },
    end: { x: pageWidth / 2 + 60, y: y },
    thickness: 1,
    color: rgb(COLORS.info.r, COLORS.info.g, COLORS.info.b),
  });
  y -= 25;

  page.drawText('This is to certify that', {
    x: pageWidth / 2 - 55,
    y: y,
    size: 11,
    font: regularFont,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });
  y -= 30;

  const userName = config?.userName || 'User';
  const nameWidth = boldFont.widthOfTextAtSize(userName, 28);
  page.drawText(userName, {
    x: pageWidth / 2 - nameWidth / 2,
    y: y,
    size: 28,
    font: boldFont,
    color: rgb(COLORS.dark.r, COLORS.dark.g, COLORS.dark.b),
  });
  y -= 25;

  page.drawText('has successfully completed the', {
    x: pageWidth / 2 - 75,
    y: y,
    size: 11,
    font: regularFont,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });
  y -= 25;

  const skillName = config?.skillName || 'Skill Assessment';
  const skillWidth = boldFont.widthOfTextAtSize(skillName, 20);
  page.drawText(skillName, {
    x: pageWidth / 2 - skillWidth / 2,
    y: y,
    size: 20,
    font: boldFont,
    color: rgb(COLORS.info.r, COLORS.info.g, COLORS.info.b),
  });
  y -= 25;

  const level = config?.level || 'Beginner';
  const levelColor = LEVEL_COLORS[level] || COLORS.info;
  const levelWidth = 60;
  const levelHeight = 18;

  page.drawRectangle({
    x: pageWidth / 2 - levelWidth / 2,
    y: y - levelHeight + 5,
    width: levelWidth,
    height: levelHeight,
    color: rgb(levelColor.r, levelColor.g, levelColor.b),
  });

  const levelTextWidth = boldFont.widthOfTextAtSize(level, 11);
  page.drawText(level, {
    x: pageWidth / 2 - levelTextWidth / 2,
    y: y - 8,
    size: 11,
    font: boldFont,
    color: rgb(COLORS.white.r, COLORS.white.g, COLORS.white.b),
  });
  y -= 30;

  if (config?.score !== undefined) {
    page.drawText(`with a score of ${config.score}%`, {
      x: pageWidth / 2 - 50,
      y: y,
      size: 11,
      font: regularFont,
      color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
    });
    y -= 25;
  }

  if (config?.issuedAt) {
    const issueDate = formatDate(new Date(config.issuedAt));
    page.drawText(`Issued on: ${issueDate}`, {
      x: pageWidth / 2 - 45,
      y: y,
      size: 10,
      font: regularFont,
      color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
    });
    y -= 18;
  }

  if (config?.certificateNumber) {
    page.drawText(`Certificate No: ${config.certificateNumber}`, {
      x: pageWidth / 2 - 65,
      y: y,
      size: 9,
      font: regularFont,
      color: rgb(0.58, 0.64, 0.72),
    });
    y -= 15;
  }

  if (config?.verificationUrl) {
    page.drawText(`Verify at: ${config.verificationUrl}`, {
      x: pageWidth / 2 - 90,
      y: y,
      size: 8,
      font: regularFont,
      color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
    });
  }

  const sigY = margin + 60;
  
  page.drawLine({
    start: { x: 100, y: sigY },
    end: { x: 200, y: sigY },
    thickness: 0.5,
    color: rgb(0.8, 0.84, 0.88),
  });
  page.drawText('Authorized Signature', {
    x: 115,
    y: sigY - 12,
    size: 9,
    font: regularFont,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });

  page.drawLine({
    start: { x: pageWidth - 200, y: sigY },
    end: { x: pageWidth - 100, y: sigY },
    thickness: 0.5,
    color: rgb(0.8, 0.84, 0.88),
  });
  page.drawText('Workly India', {
    x: pageWidth - 165,
    y: sigY - 12,
    size: 9,
    font: regularFont,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });

  page.drawText('Empowering Workly India Professionals Across India', {
    x: pageWidth / 2 - 120,
    y: margin + 20,
    size: 8,
    font: regularFont,
    color: rgb(0.58, 0.64, 0.72),
  });
}

function drawFooter(page: any, font: any, pageWidth: number, pageNum: number, totalPages: number): void {
  const footerY = 20;
  // Use centralized domain from _shared/domain.ts (imported at top of file)
  const PRODUCTION_DOMAIN = CANONICAL_DOMAIN;
  
  page.drawText(`Workly India - India's #1 Remote Jobs Platform | ${PRODUCTION_DOMAIN}`, {
    x: 40,
    y: footerY,
    size: 7,
    font: font,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });

  const pageText = `Page ${pageNum} of ${totalPages}`;
  const textWidth = font.widthOfTextAtSize(pageText, 8);
  page.drawText(pageText, {
    x: pageWidth - 40 - textWidth,
    y: footerY,
    size: 8,
    font: font,
    color: rgb(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b),
  });
}

// ============ COVER LETTER PDF - BLUE PEN HANDWRITTEN STYLE ============
async function drawCoverLetterPDF(
  pdfDoc: any,
  page: any,
  regularFont: any,
  boldFont: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  config?: TemplateConfig
): Promise<void> {
  // Blue pen ink color - like ballpoint pen
  const blueInk = rgb(0, 0.24, 0.65);
  const lightBlueInk = rgb(0.1, 0.35, 0.75);
  
  // Cream paper background
  const paperBg = rgb(0.99, 0.98, 0.95);
  
  // Embed italic font for handwritten feel
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const boldItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  
  // Draw cream paper background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: paperBg,
  });
  
  // Draw subtle border like letterhead paper
  page.drawRectangle({
    x: 20,
    y: 20,
    width: pageWidth - 40,
    height: pageHeight - 40,
    borderColor: rgb(0.85, 0.82, 0.78),
    borderWidth: 0.5,
  });
  
  // Draw decorative top line
  page.drawLine({
    start: { x: margin, y: pageHeight - 45 },
    end: { x: pageWidth - margin, y: pageHeight - 45 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  
  let y = pageHeight - 35;
  
  // Date - top right, blue ink, italic
  const dateText = config?.applicationDate || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const dateWidth = italicFont.widthOfTextAtSize(dateText, 11);
  page.drawText(dateText, {
    x: pageWidth - margin - dateWidth,
    y: y,
    size: 11,
    font: italicFont,
    color: blueInk,
  });
  
  // "Cover Letter" heading - centered
  y = pageHeight - 65;
  const headingText = 'Cover Letter';
  const headingWidth = boldFont.widthOfTextAtSize(headingText, 20);
  page.drawText(headingText, {
    x: (pageWidth - headingWidth) / 2,
    y: y,
    size: 20,
    font: boldFont,
    color: blueInk,
  });
  
  // Greeting
  y -= 45;
  page.drawText('Dear Hiring Manager,', {
    x: margin,
    y: y,
    size: 12,
    font: italicFont,
    color: blueInk,
  });
  
  // Main content - blue ink, natural handwritten style
  y -= 30;
  const content = config?.coverLetterContent || '';
  const contentWidth = pageWidth - (margin * 2);
  const lineHeight = 22; // More space for handwritten feel
  
  // Split content into paragraphs
  const paragraphs = content.split('\n').filter(p => p.trim());
  
  for (const paragraph of paragraphs) {
    // Skip lines with "Bio:" or "Not specified"
    if (paragraph.toLowerCase().startsWith('bio:') ||
        paragraph.includes('Not specified') ||
        paragraph.includes('Not provided')) {
      continue;
    }
    
    // Word wrap the paragraph
    const words = paragraph.trim().split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = italicFont.widthOfTextAtSize(testLine, 12);
      
      if (testWidth > contentWidth) {
        // Draw current line
        if (currentLine) {
          // Check if we need a new page
          if (y < margin + 100) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            // Redraw paper background on new page
            page.drawRectangle({
              x: 0,
              y: 0,
              width: pageWidth,
              height: pageHeight,
              color: paperBg,
            });
            page.drawRectangle({
              x: 20,
              y: 20,
              width: pageWidth - 40,
              height: pageHeight - 40,
              borderColor: rgb(0.85, 0.82, 0.78),
              borderWidth: 0.5,
            });
            y = pageHeight - 50;
          }
          
          page.drawText(currentLine, {
            x: margin,
            y: y,
            size: 12,
            font: italicFont,
            color: blueInk,
          });
          y -= lineHeight;
        }
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text in the line
    if (currentLine) {
      if (y < margin + 100) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          color: paperBg,
        });
        page.drawRectangle({
          x: 20,
          y: 20,
          width: pageWidth - 40,
          height: pageHeight - 40,
          borderColor: rgb(0.85, 0.82, 0.78),
          borderWidth: 0.5,
        });
        y = pageHeight - 50;
      }
      
      page.drawText(currentLine, {
        x: margin,
        y: y,
        size: 12,
        font: italicFont,
        color: blueInk,
      });
      y -= lineHeight;
    }
    
    // Add paragraph spacing
    y -= 8;
  }
  
  // Closing - "Warm Regards,"
  y -= 15;
  page.drawText('Warm Regards,', {
    x: margin,
    y: y,
    size: 12,
    font: italicFont,
    color: blueInk,
  });
  
  // ============ REALISTIC HANDWRITTEN SIGNATURE ============
  y -= 40;
  const signX = margin;
  const signY = y;
  const applicantName = config?.applicantName || 'Applicant';
  
  // Get first name for signature style (usually signatures are first name based)
  const firstName = applicantName.split(' ')[0];
  const lastName = applicantName.split(' ').slice(1).join(' ');
  
  // Draw flowing signature curves in blue ink
  // Start with a large capital letter loop
  const startX = signX;
  const startY = signY;
  
  // Main signature stroke - flowing curve (capital letter start)
  page.drawLine({
    start: { x: startX, y: startY },
    end: { x: startX + 8, y: startY + 12 },
    thickness: 1.2,
    color: blueInk,
  });
  
  page.drawLine({
    start: { x: startX + 8, y: startY + 12 },
    end: { x: startX + 18, y: startY + 15 },
    thickness: 1.1,
    color: blueInk,
  });
  
  // Loop down
  page.drawLine({
    start: { x: startX + 18, y: startY + 15 },
    end: { x: startX + 25, y: startY + 8 },
    thickness: 1.0,
    color: blueInk,
  });
  
  page.drawLine({
    start: { x: startX + 25, y: startY + 8 },
    end: { x: startX + 30, y: startY - 2 },
    thickness: 0.9,
    color: blueInk,
  });
  
  // Flowing middle section
  page.drawLine({
    start: { x: startX + 30, y: startY - 2 },
    end: { x: startX + 45, y: startY + 3 },
    thickness: 0.8,
    color: blueInk,
  });
  
  page.drawLine({
    start: { x: startX + 45, y: startY + 3 },
    end: { x: startX + 55, y: startY - 1 },
    thickness: 0.7,
    color: blueInk,
  });
  
  // Rising curve
  page.drawLine({
    start: { x: startX + 55, y: startY - 1 },
    end: { x: startX + 70, y: startY + 6 },
    thickness: 0.8,
    color: blueInk,
  });
  
  // Small loop
  page.drawLine({
    start: { x: startX + 70, y: startY + 6 },
    end: { x: startX + 75, y: startY + 10 },
    thickness: 0.7,
    color: blueInk,
  });
  
  page.drawLine({
    start: { x: startX + 75, y: startY + 10 },
    end: { x: startX + 82, y: startY + 5 },
    thickness: 0.6,
    color: blueInk,
  });
  
  // Descending flourish
  page.drawLine({
    start: { x: startX + 82, y: startY + 5 },
    end: { x: startX + 95, y: startY - 5 },
    thickness: 0.7,
    color: blueInk,
  });
  
  // Final tail
  page.drawLine({
    start: { x: startX + 95, y: startY - 5 },
    end: { x: startX + 110, y: startY - 3 },
    thickness: 0.5,
    color: blueInk,
  });
  
  // Additional decorative loops for longer names
  if (lastName) {
    page.drawLine({
      start: { x: startX + 110, y: startY - 3 },
      end: { x: startX + 120, y: startY + 2 },
      thickness: 0.6,
      color: blueInk,
    });
    
    page.drawLine({
      start: { x: startX + 120, y: startY + 2 },
      end: { x: startX + 135, y: startY - 4 },
      thickness: 0.5,
      color: blueInk,
    });
    
    page.drawLine({
      start: { x: startX + 135, y: startY - 4 },
      end: { x: startX + 150, y: startY - 2 },
      thickness: 0.4,
      color: blueInk,
    });
  }
  
  // Signature underline with slight wave
  const underlineY = signY - 12;
  page.drawLine({
    start: { x: startX, y: underlineY },
    end: { x: startX + 40, y: underlineY + 1 },
    thickness: 0.5,
    color: lightBlueInk,
  });
  
  page.drawLine({
    start: { x: startX + 40, y: underlineY + 1 },
    end: { x: startX + 80, y: underlineY - 1 },
    thickness: 0.5,
    color: lightBlueInk,
  });
  
  page.drawLine({
    start: { x: startX + 80, y: underlineY - 1 },
    end: { x: startX + (lastName ? 150 : 110), y: underlineY },
    thickness: 0.4,
    color: lightBlueInk,
  });
  
  // Print name below signature in blue ink
  y = underlineY - 20;
  page.drawText(applicantName, {
    x: margin,
    y: y,
    size: 13,
    font: boldItalicFont,
    color: blueInk,
  });
}

// ============ UTILITY FUNCTIONS ============
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function truncateText(text: string, maxWidth: number, fontSize: number): string {
  const avgCharWidth = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}
