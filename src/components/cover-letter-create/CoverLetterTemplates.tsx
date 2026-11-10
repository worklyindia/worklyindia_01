import "@/lib/signatureFonts";
import React from 'react';
import { CoverLetterDraft, CoverLetterTemplate } from '@/hooks/useCoverLetterDraft';
import { buildCoverLetterText } from './buildCoverLetter';

type TemplateKey =
  | 'Professional'
  | 'ATS Simple'
  | 'Modern'
  | 'Minimal'
  | 'Executive'
  | 'Fresher'
  | 'Creative'
  | 'Corporate'
  | 'Formal'
  | 'Simple';

type Palette = {
  ink: string;
  muted: string;
  accent: string;
  soft: string;
  paper: string;
  font: string;
  headingFont: string;
};

const normalizeTemplate = (template?: CoverLetterTemplate): TemplateKey => {
  switch (template) {
    case 'ATS Simple':
    case 'ATS Professional':
      return 'ATS Simple';
    case 'Modern':
    case 'Minimal':
    case 'Executive':
    case 'Fresher':
    case 'Creative':
    case 'Corporate':
    case 'Formal':
    case 'Simple':
      return template;
    case 'Elegant':
    case 'Premium':
      return 'Executive';
    case 'Classic':
      return 'Formal';
    case 'Professional':
    default:
      return 'Professional';
  }
};

const PALETTE: Record<TemplateKey, Palette> = {
  Professional: { ink: '#172033', muted: '#526071', accent: '#1E3A8A', soft: '#EEF2FF', paper: '#FFFFFF', font: 'Arial, Helvetica, sans-serif', headingFont: 'Arial, Helvetica, sans-serif' },
  'ATS Simple': { ink: '#111111', muted: '#333333', accent: '#111111', soft: '#FFFFFF', paper: '#FFFFFF', font: 'Arial, Helvetica, sans-serif', headingFont: 'Arial, Helvetica, sans-serif' },
  Modern: { ink: '#102033', muted: '#506072', accent: '#2563EB', soft: '#DBEAFE', paper: '#FFFFFF', font: 'Inter, Arial, sans-serif', headingFont: 'Inter, Arial, sans-serif' },
  Minimal: { ink: '#222222', muted: '#777777', accent: '#666666', soft: '#F7F7F7', paper: '#FFFFFF', font: 'Helvetica, Arial, sans-serif', headingFont: 'Helvetica, Arial, sans-serif' },
  Executive: { ink: '#0F172A', muted: '#586274', accent: '#0F172A', soft: '#F1F5F9', paper: '#FFFFFF', font: 'Georgia, Times, serif', headingFont: 'Georgia, Times, serif' },
  Fresher: { ink: '#16324A', muted: '#5E7388', accent: '#60A5FA', soft: '#EFF6FF', paper: '#FFFFFF', font: 'Arial, Helvetica, sans-serif', headingFont: 'Arial, Helvetica, sans-serif' },
  Creative: { ink: '#35153D', muted: '#76507E', accent: '#D946EF', soft: '#FAE8FF', paper: '#FFFBFE', font: 'Trebuchet MS, Arial, sans-serif', headingFont: 'Trebuchet MS, Arial, sans-serif' },
  Corporate: { ink: '#1D293D', muted: '#64748B', accent: '#1E40AF', soft: '#E0E7FF', paper: '#FFFFFF', font: 'Segoe UI, Arial, sans-serif', headingFont: 'Segoe UI, Arial, sans-serif' },
  Formal: { ink: '#000000', muted: '#222222', accent: '#000000', soft: '#FFFFFF', paper: '#FFFFFF', font: 'Times New Roman, Times, serif', headingFont: 'Times New Roman, Times, serif' },
  Simple: { ink: '#222222', muted: '#666666', accent: '#444444', soft: '#FAFAFA', paper: '#FFFFFF', font: 'Arial, Helvetica, sans-serif', headingFont: 'Arial, Helvetica, sans-serif' },
};

