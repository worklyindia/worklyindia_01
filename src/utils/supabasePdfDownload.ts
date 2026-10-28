import { generateSinglePageResumePDF } from './pdfGenerator';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

async function renderNodeToPdfBlob(elementId: string): Promise<Blob> {
  const element = document.getElementById(elementId) as HTMLElement | null;
  if (!element) throw new Error('Render node not found');
  try { // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {}
  const A4_W = 794, A4_H = 1123;
  const orig = {
    width: element.style.width, minHeight: element.style.minHeight,
    transform: element.style.transform, transformOrigin: element.style.transformOrigin,
    background: element.style.background,
  };
  element.style.width = A4_W + 'px';
  element.style.minHeight = 'auto';
  element.style.transform = 'none';
  element.style.background = '#ffffff';
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const contentHeight = element.scrollHeight;
  const scale = Math.min(1, A4_H / contentHeight);
  if (scale < 1) {
    element.style.transformOrigin = 'top left';
    element.style.transform = `scale(${scale})`;
  }
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  try {
    const canvas = await html2canvas(element, {
      scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
      logging: false, width: A4_W, height: A4_H, windowWidth: A4_W, windowHeight: A4_H,
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    return pdf.output('blob');
  } finally {
    element.style.width = orig.width;
    element.style.minHeight = orig.minHeight;
    element.style.transform = orig.transform;
    element.style.transformOrigin = orig.transformOrigin;
    element.style.background = orig.background;
  }
}

/**
 * Generate PDF locally from a hidden render node and trigger a browser download.
 * NOTE: intentionally does NOT upload to Supabase Storage or write to the database
 * to keep storage/DB usage low. Name kept for backwards compatibility.
 */
export async function downloadPdfViaSupabase(elementId: string, fileName: string): Promise<void> {
  const blob = await renderNodeToPdfBlob(elementId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { generateSinglePageResumePDF };
