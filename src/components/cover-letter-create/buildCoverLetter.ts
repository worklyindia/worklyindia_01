import { CoverLetterDraft } from '@/hooks/useCoverLetterDraft';

export const buildCoverLetterText = (d: CoverLetterDraft): string => {
  const date = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const greeting =
    d.opening.greeting === 'Custom'
      ? d.opening.customGreeting || 'Dear Hiring Manager'
      : d.opening.greeting === 'Dear Mr./Ms. [Name]'
        ? d.opening.customGreeting
          ? `Dear ${d.opening.customGreeting}`
          : 'Dear Hiring Manager'
        : d.opening.greeting || 'Dear Hiring Manager';

  const lines: string[] = [];

  // Header
  if (d.personal.fullName) lines.push(d.personal.fullName);
  const contact = [d.personal.mobile, d.personal.email, d.personal.location].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  const links = [d.personal.linkedin, d.personal.portfolio].filter(Boolean).join(' | ');
  if (links) lines.push(links);
  lines.push('');
  lines.push(date);
  lines.push('');

  // Employer
  if (d.employer.hiringManager) lines.push(d.employer.hiringManager);
  if (d.employer.designation) lines.push(d.employer.designation);
  if (d.employer.companyName) lines.push(d.employer.companyName);
  if (d.employer.companyAddress) lines.push(d.employer.companyAddress);
  lines.push('');

  // Subject
  if (d.job.title) {
    const subj = `Subject: Application for ${d.job.title}${d.job.id ? ' (Job ID: ' + d.job.id + ')' : ''}`;
    lines.push(subj);
    lines.push('');
  }

  // Greeting
  lines.push(`${greeting},`);
  lines.push('');

  // Introduction
  const intro: string[] = [];
  if (d.introduction.whyApplying) intro.push(d.introduction.whyApplying);
  if (d.introduction.whereFound) intro.push(`I came across this opportunity through ${d.introduction.whereFound}.`);
  if (intro.length) { lines.push(intro.join(' ')); lines.push(''); }

  // Experience
  const exp: string[] = [];
  if (d.experience.years) exp.push(`With ${d.experience.years} of professional experience,`);
  if (d.experience.currentTitle || d.experience.currentCompany) {
    exp.push(`currently serving as ${d.experience.currentTitle}${d.experience.currentCompany ? ' at ' + d.experience.currentCompany : ''},`);
  }
  if (d.experience.relevant) exp.push(`I have ${d.experience.relevant}.`);
  if (exp.length) { lines.push(exp.join(' ')); lines.push(''); }

  // Skills
  if (d.skills.skills.length) {
    lines.push(`My key skills include ${d.skills.skills.join(', ')}.`);
  }
  if (d.skills.certifications) lines.push(`Certifications: ${d.skills.certifications}.`);
  if (d.skills.achievements) lines.push(`Notable achievements: ${d.skills.achievements}.`);
  if (d.skills.skills.length || d.skills.certifications || d.skills.achievements) lines.push('');

  // Why Company
  if (d.whyCompany) { lines.push(d.whyCompany); lines.push(''); }

  // Closing
  if (d.closing.availability) lines.push(`I am available to join ${d.closing.availability}.`);
  if (d.closing.thankYou) lines.push(d.closing.thankYou);
  lines.push('');

  // Signature
  lines.push('Warm regards,');
  if (d.signature.typedName || d.personal.fullName) {
    lines.push(d.signature.typedName || d.personal.fullName);
  }

  return lines.join('\n');
};
