/**
 * Off-screen renderer for resume templates.
 * Mounts the exact React preview template (from ALL_RESUME_TEMPLATES)
 * into a hidden container, waits for fonts + images, and captures a
 * high-DPI canvas that is used to produce PDF / DOCX / Print outputs.
 *
 * Because we render the same component the user sees in the preview,
 * downloads visually match the preview 1:1 — including circular
 * profile photos (Avatar uses borderRadius: 50%).
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import { ALL_RESUME_TEMPLATES, ResumeData, ResumeTemplateId } from '@/components/resume/templates/AllResumeTemplates';

const A4_WIDTH_PX = 794;   // 210mm @ 96dpi
const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi

const resolveTemplate = (name: string) => {
  const keys = Object.keys(ALL_RESUME_TEMPLATES) as ResumeTemplateId[];
  const exact = keys.find((k) => k.toLowerCase() === (name || '').toLowerCase());
  if (exact) return ALL_RESUME_TEMPLATES[exact];
  // Fallback to Professional
  return ALL_RESUME_TEMPLATES.Professional;
};

const waitForFonts = async () => {
  try {
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;
  } catch { /* ignore */ }
};

const waitForImages = (root: HTMLElement) =>
  Promise.all(
    Array.from(root.querySelectorAll('img')).map(
      (img) =>
        new Promise<void>((resolve) => {
          if ((img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0) return resolve();
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          // safety timeout
          setTimeout(() => resolve(), 4000);
        }),
    ),
  );

/**
 * Render the resume template into a detached DOM node and capture it.
 * Returns a canvas at 2× DPR so both PDF and DOCX images stay crisp.
 */
export const captureResume = async (
  templateName: string,
  resumeData: ResumeData,
): Promise<HTMLCanvasElement> => {
  const Template = resolveTemplate(templateName);

  // Host stays laid out at (0,0) so mobile browsers render the full A4 node.
  // Do NOT hide it with visibility/opacity/clip-path: html2canvas respects
  // those properties and captures a white page. A negative z-index keeps the
  // temporary render behind the app while preserving pixels for capture.
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = `${A4_WIDTH_PX}px`;
  host.style.height = `${A4_HEIGHT_PX}px`;
  host.style.background = '#ffffff';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  host.style.overflow = 'hidden';
  host.style.contain = 'layout size';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    await new Promise<void>((resolve) => {
      flushSync(() => {
        root!.render(<Template resumeData={resumeData} />);
      });
      // Two RAFs so React has committed and layout is settled.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const node = host.querySelector<HTMLElement>('#resume-preview') || host.firstElementChild as HTMLElement;
    if (!node) throw new Error('Resume preview node not found');

    // Force explicit A4 sizing on the captured node so mobile viewport
    // constraints can't shrink it during html2canvas cloning.
    node.style.width = `${A4_WIDTH_PX}px`;
    node.style.minWidth = `${A4_WIDTH_PX}px`;
    node.style.maxWidth = `${A4_WIDTH_PX}px`;
    node.style.height = `${A4_HEIGHT_PX}px`;
    node.style.minHeight = `${A4_HEIGHT_PX}px`;
    node.style.maxHeight = `${A4_HEIGHT_PX}px`;
    node.style.boxSizing = 'border-box';

    await waitForFonts();
    await waitForImages(node);
    // Small extra tick for any post-image reflow
    await new Promise((r) => setTimeout(r, 80));

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      windowWidth: A4_WIDTH_PX,
      windowHeight: A4_HEIGHT_PX,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      foreignObjectRendering: false,
      imageTimeout: 8000,
    });
    return canvas;
  } finally {
    try { root?.unmount(); } catch { /* ignore */ }
    try { document.body.removeChild(host); } catch { /* ignore */ }
  }
};

/**
 * Serialize the resume template into a standalone HTML document string
 * suitable for opening in a new window and printing. Inlines the
 * component's rendered markup along with all stylesheets on the page so
 * fonts/colors match the preview.
 */
export const renderResumePrintHtml = async (
  templateName: string,
  resumeData: ResumeData,
  title = 'Resume',
): Promise<string> => {
  const Template = resolveTemplate(templateName);
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = `${A4_WIDTH_PX}px`;
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    await new Promise<void>((resolve) => {
      root!.render(<Template resumeData={resumeData} />);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    await waitForFonts();
    await waitForImages(host);

    const inner = host.innerHTML;

    // Pull all styles from the current document so preview CSS applies in the print window.
    const styleTags = Array.from(document.querySelectorAll('style'))
      .map((s) => s.outerHTML)
      .join('\n');
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => l.outerHTML)
      .join('\n');
    // Google fonts used by templates
    const fontLink = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@300;400;500;600;700;800&family=Nunito:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
${fontLink}
${linkTags}
${styleTags}
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { display: flex; justify-content: center; }
  #resume-preview { box-shadow: none !important; }
</style>
</head><body>${inner}</body></html>`;
  } finally {
    try { root?.unmount(); } catch { /* ignore */ }
    try { document.body.removeChild(host); } catch { /* ignore */ }
  }
};
