import { Mail, Phone, MapPin, Linkedin, Globe, Briefcase, GraduationCap, Award, Code, Languages } from "lucide-react";

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
  };
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  languages: string[];
  certifications: string[];
}

interface ResumePreviewProps {
  resumeData: ResumeData;
  className?: string;
}

const ResumePreview = ({ resumeData, className = "" }: ResumePreviewProps) => {
  // Calculate if compact mode is needed - more aggressive
  const totalContent = 
    (resumeData.summary?.length || 0) +
    (resumeData.experience?.length || 0) * 150 +
    (resumeData.education?.length || 0) * 80 +
    (resumeData.skills?.length || 0) * 20;
  
  const isCompact = totalContent > 1500; // More aggressive threshold
  
  // Dynamic sizing based on content - more aggressive compression
  const sizes = isCompact ? {
    headerPadding: '20px 28px',
    headerTitle: '28px',
    headerSubtitle: '15px',
    contactText: '12px',
    contentPadding: '20px 28px',
    sectionMargin: '18px',
    sectionTitle: '16px',
    jobTitle: '14px',
    bodyText: '11px',
    skillPadding: '4px 10px',
    iconSize: 16,
  } : {
    headerPadding: '32px 40px',
    headerTitle: '36px',
    headerSubtitle: '18px',
    contactText: '14px',
    contentPadding: '32px 40px',
    sectionMargin: '32px',
    sectionTitle: '20px',
    jobTitle: '16px',
    bodyText: '14px',
    skillPadding: '6px 14px',
    iconSize: 20,
  };

  return (
    <div 
      className={`bg-white text-gray-900 ${className}`} 
      style={{ 
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        width: '100%',
        maxWidth: '210mm',
        height: 'auto',
        maxHeight: '297mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        pageBreakAfter: 'avoid',
        pageBreakInside: 'avoid',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Professional Header with Gradient */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: sizes.headerPadding,
        color: 'white',
        pageBreakInside: 'avoid',
      }}>
        <h1 style={{
          fontSize: sizes.headerTitle,
          fontWeight: '700',
          marginBottom: '6px',
          letterSpacing: '-0.5px',
          fontFamily: "'Poppins', sans-serif",
          lineHeight: '1.2',
        }}>
          {resumeData.personalInfo.fullName}
        </h1>
        {resumeData.personalInfo.title && 
         resumeData.personalInfo.title !== "Professional Title" && (
          <p style={{
            fontSize: sizes.headerSubtitle,
            fontWeight: '500',
            opacity: 0.95,
            marginBottom: '12px',
          }}>
            {resumeData.personalInfo.title}
          </p>
        )}
        
        {/* Contact Info - Compact Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '8px',
          fontSize: sizes.contactText,
          marginTop: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={14} />
            <span style={{ fontSize: '13px' }}>{resumeData.personalInfo.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone size={14} />
            <span style={{ fontSize: '13px' }}>{resumeData.personalInfo.phone}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} />
            <span style={{ fontSize: '13px' }}>{resumeData.personalInfo.address}</span>
          </div>
          {resumeData.personalInfo.linkedin && 
           !resumeData.personalInfo.linkedin.includes('linkedin.com/in/yourprofile') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Linkedin size={14} />
              <span style={{ fontSize: '13px' }}>{resumeData.personalInfo.linkedin}</span>
            </div>
          )}
          {resumeData.personalInfo.portfolio && 
           !resumeData.personalInfo.portfolio.includes('yourportfolio.com') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} />
              <span style={{ fontSize: '13px' }}>{resumeData.personalInfo.portfolio}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: sizes.contentPadding, flex: '1', overflow: 'hidden' }}>
        {/* Professional Summary */}
        {resumeData.summary && (
          <section style={{ marginBottom: sizes.sectionMargin, pageBreakInside: 'avoid' }}>
            <h2 style={{
              fontSize: sizes.sectionTitle,
              fontWeight: '700',
              color: '#667eea',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '2px solid #667eea',
              paddingBottom: '18px', lineHeight: '1.4',
              fontFamily: "'Poppins', sans-serif",
            }}>
              <Briefcase size={sizes.iconSize} />
              PROFESSIONAL SUMMARY
            </h2>
            <p style={{
              fontSize: sizes.bodyText,
              lineHeight: '1.5',
              color: '#374151',
              textAlign: 'justify',
            }}>
              {resumeData.summary}
            </p>
          </section>
        )}

        {/* Work Experience */}
        {resumeData.experience.length > 0 && (
          <section style={{ marginBottom: sizes.sectionMargin }}>
            <h2 style={{
              fontSize: sizes.sectionTitle,
              fontWeight: '700',
              color: '#667eea',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '2px solid #667eea',
              paddingBottom: '18px', lineHeight: '1.4',
              fontFamily: "'Poppins', sans-serif",
            }}>
              <Briefcase size={sizes.iconSize} />
              WORK EXPERIENCE
            </h2>
            {resumeData.experience.map((exp, index) => (
              <div key={exp.id} style={{ 
                marginBottom: index === resumeData.experience.length - 1 ? '0' : '16px',
                pageBreakInside: 'avoid',
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '4px',
                  gap: '8px',
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: sizes.jobTitle,
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '2px',
                    }}>
                      {exp.position}
                    </h3>
                    <p style={{
                      fontSize: sizes.bodyText,
                      fontWeight: '500',
                      color: '#764ba2',
                    }}>
                      {exp.company}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    backgroundColor: '#f3f4f6',
                    padding: '3px 10px',
                    borderRadius: '10px',
                    whiteSpace: 'nowrap',
                  }}>
                    {exp.duration}
                  </span>
                </div>
                <p style={{
                  fontSize: sizes.bodyText,
                  lineHeight: '1.5',
                  color: '#4b5563',
                  marginTop: '6px',
                  textAlign: 'justify',
                }}>
                  {exp.description}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Two-Column Layout for Education, Skills, Languages, Certifications */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: sizes.sectionMargin,
        }}>
          {/* Education */}
          {resumeData.education.length > 0 && (
            <section>
              <h2 style={{
                fontSize: sizes.sectionTitle,
                fontWeight: '700',
                color: '#667eea',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '2px solid #667eea',
                paddingBottom: '18px', lineHeight: '1.4',
                fontFamily: "'Poppins', sans-serif",
              }}>
                <GraduationCap size={sizes.iconSize} />
                EDUCATION
              </h2>
              {resumeData.education.map((edu) => (
                <div key={edu.id} style={{ marginBottom: '12px', pageBreakInside: 'avoid' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '3px',
                    gap: '8px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: sizes.jobTitle,
                        fontWeight: '600',
                        color: '#1f2937',
                      }}>
                        {edu.degree}
                      </h3>
                      <p style={{
                        fontSize: sizes.bodyText,
                        color: '#764ba2',
                        marginTop: '2px',
                      }}>
                        {edu.institution}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      backgroundColor: '#f3f4f6',
                      padding: '3px 10px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {edu.year}
                    </span>
                  </div>
                  {edu.grade && (
                    <p style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      marginTop: '3px',
                    }}>
                      Grade: {edu.grade}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Skills & Languages - Two Column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Skills */}
            {resumeData.skills.length > 0 && (
              <section>
                <h2 style={{
                  fontSize: sizes.sectionTitle,
                  fontWeight: '700',
                  color: '#667eea',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '2px solid #667eea',
                  paddingBottom: '18px', lineHeight: '1.4',
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  <Code size={sizes.iconSize} />
                  SKILLS
                </h2>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {resumeData.skills.map((skill, index) => (
                    <span key={index} style={{
                      fontSize: '12px',
                      color: '#374151',
                      backgroundColor: '#e0e7ff',
                      padding: sizes.skillPadding,
                      borderRadius: '12px',
                      fontWeight: '500',
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Languages */}
            {resumeData.languages.length > 0 && (
              <section>
                <h2 style={{
                  fontSize: sizes.sectionTitle,
                  fontWeight: '700',
                  color: '#667eea',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '2px solid #667eea',
                  paddingBottom: '18px', lineHeight: '1.4',
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  <Languages size={sizes.iconSize} />
                  LANGUAGES
                </h2>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {resumeData.languages.map((lang, index) => (
                    <span key={index} style={{
                      fontSize: '12px',
                      color: '#374151',
                      backgroundColor: '#fef3c7',
                      padding: sizes.skillPadding,
                      borderRadius: '12px',
                      fontWeight: '500',
                    }}>
                      {lang}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Certifications */}
          {resumeData.certifications.length > 0 && (
            <section>
              <h2 style={{
                fontSize: sizes.sectionTitle,
                fontWeight: '700',
                color: '#667eea',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '2px solid #667eea',
                paddingBottom: '18px', lineHeight: '1.4',
                fontFamily: "'Poppins', sans-serif",
              }}>
                <Award size={sizes.iconSize} />
                CERTIFICATIONS
              </h2>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '6px',
              }}>
                {resumeData.certifications.map((cert, index) => (
                  <li key={index} style={{
                    fontSize: sizes.bodyText,
                    color: '#374151',
                    paddingLeft: '18px',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: '0',
                      color: '#667eea',
                      fontWeight: 'bold',
                    }}>
                      ✓
                    </span>
                    {cert}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* Footer - Compact */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '12px 32px',
        color: 'white',
        textAlign: 'center',
        fontSize: '11px',
        marginTop: 'auto',
        pageBreakInside: 'avoid',
      }}>
        <p style={{ margin: 0 }}>
          Generated via Workly India Jobs Platform | Professional Resume
        </p>
      </div>
    </div>
  );
};

export default ResumePreview;
