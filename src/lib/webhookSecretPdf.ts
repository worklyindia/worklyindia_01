import { jsPDF } from "jspdf";

export type WebhookSecretDocument = { url: string; secret: string; events: string[]; description?: string };

export function downloadWebhookSecretPdf(d: WebhookSecretDocument) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  doc.setProperties({ title: "Webhook credentials", creator: "Workly India Developer Portal" });

  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Webhook Credentials", margin, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Workly India Developer Portal", margin, 32);

  let y = 56;
  const addField = (label: string, value: string) => {
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(value, contentWidth - 8) as string[];
    const boxHeight = Math.max(13, lines.length * 5 + 8);
    if (y + boxHeight + 16 > pageHeight - 20) { doc.addPage(); y = 24; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text(label.toUpperCase(), margin, y);
    y += 6;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");
    doc.text(lines, margin + 4, y + 8);
    y += boxHeight + 10;
  };

  addField("Webhook URL", d.url);
  if (d.description) addField("Description", d.description);
  addField("Webhook secret", d.secret);
  addField("Events", d.events.join(", "));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(doc.splitTextToSize("Keep this file private. Use the secret to verify the X-Webhook-Signature header (HMAC SHA-256). It cannot be shown again.", contentWidth), margin, y);

  let host = "webhook";
  try { host = new URL(d.url).hostname.replace(/[^a-z0-9-]+/gi, "-"); } catch { /* keep default */ }
  doc.save(`${host}-webhook-secret.pdf`);
}
