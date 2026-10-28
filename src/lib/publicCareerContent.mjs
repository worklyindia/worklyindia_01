// Public facts shared by the interactive pages and their no-JavaScript HTML.
export const PUBLIC_CAREER_CONTENT = {
  '/jobs': {
    heading: 'Jobs in India — remote, hybrid and on-site',
    description: 'Explore Workly India job listings by role, location, category and experience. Compare job details before choosing where to apply.',
    sections: [
      { heading: 'Find a role that fits', text: 'Browse remote, on-site, hybrid and fresher listings. Search by job title or skills, then narrow the results by location and job type.' },
      { heading: 'Compare before applying', text: 'Read the responsibilities, experience requirements, employer details and any listed salary. Partner listings may take you to an external website to apply.' },
    ],
    links: [{ href: '/resume-builder', label: 'Prepare your resume' }, { href: '/job-seeker-guidelines', label: 'Job seeker guidelines' }, { href: '/trust-safety', label: 'Trust and safety' }],
  },
  '/resume-builder': {
    heading: 'Resume and cover letter builder',
    description: 'Build your resume with guided sections, choose a design, and download PDF or DOCX. Create a matching cover letter for your next application.',
    sections: [
      { heading: 'What to include in your resume', text: 'Add your contact details, summary, experience, education and skills. Include relevant certifications, projects, languages, achievements and internships.' },
      { heading: 'Choose a format for your application', text: 'Use the ATS Simple design for plain formatting. Download PDF or DOCX, switch designs without retyping your content, or share your resume by link.' },
    ],
    links: [{ href: '/auth?redirect=%2Fresume-builder', label: 'Sign in to create a resume' }, { href: '/jobs', label: 'Browse jobs' }, { href: '/job-seeker-guidelines', label: 'Job seeker guidelines' }],
  },
};