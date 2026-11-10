import { useState, useEffect } from "react";
import { useProfileTracking } from "@/hooks/useProfileTracking";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  Star, 
  MessageCircle, 
  Calendar,
  GraduationCap,
  Award,
  Languages,
  Globe,
  FileText,
  Target,
  Building,
  Download,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND_CONFIG } from "@/config/brandConfig";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import SocialMediaIcons from "@/components/SocialMediaIcons";
import { downloadResumeViaEdge, downloadCoverLetterViaEdge, ResumeData as EdgeResumeData } from "@/utils/edgeFunctionDownload";

interface ApplicantData {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  profileImage?: string;
  currentPosition: string;
  company: string;
  experience: string;
  skills: string[];
  education: string;
  appliedAt: string;
  // Additional comprehensive data
  bio?: string;
  experienceLevel?: number;
  preferredLocation?: string;
  jobType?: string;
  industry?: string;
  whatsappNumber?: string;
  application_source?: 'api' | 'website';
  isGuest?: boolean;
  // API-specific structured data
  api_social_links?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    linkedin?: string;
  };
  api_certifications?: Array<{
    certification_name: string;
    issuing_organization: string;
    issue_date?: string;
    expiry_date?: string;
    credential_id?: string;
    credential_url?: string;
    description?: string;
  }>;
  api_professional_experiences?: Array<{
    position: string;
    company?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    description?: string;
  }>;
  api_education_entries?: Array<{
    degree: string;
    institution?: string;
    field_of_study?: string;
    start_year?: number;
    end_year?: number;
    grade?: string;
    description?: string;
  }>;
  // Website-specific data
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    linkedin?: string;
  };
  address?: {
    precise?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  telegramUsername?: string;
  languages?: string[];
  coverLetter?: string;
  educationEntries?: Array<{
    id: string;
    degree: string;
    institution?: string;
    field_of_study?: string;
    start_year?: number;
    end_year?: number;
    grade?: string;
    description?: string;
  }>;
  certifications?: Array<{
    id: string;
    certification_name: string;
    issuing_organization: string;
    issue_date?: string;
    expiry_date?: string;
    credential_id?: string;
    credential_url?: string;
    description?: string;
  }>;
  professionalExperiences?: Array<{
    id: string;
    position: string;
    company?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
    description?: string;
    experience_years?: number;
  }>;
}

