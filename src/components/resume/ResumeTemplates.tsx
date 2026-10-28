import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBrandAssets } from '@/hooks/useBrandAssets';
import { useUserProfile } from '@/hooks/useUserProfile';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Linkedin, 
  Github,
  Calendar,
  Building,
  GraduationCap,
  Award,
  Languages,
  Star,
  Briefcase
} from 'lucide-react';
import { analyzeResumeContent, getCompactMode } from '@/utils/resumeOptimizer';

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

interface ResumeTemplateProps {
  resumeData: ResumeData;
  className?: string;
}

function ResumeHeaderBranding({
  variant,
  templateLabel,
}: {
  variant: 'dark' | 'light';
  templateLabel: string;
}) {
  const brand = useBrandAssets();
  const { data: profile } = useUserProfile();

  const brandName = brand.brand_name || 'Workly India';
  const brandLogo =
    variant === 'dark'
      ? (brand.logo_url || brand.favicon_url)
      : (brand.logo_dark_url || brand.logo_url || brand.favicon_url);

  const userImageUrl = (profile as any)?.profile_image_url as string | undefined;
  const userName = ((profile as any)?.full_name as string | undefined) || 'User';

  return (
    <div className="flex items-start justify-end gap-3">
      <div className="text-right">
        <div className={variant === 'dark' ? 'text-white' : 'text-foreground'}>
          <div className="flex items-center justify-end gap-2">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                className={
                  variant === 'dark'
                    ? 'h-6 w-6 rounded-sm bg-white/10 p-0.5'
                    : 'h-6 w-6 rounded-sm bg-muted/40 p-0.5'
                }
                loading="eager"
              />
            ) : null}
            <p className="font-semibold leading-none">{brandName}</p>
          </div>
          <p className={variant === 'dark' ? 'text-white/80' : 'text-muted-foreground'}>
            {templateLabel}
          </p>
        </div>
      </div>

      {userImageUrl ? (
        <img
          src={userImageUrl}
          alt={userName}
          className={
            variant === 'dark'
              ? 'h-11 w-11 rounded-full border border-white/30 object-cover'
              : 'h-11 w-11 rounded-full border border-border object-cover'
          }
          loading="eager"
        />
      ) : null}
    </div>
  );
}

