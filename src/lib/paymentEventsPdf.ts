import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PaymentEventPdfEvent = {
  event_id: string | null;
  event_type: string;
  category: string;
  account_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  amount_paise: number | null;
  currency: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  error_code: string | null;
  error_description: string | null;
  payload: any;
  signature_verified: boolean;
  event_created_at: string | null;
  created_at: string;
};

/** Flattens any JSON value into [dotted.path, displayValue] rows so every raw field is shown. */
export const flattenPayload = (value: any, prefix = ""): [string, string][] => {
  if (value === null) return prefix ? [[prefix, "null"]] : [["value", "null"]];
  if (value === undefined) return prefix ? [[prefix, "undefined"]] : [];
  if (Array.isArray(value)) {
    if (value.length === 0) return prefix ? [[prefix, "[]"]] : [];
    return value.flatMap((v, i) => flattenPayload(v, `${prefix}[${i}]`));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return prefix ? [[prefix, "{}"]] : [];
    return entries.flatMap(([k, v]) => flattenPayload(v, prefix ? `${prefix}.${k}` : k));
  }
  return [[prefix || "value", String(value)]];
};

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  timeZone: "Asia/Kolkata",
});

// Compact spreadsheet-style palette, matching the API Logs / Call History PDFs.
const ink: [number, number, number] = [32, 33, 36];
const muted: [number, number, number] = [95, 99, 104];
const rule: [number, number, number] = [189, 193, 198];
const soft: [number, number, number] = [241, 243, 244];
const sheetGreen: [number, number, number] = [24, 128, 56];
const red: [number, number, number] = [183, 54, 61];