interface ApplicantProfileDialogProps {
  applicant: ApplicantData;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ApplicantProfileDialog = ({ applicant, children, open, onOpenChange }: ApplicantProfileDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const { trackProfileView } = useProfileTracking();

  // Use external control if provided, otherwise use internal state
  const dialogOpen = open !== undefined ? open : isOpen;
  const setDialogOpen = onOpenChange !== undefined ? onOpenChange : setIsOpen;

  // Track profile view when dialog opens
  useEffect(() => {
    if (dialogOpen && applicant.id) {
      trackProfileView(applicant.id);
    }
  }, [dialogOpen, applicant.id, trackProfileView]);

  // Transform applicant data to EdgeResumeData format for Edge Function
  // Using same formatting as Resume Builder (useResumeData.ts)
  const edgeResumeData: EdgeResumeData = {
    personalInfo: {
      fullName: applicant.name,
      email: applicant.email,
      phone: applicant.phone,
      address: applicant.location,
      linkedin: applicant.socialLinks?.linkedin || 
                applicant.api_social_links?.linkedin || '',
      portfolio: '',
      title: applicant.currentPosition,
    },
    summary: applicant.bio || '',
    experience: (applicant.professionalExperiences || applicant.api_professional_experiences || []).map((exp) => {
      // Format dates like Resume Builder - using year only
      const startYear = exp.start_date ? new Date(exp.start_date).getFullYear() : '';
      const endYear = exp.is_current ? 'Present' : (exp.end_date ? new Date(exp.end_date).getFullYear() : '');
      const duration = startYear && endYear ? `${startYear} - ${endYear}` : 'Present';
      
      return {
        position: exp.position,
        company: exp.company || 'Company',
        duration,
        description: exp.description || '',
      };
    }),
    education: (applicant.educationEntries || applicant.api_education_entries || []).map((edu) => ({
      degree: edu.degree,
      institution: edu.institution || 'Institution',
      year: edu.end_year?.toString() || (edu.start_year?.toString() || 'Present'),
      grade: edu.grade || '',
    })),
    skills: applicant.skills || [],
    languages: (applicant.languages && applicant.languages.length > 0) 
      ? applicant.languages 
      : ['English', 'Hindi'],
    certifications: (applicant.certifications || applicant.api_certifications || []).map(c => {
      const year = c.issue_date ? new Date(c.issue_date).getFullYear() : '';
      return `${c.certification_name}${c.issuing_organization ? ` - ${c.issuing_organization}` : ''}${year ? ` (${year})` : ''}`;
    }),
  };

  const handleResumeDownload = async () => {
    setIsGeneratingResume(true);
    try {
      const filename = `${applicant.name || 'Resume'}-professional`;
      await downloadResumeViaEdge(edgeResumeData, 'professional', filename);
    } catch (error) {
      console.error('Error generating resume:', error);
    } finally {
      setIsGeneratingResume(false);
    }
  };

  // Helper function to validate bio content
  const isValidBio = (bio: string | undefined): boolean => {
    if (!bio || !bio.trim()) return false;
    
    // Show About section for any bio content that's not just whitespace
    return bio.trim().length > 0;
  };

  // Check if applicant has enough data for a meaningful resume
  const hasResumeData = (
    (applicant.professionalExperiences?.length || 0) > 0 || 
    (applicant.api_professional_experiences?.length || 0) > 0 ||
    (applicant.educationEntries?.length || 0) > 0 || 
    (applicant.api_education_entries?.length || 0) > 0 ||
    (applicant.skills?.length || 0) > 0 ||
    (applicant.bio && applicant.bio.trim().length > 0)
  );

  // Helper function to check if this is a guest applicant (applied without login)
  // Guest = explicitly marked as guest (no user_id means they applied without login)
  const isGuestApplicant = applicant.isGuest === true;

  // Should show resume download button - only for login users with meaningful data
  // Don't show for guests (no user_id) OR users without any resume-worthy data
  const canDownloadResume = hasResumeData && !isGuestApplicant;

  // Helper function to check if location is valid
  const hasValidLocation = (location: string | undefined): boolean => {
    return !!location && location.trim().length > 0;
  };

  // Helper function to replace Bio line in cover letter with actual bio content
  // Also filter out lines with "Not specified" or "Not provided"
  const getDisplayCoverLetter = (coverLetter: string | undefined): string => {
    if (!coverLetter) return '';
    
    const lines = coverLetter.split('\n');
    const updatedLines = lines
      .map(line => {
        if (line.toLowerCase().startsWith('bio:')) {
          const actualBio = applicant.bio || '';
          return actualBio ? `Bio: ${actualBio}` : null;
        }
        // Hide lines with "Not specified" or "Not provided"
        if (line.includes('Not specified') || line.includes('Not provided')) {
          return null;
        }
        return line;
      })
      .filter((line): line is string => line !== null);
    
    return updatedLines.join('\n');
  };

  const handleCall = () => {
    window.open(`tel:${applicant.phone}`, '_self');
  };

  const handleWhatsApp = () => {
    const whatsappNumber = applicant.whatsappNumber || applicant.phone;
    if (!whatsappNumber) return;
    
    // Clean number and ensure proper format (add 91 if not present)
    let cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber;
    }
    
    const message = `Hi ${applicant.name}, I found your profile for the job application and would like to discuss further.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanNumber}?text=${encodedMessage}`, '_blank');
  };

  return (
    <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && (
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
      )}
      <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] overflow-hidden p-0 [&>button]:hidden flex flex-col">
        <div className="p-6 pb-2">
          <StandardSheetHeader 
            onClose={() => setDialogOpen(false)}
            minimal={true}
          />
        </div>
        
        <ScrollArea className="flex-1 px-6 h-[calc(85vh-120px)]">
          <div className="space-y-6 pb-4">
            {/* Scrollable Title Section */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Complete Applicant Profile</h2>
              {applicant.isGuest && (
                <Badge className="bg-gray-100 text-gray-800 text-xs">
                  Guest
                </Badge>
              )}
            </div>
            
            {/* Profile Header - Hide name section for non-login (API) applicants */}
            {applicant.application_source !== 'api' && (
              <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={applicant.profileImage} alt={applicant.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {applicant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{applicant.name}</h3>
                  {applicant.currentPosition && (
                    <p className="text-muted-foreground">{applicant.currentPosition}</p>
                  )}
                  {/* Only show company if it's not "Workly India" and not empty */}
                  {applicant.company && 
                   ![BRAND_CONFIG.name, ...BRAND_CONFIG.legacyNames].some(
                     name => applicant.company?.toLowerCase() === name.toLowerCase()
                   ) && (
                    <p className="text-sm text-muted-foreground">{applicant.company}</p>
                  )}
                </div>
              </div>
            )}

            {/* Bio - Only show if bio exists */}
            {isValidBio(applicant.bio) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    About
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {applicant.bio}
                  </p>
                </div>
              </>
            )}

            {/* Contact Information - Only show items that have data */}
            {(applicant.phone || applicant.email || applicant.whatsappNumber || hasValidLocation(applicant.location)) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Contact Information</h4>
                  <div className="space-y-2">
                    {applicant.phone && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{applicant.phone}</span>
                      </div>
                    )}
                    {applicant.email && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{applicant.email}</span>
                      </div>
                    )}
                    {applicant.whatsappNumber && (
                      <div className="flex items-center space-x-2 text-sm">
                        <MessageCircle className="w-4 h-4 text-muted-foreground" />
                        <span>{applicant.whatsappNumber}</span>
                      </div>
                    )}
                    {hasValidLocation(applicant.location) && (
                      <div className="flex items-center space-x-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{applicant.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Professional Experience - Only show if data exists */}
            {(() => {
              // Check all sources for experience data
              const experiences = applicant.professionalExperiences?.length 
                ? applicant.professionalExperiences 
                : applicant.api_professional_experiences;
              
              // Only show section if data exists
              if (experiences && experiences.length > 0) {
                return (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Professional Experience
                      </h4>
                      {experiences.map((exp, index) => (
                        <div key={('id' in exp ? (exp as { id: string }).id : null) || index} className="border-l-2 border-gray-200 pl-4 pb-4">
                          <h5 className="font-medium">{exp.position}</h5>
                          {exp.company && <p className="text-sm text-muted-foreground">{exp.company}</p>}
                          <p className="text-xs text-muted-foreground">
                            {exp.start_date ? new Date(exp.start_date).getFullYear() : 'N/A'} - 
                            {exp.is_current ? 'Present' : (exp.end_date ? new Date(exp.end_date).getFullYear() : 'N/A')}
                          </p>
                          {exp.description && <p className="text-sm mt-2">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                );
              }
              return null;
            })()}

            {/* Education - Only show if data exists */}
            {(() => {
              // Check all sources for education data
              const educationList = applicant.educationEntries?.length 
                ? applicant.educationEntries 
                : applicant.api_education_entries;
              
              // Only show section if data exists
              if (educationList && educationList.length > 0) {
                return (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center">
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Education
                      </h4>
                      {educationList.map((edu, index) => (
                        <div key={('id' in edu ? (edu as { id: string }).id : null) || index} className="border-l-2 border-gray-200 pl-4 pb-4">
                          <h5 className="font-medium">{edu.degree}</h5>
                          {edu.institution && <p className="text-sm text-muted-foreground">{edu.institution}</p>}
                          <p className="text-xs text-muted-foreground">
                            {edu.start_year || 'N/A'} - {edu.end_year || 'Present'}
                          </p>
                          {edu.grade && <p className="text-sm">Grade: {edu.grade}</p>}
                          {edu.field_of_study && <p className="text-sm text-muted-foreground">Field: {edu.field_of_study}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                );
              }
              return null;
            })()}

            {/* Certifications - Only show if data exists */}
            {(() => {
              // Check all sources for certification data
              const certList = applicant.certifications?.length 
                ? applicant.certifications 
                : applicant.api_certifications;
              
              // Only show section if data exists
              if (certList && certList.length > 0) {
                return (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center">
                        <Award className="w-4 h-4 mr-2" />
                        Certifications
                      </h4>
                      {certList.map((cert, index) => (
                        <div key={('id' in cert ? (cert as { id: string }).id : null) || index} className="border-l-2 border-gray-200 pl-4 pb-4">
                          <h5 className="font-medium">{cert.certification_name}</h5>
                          <p className="text-sm text-muted-foreground">{cert.issuing_organization}</p>
                          {cert.issue_date && (
                            <p className="text-xs text-muted-foreground">
                              Issued: {new Date(cert.issue_date).getFullYear()}
                            </p>
                          )}
                          {cert.credential_id && (
                            <p className="text-xs text-muted-foreground">ID: {cert.credential_id}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              }
              return null;
            })()}

            {/* Skills - Only show if has data */}
            {applicant.skills && applicant.skills.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {applicant.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Languages - Show for all users, with default if empty for login users */}
            {(() => {
              // Check for languages data - from api_ or profile
              const languagesList = applicant.languages && applicant.languages.length > 0 
                ? applicant.languages 
                : (!isGuestApplicant ? ['English', 'Hindi'] : []);
              
              // Show section if user has languages or is a login user (show defaults)
              if (languagesList.length > 0) {
                return (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center">
                        <Languages className="w-4 h-4 mr-2" />
                        Languages
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {languagesList.map((language, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {language}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                );
              }
              return null;
            })()}

            {/* Social Media Links - Only show if has data */}
            {(() => {
              const socialLinks = applicant.application_source === 'api' 
                ? applicant.api_social_links 
                : applicant.socialLinks;
              
              const hasSocialLinks = socialLinks && Object.values(socialLinks).some(link => link && link.trim());
              
              if (hasSocialLinks) {
                return (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Social Media
                      </h4>
                      <SocialMediaIcons
                        instagram={socialLinks?.instagram}
                        facebook={socialLinks?.facebook}
                        youtube={socialLinks?.youtube}
                        linkedin={socialLinks?.linkedin}
                        size="md"
                        className="justify-start"
                      />
                    </div>
                  </>
                );
              }
              return null;
            })()}

            {/* Telegram Chat Button - Only show if user has Telegram connected */}
            {applicant.telegramUsername && (
              <>
                <Separator />
                <Button
                  onClick={() => window.open(`https://t.me/${applicant.telegramUsername}`, '_blank')}
                  variant="outline"
                  className="w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Telegram Chat
                </Button>
              </>
            )}

            {/* Cover Letter - Handwritten Style */}
            {applicant.coverLetter && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Cover Letter
                    </h4>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={async () => {
                        setIsGeneratingCoverLetter(true);
                        try {
                          await downloadCoverLetterViaEdge({
                            content: getDisplayCoverLetter(applicant.coverLetter || ''),
                            applicantName: applicant.name,
                            date: new Date(applicant.appliedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })
                          }, `${applicant.name}-cover-letter`);
                        } catch (error) {
                          console.error('Error generating cover letter:', error);
                        } finally {
                          setIsGeneratingCoverLetter(false);
                        }
                      }}
                      disabled={isGeneratingCoverLetter}
                      className="h-7 px-2 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      {isGeneratingCoverLetter ? 'Generating...' : 'Download'}
                    </Button>
                  </div>
                  {/* Paper-like handwritten style container - Blue Pen Ink */}
                  <div 
                    className="relative p-6 rounded-lg border shadow-sm overflow-hidden"
                    style={{
                      background: 'linear-gradient(180deg, #fdfcf8 0%, #faf8f3 100%)',
                      fontFamily: '"Times New Roman", Georgia, serif',
                    }}
                  >
                    {/* Decorative top line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                    
                    {/* Date - top right - Blue ink */}
                    <p 
                      className="text-right text-sm italic mb-4"
                      style={{ color: '#003da6' }}
                    >
                      {new Date(applicant.appliedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    
                    {/* Greeting - Blue ink */}
                    <p 
                      className="text-sm italic mb-4"
                      style={{ color: '#003da6' }}
                    >
                      Dear Hiring Manager,
                    </p>
                    
                    {/* Letter content - Blue ink */}
                    <div className="space-y-3">
                      {getDisplayCoverLetter(applicant.coverLetter).split('\n').map((paragraph, index) => (
                        paragraph.trim() ? (
                          <p 
                            key={index} 
                            className="text-sm leading-relaxed italic"
                            style={{ 
                              lineHeight: '1.8',
                              color: '#003da6',
                            }}
                          >
                            {paragraph.trim()}
                          </p>
                        ) : null
                      ))}
                    </div>
                    
                    {/* Closing - Blue ink */}
                    <div className="mt-6 space-y-2">
                      <p className="text-sm italic" style={{ color: '#003da6' }}>Warm Regards,</p>
                      
                      {/* Handwritten-style signature SVG - Blue ink */}
                      <svg 
                        width="150" 
                        height="40" 
                        viewBox="0 0 150 40" 
                        className="mt-2"
                      >
                        {/* Flowing signature strokes */}
                        <path
                          d="M5,25 Q10,10 20,15 Q30,20 35,12 Q45,5 55,18 Q65,28 75,20 Q85,12 95,22 Q105,30 115,18 Q125,8 140,15"
                          fill="none"
                          stroke="#003da6"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Decorative loop */}
                        <path
                          d="M15,20 Q20,8 30,12"
                          fill="none"
                          stroke="#003da6"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        {/* Underline flourish */}
                        <path
                          d="M5,32 Q50,34 100,30 Q130,28 145,32"
                          fill="none"
                          stroke="#1a5dc0"
                          strokeWidth="0.8"
                          strokeLinecap="round"
                          opacity="0.7"
                        />
                      </svg>
                      
                      <p 
                        className="text-base font-semibold"
                        style={{ fontStyle: 'italic', color: '#003da6' }}
                      >
                        {applicant.name}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Application Date */}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Applied on: {new Date(applicant.appliedAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: '2-digit', 
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
              {canDownloadResume && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleResumeDownload}
                  disabled={isGeneratingResume}
                  className="h-7 px-2 text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  {isGeneratingResume ? 'Generating...' : 'Resume'}
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Sticky Action Buttons */}
        <div className="sticky bottom-0 bg-background border-t p-4 flex space-x-2">
          <Button onClick={handleCall} className="flex-1">
            <Phone className="w-4 h-4 mr-2" />
            Call
          </Button>
          <Button onClick={handleWhatsApp} variant="outline" className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
        </div>
        
      </SheetContent>
    </Sheet>
  );
};

export default ApplicantProfileDialog;