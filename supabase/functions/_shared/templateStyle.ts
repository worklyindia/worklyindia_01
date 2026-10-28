// Shared template style palette used by both PDF and DOCX generators.
// Each template gets its own distinct layout — not just a color swap.
export type ResumeLayout =
  | 'sidebar-left'        // Professional, Two Column
  | 'sidebar-right'       // Modern
  | 'one-col-plain'       // ATS Simple, Simple
  | 'one-col-underline'   // Minimal, One Column
  | 'banner-serif'        // Executive
  | 'fresher-cards'       // Fresher (education first, rounded blocks)
  | 'compact-dense'       // Compact
  | 'creative-blocks';    // Creative

export type CoverLayout =
  | 'header-band'         // Professional, Corporate
  | 'plain-bw'            // ATS Simple, Simple
  | 'accent-left-bar'     // Modern
  | 'centered-hairline'   // Minimal
  | 'banner-serif'        // Executive
  | 'fresher-card'        // Fresher
  | 'creative-split'      // Creative
  | 'sidebar-meta'        // Corporate (memo)
  | 'formal-serif'        // Formal / Classic
  | 'simple-clean';       // Simple, clean letter with subtle rule

export type TemplateStyle = {
  key: string;
  accent: [number, number, number]; // rgb 0-1
  accentHex: string;                // "1E3A8A"
  secondaryHex?: string;            // subtle background tint
  font: 'serif' | 'sans' | 'mono';
  resumeLayout: ResumeLayout;
  coverLayout: CoverLayout;
  invertHeader: boolean;
};

const RGB = (r: number, g: number, b: number): [number, number, number] => [r / 255, g / 255, b / 255];
const HEX = (r: number, g: number, b: number) =>
  [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();

const style = (
  key: string,
  r: number, g: number, b: number,
  font: 'serif' | 'sans',
  resumeLayout: ResumeLayout,
  coverLayout: CoverLayout,
  invertHeader = true,
  secondaryHex?: string,
): TemplateStyle => ({
  key,
  accent: RGB(r, g, b),
  accentHex: HEX(r, g, b),
  secondaryHex,
  font,
  resumeLayout,
  coverLayout,
  invertHeader,
});

const normalizeTemplateName = (name: string): string => {
  const t = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (t === 'minimalist') return 'minimal';
  if (t === 'ats') return 'ats simple';
  if (t === 'two col') return 'two column';
  if (t === 'one col') return 'one column';
  if (t === 'premium' || t === 'elegant') return 'executive';
  if (t === 'classic') return 'formal';
  return t;
};

export const templateStyle = (name: string): TemplateStyle => {
  const t = normalizeTemplateName(name);

  // RESUME templates
  if (t === 'professional') return style('professional', 30, 58, 138, 'sans', 'sidebar-left', 'header-band', true, 'EEF2FF');
  if (t === 'ats simple') return style('ats-simple', 17, 17, 17, 'sans', 'one-col-plain', 'plain-bw', false);
  if (t === 'modern') return style('modern', 37, 99, 235, 'sans', 'sidebar-right', 'accent-left-bar', false, 'DBEAFE');
  if (t === 'minimal') return style('minimal', 100, 100, 100, 'sans', 'one-col-underline', 'centered-hairline', false);
  if (t === 'executive') return style('executive', 15, 23, 42, 'serif', 'banner-serif', 'banner-serif', true, 'F1F5F9');
  if (t === 'fresher') return style('fresher', 96, 165, 250, 'sans', 'fresher-cards', 'fresher-card', false, 'EFF6FF');
  if (t === 'two column') return style('two-column', 71, 85, 105, 'sans', 'sidebar-left', 'sidebar-meta', false, 'F1F5F9');
  if (t === 'one column') return style('one-column', 51, 65, 85, 'sans', 'one-col-underline', 'plain-bw', false);
  if (t === 'compact') return style('compact', 30, 41, 59, 'sans', 'compact-dense', 'plain-bw', false);
  if (t === 'creative') return style('creative', 217, 70, 239, 'sans', 'creative-blocks', 'creative-split', true, 'FAE8FF');

  // COVER LETTER-specific templates
  if (t === 'ats professional') return style('ats-professional', 17, 17, 17, 'sans', 'one-col-plain', 'plain-bw', false);
  if (t === 'professional') return style('cover-professional', 30, 58, 138, 'sans', 'sidebar-left', 'header-band', true, 'EEF2FF');
  if (t === 'ats simple') return style('cover-ats-simple', 17, 17, 17, 'sans', 'one-col-plain', 'plain-bw', false);
  if (t === 'corporate') return style('corporate', 30, 64, 175, 'sans', 'sidebar-left', 'sidebar-meta', true, 'E0E7FF');
  if (t === 'formal' || t === 'classic') return style('formal', 0, 0, 0, 'serif', 'one-col-underline', 'formal-serif', false);
  if (t === 'simple') return style('simple', 68, 68, 68, 'sans', 'one-col-plain', 'simple-clean', false, 'F7F7F7');

  return style('default', 17, 17, 17, 'sans', 'one-col-plain', 'plain-bw', false);
};
