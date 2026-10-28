import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationDetection } from "@/hooks/useLocationDetection";
import { useEducationEntries } from "@/hooks/useEducationEntries";
import { useProfessionalExperiences } from "@/hooks/useProfessionalExperiences";
import { useCertifications } from "@/hooks/useCertifications";
import { useResumeData } from "@/hooks/useResumeData";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { generateResumePDF } from "@/utils/pdfGenerator";
import ResumePreview from "@/components/ResumePreview";
import EditAboutDialog from "@/components/EditAboutDialog";

import {
  ProfileHeader,
  ProfileActionBar,
  ProfileSection,
  ProfileBadgeList,
  ProfileContactSection,
  ProfileSocialLinks,
  ProfileExperienceSection,
  ProfileEducationSection,
  ProfileCertificationsSection,
  ProfileAboutSection,
} from "@/components/profile";

const Profile = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { successFeedback } = useNativeFeel();
  const [locationAddress, setLocationAddress] = useState<string>("");
  
  // Edit About dialog state
  const [isEditAboutOpen, setIsEditAboutOpen] = useState(false);
  const [currentBio, setCurrentBio] = useState(profile?.bio || "");
  
  // Update currentBio when profile changes
  useEffect(() => {
    setCurrentBio(profile?.bio || "");
  }, [profile?.bio]);

  const handleBioUpdate = (newBio: string) => {
    setCurrentBio(newBio);
  };
  
  // Fetch detailed education and work experience data
  const { educationEntries, loading: educationLoading, refetch: refetchEducation } = useEducationEntries();
  const { experiences, loading: experiencesLoading, refetch: refetchExperiences } = useProfessionalExperiences();
  const { certifications, loading: certificationsLoading, refetch: refetchCertifications } = useCertifications();
  
  // Compute experience years
  const displayExperienceYears = Math.max(
    Number(profile?.experience_years || 0),
    ...experiences.map((e) => Number(e.experience_years || 0))
  );
  
  // Resume data for CV download
  const { resumeData } = useResumeData();


  const locationDetection = useLocationDetection({
    onLocationDetected: (location) => {
      if (location.fullAddress) {
        setLocationAddress(location.fullAddress);
      } else {
        setLocationAddress(`${location.city}, ${location.state}, ${location.country}`);
      }
    }
  });

  const handleEditProfile = () => {
    navigate('/JobSeeker/Profile/Edit/1');
  };

  const handleDownloadCV = async () => {
    try {
      const { downloadResumeViaEdge } = await import('@/utils/edgeFunctionDownload');
      const success = await downloadResumeViaEdge(
        resumeData,
        'professional',
        `${profile?.full_name || 'Resume'}-CV`
      );
      if (!success) {
        // Fallback to local generation
        await generateResumePDF('hidden-resume-preview', `${profile?.full_name || 'Resume'}-CV.pdf`);
      }
    } catch (error) {
      console.error('Error downloading CV:', error);
      // Fallback to local generation
      try {
        await generateResumePDF('hidden-resume-preview', `${profile?.full_name || 'Resume'}-CV.pdf`);
        toast.success("CV downloaded successfully!");
      } catch {
        toast.error("Failed to download CV. Please try again.");
      }
    }
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your profile.</p>
          <Button onClick={() => navigate('/auth')} className="active:scale-95 transition-transform">
            Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 relative">
        <div className="pb-24"
          style={{ 
            minHeight: '100vh',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
        {/* LinkedIn-Style Header */}
        <ProfileHeader 
          profile={profile} 
          user={user} 
          experienceYears={displayExperienceYears}
        />

        {/* Action Bar */}
        <ProfileActionBar
          onEditProfile={handleEditProfile}
          onDownloadCV={handleDownloadCV}
          onSettings={handleSettings}
        />

        {/* Divider */}
        <div className="h-2 bg-muted/50" />

        {/* Contact Information */}
        <ProfileContactSection
          email={user.email}
          phone={profile.phone}
          whatsappNumber={profile.whatsapp_number}
          location={profile.location}
          userId={user.id}
          showTelegramStatus={true}
        />

        {/* About Section */}
        <ProfileAboutSection
          bio={currentBio}
          onEditPress={() => setIsEditAboutOpen(true)}
        />

        {/* Skills Section */}
        <ProfileSection title="Skills" icon={Briefcase}>
          <ProfileBadgeList 
            items={profile.skills || []} 
            emptyMessage="No skills added yet. Update your profile to add skills."
          />
        </ProfileSection>

        {/* Work Experience */}
        <ProfileExperienceSection
          experiences={experiences}
          loading={experiencesLoading}
          onEditPress={handleEditProfile}
        />

        {/* Education */}
        <ProfileEducationSection
          educationEntries={educationEntries}
          loading={educationLoading}
          onEditPress={handleEditProfile}
        />

        {/* Certifications */}
        <ProfileCertificationsSection
          certifications={certifications}
          loading={certificationsLoading}
          onEditPress={handleEditProfile}
        />

        {/* Languages */}
        <ProfileSection title="Languages" icon={Languages}>
          <ProfileBadgeList 
            items={(profile as any).languages || []} 
            emptyMessage="No languages added yet."
          />
        </ProfileSection>

        {/* Social Links */}
        <ProfileSocialLinks
          instagram={(profile as any).instagram_link}
          facebook={(profile as any).facebook_link}
          youtube={(profile as any).youtube_link}
          linkedin={(profile as any).linkedin_link}
        />

        {/* Bottom Spacing */}
        <div className="h-8" />
        </div>
      
      {/* Edit About Dialog */}
      <EditAboutDialog
        isOpen={isEditAboutOpen}
        onClose={() => setIsEditAboutOpen(false)}
        currentBio={currentBio}
        onBioUpdate={handleBioUpdate}
      />
      
      {/* Hidden Resume Preview for PDF generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div id="hidden-resume-preview" className="bg-white" style={{ width: '794px', padding: '40px' }}>
          <ResumePreview resumeData={resumeData} />
        </div>
      </div>
    </div>
  );
};

export default Profile;
