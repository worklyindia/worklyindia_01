/**
 * High-Quality PDF Generator for Resumes
 * Uses html2canvas + jsPDF for direct download (no print dialog)
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generateResumePDF = async (elementId: string, fileName: string = 'resume.pdf'): Promise<void> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Resume preview element not found');
    }

    // Check if element has visible content
    if (element.offsetHeight === 0 || element.offsetWidth === 0) {
      throw new Error('Element has no visible dimensions');
    }

    // Create high-quality canvas from the element
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    // Calculate dimensions for A4 page (210mm x 297mm)
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: imgHeight > imgWidth ? 'portrait' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add image to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Handle multi-page if content is too long
    let heightLeft = imgHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Trigger direct download (no view)
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};

export const generateShareableLink = (resumeData: any): string => {
  const encodedData = btoa(JSON.stringify(resumeData));
  return `${window.location.origin}/resume-preview?data=${encodedData}`;
};

/**
 * Download resume as different formats
 */
export const downloadResumeAsFormat = async (
  elementId: string,
  format: 'pdf' | 'html' | 'txt',
  fileName: string = 'resume'
): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Resume element not found');
  }

  switch (format) {
    case 'pdf':
      return generateResumePDF(elementId, `${fileName}.pdf`);
    
    case 'html':
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 20px; font-family: 'Inter', sans-serif; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  ${element.innerHTML}
</body>
</html>`;
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      downloadBlob(htmlBlob, `${fileName}.html`);
      break;
    
    case 'txt':
      const textContent = element.innerText;
      const txtBlob = new Blob([textContent], { type: 'text/plain' });
      downloadBlob(txtBlob, `${fileName}.txt`);
      break;
  }
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Single-page A4 HD PDF generator.
 * Auto-scales the source node down so ALL content fits on one A4 page.
 * Uses PNG capture + font-ready wait for crisp text on mobile.
 */
export const generateSinglePageResumePDF = async (
  elementId: string,
  fileName: string = 'resume.pdf'
): Promise<void> => {
  const element = document.getElementById(elementId) as HTMLElement | null;
  if (!element) throw new Error('Resume element not found');

  // Wait for web fonts so text is sharp
  try {
    // @ts-ignore
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {}

  // A4 at 96dpi (px): 794 x 1123
  const A4_W = 794;
  const A4_H = 1123;

  // Save original inline styles we may touch
  const original = {
    width: element.style.width,
    minHeight: element.style.minHeight,
    transform: element.style.transform,
    transformOrigin: element.style.transformOrigin,
    background: element.style.background,
  };

  // Force node to A4 width so we measure at the target page size
  element.style.width = A4_W + 'px';
  element.style.minHeight = 'auto';
  element.style.transform = 'none';
  element.style.background = '#ffffff';

  // Give the browser a tick to relayout
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const contentHeight = element.scrollHeight;
  const scale = Math.min(1, A4_H / contentHeight);

  // Apply scale so everything fits on one page
  if (scale < 1) {
    element.style.transformOrigin = 'top left';
    element.style.transform = `scale(${scale})`;
  }

  await new Promise((r) => requestAnimationFrame(() => r(null)));

  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: A4_W,
      height: A4_H,
      windowWidth: A4_W,
      windowHeight: A4_H,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.save(fileName);
  } finally {
    // Restore
    element.style.width = original.width;
    element.style.minHeight = original.minHeight;
    element.style.transform = original.transform;
    element.style.transformOrigin = original.transformOrigin;
    element.style.background = original.background;
  }
};

