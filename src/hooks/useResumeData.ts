import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfessionalExperiences } from './useProfessionalExperiences';
import { useEducationEntries } from './useEducationEntries';
import { useCertifications } from './useCertifications';

interface Experience {
  id: string;
  position: string;
  company: string;
  duration: string;
  description: string;
}

interface Education {
  id: string;
  degree: string;
  institution: string;
  year: string;
  grade: string;
}

interface ResumeData {
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    linkedin: string;
    portfolio: string;
    title?: string;
    website?: string;
  };
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  languages: string[];
  certifications: string[];
}

export type { ResumeData, Experience, Education };

const defaultResumeData: ResumeData = {
  personalInfo: {
    fullName: "Your Full Name",
    email: "your.email@example.com",
    phone: "+91 9876543210",
    address: "City, State, Country",
    linkedin: "linkedin.com/in/yourprofile",
    portfolio: "yourportfolio.com",
    title: "Professional Title",
    website: "yourportfolio.com"
  },
  summary: "Write a brief professional summary highlighting your key skills and experience...",
  experience: [
    {
      id: "1",
      position: "Job Title",
      company: "Company Name",
      duration: "Start Date - End Date",
      description: "Describe your key responsibilities and achievements in this role..."
    }
  ],
  education: [
    {
      id: "1",
      degree: "Degree Name",
      institution: "Institution Name",
      year: "Graduation Year",
      grade: "Grade/CGPA"
    }
  ],
  skills: ["Skill 1", "Skill 2", "Skill 3", "Skill 4"],
  languages: ["English", "Hindi"],
  certifications: ["Certification Name - Year"]
};

export const useResumeData = () => {
  const { user, profile } = useAuth();
  const { experiences } = useProfessionalExperiences();
  const { educationEntries } = useEducationEntries();
  const { certifications } = useCertifications();
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize with user profile data and database records
  useEffect(() => {
    if (user && profile) {
      // Map professional experiences from database
      const mappedExperiences: Experience[] = experiences.map((exp) => {
        const startDate = exp.start_date ? new Date(exp.start_date).getFullYear() : '';
        const endDate = exp.is_current ? 'Present' : (exp.end_date ? new Date(exp.end_date).getFullYear() : '');
        const duration = startDate && endDate ? `${startDate} - ${endDate}` : (exp.experience_years ? `${exp.experience_years} years` : 'Present');
        
        return {
          id: exp.id,
          position: exp.position,
          company: exp.company || 'Company',
          duration,
          description: exp.description || ''
        };
      });

      // Map education entries from database
      const mappedEducation: Education[] = educationEntries.map((edu) => {
        const year = edu.end_year ? edu.end_year.toString() : (edu.start_year ? edu.start_year.toString() : 'Present');
        
        return {
          id: edu.id,
          degree: edu.degree,
          institution: edu.institution || 'Institution',
          year,
          grade: edu.grade || ''
        };
      });

      // Map certifications from database
      const mappedCertifications = certifications.map((cert) => {
        const year = cert.issue_date ? new Date(cert.issue_date).getFullYear() : '';
        return `${cert.certification_name} - ${cert.issuing_organization}${year ? ` (${year})` : ''}`;
      });

      const initialData: ResumeData = {
        personalInfo: {
          fullName: profile.full_name || "Your Full Name",
          email: user.email || "your.email@example.com",
          phone: profile.phone || "+91 9876543210",
          address: profile.location || "City, State, Country",
          linkedin: "linkedin.com/in/yourprofile",
          portfolio: "yourportfolio.com",
          title: profile.current_position || "",
          website: "yourportfolio.com"
        },
        summary: profile.bio || "Write a brief professional summary highlighting your key skills and experience...",
        experience: mappedExperiences.length > 0 ? mappedExperiences : defaultResumeData.experience,
        education: mappedEducation.length > 0 ? mappedEducation : defaultResumeData.education,
        skills: profile.skills && profile.skills.length > 0 ? profile.skills : defaultResumeData.skills,
        languages: defaultResumeData.languages,
        certifications: mappedCertifications.length > 0 ? mappedCertifications : defaultResumeData.certifications
      };
      
      setResumeData(initialData);
      setIsInitialized(true);
    }
  }, [user, profile, experiences, educationEntries, certifications]);

  // Auto-save to localStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('resumeData', JSON.stringify(resumeData));
    }
  }, [resumeData, isInitialized]);

  const updateResumeData = (newData: Partial<ResumeData>) => {
    setResumeData(prev => ({ ...prev, ...newData }));
  };

  const saveResume = () => {
    localStorage.setItem('resumeData', JSON.stringify(resumeData));
  };

  return {
    resumeData,
    setResumeData,
    updateResumeData,
    saveResume,
    isInitialized
  };
};