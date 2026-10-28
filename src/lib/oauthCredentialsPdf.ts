import { jsPDF } from "jspdf";

export type OAuthCredentialDocument = {
  appName: string;
  redirectUris: string[];
  clientId: string;
  clientSecret?: string;
};

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${normalized || "oauth-app"}-credentials.pdf`;
}

export function buildOAuthCredentialsPdf(credentials: OAuthCredentialDocument) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 24;

  doc.setProperties({
    title: `${credentials.appName} OAuth credentials`,
    subject: "OAuth application credentials",
    creator: "Workly India Developer Portal",
  });

  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("OAuth App Credentials", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Workly India Developer Portal", margin, y + 8);

  y = 56;
  doc.setTextColor(17, 24, 39);

  const addField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text(label.toUpperCase(), margin, y);
    y += 6;

    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    const lines = doc.splitTextToSize(value, contentWidth - 8) as string[];
    const boxHeight = Math.max(13, lines.length * 5 + 8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");
    doc.text(lines, margin + 4, y + 8);
    y += boxHeight + 10;
  };

  addField("App name", credentials.appName);
  credentials.redirectUris.forEach((uri, index) => {
    addField(credentials.redirectUris.length > 1 ? `Redirect URL ${index + 1}` : "Redirect URL", uri);
  });
  addField("Client ID", credentials.clientId);
  addField("Client secret", credentials.clientSecret || "Not issued for public apps (PKCE)");

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const notice = credentials.clientSecret
    ? "Keep this file private. The client secret cannot be retrieved again after this page is refreshed."
    : "This public app uses PKCE and does not require a client secret.";
  doc.text(doc.splitTextToSize(notice, contentWidth), margin, y);

  return doc;
}

export function downloadOAuthCredentialsPdf(credentials: OAuthCredentialDocument) {
  buildOAuthCredentialsPdf(credentials).save(safeFilename(credentials.appName));
}