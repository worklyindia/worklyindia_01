import jsPDF from "jspdf";
import type { UserCertificate } from "@/types/assessment";
import { SITE_CONFIG } from "@/config/siteConfig";
import { downloadViaEdgeFunction, formatCertificateForDownload, type CertificateData } from "./edgeFunctionDownload";

// Local PDF generation (fallback)
export const generateCertificatePDF = async (
  certificate: UserCertificate,
  userName: string
) => {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();

  // Background gradient effect (using rectangles with varying opacity)
  pdf.setFillColor(249, 250, 251);
  pdf.rect(0, 0, width, height, "F");

  // Border
  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(2);
  pdf.rect(10, 10, width - 20, height - 20);

  // Inner border
  pdf.setDrawColor(147, 197, 253);
  pdf.setLineWidth(0.5);
  pdf.rect(12, 12, width - 24, height - 24);

  // Header - Workly India Logo/Title
  pdf.setFontSize(32);
  pdf.setTextColor(30, 64, 175);
  pdf.setFont("helvetica", "bold");
  pdf.text("WORKLY INDIA", width / 2, 30, { align: "center" });

  // Certificate of Achievement
  pdf.setFontSize(18);
  pdf.setTextColor(100, 116, 139);
  pdf.setFont("helvetica", "normal");
  pdf.text("Certificate of Achievement", width / 2, 40, { align: "center" });

  // Decorative line
  pdf.setDrawColor(59, 130, 246);
  pdf.setLineWidth(0.5);
  pdf.line(width / 2 - 40, 45, width / 2 + 40, 45);

  // This is to certify that
  pdf.setFontSize(12);
  pdf.setTextColor(71, 85, 105);
  pdf.text("This is to certify that", width / 2, 60, { align: "center" });

  // User Name (larger and bold)
  pdf.setFontSize(28);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.text(userName, width / 2, 75, { align: "center" });

  // Achievement text
  pdf.setFontSize(12);
  pdf.setTextColor(71, 85, 105);
  pdf.setFont("helvetica", "normal");
  pdf.text("has successfully completed the", width / 2, 85, { align: "center" });

  // Skill Name
  pdf.setFontSize(20);
  pdf.setTextColor(59, 130, 246);
  pdf.setFont("helvetica", "bold");
  pdf.text(certificate.skill_name, width / 2, 95, { align: "center" });

  // Level badge
  const levelColors: Record<string, [number, number, number]> = {
    Expert: [147, 51, 234],
    Advanced: [59, 130, 246],
    Intermediate: [234, 179, 8],
    Beginner: [34, 197, 94],
  };

  const levelColor = levelColors[certificate.level] || [59, 130, 246];
  pdf.setFillColor(...levelColor);
  pdf.roundedRect(width / 2 - 20, 100, 40, 10, 2, 2, "F");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text(certificate.level, width / 2, 106.5, { align: "center" });

  // Score
  pdf.setFontSize(12);
  pdf.setTextColor(71, 85, 105);
  pdf.setFont("helvetica", "normal");
  pdf.text(`with a score of ${certificate.score}%`, width / 2, 118, {
    align: "center",
  });

  // Issue date
  const issueDate = new Date(certificate.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Issued on: ${issueDate}`, width / 2, 130, { align: "center" });

  // Certificate number
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Certificate No: ${certificate.certificate_number}`, width / 2, 138, {
    align: "center",
  });

  // Verification URL
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  const verificationUrl = `${SITE_CONFIG.PRODUCTION_DOMAIN}${certificate.verification_url}`;
  pdf.text(`Verify at: ${verificationUrl}`, width / 2, 145, { align: "center" });

  // Footer signature area
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.line(40, 165, 90, 165);
  pdf.line(width - 90, 165, width - 40, 165);

  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text("Authorized Signature", 65, 170, { align: "center" });
  pdf.text("Workly India", width - 65, 170, { align: "center" });

  // Bottom decorative text
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Empowering Workly India Professionals Across India", width / 2, 185, {
    align: "center",
  });

  return pdf;
};

// Download certificate using Edge Function (primary method)
export const downloadCertificate = async (
  certificate: UserCertificate,
  userName: string
) => {
  try {
    // Try Edge Function first for professional styled PDF
    const certData: CertificateData = {
      certificate_number: certificate.certificate_number,
      skill_name: certificate.skill_name,
      level: certificate.level,
      score: certificate.score,
      issued_at: certificate.issued_at,
      expires_at: certificate.expires_at || undefined,
      verification_url: `${SITE_CONFIG.PRODUCTION_DOMAIN}${certificate.verification_url}`,
    };

    const { data, config } = formatCertificateForDownload(certData, userName);
    
    const success = await downloadViaEdgeFunction(
      'pdf',
      `Workly-India-Certificate-${certificate.certificate_number}`,
      data,
      'certificate',
      config
    );

    if (success) return;

    // Fallback to local generation
    console.log('Edge function failed, using local PDF generation');
    const pdf = await generateCertificatePDF(certificate, userName);
    const fileName = `Workly-India-Certificate-${certificate.certificate_number}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error('Certificate download error:', error);
    // Fallback to local generation
    const pdf = await generateCertificatePDF(certificate, userName);
    const fileName = `Workly-India-Certificate-${certificate.certificate_number}.pdf`;
    pdf.save(fileName);
  }
};