const SAMPLE_TEXT = `17 July 2026

Hiring Manager
Company Name
123 Business Avenue
Mumbai, India

Subject: Application for Marketing Manager Position

Dear Hiring Manager,

I am writing to express my strong interest in the Marketing Manager role at your organization. With over five years of experience leading integrated campaigns, growing digital audiences, and delivering measurable business outcomes, I am confident I would be a valuable addition to your team.

In my current position at Bright Works, I led a cross-functional team of eight and delivered a 42% increase in qualified leads across our top three product lines. I built the analytics practice from the ground up, launched a content strategy that tripled organic traffic, and consistently maintained the highest standards of communication and ownership with senior stakeholders.

Beyond execution, I bring a collaborative mindset and a genuine curiosity about the customer. I would welcome the chance to bring the same energy, rigour, and results focus to your team, and to help shape the next stage of your growth.

Thank you for considering my application. I look forward to the opportunity to discuss how my background can benefit your team.

Sincerely,
Your Name`;


const stripSignature = (text: string) => text.replace(/\n+(Warm regards|Sincerely|Regards),\s*\n?.*$/i, '').trim();

const linesFromDraft = (draft: CoverLetterDraft) => {
  const isEmpty = !draft.personal.fullName && !draft.employer.companyName && !draft.introduction.whyApplying;
  const text = isEmpty ? SAMPLE_TEXT : buildCoverLetterText(draft);
  return stripSignature(text).split('\n');
};

const SIG_FONT_FAMILY: Record<string, string> = {
  'great-vibes': '"Great Vibes", cursive',
  'dancing-script': '"Dancing Script", cursive',
  'homemade-apple': '"Homemade Apple", cursive',
  'sacramento': '"Sacramento", cursive',
  'allura': '"Allura", cursive',
  'alex-brush': '"Alex Brush", cursive',
  'kaushan-script': '"Kaushan Script", cursive',
  'satisfy': '"Satisfy", cursive',
  'pacifico': '"Pacifico", cursive',
  'caveat': '"Caveat", cursive',
  'yellowtail': '"Yellowtail", cursive',
  'parisienne': '"Parisienne", cursive',
  'monsieur-la-doulaise': '"Monsieur La Doulaise", cursive',
  'tangerine': '"Tangerine", cursive',
  'mrs-saint-delafield': '"Mrs Saint Delafield", cursive',
  'pinyon-script': '"Pinyon Script", cursive',
  'herr-von-muellerhoff': '"Herr Von Muellerhoff", cursive',
  'rochester': '"Rochester", cursive',
  'qwigley': '"Qwigley", cursive',
  'italianno': '"Italianno", cursive',
  'arizonia': '"Arizonia", cursive',
  'marck-script': '"Marck Script", cursive',
  'bilbo': '"Bilbo", cursive',
  'bilbo-swash-caps': '"Bilbo Swash Caps", cursive',
  'aguafina-script': '"Aguafina Script", cursive',
  'cedarville-cursive': '"Cedarville Cursive", cursive',
  'clicker-script': '"Clicker Script", cursive',
  'sofia': '"Sofia", cursive',
  'windsong': '"WindSong", cursive',
  'freebooter-script': '"Freebooter Script", "Great Vibes", cursive',
  'euphoria-script': '"Euphoria Script", cursive',
};

const meta = (draft: CoverLetterDraft) => ({
  name: draft.personal.fullName || draft.signature.typedName || 'Your Name',
  title: draft.job.title || 'Cover Letter',
  contact: [draft.personal.mobile, draft.personal.email, draft.personal.location].filter(Boolean).join('  •  ') || '+91 98765 43210  •  name@example.com  •  City, State',
  links: [draft.personal.linkedin, draft.personal.portfolio].filter(Boolean).join('  •  '),
  company: draft.employer.companyName || 'Company Name',
  manager: draft.employer.hiringManager || 'Hiring Manager',
  signature: draft.signature.digitalSignatureUrl,
  typedName: draft.signature.typedName || draft.personal.fullName || 'Your Name',
  signatureFont: draft.signature.signatureFont || '',
});

