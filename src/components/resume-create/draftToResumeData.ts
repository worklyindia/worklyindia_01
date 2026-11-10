import { ResumeDraft } from '@/hooks/useResumeDraft';

const SAMPLE = {
  personalInfo: {
    fullName: 'Your Name',
    email: 'name@example.com',
    phone: '+91 98765 43210',
    address: 'City, State',
    linkedin: 'linkedin.com/in/yourname',
    portfolio: 'yourwebsite.com',
    title: 'Your Professional Title',
    website: 'yourwebsite.com',
    photoUrl: '',
  },
  summary:
    'Motivated professional with proven experience delivering results. Skilled in collaboration, problem solving, and continuous learning.',
  experience: [
    { id: '1', position: 'Senior Role', company: 'Company Name', duration: '2022 - Present', description: 'Led key initiatives and delivered measurable outcomes.' },
    { id: '2', position: 'Associate Role', company: 'Previous Co.', duration: '2019 - 2022', description: 'Supported cross-functional teams to ship on time.' },
  ],
  education: [
    { id: '1', degree: 'Bachelor of Technology', institution: 'University Name', year: '2015 - 2019', grade: '8.2 CGPA' },
  ],
  skills: ['Communication', 'Teamwork', 'MS Office', 'Problem Solving', 'Leadership'],
  languages: ['English (Fluent)', 'Hindi (Fluent)'],
  certifications: ['Google Digital Garage', 'PMP Foundations'],
};

export const draftToResumeData = (draft: ResumeDraft) => {
  const p = draft.personal;
  const hasAny =
    p.fullName || draft.summary || (draft.experiences && draft.experiences.length) ||
    (draft.education && draft.education.length) || (draft.skills && draft.skills.length);

  if (!hasAny) return SAMPLE;

  return {
    personalInfo: {
      fullName: p.fullName || SAMPLE.personalInfo.fullName,
      email: p.email || '',
      phone: p.mobile || '',
      address: p.location || '',
      linkedin: p.linkedin || '',
      portfolio: p.portfolio || '',
      title: p.professionalTitle || '',
      website: p.portfolio || '',
      photoUrl: p.photoUrl || '',
    },
    summary: draft.summary || '',
    experience: (draft.experiences || []).map((e) => ({
      id: e.id,
      position: e.jobTitle,
      company: e.company,
      duration: `${e.startDate}${e.currentlyWorking ? ' - Present' : e.endDate ? ' - ' + e.endDate : ''}`,
      description: [e.responsibilities, e.achievements].filter(Boolean).join('\n'),
    })),
    education: (draft.education || []).map((ed) => ({
      id: ed.id,
      degree: ed.course,
      institution: ed.school,
      year: `${ed.startYear}${ed.endYear ? ' - ' + ed.endYear : ''}`,
      grade: ed.grade,
    })),
    skills: (draft.skills || []).map((s) => s.name),
    languages: (draft.languages || []).map((l) => `${l.name} (${l.proficiency})`),
    certifications: (draft.certifications || []).map((c) =>
      [c.name, c.organization].filter(Boolean).join(' - ')
    ),
  };
};

export const templateKey = (
  t: ResumeDraft['template']
): NonNullable<ResumeDraft['template']> => {
  // Each of the 10 template ids now has its own distinct renderer registered
  // in RESUME_TEMPLATES (see AllResumeTemplates.tsx). Return the id verbatim.
  return (t as any) || 'Professional';
};
