/**
 * Cover Letter PDF Generator - Handwritten Style
 * Creates a pen-and-paper aesthetic PDF
 */

import jsPDF from 'jspdf';

interface CoverLetterData {
  content: string;
  applicantName: string;
  date?: string;
}

export const generateCoverLetterPDF = (data: CoverLetterData, filename: string = 'cover-letter.pdf'): void => {
  const { content, applicantName, date } = data;
  
  // Create PDF with A4 dimensions
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - (margin * 2);
  
  // Paper-like cream background
  pdf.setFillColor(255, 253, 248);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Add subtle border like notebook paper
  pdf.setDrawColor(220, 215, 200);
  pdf.setLineWidth(0.5);
  pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);
  
  // Add decorative top line (like letterhead)
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 35, pageWidth - margin, 35);

  // Date on top right - elegant italic style
  const formattedDate = date || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  pdf.setFont('times', 'italic');
  pdf.setFontSize(11);
  pdf.setTextColor(80, 80, 80);
  pdf.text(formattedDate, pageWidth - margin, 28, { align: 'right' });

  // "Cover Letter" heading
  pdf.setFont('times', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(50, 50, 50);
  pdf.text('Cover Letter', pageWidth / 2, 50, { align: 'center' });

  // Main content - elegant serif font for handwritten feel
  pdf.setFont('times', 'normal');
  pdf.setFontSize(12);
  pdf.setTextColor(40, 40, 40);
  
  let yPosition = 65;
  const lineHeight = 7;
  
  // Add greeting
  pdf.setFont('times', 'italic');
  pdf.text('Dear Hiring Manager,', margin, yPosition);
  yPosition += lineHeight * 2;
  
  // Process content - split into paragraphs
  pdf.setFont('times', 'normal');
  const paragraphs = content.split('\n').filter(p => p.trim());
  
  paragraphs.forEach(paragraph => {
    // Skip "Bio:" lines or empty content
    if (paragraph.toLowerCase().startsWith('bio:') || 
        paragraph.includes('Not specified') || 
        paragraph.includes('Not provided')) {
      return;
    }
    
    // Word wrap the paragraph
    const lines = pdf.splitTextToSize(paragraph.trim(), contentWidth);
    
    lines.forEach((line: string) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        // Add background to new page
        pdf.setFillColor(255, 253, 248);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        pdf.setDrawColor(220, 215, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);
        yPosition = 35;
        pdf.setTextColor(40, 40, 40);
      }
      
      pdf.text(line, margin, yPosition);
      yPosition += lineHeight;
    });
    
    // Add paragraph spacing
    yPosition += lineHeight * 0.5;
  });
  
  // Add closing
  yPosition += lineHeight;
  pdf.setFont('times', 'italic');
  pdf.text('Warm Regards,', margin, yPosition);
  yPosition += lineHeight * 2;
  
  // Signature style name
  pdf.setFont('times', 'bolditalic');
  pdf.setFontSize(14);
  pdf.text(applicantName, margin, yPosition);
  
  // Add decorative signature line
  yPosition += 3;
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.2);
  pdf.line(margin, yPosition, margin + 50, yPosition);

  // Download the PDF
  pdf.save(filename);
};