const BodyText: React.FC<{ lines: string[]; palette: Palette; compact?: boolean }> = ({ lines, palette, compact }) => (
  <div style={{ whiteSpace: 'pre-wrap', fontSize: compact ? 12.2 : 13.4, lineHeight: compact ? 1.48 : 1.66, color: palette.ink }}>
    {lines.join('\n')}
  </div>
);

const Signature: React.FC<{ draft: CoverLetterDraft; palette: Palette; centered?: boolean }> = ({ draft, palette, centered }) => {
  const m = meta(draft);
  const fontFamily = m.signatureFont ? SIG_FONT_FAMILY[m.signatureFont] : '';
  return (
    <div style={{ marginTop: 22, textAlign: centered ? 'center' : 'left' }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: palette.ink }}>Sincerely,</div>
      {m.signature ? (
        <img src={m.signature} alt={`${m.typedName} signature`} style={{ display: 'block', margin: centered ? '0 auto 4px' : '0 0 4px', maxWidth: 180, maxHeight: 56, objectFit: 'contain' }} />
      ) : fontFamily ? (
        <div style={{ fontFamily, fontSize: 34, lineHeight: 1, color: '#1D4ED8', margin: centered ? '0 auto 6px' : '0 0 6px' }}>
          {m.typedName}
        </div>
      ) : (
        <>
          <div style={{ width: 150, height: 34, borderBottom: `1px solid ${palette.muted}`, margin: centered ? '0 auto 6px' : '0 0 6px' }} />
          <div style={{ fontWeight: 700, color: palette.ink }}>{m.typedName}</div>
        </>
      )}
    </div>
  );
};

const Page: React.FC<{ palette: Palette; children: React.ReactNode }> = ({ palette, children }) => (
  <div className="doc-preview" style={{ width: 794, height: 1123, minHeight: 1123, background: palette.paper, color: palette.ink, fontFamily: palette.font, colorScheme: 'light', overflow: 'hidden' }}>
    {children}
  </div>
);

const ProfessionalLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <header style={{ background: palette.accent, color: '#FFFFFF', padding: '36px 46px 28px' }}>
        <h1 style={{ margin: 0, fontFamily: palette.headingFont, fontSize: 28, fontWeight: 800 }}>{m.name}</h1>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.92 }}>{m.contact}</div>
        {m.links && <div style={{ marginTop: 4, fontSize: 12, opacity: 0.88 }}>{m.links}</div>}
      </header>
      <main style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 34, padding: '34px 46px' }}>
        <aside style={{ borderRight: `3px solid ${palette.soft}`, paddingRight: 20, fontSize: 12, color: palette.muted, lineHeight: 1.55 }}>
          <strong style={{ color: palette.accent, display: 'block', marginBottom: 8 }}>TO</strong>
          {m.manager}<br />{m.company}
          <strong style={{ color: palette.accent, display: 'block', margin: '24px 0 8px' }}>ROLE</strong>
          {m.title}
        </aside>
        <section><BodyText lines={lines} palette={palette} /><Signature draft={draft} palette={palette} /></section>
      </main>
    </Page>
  );
};

const AtsLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <main style={{ padding: '42px 54px', fontFamily: palette.font }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{m.name}</h1>
        <div style={{ marginTop: 4, fontSize: 12 }}>{m.contact}</div>
        {m.links && <div style={{ marginTop: 3, fontSize: 12 }}>{m.links}</div>}
        <hr style={{ border: 0, borderTop: '1px solid #111111', margin: '18px 0 24px' }} />
        <BodyText lines={lines} palette={palette} />
        <Signature draft={draft} palette={palette} />
      </main>
    </Page>
  );
};

const ModernLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr', minHeight: 1123 }}>
        <div style={{ background: palette.accent }} />
        <main style={{ padding: '42px 48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, borderBottom: `2px solid ${palette.soft}`, paddingBottom: 20 }}>
            <div><h1 style={{ margin: 0, fontSize: 30, color: palette.accent }}>{m.name}</h1><div style={{ fontWeight: 700, marginTop: 6 }}>{m.title}</div></div>
            <div style={{ textAlign: 'right', fontSize: 11.5, color: palette.muted, lineHeight: 1.55 }}>{m.contact}{m.links ? <><br />{m.links}</> : null}</div>
          </div>
          <div style={{ marginTop: 30 }}><BodyText lines={lines} palette={palette} /><Signature draft={draft} palette={palette} /></div>
        </main>
      </div>
    </Page>
  );
};

const MinimalLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <main style={{ padding: '64px 72px' }}>
        <header style={{ textAlign: 'center', marginBottom: 44 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 400, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{m.name}</h1>
          <div style={{ width: 110, borderTop: `1px solid ${palette.accent}`, margin: '18px auto 12px' }} />
          <div style={{ fontSize: 11.5, color: palette.muted }}>{m.contact}</div>
        </header>
        <BodyText lines={lines} palette={palette} />
        <Signature draft={draft} palette={palette} centered />
      </main>
    </Page>
  );
};

const ExecutiveLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <header style={{ background: palette.accent, color: '#FFFFFF', padding: '42px 48px', borderBottom: '5px solid #C9A84C' }}>
        <h1 style={{ fontFamily: palette.headingFont, margin: 0, fontSize: 34, fontWeight: 600 }}>{m.name}</h1>
        <div style={{ marginTop: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 11, color: '#E5E7EB' }}>{m.title}</div>
      </header>
      <main style={{ padding: '38px 54px' }}>
        <div style={{ float: 'right', width: 190, margin: '0 0 20px 28px', padding: 18, background: palette.soft, fontSize: 11.5, lineHeight: 1.55, color: palette.muted }}>
          <strong style={{ color: palette.ink }}>Contact</strong><br />{m.contact}{m.links ? <><br />{m.links}</> : null}
        </div>
        <BodyText lines={lines} palette={palette} />
        <Signature draft={draft} palette={palette} />
      </main>
    </Page>
  );
};

const FresherLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <main style={{ padding: '38px 44px' }}>
        <section style={{ background: palette.soft, border: `1px solid ${palette.accent}`, padding: '24px 28px', marginBottom: 28 }}>
          <h1 style={{ margin: 0, color: '#1E40AF', fontSize: 26 }}>{m.name}</h1>
          <div style={{ marginTop: 8, fontSize: 12.5, color: palette.ink }}>{m.contact}</div>
        </section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 132px', gap: 28 }}>
          <section><BodyText lines={lines} palette={palette} /><Signature draft={draft} palette={palette} /></section>
          <aside style={{ fontSize: 11.5, color: palette.muted }}>
            <div style={{ background: palette.soft, padding: 14, marginBottom: 14 }}><strong style={{ color: palette.accent }}>First-job focus</strong><br />Education, enthusiasm and potential.</div>
            <div style={{ background: palette.soft, padding: 14 }}><strong style={{ color: palette.accent }}>Applying for</strong><br />{m.title}</div>
          </aside>
        </div>
      </main>
    </Page>
  );
};

const CreativeLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <header style={{ display: 'grid', gridTemplateColumns: '42% 58%', minHeight: 140 }}>
        <div style={{ background: palette.accent, color: '#FFFFFF', padding: '34px 38px' }}><div style={{ fontSize: 44, fontWeight: 800 }}>{m.name[0] || 'Y'}</div><h1 style={{ margin: '8px 0 0', fontSize: 22 }}>{m.name}</h1></div>
        <div style={{ background: palette.soft, padding: '42px 34px', fontSize: 12, lineHeight: 1.7, color: palette.muted }}>{m.contact}{m.links ? <><br />{m.links}</> : null}</div>
      </header>
      <main style={{ padding: '38px 48px' }}>
        <div style={{ display: 'inline-block', background: palette.accent, color: '#FFFFFF', padding: '7px 14px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 11, marginBottom: 22 }}>{m.title}</div>
        <BodyText lines={lines} palette={palette} />
        <Signature draft={draft} palette={palette} />
      </main>
    </Page>
  );
};

const CorporateLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <div style={{ display: 'grid', gridTemplateColumns: '176px 1fr', minHeight: 1123 }}>
        <aside style={{ background: palette.soft, padding: '44px 24px', borderRight: `1px solid ${palette.accent}` }}>
          <h1 style={{ margin: 0, fontSize: 18, color: palette.accent }}>{m.name}</h1>
          <Info label="Date" value="17 July 2026" palette={palette} />
          <Info label="Company" value={m.company} palette={palette} />
          <Info label="Contact" value={m.contact} palette={palette} />
        </aside>
        <main style={{ padding: '44px 46px' }}><BodyText lines={lines} palette={palette} /><Signature draft={draft} palette={palette} /></main>
      </div>
    </Page>
  );
};

const Info: React.FC<{ label: string; value: string; palette: Palette }> = ({ label, value, palette }) => (
  <div style={{ marginTop: 24, fontSize: 11.5, lineHeight: 1.5, color: palette.muted }}><strong style={{ display: 'block', color: palette.accent, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{label}</strong>{value}</div>
);

const FormalLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <main style={{ padding: '46px 58px' }}>
        <h1 style={{ margin: 0, textAlign: 'center', fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{m.name}</h1>
        <div style={{ textAlign: 'center', fontSize: 12, marginTop: 8 }}>{m.contact}</div>
        <div style={{ borderTop: '3px double #000000', margin: '20px 0 28px' }} />
        <BodyText lines={lines} palette={palette} />
        <Signature draft={draft} palette={palette} />
      </main>
    </Page>
  );
};

const SimpleLetter: React.FC<{ draft: CoverLetterDraft; palette: Palette; lines: string[] }> = ({ draft, palette, lines }) => {
  const m = meta(draft);
  return (
    <Page palette={palette}>
      <main style={{ padding: '40px 50px' }}>
        <h1 style={{ fontSize: 23, margin: 0 }}>{m.name}</h1>
        <div style={{ fontSize: 12, color: palette.muted, marginTop: 6 }}>{m.contact}</div>
        <div style={{ marginTop: 28 }}><BodyText lines={lines} palette={palette} /><Signature draft={draft} palette={palette} /></div>
      </main>
    </Page>
  );
};

export const CoverLetterRender: React.FC<{ draft: CoverLetterDraft; template?: CoverLetterTemplate }> = ({ draft, template }) => {
  const tpl = normalizeTemplate(template || draft.template || 'Professional');
  const palette = PALETTE[tpl];
  const lines = linesFromDraft(draft);
  const props = { draft, palette, lines };

  switch (tpl) {
    case 'ATS Simple': return <AtsLetter {...props} />;
    case 'Modern': return <ModernLetter {...props} />;
    case 'Minimal': return <MinimalLetter {...props} />;
    case 'Executive': return <ExecutiveLetter {...props} />;
    case 'Fresher': return <FresherLetter {...props} />;
    case 'Creative': return <CreativeLetter {...props} />;
    case 'Corporate': return <CorporateLetter {...props} />;
    case 'Formal': return <FormalLetter {...props} />;
    case 'Simple': return <SimpleLetter {...props} />;
    case 'Professional':
    default: return <ProfessionalLetter {...props} />;
  }
};

export const COVER_LETTER_TEMPLATES: { id: CoverLetterTemplate; name: string; desc: string; badge?: string }[] = [
  { id: 'Professional', name: 'Professional', desc: 'Classic business letter with navy header', badge: 'Default' },
  { id: 'ATS Simple', name: 'ATS Simple', desc: 'Plain black-and-white ATS format' },
  { id: 'Modern', name: 'Modern', desc: 'Blue accent line and modern typography' },
  { id: 'Minimal', name: 'Minimal', desc: 'Large whitespace with thin separators' },
  { id: 'Executive', name: 'Executive', desc: 'Premium senior-level business styling' },
  { id: 'Fresher', name: 'Fresher', desc: 'Friendly first-job layout with light blue accents' },
  { id: 'Creative', name: 'Creative', desc: 'Stylish split header and soft color blocks' },
  { id: 'Corporate', name: 'Corporate', desc: 'Gray-blue memo sidebar format' },
  { id: 'Formal', name: 'Formal', desc: 'Traditional serif business letter' },
  { id: 'Simple', name: 'Simple', desc: 'Basic clean layout with minimal formatting' },
];