import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { refundDisplay, refundDestination } from '../../supabase/functions/_shared/refundDisplay';

export type PaymentHistoryPdfRow = {
  id: string;
  reference_id?: string | null;
  billing_address?: string | null;
  gstin?: string | null;
  shipping_address?: string | null;
  order_id: string;
  label: string;
  amount: number;
  status: "captured" | "failed" | "refunded" | "partially_refunded" | "expired" | "cancelled";
  refunded_amount?: number;
  created_at: string;
  rrn?: string | null;
  transaction_id?: string | null;
  customer_id?: string | null;
  event_id?: string | null;
  subscription_id?: string | null;
  currency?: string | null;
  description?: string | null;
  comment?: string | null;
  method?: string | null;
  vpa?: string | null;
  bank_name?: string | null;
  card_network?: string | null;
  card_last4?: string | null;
  card_type?: string | null;
  wallet?: string | null;
  provider?: string | null;
  paypal_capture_id?: string | null;
  paypal_order_id?: string | null;
  amount_usd?: number | null;
  payer_name?: string | null;
  webhook_verified?: boolean | null;

  email?: string | null;
  contact?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  refunds?: Array<{
    id?: string;
    amount?: number;
    status?: string;
    speed?: string | null;
    created_at?: string;
    expected_by?: string | null;
    processed_at?: string | null;
    display_status: "in_progress" | "successful" | "failed";
    events?: Array<{ type: string; at: string | null; speed: string | null }>;
    currency?: string | null;
    comment?: string | null;
    description?: string | null;
    customer_id?: string | null;
    upi_transaction_id?: string | null;
  }>;
};

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  timeZone: "Asia/Kolkata",
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
  return value
    .replace(/₹\s*/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
}

