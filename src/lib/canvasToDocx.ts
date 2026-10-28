/**
 * Convert a resume canvas capture into a single-page A4 DOCX where the
 * captured image fills the page. This gives 100% visual match with the
 * preview at the cost of the DOCX not being text-editable — the same
 * tradeoff Canva / Zety use for pixel-perfect exports.
 */
import { Document, Packer, Paragraph, ImageRun, PageOrientation, AlignmentType } from 'docx';

const A4_WIDTH_TWIP = 11906;   // 210mm in twentieths of a point
const A4_HEIGHT_TWIP = 16838;  // 297mm
// Content dimensions in EMUs (english metric units): 1 inch = 914400 EMU
// A4 = 8.27" × 11.69" → 7560000 × 10692000 EMU (with 0 margin)
const A4_WIDTH_EMU_INCHES = 210 / 25.4;  // ≈ 8.2677
const A4_HEIGHT_EMU_INCHES = 297 / 25.4; // ≈ 11.6929

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

export const canvasToDocxBlob = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  const dataUrl = canvas.toDataURL('image/png');
  const bytes = dataUrlToUint8Array(dataUrl);

  // px @ 96dpi → inches → points (72 pt = 1 inch)
  // But docx ImageRun.transformation uses px (interpreted at 96dpi).
  const widthPx = Math.round(A4_WIDTH_EMU_INCHES * 96);   // ≈ 794
  const heightPx = Math.round(A4_HEIGHT_EMU_INCHES * 96); // ≈ 1123

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: A4_WIDTH_TWIP,
              height: A4_HEIGHT_TWIP,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 240 },
            children: [
              new ImageRun({
                // @ts-ignore - `type` is required at runtime by docx 8+, TS defs are loose
                type: 'png',
                data: bytes,
                transformation: { width: widthPx, height: heightPx },
                altText: { title: 'Resume', description: 'Resume preview', name: 'resume' },
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
};
