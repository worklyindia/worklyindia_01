import { useEffect, useState } from 'react';
import { useSupabaseDraftSync } from './useSupabaseDraftSync';

export type CoverLetterTemplate =
  | 'Professional'
  | 'ATS Simple'
  | 'Modern'
  | 'Minimal'
  | 'Executive'
  | 'Fresher'
  | 'Creative'
  | 'Corporate'
  | 'Formal'
  | 'Simple'
  | 'ATS Professional'
  | 'Elegant'
  | 'Classic'
  | 'Premium'
  | '';


export type CoverLetterDraft = {
  personal: {
    fullName: string;
    mobile: string;
    email: string;
    location: string;
    linkedin: string;
    portfolio: string;
  };
  employer: {
    companyName: string;
    hiringManager: string;
    designation: string;
    companyAddress: string;
  };
  job: {
    title: string;
    id: string;
    location: string;
    source: string;
  };
  opening: {
    greeting: 'Dear Hiring Manager' | 'Dear Recruiter' | 'Dear Mr./Ms. [Name]' | 'Custom' | '';
    customGreeting: string;
  };
  introduction: {
    whyApplying: string;
    whereFound: string;
  };
  experience: {
    years: string;
    currentTitle: string;
    currentCompany: string;
    relevant: string;
  };
  skills: {
    skills: string[];
    certifications: string;
    achievements: string;
  };
  whyCompany: string;
  closing: {
    availability: string;
    thankYou: string;
  };
  signature: {
    typedName: string;
    digitalSignatureUrl: string;
    signatureFont?:
      | 'great-vibes'
      | 'dancing-script'
      | 'homemade-apple'
      | 'sacramento'
      | 'allura'
      | 'alex-brush'
      | 'kaushan-script'
      | 'satisfy'
      | 'pacifico'
      | 'caveat'
      | 'yellowtail'
      | 'parisienne'
      | 'monsieur-la-doulaise'
      | 'tangerine'
      | 'mrs-saint-delafield'
      | 'pinyon-script'
      | 'herr-von-muellerhoff'
      | 'rochester'
      | 'qwigley'
      | 'italianno'
      | 'arizonia'
      | 'marck-script'
      | 'bilbo'
      | 'bilbo-swash-caps'
      | 'aguafina-script'
      | 'cedarville-cursive'
      | 'clicker-script'
      | 'sofia'
      | 'windsong'
      | 'freebooter-script'
      | 'euphoria-script'
      | '';
  };
  template: CoverLetterTemplate;
};

const uid = () => Math.random().toString(36).slice(2, 10);
export const newId = uid;

export const emptyCoverLetterDraft: CoverLetterDraft = {
  personal: { fullName: '', mobile: '', email: '', location: '', linkedin: '', portfolio: '' },
  employer: { companyName: '', hiringManager: '', designation: '', companyAddress: '' },
  job: { title: '', id: '', location: '', source: '' },
  opening: { greeting: 'Dear Hiring Manager', customGreeting: '' },
  introduction: { whyApplying: '', whereFound: '' },
  experience: { years: '', currentTitle: '', currentCompany: '', relevant: '' },
  skills: { skills: [], certifications: '', achievements: '' },
  whyCompany: '',
  closing: { availability: '', thankYou: 'Thank you for considering my application.' },
  signature: { typedName: '', digitalSignatureUrl: '', signatureFont: '' },
  template: 'Professional',
};

const STORAGE_KEY = 'cover_letter_draft_v1';

export const useCoverLetterDraft = () =>
  useSupabaseDraftSync<CoverLetterDraft>('cover_letter_drafts', STORAGE_KEY, emptyCoverLetterDraft);

