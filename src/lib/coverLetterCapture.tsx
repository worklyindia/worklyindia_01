import "@/lib/signatureFonts";
/**
 * Off-screen renderer for cover letter templates.
 *
 * Mounts the exact <CoverLetterRender /> component the user sees in the
 * preview into a detached DOM node, waits for fonts + images to settle,
 * and captures a high-DPI canvas. That canvas is then used to generate
 * PDF / DOCX / Print outputs so the downloaded file matches the preview
 * pixel-for-pixel (colors, layout, sidebar, signature, typography, etc.).
 *
 * Mirrors the pipeline in resumeCapture.tsx.
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { CoverLetterRender } from '@/components/cover-letter-create/CoverLetterTemplates';
import type { CoverLetterDraft, CoverLetterTemplate } from '@/hooks/useCoverLetterDraft';

const A4_WIDTH_PX = 794;   // 210mm @ 96dpi
const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi

// Signature script fonts used by the preview. Ensure they're loaded so the
// captured canvas doesn't fall back to a system font.
const SIG_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Aguafina+Script&family=Alex+Brush&family=Allura&family=Arizonia&family=Bilbo&family=Bilbo+Swash+Caps&family=Caveat:wght@400;700&family=Cedarville+Cursive&family=Clicker+Script&family=Dancing+Script:wght@400;700&family=Euphoria+Script&family=Great+Vibes&family=Herr+Von+Muellerhoff&family=Homemade+Apple&family=Italianno&family=Kaushan+Script&family=Marck+Script&family=Monsieur+La+Doulaise&family=Mrs+Saint+Delafield&family=Pacifico&family=Parisienne&family=Pinyon+Script&family=Qwigley&family=Rochester&family=Sacramento&family=Satisfy&family=Sofia&family=Tangerine:wght@400;700&family=WindSong:wght@400;500&family=Yellowtail&display=swap';

const SIG_FONT_FAMILIES = [
  'Great Vibes',
  'Dancing Script',
  'Homemade Apple',
  'Sacramento',
  'Allura',
  'Alex Brush',
  'Kaushan Script',
  'Satisfy',
  'Pacifico',
  'Caveat',
  'Yellowtail',
  'Parisienne',
  'Monsieur La Doulaise',
  'Tangerine',
  'Mrs Saint Delafield',
  'Pinyon Script',
  'Herr Von Muellerhoff',
  'Rochester',
  'Qwigley',
  'Italianno',
  'Arizonia',
  'Marck Script',
  'Bilbo',
  'Bilbo Swash Caps',
  'Aguafina Script',
  'Cedarville Cursive',
  'Clicker Script',
  'Sofia',
  'WindSong',
  'Euphoria Script',
];

const ensureSignatureFonts = () => {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector(`link[data-cover-letter-fonts]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = SIG_FONTS_HREF;
  link.setAttribute('data-cover-letter-fonts', 'true');
  document.head.appendChild(link);
};

// Force-load signature fonts so html2canvas doesn't fall back to a system font
// when the user picks a handwriting style but never uses it elsewhere on the page.
const preloadSignatureFonts = async () => {
  try {
    // @ts-ignore
    if (!document.fonts?.load) return;
    await Promise.all(
      SIG_FONT_FAMILIES.map((family) =>
        // @ts-ignore
        document.fonts.load(`34px "${family}"`).catch(() => undefined),
      ),
    );
  } catch { /* ignore */ }
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
          const el = img as HTMLImageElement;
          if (el.complete && el.naturalWidth > 0) return resolve();
          el.addEventListener('load', () => resolve(), { once: true });
          el.addEventListener('error', () => resolve(), { once: true });
          setTimeout(() => resolve(), 4000);
        }),
    ),
  );

export const captureCoverLetter = async (
  templateName: string | undefined,
  draft: CoverLetterDraft,
): Promise<HTMLCanvasElement> => {
  ensureSignatureFonts();

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
      root!.render(
        <CoverLetterRender
          draft={draft}
          template={(templateName as CoverLetterTemplate) || draft.template}
        />,
      );
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const node = (host.firstElementChild as HTMLElement) || host;
    node.style.width = `${A4_WIDTH_PX}px`;
    node.style.minWidth = `${A4_WIDTH_PX}px`;
    node.style.maxWidth = `${A4_WIDTH_PX}px`;
    node.style.height = `${A4_HEIGHT_PX}px`;
    node.style.minHeight = `${A4_HEIGHT_PX}px`;
    node.style.maxHeight = `${A4_HEIGHT_PX}px`;
    node.style.boxSizing = 'border-box';

    await waitForFonts();
    await preloadSignatureFonts();
    await waitForImages(node);
    // Small extra tick for any post-image reflow / font swap.
    await new Promise((r) => setTimeout(r, 120));

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
