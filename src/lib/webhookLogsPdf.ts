import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type WebhookLogPdfRow = {
  event: string;
  status: string;
  response_status: number | null;
  error_message: string | null;
  created_at: string | null;
  endpoint: string;
};

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
});

const paper: [number, number, number] = [255, 255, 255];
const ink: [number, number, number] = [32, 33, 36];
const muted: [number, number, number] = [95, 99, 104];
const rule: [number, number, number] = [189, 193, 198];
const soft: [number, number, number] = [241, 243, 244];
const sheetGreen: [number, number, number] = [24, 128, 56];
const green: [number, number, number] = [22, 125, 77];
const red: [number, number, number] = [183, 54, 61];

function printable(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
}

export function downloadWebhookLogsPdf(rows: WebhookLogPdfRow[], label: string, start: Date, end: Date) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 8;
  const generatedAt = new Date();

  doc.setProperties({
    title: `Workbook Logs - ${label}`,
    subject: "Developer workbook delivery history",
    creator: "Workly India Developer Portal",
  });

  const header = () => {
    doc.setFillColor(...sheetGreen);
    doc.rect(0, 0, width, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text("Workbook Logs", margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("WORKLY INDIA / DEVELOPER PORTAL", margin, 20);
    doc.text(`${label} | ${rows.length.toLocaleString("en-IN")} deliveries`, width - margin, 14, { align: "right" });
    doc.setFontSize(7.5);
    doc.text(`Period: ${dateTime.format(start)} - ${dateTime.format(end)}`, margin, 26);
    doc.text(`Generated: ${dateTime.format(generatedAt)}`, width - margin, 26, { align: "right" });
    doc.setDrawColor(...rule);
    doc.line(margin, 29, width - margin, 29);
  };

  autoTable(doc, {
    startY: 32,
    margin: { top: 32, bottom: 13, left: margin, right: margin },
    theme: "grid",
    head: [["#", "DATE / TIME", "EVENT", "ENDPOINT", "STATUS", "HTTP", "ERROR DETAILS"]],
    body: rows.map((row, index) => [
      String(index + 1),
      row.created_at ? dateTime.format(new Date(row.created_at)) : "-",
      printable(row.event),
      printable(row.endpoint),
      printable(row.status),
      row.response_status == null ? "-" : String(row.response_status),
      printable(row.error_message || "-"),
    ]),
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, minCellHeight: 7, textColor: ink, lineColor: rule, lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: soft, textColor: ink, fontStyle: "bold", lineColor: rule, lineWidth: 0.2, halign: "left" },
    alternateRowStyles: { fillColor: paper },
    columnStyles: {
      0: { cellWidth: 9, halign: "right" },
      1: { cellWidth: 34 },
      2: { cellWidth: 38 },
      3: { cellWidth: 78 },
      4: { cellWidth: 20, fontStyle: "bold" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 82 },
    },
    willDrawPage: header,
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 4) return;
      data.cell.styles.textColor = String(data.cell.raw).toLowerCase() === "delivered" ? green : red;
    },
  });

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...muted);
    doc.text("No workbook deliveries in this period.", width / 2, 48, { align: "center" });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...rule);
    doc.line(margin, height - 10, width - margin, height - 10);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Workly India / Workbook delivery history", margin, height - 5);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 5, { align: "right" });
  }

  const fileDate = generatedAt.toLocaleDateString("en-CA");
  doc.save(`Workly_India_Workbook_Logs_${label.replace(/\s+/g, "_")}_${fileDate}.pdf`);
}