export function downloadPaymentHistoryPdf(rows: PaymentHistoryPdfRow[], label: string, start: Date, end: Date) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 8;
  const generatedAt = new Date();
  const successful = rows.filter((row) => row.status === "captured").length;
  const failed = rows.length - successful;

  doc.setProperties({
    title: `Payment History - ${label}`,
    subject: "Employee Razorpay payment history",
    creator: "Workly India Employee Portal",
  });

  const header = () => {
    doc.setFillColor(...sheetGreen);
    doc.rect(0, 0, width, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text("Payment History", margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("WORKLY INDIA / EMPLOYEE PORTAL", margin, 20);
    doc.text(`${label} | ${rows.length.toLocaleString("en-IN")} payments`, width - margin, 14, { align: "right" });
    doc.setFontSize(7.5);
    doc.text(`Period: ${dateTime.format(start)} - ${dateTime.format(end)}`, margin, 26);
    doc.text(`Successful: ${successful} | Failed: ${failed}`, width - margin, 20, { align: "right" });
    doc.text(`Generated: ${dateTime.format(generatedAt)}`, width - margin, 26, { align: "right" });
    doc.setDrawColor(...rule);
    doc.line(margin, 29, width - margin, 29);
  };

  autoTable(doc, {
    startY: 32,
    margin: { top: 32, bottom: 13, left: margin, right: margin },
    theme: "grid",
    head: [["#", "DATE / TIME", "PAYMENT", "PAYMENT ID", "ORDER ID", "AMOUNT", "STATUS"]],
    body: rows.map((row, index) => [
      String(index + 1), dateTime.format(new Date(row.created_at)), printable(row.label),
      printable(row.id), printable(row.order_id), `INR ${row.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      row.refunds?.[0]?.display_status === "failed" ? "Refund Failed"
        : row.refunds?.[0]?.display_status === "successful" ? "Refunded / Refund Success"
          : row.refunds?.length ? "Refunded"
            : row.status === "captured" ? "Successful" : row.status === "refunded" ? "Refunded"
              : row.status === "partially_refunded" ? `Refunded INR ${(row.refunded_amount ?? 0).toFixed(2)}` : row.status === "expired" ? "Link Expired" : row.status === "cancelled" ? "Link Cancelled" : "Failed",
    ]),
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, minCellHeight: 7, textColor: ink, lineColor: rule, lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: soft, textColor: ink, fontStyle: "bold", lineColor: rule, lineWidth: 0.2, halign: "left" },
    alternateRowStyles: { fillColor: paper },
    columnStyles: {
      0: { cellWidth: 9, halign: "right" },
      1: { cellWidth: 36 },
      2: { cellWidth: 55 },
      3: { cellWidth: 58 },
      4: { cellWidth: 58 },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 37, halign: "center", fontStyle: "bold" },
    },
    willDrawPage: header,
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 6) return;
      const raw = String(data.cell.raw);
      data.cell.styles.textColor = raw === "Successful" || raw.includes("Refund Success") ? green : raw.startsWith("Refunded") ? [180, 120, 0] : red;
    },
  });

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...muted);
    doc.text("No confirmed payments in this period.", width / 2, 48, { align: "center" });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...rule);
    doc.line(margin, height - 10, width - margin, height - 10);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Workly India / Razorpay payment history", margin, height - 5);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 5, { align: "right" });
  }

  const fileDate = generatedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  doc.save(`Workly_India_Payment_History_${label.replace(/\s+/g, "_")}_${fileDate}.pdf`);
}

const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

function detailMethod(payment: PaymentHistoryPdfRow) {
  const method = (payment.method ?? "").toLowerCase();
  const cardType = (payment.card_type ?? "").toLowerCase();
  if (method === "card" && cardType === "debit") return "Debit Card";
  if (method === "card" && cardType === "credit") return "Credit Card";
  const names: Record<string, string> = { upi: "UPI", bank: "Bank", netbanking: "Netbanking", card: "Card", wallet: "Wallet", emi: "EMI", cardless_emi: "Cardless EMI", paylater: "Credit Line" };
  return names[method] ?? titleCase(method);
}

function detailStatus(payment: PaymentHistoryPdfRow) {
  const refund = payment.refunds?.[0];
  if (refund?.display_status === "failed") return "Refund Failed";
  if (payment.status === "partially_refunded") return `Refunded INR ${(payment.refunded_amount ?? 0).toFixed(2)}`;
  if (payment.status === "refunded" || refund) return "Refunded";
  return payment.status === "captured" ? "Successful" : "Failed";
}

function refundStatus(refund: NonNullable<PaymentHistoryPdfRow["refunds"]>[number]) {
  const { display_status } = refundDisplay(refund);
  if (display_status === "failed") return "Refund Failed";
  if (display_status === "successful") return "Refund Success";
  return "Refund can take up to 7 days.";
}

export async function downloadPaymentDetailsPdf(payment: PaymentHistoryPdfRow, invoiceId?: string | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const font = (await registerRupeeFont(doc)) ? "DejaVuSans" : "helvetica";
  const printableRupee = (value: string) => font === "helvetica" ? printable(value) : value.replace(/[^\x20-\x7E\u00A0-\u00FF\u20B9\u2013\u2014\u2018\u2019\u201C\u201D]/g, "?");
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;
  const generatedAt = new Date();
  const details: Array<[string, string]> = [
    ["Payment ID", payment.id],
    ...(payment.transaction_id ? [["Transaction ID", payment.transaction_id] as [string, string]] : []),
    ...(payment.customer_id ? [["Customer ID", payment.customer_id] as [string, string]] : []),
    ...(payment.event_id ? [["Event ID", payment.event_id] as [string, string]] : []),
    ...(payment.subscription_id ? [["Subscription ID", payment.subscription_id] as [string, string]] : []),
    ...(invoiceId ? [["Invoice ID", invoiceId] as [string, string]] : []),
    ...(payment.paypal_capture_id || payment.paypal_order_id ? [["SECTION", "PAYPAL DETAILS"] as [string, string]] : []),
    ...(payment.paypal_capture_id ? [["Invoice / Capture ID", payment.paypal_capture_id] as [string, string]] : []),
    ...(payment.paypal_order_id ? [["PayPal Order ID", payment.paypal_order_id] as [string, string]] : []),
    ...(payment.amount_usd ? [["Charged", `USD ${Number(payment.amount_usd).toFixed(2)}`] as [string, string]] : []),
    ...(payment.payer_name ? [["Payer", payment.payer_name] as [string, string]] : []),
    ...(payment.paypal_capture_id || payment.paypal_order_id ? [["PayPal Confirmation", payment.webhook_verified ? "Confirmed by PayPal" : "Awaiting PayPal confirmation"] as [string, string]] : []),

    ...(payment.method ? [["Method", detailMethod(payment)] as [string, string]] : []),
    ...(payment.vpa ? [["Payer UPI ID", payment.vpa] as [string, string]] : []),
    ...(payment.card_network || payment.card_last4 ? [["Card Details", `${payment.card_network ?? "Card"}${payment.card_last4 ? ` ending ${payment.card_last4}` : ""}`] as [string, string]] : []),
    ...(payment.bank_name ? [["Bank", payment.bank_name] as [string, string]] : []),
    ...(payment.wallet ? [["Provider", titleCase(payment.wallet)] as [string, string]] : []),
    ["Status", detailStatus(payment)],
    ["Amount", `INR ${payment.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ...(payment.currency ? [["Currency", payment.currency] as [string, string]] : []),
    ...(payment.description ? [["Description", payment.description] as [string, string]] : []),
    ["Received", dateTime.format(new Date(payment.created_at))],
    ...(payment.rrn ? [["RRN", payment.rrn] as [string, string]] : []),
    ...(payment.order_id ? [["Order ID", payment.order_id] as [string, string]] : []),
    ...(payment.reference_id ? [["Reference ID", payment.reference_id] as [string, string]] : []),
  ];

  if (payment.contact || payment.email || payment.billing_address || payment.shipping_address || payment.gstin) {
    details.push(["SECTION", "CUSTOMER DETAILS"]);
    if (payment.contact) details.push(["Mobile Number", payment.contact]);
    if (payment.email) details.push(["Email ID", payment.email]);
    if (payment.gstin) details.push(["GSTIN", payment.gstin]);
    if (payment.billing_address) details.push(["Billing Address", payment.billing_address]);
    if (payment.shipping_address) details.push(["Shipping Address", payment.shipping_address]);
  }

  for (const refund of payment.refunds ?? []) {
    details.push(["SECTION", "REFUND UPDATES"]);
    if (refund.id) details.push(["Refund ID", refund.id]);
    details.push(["Refund Speed", titleCase(refund.speed || "Processing")]);
    details.push(["Refund Status", refundStatus(refund)]);
    if (refund.amount != null) details.push(["Refunded Amount", `INR ${refund.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
    if (refund.currency) details.push(["Currency", refund.currency]);
    if (refund.comment) details.push(["Comment", refund.comment]);
    if (refund.description) details.push(["Description", refund.description]);
    if (refund.customer_id) details.push(["Customer ID", refund.customer_id]);
    if (refund.upi_transaction_id) details.push(["UPI Transaction ID", refund.upi_transaction_id]);
    const latestEvent = [...(refund.events ?? [])]
      .filter((event) => event.at)
      .sort((first, second) => String(second.at).localeCompare(String(first.at)))[0];
    if (latestEvent?.at) {
      const eventName = latestEvent.type === "refund.processed" ? "Refund processed" : latestEvent.type === "refund.failed" ? "Refund failed" : latestEvent.type === "refund.speed_changed" ? "Refund speed changed" : "Refund started";
      details.push(["Refund History", `${eventName} - ${dateTime.format(new Date(latestEvent.at))}`]);
    }
    if (refundDisplay(refund).display_status === 'successful') details.push(['Refund Success', refundDestination(payment)]);
  }

  if (payment.status === "failed") details.push(["Error Details", payment.error_description || payment.error_reason || payment.error_code || "Payment failed. No additional details were provided."]);

  doc.setProperties({ title: `Payment Details - ${payment.id}`, subject: "Workly India payment details", creator: "Workly India Employee Portal" });
  doc.setFillColor(...sheetGreen);
  doc.rect(0, 0, width, 5, "F");
  doc.setFont(font, "bold");
  doc.setFontSize(17);
  doc.setTextColor(...ink);
  doc.text("Payment Details", margin, 18);
  doc.setFontSize(11);
  doc.text(printableRupee(payment.label), margin, 26);
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(`Generated: ${dateTime.format(generatedAt)}`, margin, 33);
  doc.setDrawColor(...rule);
  doc.line(margin, 37, width - margin, 37);

  autoTable(doc, {
    startY: 41,
    margin: { top: 16, bottom: 18, left: margin, right: margin },
    theme: "plain",
    body: details.map(([label, value]) => label === "SECTION" ? [{ content: printableRupee(value), colSpan: 2, styles: { fillColor: soft, fontStyle: "bold", textColor: muted, cellPadding: { top: 3, right: 2, bottom: 3, left: 2 } } }] : [printableRupee(label), printableRupee(value)]),
    styles: { font, fontSize: 9, textColor: ink, cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 2 }, overflow: "linebreak", valign: "top", lineColor: rule, lineWidth: { bottom: 0.1 } },
    columnStyles: { 0: { cellWidth: 46, textColor: muted }, 1: { cellWidth: 128, fontStyle: "bold" } },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...rule);
    doc.line(margin, height - 12, width - margin, height - 12);
    doc.setFont(font, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Workly India / Payment details", margin, height - 7);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 7, { align: "right" });
  }

  doc.save(`Workly_India_Payment_${payment.id}.pdf`);
}
let rupeeFontCache: Promise<{ regular: string; bold: string } | null> | null = null;

async function fetchBase64(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font load failed: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

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
