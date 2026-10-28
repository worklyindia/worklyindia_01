import { ResumeDraft, emptyDraft } from '@/hooks/useResumeDraft';
import { CoverLetterDraft, emptyCoverLetterDraft } from '@/hooks/useCoverLetterDraft';

/** Static sample used ONLY for template thumbnail previews so cards look
 *  consistent and never leak the user's real data. */
export const SAMPLE_RESUME_DRAFT: ResumeDraft = {
  ...emptyDraft,
  personal: {
    fullName: 'Alex Johnson',
    professionalTitle: 'Senior Full Stack Developer',
    mobile: '+91 98765 43210',
    email: 'alex.johnson@example.com',
    location: 'Bengaluru, India',
    linkedin: 'linkedin.com/in/alexj',
    portfolio: 'alexj.dev',
    photoUrl: '',
  },
  summary:
    'Results-driven engineer with 8+ years building scalable web applications. Expert in React, Node.js and cloud architecture. Passionate about clean code and user-centric solutions.',
  experiences: [
    {
      id: 'e1', company: 'Acme Corp', jobTitle: 'Senior Developer',
      employmentType: 'Full-time', startDate: '2022-01', endDate: '', currentlyWorking: true,
      city: 'Bengaluru',
      responsibilities: 'Led team of 5 engineers building a real-time analytics platform.',
      achievements: 'Reduced page load time by 45% and improved conversion by 22%.',
    },
    {
      id: 'e2', company: 'TechStart Inc', jobTitle: 'Full Stack Developer',
      employmentType: 'Full-time', startDate: '2019-03', endDate: '2021-12', currentlyWorking: false,
      city: 'Pune',
      responsibilities: 'Built and shipped multiple SaaS products end-to-end.',
      achievements: 'Grew active user base from 5k to 80k in 18 months.',
    },
  ],
  education: [
    { id: 'ed1', course: 'B.Tech Computer Science', school: 'IIT Bombay', board: 'IIT', startYear: '2015', endYear: '2019', grade: '8.7 CGPA' },
  ],
  skills: [
    { id: 's1', name: 'React', category: 'technical', level: 'Advanced' },
    { id: 's2', name: 'TypeScript', category: 'technical', level: 'Advanced' },
    { id: 's3', name: 'Node.js', category: 'technical', level: 'Advanced' },
    { id: 's4', name: 'AWS', category: 'technical', level: 'Intermediate' },
    { id: 's5', name: 'Leadership', category: 'soft', level: 'Advanced' },
    { id: 's6', name: 'Communication', category: 'soft', level: 'Advanced' },
  ],
  languages: [
    { id: 'l1', name: 'English', proficiency: 'Fluent' },
    { id: 'l2', name: 'Hindi', proficiency: 'Fluent' },
  ],
  hobbies: ['Photography', 'Chess', 'Hiking'],
  template: '',
};

export const SAMPLE_COVER_LETTER_DRAFT: CoverLetterDraft = {
  ...emptyCoverLetterDraft,
  personal: {
    fullName: 'Alex Johnson',
    mobile: '+91 98765 43210',
    email: 'alex.johnson@example.com',
    location: 'Bengaluru, India',
    linkedin: 'linkedin.com/in/alexj',
    portfolio: 'alexj.dev',
  },
  employer: {
    companyName: 'Acme Corporation',
    hiringManager: 'Ms. Priya Sharma',
    designation: 'Senior Developer',
    companyAddress: 'Bengaluru, India',
  },
  job: { title: 'Senior Developer', id: '', location: 'Bengaluru', source: 'LinkedIn' },
  opening: { greeting: 'Dear Hiring Manager', customGreeting: '' },
  introduction: {
    whyApplying: 'I am excited to apply for the Senior Developer role at Acme Corporation.',
    whereFound: 'LinkedIn',
  },
  experience: { years: '8', currentTitle: 'Senior Developer', currentCompany: 'TechStart Inc', relevant: 'Led scalable web platforms.' },
  skills: { skills: ['React', 'Node.js', 'AWS'], certifications: 'AWS Certified', achievements: 'Grew user base 16x.' },
  whyCompany: 'Your commitment to innovation aligns with my passion for excellence.',
  closing: { availability: 'within 30 days', thankYou: 'Thank you for considering my application.' },
  signature: { typedName: 'Alex Johnson', digitalSignatureUrl: '' },
  template: '',
};
