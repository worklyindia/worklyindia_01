import { useEffect, useState } from 'react';
import { useSupabaseDraftSync } from './useSupabaseDraftSync';

export type ExperienceEntry = {
  id: string;
  company: string;
  jobTitle: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  city: string;
  responsibilities: string;
  achievements: string;
};

export type EducationEntry = {
  id: string;
  course: string;
  school: string;
  board: string;
  startYear: string;
  endYear: string;
  grade: string;
};

export type SkillEntry = {
  id: string;
  name: string;
  category: 'technical' | 'soft';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
};

export type CertificationEntry = {
  id: string;
  name: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
  url: string;
};

export type ProjectEntry = {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  link: string;
};

export type LanguageEntry = {
  id: string;
  name: string;
  proficiency: 'Basic' | 'Intermediate' | 'Fluent';
};

export type ReferenceEntry = {
  id: string;
  name: string;
  company: string;
  designation: string;
  phone: string;
  email: string;
};

export type InternshipEntry = {
  id: string;
  company: string;
  role: string;
  duration: string;
  description: string;
};

export type ResumeDraft = {
  personal: {
    fullName: string;
    professionalTitle: string;
    mobile: string;
    email: string;
    location: string;
    linkedin: string;
    portfolio: string;
    photoUrl: string;
  };
  summary: string;
  experiences: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillEntry[];
  certifications: CertificationEntry[];
  projects: ProjectEntry[];
  languages: LanguageEntry[];
  achievements: string;
  internships: InternshipEntry[];
  hobbies: string[];
  references: ReferenceEntry[];
  additional: {
    dob: string;
    gender: string;
    maritalStatus: string;
    nationality: string;
  };
  jobPreferences: {
    preferredRole: string;
    preferredLocation: string;
    expectedSalary: string;
    employmentTypes: string[];
    immediateJoining: 'yes' | 'no' | '';
  };
  template:
    | 'Professional'
    | 'ATS Simple'
    | 'Modern'
    | 'Minimal'
    | 'Executive'
    | 'Fresher'
    | 'Two Column'
    | 'One Column'
    | 'Compact'
    | 'Creative'
    | '';
};

const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyDraft: ResumeDraft = {
  personal: {
    fullName: '',
    professionalTitle: '',
    mobile: '',
    email: '',
    location: '',
    linkedin: '',
    portfolio: '',
    photoUrl: '',
  },
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
  languages: [],
  achievements: '',
  internships: [],
  hobbies: [],
  references: [],
  additional: { dob: '', gender: '', maritalStatus: '', nationality: '' },
  jobPreferences: {
    preferredRole: '',
    preferredLocation: '',
    expectedSalary: '',
    employmentTypes: [],
    immediateJoining: '',
  },
  template: '',
};

const STORAGE_KEY = 'resume_builder_draft_v1';

export const newId = uid;

export const useResumeDraft = () =>
  useSupabaseDraftSync<ResumeDraft>('resume_drafts', STORAGE_KEY, emptyDraft);
