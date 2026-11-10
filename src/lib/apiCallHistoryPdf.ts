import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type CallHistoryRow = { id: string; calls: number; amount: number; source: string; created_at: string };
export const callHistoryLabels: Record<string, string> = { purchase: "Increase API Calls", topup: "Auto-Top-Up", free: "Free Monthly Calls" };
export const callHistoryDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
export const callHistoryTime = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

export function downloadApiCallHistoryPdf(rows: CallHistoryRow[], start: Date, end: Date) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: "API Call History - 30 Days", subject: "API call balance additions", creator: "Workly India Developer Portal" });
  autoTable(doc, {
    startY: 32,
    margin: { top: 32, bottom: 13, left: 8, right: 8 },
    theme: "grid",
    head: [["#", "DATE (IST)", "TIME (IST)", "SOURCE", "CALLS ADDED", "AMOUNT"]],
    body: rows.map((row, index) => [String(index + 1), callHistoryDate.format(new Date(row.created_at)), callHistoryTime.format(new Date(row.created_at)).toUpperCase(), callHistoryLabels[row.source] ?? callHistoryLabels.purchase, `+${Number(row.calls).toLocaleString("en-IN")}`, Number(row.amount) > 0 ? `INR ${Number(row.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Free"]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, minCellHeight: 8, textColor: [32, 33, 36], lineColor: [189, 193, 198], lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [241, 243, 244], textColor: [32, 33, 36], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 12, halign: "right" }, 1: { cellWidth: 52 }, 2: { cellWidth: 38 }, 3: { cellWidth: 89 }, 4: { cellWidth: 45, halign: "right" }, 5: { cellWidth: 45, halign: "right" } },
    willDrawPage: () => {
      doc.setFillColor(24, 128, 56);
      doc.rect(0, 0, width, 5, "F");
      doc.setTextColor(32, 33, 36);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("API Call History", 8, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("WORKLY INDIA / DEVELOPER PORTAL", 8, 20);
      doc.text(`30 Days | ${rows.length.toLocaleString("en-IN")} entries`, width - 8, 14, { align: "right" });
      doc.setFontSize(7.5);
      doc.text(`Period: ${callHistoryDate.format(start)} - ${callHistoryDate.format(end)} (IST)`, 8, 26);
      doc.text(`Generated: ${callHistoryDate.format(end)} ${callHistoryTime.format(end).toUpperCase()}`, width - 8, 26, { align: "right" });
    },
  });
  if (!rows.length) { doc.setFontSize(11); doc.text("No calls added in this period.", width / 2, 48, { align: "center" }); }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(189, 193, 198);
    doc.line(8, height - 10, width - 8, height - 10);
    doc.setFontSize(7);
    doc.text("Workly India / API call balance history", 8, height - 5);
    doc.text(`Page ${page} of ${pages}`, width - 8, height - 5, { align: "right" });
  }
  doc.save(`Workly_India_API_Call_History_${end.toISOString().slice(0, 10)}.pdf`);
}
