import { useState, useEffect } from "react";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  MessageCircle, 
  Calendar,
  GraduationCap,
  Award,
  Languages,
  Globe,
  Building,
  Clock,
  UserCheck,
  Activity
} from "lucide-react";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import SocialMediaIcons from "@/components/SocialMediaIcons";
import { formatDateWithTime } from "@/utils/dateFormatUtils";
import { useProfileTracking } from "@/hooks/useProfileTracking";

interface WebsiteUser {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  industry: string;
  current_position: string;
  company: string;
  skills: string[];
  profile_image_url: string;
  bio: string;
  education: string;
  experience_years: number;
  experience_level: number;
  preferred_location: string;
  job_type: string;
  whatsapp_number: string;
  instagram_link: string;
  facebook_link: string;
  youtube_link: string;
  linkedin_link: string;
  precise_address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  languages: string[];
  is_profile_complete: boolean;
  created_at: string;
  last_sign_in_at: string;
  total_applications: number;
  account_status: string;
  // Additional profile data
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

interface WebsiteUserProfileDialogProps {
  user: WebsiteUser;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const WebsiteUserProfileDialog = ({ user, children, open, onOpenChange }: WebsiteUserProfileDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { trackProfileView } = useProfileTracking();

  // Use external control if provided, otherwise use internal state
  const dialogOpen = open !== undefined ? open : isOpen;
  const setDialogOpen = onOpenChange !== undefined ? onOpenChange : setIsOpen;

  // Track profile view when dialog opens
  useEffect(() => {
    if (dialogOpen && user?.user_id) {
      trackProfileView(user.user_id);
    }
  }, [dialogOpen, user?.user_id, trackProfileView]);

  // Helper function to validate bio content
  const isValidBio = (bio: string | undefined): boolean => {
    if (!bio || !bio.trim()) return false;
    return bio.trim().length > 0;
  };

  const handleCall = () => {
    window.open(`tel:${user.phone}`, '_self');
  };

  const handleWhatsApp = () => {
    const phoneNumber = user.whatsapp_number || user.phone;
    const message = `Hi ${user.full_name}, I found your profile on ${BRAND_CONFIG.name} and would like to connect with you.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`, '_blank');
  };

  const getActivityStatus = () => {
    if (!user.last_sign_in_at) return { label: 'Never signed in', color: 'text-muted-foreground' };
    
    const daysSince = Math.floor((new Date().getTime() - new Date(user.last_sign_in_at).getTime()) / (1000 * 3600 * 24));
    
    if (daysSince <= 7) return { label: 'Active', color: 'text-green-600' };
    if (daysSince <= 30) return { label: 'Recently Active', color: 'text-yellow-600' };
    return { label: 'Inactive', color: 'text-red-600' };
  };

  const activityStatus = getActivityStatus();

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Profile Details</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.profile_image_url} alt={user.full_name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{user.full_name || 'No Name'}</h3>
                <p className="text-muted-foreground">{user.current_position || 'Position not specified'}</p>
                {user.company && 
                 ![BRAND_CONFIG.name, ...BRAND_CONFIG.legacyNames].some(
                   name => user.company?.toLowerCase() === name.toLowerCase()
                 ) && (
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Building className="w-3 h-3 mr-1" />
                    {user.company}
                  </p>
                )}
              </div>
            </div>

            {/* Account Information */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium">Account Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Member Since:</span>
                  <span>{formatDateWithTime(user.created_at)}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Last Sign In:</span>
                  <span>{formatDateWithTime(user.last_sign_in_at)}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Status:</span>
                  <span className={activityStatus.color}>{activityStatus.label}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Profile Complete:</span>
                  <Badge variant={user.is_profile_complete ? "default" : "secondary"}>
                    {user.is_profile_complete ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Bio */}
            {isValidBio(user.bio) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    About
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
                </div>
              </>
            )}

            {/* Contact Information */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{user.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{user.email || 'Not provided'}</span>
                </div>
                {user.whatsapp_number && (
                  <div className="flex items-center space-x-2 text-sm">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <span>{user.whatsapp_number}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{user.location || 'Location not specified'}</span>
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium">Professional Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {user.industry && (
                  <div className="text-sm">
                    <span className="font-medium">Industry:</span> {user.industry}
                  </div>
                )}
                {user.experience_years !== undefined && (
                  <div className="text-sm">
                    <span className="font-medium">Experience:</span> {user.experience_years} years
                  </div>
                )}
                {user.preferred_location && (
                  <div className="text-sm">
                    <span className="font-medium">Preferred Location:</span> {user.preferred_location}
                  </div>
                )}
                {user.job_type && (
                  <div className="text-sm">
                    <span className="font-medium">Job Type:</span> {user.job_type}
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium">Total Applications:</span> {user.total_applications || 0}
                </div>
              </div>
            </div>

            {/* Professional Experience */}
            {user.professionalExperiences && user.professionalExperiences.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Professional Experience
                  </h4>
                  {user.professionalExperiences.map((exp) => (
                    <div key={exp.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                      <h5 className="font-medium">{exp.position}</h5>
                      <p className="text-sm text-muted-foreground">{exp.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {exp.start_date} - {exp.is_current ? 'Present' : exp.end_date}
                      </p>
                      {exp.description && (
                        <p className="text-sm mt-2">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Education */}
            {user.educationEntries && user.educationEntries.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Education
                  </h4>
                  {user.educationEntries.map((edu) => (
                    <div key={edu.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                      <h5 className="font-medium">{edu.degree}</h5>
                      <p className="text-sm text-muted-foreground">{edu.institution}</p>
                      <p className="text-xs text-muted-foreground">
                        {edu.start_year} - {edu.end_year}
                      </p>
                      {edu.grade && <p className="text-sm">Grade: {edu.grade}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Certifications */}
            {user.certifications && user.certifications.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Award className="w-4 h-4 mr-2" />
                    Certifications
                  </h4>
                  {user.certifications.map((cert) => (
                    <div key={cert.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                      <h5 className="font-medium">{cert.certification_name}</h5>
                      <p className="text-sm text-muted-foreground">{cert.issuing_organization}</p>
                      <p className="text-xs text-muted-foreground">
                        Issued: {cert.issue_date ? new Date(cert.issue_date).getFullYear() : 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Skills */}
            {user.skills && user.skills.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {user.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Languages */}
            {user.languages && user.languages.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Languages className="w-4 h-4 mr-2" />
                    Languages
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {user.languages.map((language, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {language}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Social Media Links */}
            {(user.instagram_link || user.facebook_link || user.youtube_link || user.linkedin_link) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    Social Media
                  </h4>
                  <SocialMediaIcons
                    instagram={user.instagram_link}
                    facebook={user.facebook_link}
                    youtube={user.youtube_link}
                    linkedin={user.linkedin_link}
                    size="md"
                    className="justify-start"
                  />
                </div>
              </>
            )}

            {/* Action Buttons */}
            {user.phone && (
              <div className="flex space-x-2">
                <Button onClick={handleCall} className="flex-1">
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
                <Button onClick={handleWhatsApp} variant="outline" className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WebsiteUserProfileDialog;