// Professional Template - Clean and corporate
export const ProfessionalTemplate: React.FC<ResumeTemplateProps> = ({ resumeData, className = "" }) => {
  const metrics = analyzeResumeContent(resumeData);
  const isCompact = getCompactMode(metrics.estimatedHeight);
  
  return (
    <div className={`doc-preview bg-white max-h-[297mm] h-[297mm] w-full font-inter overflow-hidden ${className}`} id="resume-preview">
      {/* Header Section with Workly India Branding */}
      <div className={`bg-gradient-primary text-white ${isCompact ? 'p-5 mb-4' : 'p-8 mb-6'}`}>
        <div className={`flex justify-between items-start ${isCompact ? 'mb-3' : 'mb-4'}`}>
          <div>
            <h1 className={`${isCompact ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-3xl lg:text-4xl'} font-bold font-poppins mb-2`}>{resumeData.personalInfo.fullName}</h1>
            {resumeData.personalInfo.title && 
             resumeData.personalInfo.title !== "Professional Title" && (
              <p className={`${isCompact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} text-white/90 font-medium`}>{resumeData.personalInfo.title}</p>
            )}
          </div>
          <div className="text-sm">
            <ResumeHeaderBranding variant="dark" templateLabel="Professional Resume" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm">
          {resumeData.personalInfo.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="truncate">{resumeData.personalInfo.email}</span>
            </div>
          )}
          {resumeData.personalInfo.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{resumeData.personalInfo.phone}</span>
            </div>
          )}
          {resumeData.personalInfo.address && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{resumeData.personalInfo.address}</span>
            </div>
          )}
          {resumeData.personalInfo.website && 
           resumeData.personalInfo.website !== "yourportfolio.com" && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="truncate">{resumeData.personalInfo.website}</span>
            </div>
          )}
        </div>
      </div>

      <div className={`${isCompact ? 'px-5 pb-5' : 'px-8 pb-8'}`}>
        <div className={`grid grid-cols-1 lg:grid-cols-3 ${isCompact ? 'gap-5' : 'gap-8'}`}>
          {/* Main Content */}
          <div className={`lg:col-span-2 ${isCompact ? 'space-y-4' : 'space-y-6'}`}>
            {/* Professional Summary */}
            {resumeData.summary && (
              <section>
                <h2 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-foreground ${isCompact ? 'mb-2' : 'mb-3'} border-b-2 border-primary pb-1`}>
                  Professional Summary
                </h2>
                <p className={`text-muted-foreground ${isCompact ? 'text-sm leading-snug' : 'leading-relaxed'}`}>{resumeData.summary}</p>
              </section>
            )}

            {/* Work Experience */}
            {resumeData.experience.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-foreground ${isCompact ? 'mb-3' : 'mb-4'} border-b-2 border-primary pb-1 flex items-center gap-2`}>
                  <Briefcase className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} text-primary`} />
                  Work Experience
                </h2>
                <div className={`${isCompact ? 'space-y-4' : 'space-y-6'}`}>
                  {resumeData.experience.map((exp, index) => (
                    <div key={index} className="relative pl-4 border-l-2 border-primary/30">
                      <div className="absolute -left-2 top-0 w-4 h-4 bg-primary rounded-full"></div>
                      <div className={`${isCompact ? 'mb-1' : 'mb-2'}`}>
                        <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-semibold text-foreground`}>{exp.position}</h3>
                        <div className={`flex items-center gap-2 text-primary font-medium ${isCompact ? 'text-sm' : ''}`}>
                          <Building className="w-4 h-4" />
                          <span>{exp.company}</span>
                        </div>
                        <div className={`flex items-center gap-2 text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>
                          <Calendar className="w-4 h-4" />
                          <span>{exp.duration}</span>
                        </div>
                      </div>
                      <p className={`text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>{exp.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {resumeData.education.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-foreground ${isCompact ? 'mb-3' : 'mb-4'} border-b-2 border-secondary pb-1 flex items-center gap-2`}>
                  <GraduationCap className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} text-secondary`} />
                  Education
                </h2>
                <div className={`${isCompact ? 'space-y-2' : 'space-y-4'}`}>
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className={`bg-card border border-border rounded-lg ${isCompact ? 'p-3' : 'p-4'}`}>
                      <h3 className={`font-semibold text-foreground ${isCompact ? 'text-sm' : ''}`}>{edu.degree}</h3>
                      <p className={`text-secondary font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>{edu.institution}</p>
                      <div className={`flex justify-between items-center ${isCompact ? 'mt-1' : 'mt-2'} text-xs text-muted-foreground`}>
                        <span>{edu.year}</span>
                        {edu.grade && <span className="font-medium">Grade: {edu.grade}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className={`${isCompact ? 'space-y-4' : 'space-y-6'}`}>
            {/* Skills */}
            {resumeData.skills.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold text-foreground ${isCompact ? 'mb-3' : 'mb-4'} flex items-center gap-2`}>
                  <Star className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-warning`} />
                  Technical Skills
                </h2>
                <div className={`${isCompact ? 'space-y-2' : 'space-y-3'}`}>
                  {resumeData.skills.map((skill, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-foreground`}>{skill}</span>
                        <span className="text-xs text-muted-foreground">Advanced</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Languages */}
            {resumeData.languages.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold text-foreground ${isCompact ? 'mb-3' : 'mb-4'} flex items-center gap-2`}>
                  <Languages className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-success`} />
                  Languages
                </h2>
                <div className="space-y-2">
                  {resumeData.languages.map((language, index) => (
                    <Badge key={index} variant="secondary" className={`mr-2 mb-2 ${isCompact ? 'text-xs' : ''}`}>
                      {language}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Certifications */}
            {resumeData.certifications.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold text-foreground ${isCompact ? 'mb-3' : 'mb-4'} flex items-center gap-2`}>
                  <Award className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
                  Certifications
                </h2>
                <div className={`${isCompact ? 'space-y-1.5' : 'space-y-2'}`}>
                  {resumeData.certifications.map((cert, index) => (
                    <div key={index} className={`bg-primary/5 border border-primary/20 rounded-lg ${isCompact ? 'p-2' : 'p-3'}`}>
                      <p className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-foreground`}>{cert}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Creative Template - Modern and colorful
export const CreativeTemplate: React.FC<ResumeTemplateProps> = ({ resumeData, className = "" }) => {
  const metrics = analyzeResumeContent(resumeData);
  const isCompact = getCompactMode(metrics.estimatedHeight);
  
  return (
    <div className={`doc-preview bg-white max-h-[297mm] h-[297mm] w-full font-poppins overflow-hidden ${className}`} id="resume-preview" style={{ fontSize: isCompact ? '11px' : '14px' }}>
      {/* Creative Header with Rainbow Gradient */}
      <div className={`bg-gradient-hero text-white ${isCompact ? 'p-4 mb-3' : 'p-8 mb-6'} relative overflow-hidden`}>
        
        <div className="relative z-10">
          <div className={`flex justify-between items-start ${isCompact ? 'mb-2' : 'mb-6'}`}>
            <div>
              <h1 className={`${isCompact ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl lg:text-5xl'} font-bold ${isCompact ? 'mb-1' : 'mb-3'} tracking-tight`}>{resumeData.personalInfo.fullName}</h1>
              {resumeData.personalInfo.title && 
               resumeData.personalInfo.title !== "Professional Title" && (
                <p className={`${isCompact ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl'} text-white/90 font-medium`}>{resumeData.personalInfo.title}</p>
              )}
            </div>
            <div className="text-right">
              <div className={`bg-white/20 backdrop-blur-sm rounded-lg ${isCompact ? 'p-2' : 'p-3'}`}>
                <ResumeHeaderBranding variant="dark" templateLabel="Creative Resume" />
              </div>
            </div>
          </div>

          <div className={`flex flex-wrap ${isCompact ? 'gap-2' : 'gap-4'} ${isCompact ? 'text-xs' : 'text-sm'}`}>
            {resumeData.personalInfo.email && (
              <div className={`flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full ${isCompact ? 'px-2 py-0.5' : 'px-3 py-1'}`}>
                <Mail className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                <span className="truncate">{resumeData.personalInfo.email}</span>
              </div>
            )}
            {resumeData.personalInfo.phone && (
              <div className={`flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full ${isCompact ? 'px-2 py-0.5' : 'px-3 py-1'}`}>
                <Phone className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                <span>{resumeData.personalInfo.phone}</span>
              </div>
            )}
            {resumeData.personalInfo.address && (
              <div className={`flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full ${isCompact ? 'px-2 py-0.5' : 'px-3 py-1'}`}>
                <MapPin className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                <span className="truncate">{resumeData.personalInfo.address}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`${isCompact ? 'px-4 pb-4' : 'px-8 pb-8'}`}>
        {/* Summary with Creative Design */}
        {resumeData.summary && (
          <section className={`${isCompact ? 'mb-3' : 'mb-8'}`}>
            <div className={`bg-gradient-card rounded-2xl ${isCompact ? 'p-3' : 'p-6'} shadow-soft`}>
              <h2 className={`${isCompact ? 'text-base' : 'text-2xl'} font-bold text-foreground ${isCompact ? 'mb-1' : 'mb-4'} gradient-text`}>About Me</h2>
              <p className={`text-muted-foreground ${isCompact ? 'leading-snug text-xs' : 'leading-relaxed text-lg'}`}>{resumeData.summary}</p>
            </div>
          </section>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-3 ${isCompact ? 'gap-3' : 'gap-8'}`}>
          {/* Main Content */}
          <div className={`lg:col-span-2 ${isCompact ? 'space-y-3' : 'space-y-8'}`}>
            {/* Work Experience with Creative Timeline */}
            {resumeData.experience.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-lg' : 'text-3xl'} font-bold text-foreground ${isCompact ? 'mb-2' : 'mb-6'} gradient-text`}>Experience Journey</h2>
                <div className={`${isCompact ? 'space-y-2' : 'space-y-6'}`}>
                  {resumeData.experience.map((exp, index) => (
                    <div key={index} className="relative">
                      <div className={`bg-gradient-card ${isCompact ? 'rounded-lg' : 'rounded-2xl'} ${isCompact ? 'p-2' : 'p-6'} shadow-soft border-l-4 border-primary`}>
                        <div className={`flex items-start justify-between ${isCompact ? 'mb-1' : 'mb-4'} ${isCompact ? 'gap-2' : 'gap-4'}`}>
                          <div className="flex-1 min-w-0">
                            <h3 className={`${isCompact ? 'text-sm' : 'text-xl'} font-bold text-foreground truncate`}>{exp.position}</h3>
                            <p className={`text-primary font-semibold ${isCompact ? 'text-xs' : 'text-lg'} truncate`}>{exp.company}</p>
                          </div>
                          <Badge variant="outline" className={`bg-primary/10 text-primary border-primary ${isCompact ? 'text-[10px] px-1.5 py-0.5 shrink-0' : ''}`}>
                            {exp.duration}
                          </Badge>
                        </div>
                        <p className={`text-muted-foreground ${isCompact ? 'text-[10px] leading-tight line-clamp-2' : 'leading-relaxed'}`}>{exp.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {resumeData.education.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-lg' : 'text-3xl'} font-bold text-foreground ${isCompact ? 'mb-2' : 'mb-6'} gradient-text`}>Education</h2>
                <div className={`grid ${isCompact ? 'gap-2' : 'gap-4'}`}>
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className={`bg-gradient-secondary/10 border border-secondary/20 ${isCompact ? 'rounded-lg' : 'rounded-xl'} ${isCompact ? 'p-2' : 'p-6'}`}>
                      <h3 className={`${isCompact ? 'text-sm' : 'text-lg'} font-bold text-foreground truncate`}>{edu.degree}</h3>
                      <p className={`text-secondary font-semibold ${isCompact ? 'text-xs truncate' : ''}`}>{edu.institution}</p>
                      <div className={`flex justify-between items-center ${isCompact ? 'mt-1' : 'mt-3'}`}>
                        <span className={`text-muted-foreground ${isCompact ? 'text-[10px]' : 'text-sm'}`}>{edu.year}</span>
                        {edu.grade && (
                          <Badge variant="secondary" className={`${isCompact ? 'text-[10px] px-1.5 py-0' : ''}`}>Grade: {edu.grade}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Creative Sidebar */}
          <div className={`${isCompact ? 'space-y-2' : 'space-y-6'}`}>
            {/* Skills with Creative Progress */}
            {resumeData.skills.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-2xl'} font-bold text-foreground ${isCompact ? 'mb-2' : 'mb-4'} gradient-text`}>Skills</h2>
                <div className={`${isCompact ? 'space-y-1' : 'space-y-4'}`}>
                  {resumeData.skills.map((skill, index) => (
                    <div key={index} className={`bg-gradient-card rounded-lg ${isCompact ? 'p-1.5' : 'p-4'}`}>
                      <div className={`flex justify-between items-center ${isCompact ? 'mb-0.5' : 'mb-2'}`}>
                        <span className={`font-medium text-foreground ${isCompact ? 'text-[10px]' : 'text-sm'} truncate`}>{skill}</span>
                        {!isCompact && <Star className="w-4 h-4 text-warning fill-current" />}
                      </div>
                      {!isCompact && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-gradient-primary h-2 rounded-full transition-all duration-1000"
                            style={{ width: '90%' }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Languages */}
            {resumeData.languages.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-2xl'} font-bold text-foreground ${isCompact ? 'mb-1' : 'mb-4'} gradient-text`}>Languages</h2>
                <div className="flex flex-wrap gap-1">
                  {resumeData.languages.map((language, index) => (
                    <Badge 
                      key={index} 
                      className={`bg-success/10 text-success border-success hover:bg-success/20 ${isCompact ? 'text-[10px] px-1.5 py-0' : ''}`}
                    >
                      {language}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Certifications */}
            {resumeData.certifications.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-2xl'} font-bold text-foreground ${isCompact ? 'mb-1' : 'mb-4'} gradient-text`}>Certifications</h2>
                <div className={`${isCompact ? 'space-y-1' : 'space-y-3'}`}>
                  {resumeData.certifications.map((cert, index) => (
                    <div key={index} className={`bg-warning/10 border border-warning/30 rounded-lg ${isCompact ? 'p-1.5' : 'p-3'}`}>
                      <div className="flex items-center gap-2">
                        {!isCompact && <Award className="w-4 h-4 text-warning" />}
                        <p className={`${isCompact ? 'text-[10px]' : 'text-sm'} font-medium text-foreground ${isCompact ? 'line-clamp-1' : ''}`}>{cert}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Minimalist Template - Clean and simple
export const MinimalistTemplate: React.FC<ResumeTemplateProps> = ({ resumeData, className = "" }) => {
  const metrics = analyzeResumeContent(resumeData);
  const isCompact = getCompactMode(metrics.estimatedHeight);
  
  return (
    <div className={`doc-preview bg-white max-h-[297mm] h-[297mm] w-full font-inter overflow-hidden ${className}`} id="resume-preview">
      {/* Minimalist Header */}
      <div className={`border-b-2 border-foreground ${isCompact ? 'p-5 mb-5' : 'p-8 mb-8'}`}>
        <div className="flex justify-between items-start">
          <div>
            <h1 className={`${isCompact ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-3xl lg:text-4xl'} font-light text-foreground mb-2 tracking-wide`}>
              {resumeData.personalInfo.fullName}
            </h1>
            {resumeData.personalInfo.title && 
             resumeData.personalInfo.title !== "Professional Title" && (
              <p className={`${isCompact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} text-muted-foreground font-light`}>{resumeData.personalInfo.title}</p>
            )}
          </div>
          <div className="text-sm">
            <ResumeHeaderBranding variant="light" templateLabel="Minimalist Resume" />
          </div>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
          {resumeData.personalInfo.email && (
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {resumeData.personalInfo.email}
            </span>
          )}
          {resumeData.personalInfo.phone && (
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {resumeData.personalInfo.phone}
            </span>
          )}
          {resumeData.personalInfo.address && (
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {resumeData.personalInfo.address}
            </span>
          )}
        </div>
      </div>

      <div className={`${isCompact ? 'px-5 pb-5' : 'px-8 pb-8'}`}>
        <div className={`grid grid-cols-1 lg:grid-cols-4 ${isCompact ? 'gap-5' : 'gap-8'}`}>
          {/* Main Content */}
          <div className={`lg:col-span-3 ${isCompact ? 'space-y-5' : 'space-y-8'}`}>
            {/* Summary */}
            {resumeData.summary && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-lg'} font-medium text-foreground ${isCompact ? 'mb-3' : 'mb-4'} uppercase tracking-wide border-b border-border pb-2`}>
                  Summary
                </h2>
                <p className={`text-muted-foreground ${isCompact ? 'text-sm leading-snug' : 'leading-relaxed'}`}>{resumeData.summary}</p>
              </section>
            )}

            {/* Experience */}
            {resumeData.experience.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-lg'} font-medium text-foreground ${isCompact ? 'mb-3' : 'mb-4'} uppercase tracking-wide border-b border-border pb-2`}>
                  Experience
                </h2>
                <div className={`${isCompact ? 'space-y-4' : 'space-y-6'}`}>
                  {resumeData.experience.map((exp, index) => (
                    <div key={index}>
                      <div className={`flex justify-between items-start ${isCompact ? 'mb-1' : 'mb-2'}`}>
                        <div>
                          <h3 className={`font-medium text-foreground ${isCompact ? 'text-sm' : ''}`}>{exp.position}</h3>
                          <p className={`text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>{exp.company}</p>
                        </div>
                        <span className={`${isCompact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>{exp.duration}</span>
                      </div>
                      <p className={`text-muted-foreground ${isCompact ? 'text-xs leading-snug' : 'text-sm leading-relaxed'}`}>{exp.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {resumeData.education.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-lg'} font-medium text-foreground ${isCompact ? 'mb-3' : 'mb-4'} uppercase tracking-wide border-b border-border pb-2`}>
                  Education
                </h2>
                <div className={`${isCompact ? 'space-y-3' : 'space-y-4'}`}>
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className="flex justify-between items-start">
                      <div>
                        <h3 className={`font-medium text-foreground ${isCompact ? 'text-sm' : ''}`}>{edu.degree}</h3>
                        <p className={`text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>{edu.institution}</p>
                      </div>
                      <div className={`text-right ${isCompact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                        <p>{edu.year}</p>
                        {edu.grade && <p>Grade: {edu.grade}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Minimal Sidebar */}
          <div className={`${isCompact ? 'space-y-5' : 'space-y-8'}`}>
            {/* Skills */}
            {resumeData.skills.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-lg'} font-medium text-foreground ${isCompact ? 'mb-3' : 'mb-4'} uppercase tracking-wide border-b border-border pb-2`}>
                  Skills
                </h2>
                <div className="space-y-2">
                  {resumeData.skills.map((skill, index) => (
                    <p key={index} className={`${isCompact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                      {skill}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* Languages */}
            {resumeData.languages.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-lg'} font-medium text-foreground ${isCompact ? 'mb-3' : 'mb-4'} uppercase tracking-wide border-b border-border pb-2`}>
                  Languages
                </h2>
                <div className="space-y-2">
                  {resumeData.languages.map((language, index) => (
                    <p key={index} className={`${isCompact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                      {language}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* Certifications */}
            {resumeData.certifications.length > 0 && (
              <section>
                <h2 className={`${isCompact ? 'text-base' : 'text-lg'} font-medium text-foreground ${isCompact ? 'mb-3' : 'mb-4'} uppercase tracking-wide border-b border-border pb-2`}>
                  Certifications
                </h2>
                <div className="space-y-2">
                  {resumeData.certifications.map((cert, index) => (
                    <p key={index} className={`${isCompact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                      {cert}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { ALL_RESUME_TEMPLATES } from './templates/AllResumeTemplates';

// Legacy 3-template map (kept for `/resume-editor` back-compat) plus the new
// 10 distinct layouts keyed by the exact TEMPLATES ids used in the create flow.
export const RESUME_TEMPLATES = {
  professional: ProfessionalTemplate,
  creative: CreativeTemplate,
  minimalist: MinimalistTemplate,
  ...ALL_RESUME_TEMPLATES,
} as const;

export type TemplateType = keyof typeof RESUME_TEMPLATES;