function printable(value: string) {
  return value
    .replace(/₹\s*/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
}

async function fetchBase64(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font load failed: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

let rupeeFontCache: Promise<{ regular: string; bold: string } | null> | null = null;

async function registerRupeeFont(doc: jsPDF) {
  rupeeFontCache ??= Promise.all([fetchBase64("/fonts/DejaVuSans.ttf"), fetchBase64("/fonts/DejaVuSans-Bold.ttf")])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch(() => { rupeeFontCache = null; return null; });
  const fonts = await rupeeFontCache;
  if (!fonts) return false;
  doc.addFileToVFS("DejaVuSans.ttf", fonts.regular);
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fonts.bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
  return true;
}

const formatAmount = (paise: number | null, currency: string | null) => {
  if (paise === null || paise === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(paise / 100);
  } catch {
    return `${(paise / 100).toFixed(2)} ${currency || ""}`.trim();
  }
};

export async function downloadPaymentEventsHistoryPdf(events: PaymentEventPdfEvent[], filters: { period: string; group: string; eventName: string; search: string; from: string | null; to: string }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const font = (await registerRupeeFont(doc)) ? "DejaVuSans" : "helvetica";
  const text = (value: string) => font === "helvetica" ? printable(value) : value;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 10;
  const filterText = `Period: ${filters.period} | Group: ${filters.group} | Event: ${filters.eventName}${filters.search ? ` | Search: ${filters.search}` : ""}`;
  const filterLines = doc.splitTextToSize(text(filterText), width - margin * 2);
  const top = 31 + filterLines.length * 4;
  doc.setProperties({ title: `Payment Events History - ${filters.period}`, creator: "Workly India Owner Portal" });
  autoTable(doc, {
    startY: top,
    margin: { top, bottom: 14, left: margin, right: margin },
    theme: "grid",
    head: [["#", "Received (IST)", "Event / Group", "Entity / Event ID", "Status", "Amount", "Customer", "Verification / Error"]],
    body: events.map((event, index) => [
      String(index + 1), dateTime.format(new Date(event.created_at)),
      `${event.event_type}\n${event.category}`,
      `${event.entity_id || "—"}\n${event.event_id || "—"}`,
      event.status || "—", text(formatAmount(event.amount_paise, event.currency)),
      `${event.email || "—"}\n${event.contact || "—"}`,
      `${event.signature_verified ? "Verified" : "Not verified"}${event.error_code ? `\n${event.error_code}` : ""}${event.error_description ? `\n${event.error_description}` : ""}`,
    ].map(text)),
    styles: { font, fontSize: 7, cellPadding: 2, textColor: ink, lineColor: rule, lineWidth: 0.15, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: soft, textColor: ink, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 39 }, 2: { cellWidth: 60 }, 3: { cellWidth: 70 }, 4: { cellWidth: 31 }, 5: { cellWidth: 38 }, 6: { cellWidth: 75 }, 7: { cellWidth: 75 } },
    willDrawPage: () => {
      doc.setFillColor(...sheetGreen); doc.rect(0, 0, width, 5, "F");
      doc.setFont(font, "bold"); doc.setFontSize(15); doc.setTextColor(...ink);
      doc.text("Payment Events History", margin, 15);
      doc.setFont(font, "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
      doc.text(`${events.length.toLocaleString("en-IN")} events | WORKLY INDIA`, width - margin, 15, { align: "right" });
      doc.text(filterLines, margin, 23);
      doc.text(`From: ${filters.from ? dateTime.format(new Date(filters.from)) : "All time"} | To: ${dateTime.format(new Date(filters.to))}`, margin, top - 4);
    },
    didParseCell: (data) => {
      const event = events[data.row.index];
      if (data.section === "body" && event && (event.error_code || event.error_description || /failed|expired|cancelled|halted|lost/.test(event.event_type))) data.cell.styles.textColor = red;
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFont(font, "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text("Workly India / Payment events history", margin, height - 7);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 7, { align: "right" });
  }
  doc.save(`Workly_India_Payment_Events_${filters.period.replace(/\W+/g, "_")}_${filters.to.slice(0, 10)}.pdf`);
}

export async function downloadPaymentEventPdf(event: PaymentEventPdfEvent, groupLabel: string, provider = "Razorpay") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const font = (await registerRupeeFont(doc)) ? "DejaVuSans" : "helvetica";
  const text = (value: string) =>
    font === "helvetica"
      ? printable(value)
      : value.replace(/[^\x20-\x7E\u00A0-\u00FF\u20B9\u2013\u2014\u2018\u2019\u201C\u201D\n\t]/g, "?");

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 8;
  const generatedAt = new Date();
  const payloadRows = flattenPayload(event.payload);

  const details: Array<[string, string]> = [
    ["event", event.event_type],
    ["group", groupLabel],
    ["received", dateTime.format(new Date(event.created_at))],
    [`${provider.toLowerCase()}_time`, event.event_created_at ? dateTime.format(new Date(event.event_created_at)) : "—"],
    ["entity", event.entity_type || "—"],
    ["entity_id", event.entity_id || "—"],
    ["status", event.status || "—"],
    ["amount", formatAmount(event.amount_paise, event.currency)],
    ["currency", event.currency || "—"],
    ["email", event.email || "—"],
    ["contact", event.contact || "—"],
    ["event_id", event.event_id || "—"],
    ["account_id", event.account_id || "—"],
    ["signature", event.signature_verified ? "verified" : "not verified"],
    ["error_code", event.error_code || "—"],
    ["error", event.error_description || "—"],
  ];

  const body: any[] = details.map(([field, value]) => [String(field), text(value)]);
  if (payloadRows.length > 0) {
    body.push([{ content: `PAYLOAD - FULL DATA (${payloadRows.length} fields)`, colSpan: 3, styles: { fillColor: soft, textColor: muted, fontStyle: "bold", cellPadding: { top: 3, right: 2, bottom: 3, left: 2 } } }]);
    for (const [field, value] of payloadRows) body.push([text(field), text(value)]);
  }

  const isErrorField = (field: string, value: string) =>
    value !== "—" && (/(^|\.)error(_description|_code)?$/.test(field) || field.endsWith("reason") || (field === "signature" && value === "not verified"));

  doc.setProperties({
    title: `Payment Event Details - ${event.event_type}`,
    subject: `${provider} payment event details`,
    creator: "Workly India Owner Portal",
  });

  const header = () => {
    doc.setFillColor(...sheetGreen);
    doc.rect(0, 0, width, 5, "F");
    doc.setFont(font, "bold");
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text("Payment Event Details", margin, 14);
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("WORKLY INDIA / OWNER PORTAL", margin, 20);
    doc.text(`${text(event.event_type)} | Generated: ${dateTime.format(generatedAt)}`, width - margin, 14, { align: "right" });
    doc.setFontSize(7.5);
    doc.text(`Event group: ${text(groupLabel)}`, margin, 26);
    doc.text(`${payloadRows.length.toLocaleString("en-IN")} payload fields`, width - margin, 20, { align: "right" });
    doc.setDrawColor(...rule);
    doc.line(margin, 29, width - margin, 29);
  };

  autoTable(doc, {
    startY: 32,
    margin: { top: 32, bottom: 13, left: margin, right: margin },
    theme: "grid",
    head: [["#", "DETAIL", "VALUE"]],
    body: body.map((row: any, index) => (Array.isArray(row) ? [String(index + 1), row[0], row[1]] : row)),
    styles: { font, fontSize: 7.5, cellPadding: 1.6, minCellHeight: 7, textColor: ink, lineColor: rule, lineWidth: 0.15, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: soft, textColor: ink, fontStyle: "bold", lineColor: rule, lineWidth: 0.2, halign: "left" },
    columnStyles: {
      0: { cellWidth: 10, halign: "right" },
      1: { cellWidth: 58 },
      2: { cellWidth: width - 2 * margin - 68 },
    },
    willDrawPage: header,
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 2) return;
      const row = data.row.raw as any[];
      const field = typeof row?.[1] === "string" ? row[1] : "";
      const value = typeof row?.[2] === "string" ? row[2] : "";
      if (isErrorField(field, value)) data.cell.styles.textColor = red;
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...rule);
    doc.line(margin, height - 10, width - margin, height - 10);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Workly India / Payment event details", margin, height - 5);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 5, { align: "right" });
  }

  const fileDate = generatedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  doc.save(`Workly_India_Payment_Event_${event.event_type.replace(/\./g, "_")}_${fileDate}.pdf`);
}
