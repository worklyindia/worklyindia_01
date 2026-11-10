import { ResumeDraft } from '@/hooks/useResumeDraft';

export const buildResumeText = (d: ResumeDraft): string => {
  const p = d.personal;
  const lines: string[] = [];

  if (p.fullName) lines.push(p.fullName.toUpperCase());
  if (p.professionalTitle) lines.push(p.professionalTitle);
  const contact = [p.mobile, p.email, p.location].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  const links = [p.linkedin, p.portfolio].filter(Boolean).join(' | ');
  if (links) lines.push(links);
  lines.push('');

  if (d.summary) {
    lines.push('PROFESSIONAL SUMMARY');
    lines.push(d.summary);
    lines.push('');
  }

  if (d.experiences?.length) {
    lines.push('EXPERIENCE');
    d.experiences.forEach((e) => {
      const dates = `${e.startDate || ''}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`;
      lines.push(`${e.jobTitle || ''} — ${e.company || ''}${dates ? '  (' + dates + ')' : ''}`);
      if (e.responsibilities) lines.push(e.responsibilities);
      if (e.achievements) lines.push(e.achievements);
      lines.push('');
    });
  }

  if (d.education?.length) {
    lines.push('EDUCATION');
    d.education.forEach((ed) => {
      const yr = `${ed.startYear || ''}${ed.endYear ? ' - ' + ed.endYear : ''}`;
      lines.push(`${ed.course || ''} — ${ed.school || ''}${yr ? '  (' + yr + ')' : ''}${ed.grade ? '  ' + ed.grade : ''}`);
    });
    lines.push('');
  }

  if (d.skills?.length) {
    lines.push('SKILLS');
    lines.push(d.skills.map((s) => s.name).filter(Boolean).join(', '));
    lines.push('');
  }

  if (d.languages?.length) {
    lines.push('LANGUAGES');
    lines.push(d.languages.map((l) => `${l.name} (${l.proficiency})`).join(', '));
    lines.push('');
  }

  if (d.certifications?.length) {
    lines.push('CERTIFICATIONS');
    d.certifications.forEach((c) => {
      lines.push(`• ${[c.name, c.organization].filter(Boolean).join(' - ')}`);
    });
    lines.push('');
  }

  return lines.join('\n').trim();
};
