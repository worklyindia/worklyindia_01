import { Award, Calendar, ExternalLink, Edit } from "lucide-react";
import { ProfileSection } from "./ProfileSection";
import { Button } from "@/components/ui/button";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface Certification {
  id: string;
  certification_name: string;
  issuing_organization: string;
  issue_date?: string;
  expiry_date?: string;
  credential_id?: string;
  credential_url?: string;
  description?: string;
}

interface ProfileCertificationsSectionProps {
  certifications: Certification[];
  loading: boolean;
  onEditPress: () => void;
}

export const ProfileCertificationsSection = ({ 
  certifications, 
  loading, 
  onEditPress 
}: ProfileCertificationsSectionProps) => {
  const { tapFeedback } = useNativeFeel();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const handleCredentialPress = (url: string) => {
    tapFeedback();
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <ProfileSection title="Certifications" icon={Award}>
        <div className="px-4 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </ProfileSection>
    );
  }

  if (!certifications || certifications.length === 0) {
    return (
      <ProfileSection title="Certifications" icon={Award}>
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">No certifications added yet</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { tapFeedback(); onEditPress(); }}
            className="active:scale-95 transition-transform"
          >
            <Edit className="w-4 h-4 mr-2" />
            Add Certifications
          </Button>
        </div>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection title="Certifications" icon={Award}>
      <div className="divide-y divide-border/50">
        {certifications.map((cert) => (
          <div key={cert.id} className="px-4 py-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-warning" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground">{cert.certification_name}</h4>
                <p className="text-sm text-primary font-medium">{cert.issuing_organization}</p>
                
                <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {cert.issue_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Issued: {formatDate(cert.issue_date)}
                    </span>
                  )}
                  {cert.credential_id && (
                    <span className="px-1.5 py-0.5 bg-muted rounded">
                      ID: {cert.credential_id}
                    </span>
                  )}
                </div>
                
                {cert.credential_url && (
                  <button
                    onClick={() => handleCredentialPress(cert.credential_url!)}
                    className="flex items-center gap-1 mt-2 text-primary text-sm font-medium active:scale-95 transition-transform"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Credential
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
};
