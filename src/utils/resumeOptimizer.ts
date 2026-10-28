/**
 * Resume Content Optimizer
 * Provides utilities to optimize resume content for single-page layout
 */

export interface ContentMetrics {
  totalCharacters: number;
  estimatedHeight: number;
  sections: {
    summary: number;
    experience: number;
    education: number;
    skills: number;
    languages: number;
    certifications: number;
  };
  warnings: string[];
  suggestions: string[];
}

// Optimal character limits for single-page A4 resume
const OPTIMAL_LIMITS = {
  summary: 400,
  experienceDescription: 150,
  totalExperiences: 3,
  totalEducation: 3,
  totalSkills: 12,
  totalLanguages: 4,
  totalCertifications: 4,
};

export const analyzeResumeContent = (resumeData: any): ContentMetrics => {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Calculate section metrics
  const summaryLength = resumeData.summary?.length || 0;
  const experienceLength = resumeData.experience?.reduce((sum: number, exp: any) => 
    sum + (exp.description?.length || 0), 0) || 0;
  
  const educationCount = resumeData.education?.length || 0;
  const skillsCount = resumeData.skills?.length || 0;
  const languagesCount = resumeData.languages?.length || 0;
  const certificationsCount = resumeData.certifications?.length || 0;
  
  // Estimate total height in mm (A4 is 297mm)
  let estimatedHeight = 0;
  estimatedHeight += 60; // Header
  estimatedHeight += summaryLength > 0 ? Math.min(40 + (summaryLength / 10), 80) : 0;
  estimatedHeight += (resumeData.experience?.length || 0) * 50;
  estimatedHeight += (educationCount) * 35;
  estimatedHeight += skillsCount > 0 ? 50 : 0;
  estimatedHeight += languagesCount > 0 ? 40 : 0;
  estimatedHeight += certificationsCount > 0 ? 45 : 0;
  estimatedHeight += 30; // Footer
  
  // Generate warnings
  if (estimatedHeight > 297) {
    warnings.push('⚠️ Content exceeds single page. Consider reducing content.');
  }
  
  if (summaryLength > OPTIMAL_LIMITS.summary) {
    warnings.push(`Summary is too long (${summaryLength} chars). Optimal: ${OPTIMAL_LIMITS.summary} chars.`);
    suggestions.push('Shorten your professional summary to 2-3 sentences.');
  }
  
  if ((resumeData.experience?.length || 0) > OPTIMAL_LIMITS.totalExperiences) {
    warnings.push(`Too many work experiences (${resumeData.experience.length}). Optimal: ${OPTIMAL_LIMITS.totalExperiences}.`);
    suggestions.push('Focus on your most recent and relevant positions.');
  }
  
  if (skillsCount > OPTIMAL_LIMITS.totalSkills) {
    warnings.push(`Too many skills (${skillsCount}). Optimal: ${OPTIMAL_LIMITS.totalSkills}.`);
    suggestions.push('List only your strongest and most relevant skills.');
  }
  
  // Check for overly long descriptions
  resumeData.experience?.forEach((exp: any, index: number) => {
    if (exp.description?.length > OPTIMAL_LIMITS.experienceDescription) {
      warnings.push(`Experience #${index + 1} description is too long (${exp.description.length} chars).`);
    }
  });
  
  return {
    totalCharacters: summaryLength + experienceLength,
    estimatedHeight,
    sections: {
      summary: summaryLength,
      experience: experienceLength,
      education: educationCount,
      skills: skillsCount,
      languages: languagesCount,
      certifications: certificationsCount,
    },
    warnings,
    suggestions,
  };
};

export const getCompactMode = (estimatedHeight: number): boolean => {
  return estimatedHeight > 240; // More aggressive - trigger compact mode earlier for single page
};

export const getOptimalFontSizes = (estimatedHeight: number) => {
  if (estimatedHeight > 320) {
    // Very compact
    return {
      headerTitle: '28px',
      headerSubtitle: '16px',
      sectionTitle: '16px',
      jobTitle: '14px',
      bodyText: '11px',
      contactText: '12px',
      spacing: 'compact',
    };
  } else if (estimatedHeight > 280) {
    // Compact
    return {
      headerTitle: '32px',
      headerSubtitle: '17px',
      sectionTitle: '18px',
      jobTitle: '15px',
      bodyText: '12px',
      contactText: '13px',
      spacing: 'reduced',
    };
  }
  
  // Standard
  return {
    headerTitle: '36px',
    headerSubtitle: '18px',
    sectionTitle: '20px',
    jobTitle: '16px',
    bodyText: '14px',
    contactText: '14px',
    spacing: 'normal',
  };
};
