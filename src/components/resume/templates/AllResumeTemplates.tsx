import React from 'react';
import { Mail, Phone, MapPin, Globe, Linkedin, Calendar, Building, GraduationCap, Award, Languages, Star, Briefcase, User } from 'lucide-react';

export interface Experience { id: string; position: string; company: string; duration: string; description: string; }
export interface Education { id: string; degree: string; institution: string; year: string; grade: string; }
export interface ResumeData {
  personalInfo: {
    fullName: string; email: string; phone: string; address: string;
    linkedin: string; portfolio: string; title?: string; website?: string; photoUrl?: string;
  };
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  languages: string[];
  certifications: string[];
}

interface P { resumeData: ResumeData; className?: string; }

/* A4 shell — 794×1123 px @ 96dpi. All templates share this outer frame. */
const Page: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; id?: string }> = ({ children, className = '', style, id }) => (
  <div id={id} className={`doc-preview bg-white overflow-hidden ${className}`} style={{ width: '794px', height: '1123px', minHeight: '1123px', colorScheme: 'light', ...style }}>
    {children}
  </div>
);

const initials = (name: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('') || 'YN';

const Avatar: React.FC<{ r: ResumeData; size: number; dark?: boolean; radius?: number | string; style?: React.CSSProperties; ringColor?: string }> = ({ r, size, dark = false, radius = '50%', style, ringColor }) => {
  const ring = ringColor || (dark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)');
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: dark ? 'rgba(255,255,255,0.12)' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.36), fontWeight: 700, overflow: 'hidden', boxShadow: radius === '50%' ? `0 0 0 3px ${ring}, 0 0 0 4px rgba(0,0,0,0.08)` : undefined, ...style }}>
      {r.personalInfo.photoUrl ? (
        <img src={r.personalInfo.photoUrl} alt={`${r.personalInfo.fullName || 'Candidate'} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius }} crossOrigin="anonymous" />
      ) : (
        initials(r.personalInfo.fullName)
      )}
    </div>
  );
};

const estimateBadgeWidth = (label: string, fontSize: number, paddingX: number, letterSpacing = 0) => {
  const length = Array.from(label).length;
  return Math.ceil(length * fontSize * 0.68 + Math.max(0, length - 1) * letterSpacing + paddingX * 2);
};

const SvgBadge: React.FC<{
  children: string;
  height: number;
  paddingX: number;
  bg: string;
  color: string;
  fontSize: number;
  fontWeight?: number;
  radius?: number;
  uppercase?: boolean;
  letterSpacing?: number;
  marginBottom?: number;
  fontFamily?: string;
}> = ({ children, height, paddingX, bg, color, fontSize, fontWeight = 600, radius = 999, uppercase = false, letterSpacing = 0, marginBottom, fontFamily = 'Arial, Helvetica, sans-serif' }) => {
  const label = uppercase ? children.toUpperCase() : children;
  const width = estimateBadgeWidth(label, fontSize, paddingX, letterSpacing);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={label}
      role="img"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible', marginBottom, flex: '0 0 auto' }}
    >
      <rect width={width} height={height} rx={radius} ry={radius} fill={bg} />
      <text
        x={width / 2}
        y={height / 2}
        fill={color}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </svg>
  );
};

const SvgSkillPill: React.FC<{ label: string }> = ({ label }) => {
  const height = 28;
  const paddingX = 12;
  const bulletX = paddingX + 4;
  const labelX = paddingX + 18;
  const maxWidth = 206;
  const estimatedWidth = estimateBadgeWidth(label, 11.5, paddingX + 18);
  const width = Math.min(maxWidth, Math.max(72, estimatedWidth));
  const labelMaxWidth = width - labelX - paddingX;
  const estimatedLabelWidth = Math.max(1, estimateBadgeWidth(label, 11.5, 0));
  const needsFit = estimatedLabelWidth > labelMaxWidth;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={label}
      role="img"
      style={{ display: 'block', overflow: 'visible', flex: '0 0 auto' }}
    >
      <rect width={width} height={height} rx={6} ry={6} fill="#0f172a" />
      <text
        x={bulletX}
        y={height / 2}
        fill="#ffffff"
        fontFamily="Space Grotesk, Inter, Arial, sans-serif"
        fontSize={13}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        alignmentBaseline="central"
      >
        •
      </text>
      <text
        x={labelX}
        y={height / 2}
        fill="#ffffff"
        fontFamily="Space Grotesk, Inter, Arial, sans-serif"
        fontSize={11.5}
        fontWeight={600}
        textAnchor="start"
        dominantBaseline="central"
        alignmentBaseline="central"
        {...(needsFit ? { textLength: labelMaxWidth, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
      >
        {label}
      </text>
    </svg>
  );
};

/**
 * BulletList — renders items with an explicit "•" glyph in a controllable
 * color. Avoids CSS `list-style` markers, which html2canvas often drops
 * from PDF/DOCX/print captures. Each item is a flex row so the bullet and
 * label stay on the same baseline even when the label wraps.
 */
const BulletList: React.FC<{
  items: string[];
  bulletColor?: string;
  textColor?: string;
  fontSize?: number;
  lineHeight?: number;
  gap?: number;
  bullet?: string;
  style?: React.CSSProperties;
}> = ({ items, bulletColor = '#ffffff', textColor = 'inherit', fontSize = 12, lineHeight = 1.7, gap = 8, bullet = '•', style }) => (
  <div style={{ fontSize, lineHeight, color: textColor, ...style }}>
    {items.map((item, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap, marginBottom: 2 }}>
        <span aria-hidden="true" style={{ color: bulletColor, flex: '0 0 auto', lineHeight: 'inherit', fontWeight: 700 }}>{bullet}</span>
        <span style={{ flex: '1 1 auto' }}>{item}</span>
      </div>
    ))}
  </div>
);

/* ============================================================
   1. PROFESSIONAL — Navy sidebar (left) + main content right
============================================================ */
export const ProfessionalTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
    <div className="grid" style={{ gridTemplateColumns: '260px 1fr', minHeight: '1123px' }}>
      {/* Sidebar */}
      <aside style={{ background: '#1E3A8A', color: '#fff', padding: '32px 24px' }}>
        <Avatar r={r} size={84} dark style={{ marginBottom: 24 }} />
        <SideHeading>Contact</SideHeading>
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          {r.personalInfo.email && <Row icon={<Mail size={12} />} text={r.personalInfo.email} />}
          {r.personalInfo.phone && <Row icon={<Phone size={12} />} text={r.personalInfo.phone} />}
          {r.personalInfo.address && <Row icon={<MapPin size={12} />} text={r.personalInfo.address} />}
          {r.personalInfo.linkedin && <Row icon={<Linkedin size={12} />} text={r.personalInfo.linkedin} />}
          {r.personalInfo.website && <Row icon={<Globe size={12} />} text={r.personalInfo.website} />}
        </div>
        {r.skills.length > 0 && (
          <>
            <SideHeading>Skills</SideHeading>
            <BulletList items={r.skills} bulletColor="#ffffff" textColor="#ffffff" fontSize={12} lineHeight={1.8} />
          </>
        )}
        {r.languages.length > 0 && (
          <>
            <SideHeading>Languages</SideHeading>
            <BulletList items={r.languages} bulletColor="#ffffff" textColor="#ffffff" fontSize={12} lineHeight={1.7} />
          </>
        )}
      </aside>
      {/* Main */}
      <main style={{ padding: '36px 40px', color: '#0f172a' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#0f172a' }}>
          {r.personalInfo.fullName || 'Your Name'}
        </h1>
        {r.personalInfo.title && (
          <p style={{ fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1E3A8A', margin: '6px 0 22px', fontWeight: 600 }}>
            {r.personalInfo.title}
          </p>
        )}
        {r.summary && <MainSection title="Professional Summary" accent="#1E3A8A"><p style={bodyStyle}>{r.summary}</p></MainSection>}
        {r.experience.length > 0 && (
          <MainSection title="Work Experience" accent="#1E3A8A">
            {r.experience.map((e) => (
              <div key={e.id} style={{ marginBottom: 14, paddingLeft: 14, borderLeft: '2px solid #1E3A8A' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{e.position}</div>
                <div style={{ fontSize: 12, color: '#1E3A8A', fontWeight: 600 }}>{e.company} · {e.duration}</div>
                <p style={{ ...bodyStyle, marginTop: 4 }}>{e.description}</p>
              </div>
            ))}
          </MainSection>
        )}
        {r.education.length > 0 && (
          <MainSection title="Education" accent="#1E3A8A">
            {r.education.map((ed) => (
              <div key={ed.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{ed.degree}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{ed.institution} · {ed.year}{ed.grade ? ` · ${ed.grade}` : ''}</div>
              </div>
            ))}
          </MainSection>
        )}
        {r.certifications.length > 0 && (
          <MainSection title="Certifications" accent="#1E3A8A">
            <BulletList items={r.certifications} bulletColor="#1E3A8A" textColor="#334155" fontSize={12} lineHeight={1.7} />
          </MainSection>
        )}
      </main>
    </div>
  </Page>
);

const bodyStyle: React.CSSProperties = { fontSize: 12, lineHeight: 1.55, color: '#334155', margin: 0 };
const SideHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '22px 0 10px', fontWeight: 700, opacity: 0.85 }}>{children}</h3>
);
const Row: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div
    data-resume-contact-row
    style={{
      display: 'table',
      tableLayout: 'fixed',
      width: '100%',
      marginBottom: 8,
      pageBreakInside: 'avoid',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
      fontSize: 11,
      lineHeight: 1.4,
    }}
  >
    <span
      aria-hidden
      style={{
        display: 'table-cell',
        width: 14,
        height: 16,
        minWidth: 14,
        maxWidth: 14,
        opacity: 0.95,
        lineHeight: 0,
        paddingTop: 2,
        paddingRight: 8,
        verticalAlign: 'top',
      }}
    >
      {icon}
    </span>
    <span
      style={{
        display: 'table-cell',
        width: 'auto',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        whiteSpace: 'normal',
        lineHeight: 1.4,
        verticalAlign: 'top',
      }}
    >
      {text}
    </span>
  </div>
);
const MainSection: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({ title, accent, children }) => (
  <section style={{ marginBottom: 20 }}>
    <h2 style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: accent, margin: '0 0 12px', borderBottom: `2px solid ${accent}`, paddingBottom: 16, lineHeight: 1.3 }}>{title}</h2>
    {children}
  </section>
);

/* ============================================================
   2. ATS SIMPLE — Pure B/W, no icons, single column
============================================================ */
export const AtsSimpleTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', padding: '48px 64px' }}>
    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, textAlign: 'center' }}>{r.personalInfo.fullName || 'Your Name'}</h1>
    {r.personalInfo.title && <p style={{ textAlign: 'center', fontSize: 13, margin: '4px 0 6px' }}>{r.personalInfo.title}</p>}
    <p style={{ textAlign: 'center', fontSize: 11, margin: 0 }}>
      {[r.personalInfo.email, r.personalInfo.phone, r.personalInfo.address, r.personalInfo.linkedin].filter(Boolean).join(' | ')}
    </p>
    <hr style={{ border: 0, borderTop: '1px solid #000', margin: '14px 0' }} />
    {r.summary && <AtsSec title="SUMMARY"><p style={atsBody}>{r.summary}</p></AtsSec>}
    {r.experience.length > 0 && (
      <AtsSec title="EXPERIENCE">
        {r.experience.map((e) => (
          <div key={e.id} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{e.position} — {e.company}</div>
            <div style={{ fontSize: 11, fontStyle: 'italic' }}>{e.duration}</div>
            <p style={atsBody}>{e.description}</p>
          </div>
        ))}
      </AtsSec>
    )}
    {r.education.length > 0 && (
      <AtsSec title="EDUCATION">
        {r.education.map((ed) => (
          <div key={ed.id} style={{ marginBottom: 6, fontSize: 12 }}>
            <b>{ed.degree}</b>, {ed.institution} — {ed.year}{ed.grade ? ` (${ed.grade})` : ''}
          </div>
        ))}
      </AtsSec>
    )}
    {r.skills.length > 0 && <AtsSec title="SKILLS"><p style={atsBody}>{r.skills.join(', ')}</p></AtsSec>}
    {r.languages.length > 0 && <AtsSec title="LANGUAGES"><p style={atsBody}>{r.languages.join(', ')}</p></AtsSec>}
    {r.certifications.length > 0 && (
      <AtsSec title="CERTIFICATIONS">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </AtsSec>
    )}
  </Page>
);
const atsBody: React.CSSProperties = { fontSize: 11.5, lineHeight: 1.45, color: '#000', margin: '2px 0' };
const AtsSec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginBottom: 12 }}>
    <h2 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 7px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: 15, lineHeight: 1.3 }}>{title}</h2>
    {children}
  </section>
);

/* ============================================================
   3. MODERN — Left accent bar + chip section headers
============================================================ */
export const ModernTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Poppins, Inter, sans-serif', color: '#111' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '8px 1fr', minHeight: '1123px' }}>
      <div style={{ background: '#2563EB' }} />
      <div style={{ padding: '40px 44px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #2563EB', paddingBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: '#1e293b' }}>{r.personalInfo.fullName}</h1>
            {r.personalInfo.title && <p style={{ margin: '4px 0 0', color: '#2563EB', fontWeight: 600 }}>{r.personalInfo.title}</p>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
            {r.personalInfo.email && <div>{r.personalInfo.email}</div>}
            {r.personalInfo.phone && <div>{r.personalInfo.phone}</div>}
            {r.personalInfo.address && <div>{r.personalInfo.address}</div>}
          </div>
        </div>
        {r.summary && <ModSec title="About"><p style={bodyStyle}>{r.summary}</p></ModSec>}
        {r.experience.length > 0 && (
          <ModSec title="Experience">
            {r.experience.map((e) => (
              <div key={e.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <b>{e.position}</b><span style={{ color: '#2563EB', fontSize: 11 }}>{e.duration}</span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>{e.company}</div>
                <p style={{ ...bodyStyle, marginTop: 3 }}>{e.description}</p>
              </div>
            ))}
          </ModSec>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {r.education.length > 0 && (
            <ModSec title="Education">
              {r.education.map((ed) => (
                <div key={ed.id} style={{ marginBottom: 8, fontSize: 12 }}>
                  <b>{ed.degree}</b><br /><span style={{ color: '#475569' }}>{ed.institution} · {ed.year}</span>
                </div>
              ))}
            </ModSec>
          )}
          {r.skills.length > 0 && (
            <ModSec title="Skills">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {r.skills.map((s, i) => (
                  <SvgBadge key={i} height={22} paddingX={10} bg="#DBEAFE" color="#1D4ED8" fontSize={11}>{s}</SvgBadge>
                ))}
              </div>
            </ModSec>
          )}
        </div>
        {r.certifications.length > 0 && <ModSec title="Certifications"><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul></ModSec>}
      </div>
    </div>
  </Page>
);
const ModSec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginTop: 22 }}>
    <SvgBadge height={24} paddingX={12} bg="#2563EB" color="#fff" fontSize={11} fontWeight={700} letterSpacing={1.1} radius={6} uppercase marginBottom={10}>{title}</SvgBadge>
    <div>{children}</div>
  </section>
);

/* ============================================================
   4. MINIMAL — Extreme whitespace, hairline dividers
============================================================ */
export const MinimalTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Inter, sans-serif', color: '#111', padding: '80px 96px' }}>
    <div style={{ textAlign: 'center', marginBottom: 40 }}>
      <h1 style={{ fontSize: 34, fontWeight: 300, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
        {r.personalInfo.fullName}
      </h1>
      {r.personalInfo.title && <p style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#666', margin: '10px 0 0' }}>{r.personalInfo.title}</p>}
      <div style={{ fontSize: 11, color: '#666', marginTop: 18, letterSpacing: '0.05em' }}>
        {[r.personalInfo.email, r.personalInfo.phone, r.personalInfo.address].filter(Boolean).join(' · ')}
      </div>
    </div>
    <MinSec title="Summary">{r.summary && <p style={{ fontSize: 12, lineHeight: 1.8, color: '#333', margin: 0 }}>{r.summary}</p>}</MinSec>
    {r.experience.length > 0 && (
      <MinSec title="Experience">
        {r.experience.map((e) => (
          <div key={e.id} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ fontWeight: 500 }}>{e.position}, {e.company}</span>
              <span style={{ color: '#888' }}>{e.duration}</span>
            </div>
            <p style={{ fontSize: 11.5, color: '#555', margin: '4px 0 0', lineHeight: 1.7 }}>{e.description}</p>
          </div>
        ))}
      </MinSec>
    )}
    {r.education.length > 0 && (
      <MinSec title="Education">
        {r.education.map((ed) => (
          <div key={ed.id} style={{ fontSize: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>{ed.degree}, {ed.institution}</span><span style={{ color: '#888' }}>{ed.year}</span>
          </div>
        ))}
      </MinSec>
    )}
    {r.skills.length > 0 && <MinSec title="Skills"><p style={{ fontSize: 12, color: '#555', margin: 0, letterSpacing: '0.02em' }}>{r.skills.join(' · ')}</p></MinSec>}
    {r.languages.length > 0 && <MinSec title="Languages"><p style={{ fontSize: 12, color: '#555', margin: 0 }}>{r.languages.join(' · ')}</p></MinSec>}
  </Page>
);
const MinSec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginBottom: 30 }}>
    <div style={{ borderTop: '1px solid #e5e5e5', marginBottom: 14 }} />
    <h2 style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#999', fontWeight: 500, margin: '0 0 12px' }}>{title}</h2>
    {children}
  </section>
);

/* ============================================================
   5. EXECUTIVE — Charcoal banner, serif name, gold hairline
============================================================ */
export const ExecutiveTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#0f172a' }}>
    <header style={{ background: '#0f172a', color: '#fff', padding: '46px 56px 34px' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, margin: 0, fontWeight: 400, letterSpacing: '0.02em' }}>{r.personalInfo.fullName}</h1>
      <div style={{ height: 2, background: '#c9a84c', width: 120, margin: '12px 0 14px' }} />
      {r.personalInfo.title && <p style={{ fontSize: 13, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#c9a84c', margin: 0 }}>{r.personalInfo.title}</p>}
      <div style={{ marginTop: 18, fontSize: 11.5, color: '#e2e8f0', letterSpacing: '0.05em' }}>
        {[r.personalInfo.email, r.personalInfo.phone, r.personalInfo.address, r.personalInfo.linkedin].filter(Boolean).join('   |   ')}
      </div>
    </header>
    <div style={{ padding: '32px 56px' }}>
      {r.summary && <ExecSec title="Executive Profile"><p style={{ fontSize: 12.5, lineHeight: 1.7, margin: 0, color: '#334155' }}>{r.summary}</p></ExecSec>}
      {r.experience.length > 0 && (
        <ExecSec title="Leadership Experience">
          {r.experience.map((e) => (
            <div key={e.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{e.position}</div>
              <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c9a84c' }}>{e.company} · {e.duration}</div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: '#334155', margin: '6px 0 0' }}>{e.description}</p>
            </div>
          ))}
        </ExecSec>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
        {r.education.length > 0 && (
          <ExecSec title="Education">
            {r.education.map((ed) => (
              <div key={ed.id} style={{ fontSize: 12, marginBottom: 8 }}>
                <b>{ed.degree}</b><br /><span style={{ color: '#64748b' }}>{ed.institution}, {ed.year}</span>
              </div>
            ))}
          </ExecSec>
        )}
        {r.skills.length > 0 && (
          <ExecSec title="Core Competencies">
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#334155', lineHeight: 1.7 }}>{r.skills.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </ExecSec>
        )}
      </div>
    </div>
  </Page>
);
const ExecSec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginBottom: 22 }}>
    <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#0f172a', fontWeight: 700, margin: '0 0 10px', lineHeight: 1.3 }}>{title}</h2>
    <div style={{ height: 1, background: '#c9a84c', width: 60, marginBottom: 10 }} />
    {children}
  </section>
);

/* ============================================================
   6. FRESHER — Rounded soft-blue header card, education FIRST
============================================================ */
export const FresherTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Nunito, Inter, sans-serif', color: '#0f172a', padding: '32px' }}>
    <div style={{ background: '#EFF6FF', borderRadius: 20, padding: '28px 32px', display: 'flex', gap: 24, alignItems: 'center' }}>
      <Avatar r={r} size={88} style={{ background: '#60A5FA', color: '#fff', fontSize: 30, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 26, margin: 0, fontWeight: 800, color: '#1e40af' }}>{r.personalInfo.fullName}</h1>
        {r.personalInfo.title && <p style={{ margin: '4px 0', color: '#3b82f6', fontWeight: 600 }}>{r.personalInfo.title}</p>}
        <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
          {[r.personalInfo.email, r.personalInfo.phone, r.personalInfo.address].filter(Boolean).join(' • ')}
        </div>
      </div>
    </div>
    {r.summary && <FreshSec title="About Me">{r.summary}</FreshSec>}
    {r.education.length > 0 && (
      <section style={{ marginTop: 20 }}>
        <FreshHeading>Education</FreshHeading>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {r.education.map((ed) => (
            <div key={ed.id} style={{ background: '#F8FAFC', border: '1px solid #DBEAFE', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{ed.degree}</div>
              <div style={{ fontSize: 12, color: '#3b82f6' }}>{ed.institution}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{ed.year}{ed.grade ? ` · ${ed.grade}` : ''}</div>
            </div>
          ))}
        </div>
      </section>
    )}
    {r.experience.length > 0 && (
      <section style={{ marginTop: 20 }}>
        <FreshHeading>Experience / Internships</FreshHeading>
        {r.experience.map((e) => (
          <div key={e.id} style={{ borderLeft: '3px solid #60A5FA', paddingLeft: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{e.position} <span style={{ color: '#3b82f6', fontWeight: 500 }}>at {e.company}</span></div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{e.duration}</div>
            <p style={{ fontSize: 12, margin: '4px 0 0', color: '#334155' }}>{e.description}</p>
          </div>
        ))}
      </section>
    )}
    {r.skills.length > 0 && (
      <section style={{ marginTop: 20 }}>
        <FreshHeading>Skills</FreshHeading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {r.skills.map((s, i) => (
            <SvgBadge key={i} height={26} paddingX={14} bg="#DBEAFE" color="#1D4ED8" fontSize={12} fontWeight={700}>{s}</SvgBadge>
          ))}
        </div>
      </section>
    )}
    {(r.languages.length > 0 || r.certifications.length > 0) && (
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {r.languages.length > 0 && <div><FreshHeading>Languages</FreshHeading><p style={{ fontSize: 12, color: '#334155', margin: 0 }}>{r.languages.join(' • ')}</p></div>}
        {r.certifications.length > 0 && <div><FreshHeading>Certifications</FreshHeading><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
      </div>
    )}
  </Page>
);
const FreshHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e40af', margin: '0 0 10px' }}>{children}</h2>
);
const FreshSec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginTop: 20 }}>
    <FreshHeading>{title}</FreshHeading>
    <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.65, margin: 0 }}>{children}</p>
  </section>
);

/* ============================================================
   7. TWO COLUMN — 35/65 gray sidebar + vertical rule
============================================================ */
export const TwoColumnTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Inter, sans-serif', color: '#0f172a' }}>
    <div style={{ padding: '36px 44px 20px' }}>
      <h1 style={{ fontSize: 30, margin: 0, fontWeight: 800 }}>{r.personalInfo.fullName}</h1>
      {r.personalInfo.title && <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 14 }}>{r.personalInfo.title}</p>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '35% 1fr', minHeight: '900px' }}>
      <aside style={{ background: '#F1F5F9', padding: '28px 24px', borderRight: '1px solid #cbd5e1' }}>
        <TCHeading>Contact</TCHeading>
        <div style={{ fontSize: 11.5, lineHeight: 1.8, color: '#334155' }}>
          {r.personalInfo.email && <div>{r.personalInfo.email}</div>}
          {r.personalInfo.phone && <div>{r.personalInfo.phone}</div>}
          {r.personalInfo.address && <div>{r.personalInfo.address}</div>}
          {r.personalInfo.linkedin && <div>{r.personalInfo.linkedin}</div>}
        </div>
        {r.skills.length > 0 && (<><TCHeading>Skills</TCHeading><ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7, color: '#334155' }}>{r.skills.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
        {r.languages.length > 0 && (<><TCHeading>Languages</TCHeading><ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7 }}>{r.languages.map((l, i) => <li key={i}>{l}</li>)}</ul></>)}
        {r.certifications.length > 0 && (<><TCHeading>Certifications</TCHeading><ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, lineHeight: 1.6 }}>{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
      </aside>
      <main style={{ padding: '28px 32px' }}>
        {r.summary && (<><TCHeading dark>Summary</TCHeading><p style={{ fontSize: 12, lineHeight: 1.65, color: '#334155', margin: 0 }}>{r.summary}</p></>)}
        {r.experience.length > 0 && (
          <><TCHeading dark>Experience</TCHeading>
            {r.experience.map((e) => (
              <div key={e.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{e.position}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{e.company} · {e.duration}</div>
                <p style={{ fontSize: 12, margin: '4px 0 0', color: '#334155' }}>{e.description}</p>
              </div>
            ))}
          </>
        )}
        {r.education.length > 0 && (<><TCHeading dark>Education</TCHeading>{r.education.map((ed) => (
          <div key={ed.id} style={{ fontSize: 12, marginBottom: 6 }}>
            <b>{ed.degree}</b> — {ed.institution} ({ed.year}){ed.grade ? `, ${ed.grade}` : ''}
          </div>
        ))}</>)}
      </main>
    </div>
  </Page>
);
const TCHeading: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <h2 style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: dark ? '#0f172a' : '#475569', fontWeight: 700, margin: '18px 0 10px', borderBottom: dark ? '2px solid #0f172a' : 'none', paddingBottom: dark ? 15 : 0, lineHeight: 1.3 }}>{children}</h2>
);

/* ============================================================
   8. ONE COLUMN — Full-width, wide sections, thick underline
============================================================ */
export const OneColumnTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Inter, sans-serif', color: '#0f172a', padding: '54px 72px' }}>
    <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{r.personalInfo.fullName}</h1>
    {r.personalInfo.title && <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 8px' }}>{r.personalInfo.title}</p>}
    <div style={{ fontSize: 11.5, color: '#475569', borderBottom: '3px solid #0f172a', paddingBottom: 10 }}>
      {[r.personalInfo.email, r.personalInfo.phone, r.personalInfo.address, r.personalInfo.linkedin].filter(Boolean).join('  •  ')}
    </div>
    {r.summary && <OCSec title="Summary"><p style={bodyStyle}>{r.summary}</p></OCSec>}
    {r.experience.length > 0 && (
      <OCSec title="Experience">
        {r.experience.map((e) => (
          <div key={e.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
              <span>{e.position} — {e.company}</span><span style={{ fontWeight: 500, color: '#64748b' }}>{e.duration}</span>
            </div>
            <p style={{ ...bodyStyle, marginTop: 4 }}>{e.description}</p>
          </div>
        ))}
      </OCSec>
    )}
    {r.education.length > 0 && (
      <OCSec title="Education">
        {r.education.map((ed) => (
          <div key={ed.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
            <span><b>{ed.degree}</b>, {ed.institution}</span><span style={{ color: '#64748b' }}>{ed.year}{ed.grade ? ` · ${ed.grade}` : ''}</span>
          </div>
        ))}
      </OCSec>
    )}
    {r.skills.length > 0 && <OCSec title="Skills"><p style={bodyStyle}>{r.skills.join(' • ')}</p></OCSec>}
    {r.languages.length > 0 && <OCSec title="Languages"><p style={bodyStyle}>{r.languages.join(' • ')}</p></OCSec>}
    {r.certifications.length > 0 && <OCSec title="Certifications"><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul></OCSec>}
  </Page>
);
const OCSec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginTop: 20 }}>
    <h2 style={{ fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 11px', borderBottom: '3px solid #0f172a', paddingBottom: 17, lineHeight: 1.3 }}>{title}</h2>
    {children}
  </section>
);

/* ============================================================
   9. COMPACT — Dense, 10pt, 2-col skills grid, inline meta
============================================================ */
export const CompactTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: 'Inter, sans-serif', color: '#0f172a', padding: '28px 36px', fontSize: 10 }}>
    <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: 8, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{r.personalInfo.fullName}</h1>
        <span style={{ fontSize: 10.5, color: '#334155' }}>{r.personalInfo.title}</span>
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
        {[r.personalInfo.email, r.personalInfo.phone, r.personalInfo.address, r.personalInfo.linkedin].filter(Boolean).join(' | ')}
      </div>
    </div>
    {r.summary && <CmpSec title="Summary"><p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.4 }}>{r.summary}</p></CmpSec>}
    {r.experience.length > 0 && (
      <CmpSec title="Experience">
        {r.experience.map((e) => (
          <div key={e.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{e.position} • {e.company} • <span style={{ fontWeight: 400, color: '#64748b' }}>{e.duration}</span></div>
            <p style={{ margin: '1px 0 0', fontSize: 10.5, lineHeight: 1.35, color: '#334155' }}>{e.description}</p>
          </div>
        ))}
      </CmpSec>
    )}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {r.education.length > 0 && (
        <CmpSec title="Education">
          {r.education.map((ed) => (
            <div key={ed.id} style={{ fontSize: 10.5, marginBottom: 3 }}>
              <b>{ed.degree}</b>, {ed.institution} — {ed.year}
            </div>
          ))}
        </CmpSec>
      )}
      {r.skills.length > 0 && (
        <CmpSec title="Skills">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12, fontSize: 10.5, lineHeight: 1.5 }}>
            {r.skills.map((s, i) => <div key={i}>• {s}</div>)}
          </div>
        </CmpSec>
      )}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {r.languages.length > 0 && <CmpSec title="Languages"><div style={{ fontSize: 10.5 }}>{r.languages.join(' • ')}</div></CmpSec>}
      {r.certifications.length > 0 && <CmpSec title="Certifications"><ul style={{ margin: 0, paddingLeft: 14, fontSize: 10.5, lineHeight: 1.45 }}>{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul></CmpSec>}
    </div>
  </Page>
);
const CmpSec: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginTop: 8 }}>
    <h2 style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px', color: '#1e293b' }}>{title}</h2>
    {children}
  </section>
);

/* ============================================================
   10. CREATIVE — Asymmetric colored block header + display type
============================================================ */
export const CreativeTemplate: React.FC<P> = ({ resumeData: r, className = '' }) => (
  <Page id="resume-preview" className={className} style={{ fontFamily: '"Space Grotesk", Inter, sans-serif', color: '#0f172a', position: 'relative', overflow: 'hidden' }}>
    {/* Header shapes rendered as inline SVG so html2canvas (used for PDF/DOCX/Print)
        captures the diagonal cut exactly like the on-screen preview. CSS clip-path
        is not supported by html2canvas, which is why the download previously came
        out as a flat vertical split with no white diagonal. */}
    <svg
      width="794"
      height="240"
      viewBox="0 0 794 240"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}
      aria-hidden="true"
    >
      {/* Dark left block */}
      <polygon points="0,0 340,0 340,240 0,240" fill="#0f172a" />
      {/* Magenta right block with a slim diagonal notch on its bottom-left
          corner — kept narrow so the name/title never falls in the white gap. */}
      <polygon points="368,0 794,0 794,240 400,240" fill="#D946EF" />
    </svg>
    <div style={{ position: 'relative', padding: '48px 44px', display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', minHeight: 240, color: '#fff' }}>
      <div>
        <Avatar r={r} size={84} radius={20} style={{ background: '#D946EF', color: '#fff', fontSize: 34, marginBottom: 14 }} />
        <div style={{ fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.7 }}>{r.personalInfo.title}</div>
      </div>
      <div style={{ paddingLeft: 24 }}>
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.05 }}>{r.personalInfo.fullName}</h1>
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.55, paddingLeft: 8 }}>
          {r.personalInfo.email && <div>✉ {r.personalInfo.email}</div>}
          {r.personalInfo.phone && <div>☎ {r.personalInfo.phone}</div>}
          {r.personalInfo.address && <div>◉ {r.personalInfo.address}</div>}
        </div>
      </div>
    </div>
    <div style={{ padding: '30px 44px' }}>
      {r.summary && (
        <div style={{ background: '#FAE8FF', borderRadius: 16, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#A21CAF', fontWeight: 700, marginBottom: 6 }}>Profile</div>
          <p style={{ fontSize: 12.5, color: '#4a044e', margin: 0, lineHeight: 1.6 }}>{r.summary}</p>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div>
          {r.experience.length > 0 && (
            <>
              <CrHead>Experience</CrHead>
              {r.experience.map((e) => (
                <div key={e.id} style={{ marginBottom: 14, borderLeft: '3px solid #D946EF', paddingLeft: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.position}</div>
                  <div style={{ fontSize: 11.5, color: '#D946EF', fontWeight: 600 }}>{e.company} — {e.duration}</div>
                  <p style={{ fontSize: 12, margin: '4px 0 0', color: '#334155' }}>{e.description}</p>
                </div>
              ))}
            </>
          )}
          {r.education.length > 0 && (
            <>
              <CrHead>Education</CrHead>
              {r.education.map((ed) => (
                <div key={ed.id} style={{ fontSize: 12, marginBottom: 6 }}>
                  <b>{ed.degree}</b> — {ed.institution} <span style={{ color: '#64748b' }}>({ed.year})</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div>
          {r.skills.length > 0 && (
            <>
              <CrHead>Skills</CrHead>
              {/* SVG pills keep the bullet and label vertically centered in both
                  browser preview and html2canvas PDF/DOCX/Print captures. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.skills.map((s, i) => (
                  <SvgSkillPill key={i} label={s} />
                ))}
              </div>
            </>
          )}
          {r.languages.length > 0 && (
            <>
              <CrHead>Languages</CrHead>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.7 }}>{r.languages.join(', ')}</div>
            </>
          )}
          {r.certifications.length > 0 && (
            <>
              <CrHead>Certifications</CrHead>
              <BulletList items={r.certifications} bulletColor="#D946EF" textColor="#334155" fontSize={11.5} lineHeight={1.55} />
            </>
          )}
        </div>
      </div>
    </div>
  </Page>
);
const CrHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize: 12, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#D946EF', fontWeight: 800, margin: '18px 0 10px' }}>{children}</h2>
);

/* ============================================================
   Registry — keyed by the exact TEMPLATES ids used in Steps.tsx
============================================================ */
export const ALL_RESUME_TEMPLATES = {
  Professional: ProfessionalTemplate,
  'ATS Simple': AtsSimpleTemplate,
  Modern: ModernTemplate,
  Minimal: MinimalTemplate,
  Executive: ExecutiveTemplate,
  Fresher: FresherTemplate,
  'Two Column': TwoColumnTemplate,
  'One Column': OneColumnTemplate,
  Compact: CompactTemplate,
  Creative: CreativeTemplate,
} as const;

export type ResumeTemplateId = keyof typeof ALL_RESUME_TEMPLATES;
