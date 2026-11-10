import { Globe, Instagram, Facebook, Youtube, Linkedin } from "lucide-react";
import { ProfileSection, ProfileListItem } from "./ProfileSection";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface ProfileSocialLinksProps {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
}

export const ProfileSocialLinks = ({ 
  instagram, 
  facebook, 
  youtube, 
  linkedin 
}: ProfileSocialLinksProps) => {
  const { tapFeedback } = useNativeFeel();
  
  const hasSocialLinks = instagram || facebook || youtube || linkedin;
  
  if (!hasSocialLinks) return null;

  const handleLinkPress = (url: string) => {
    tapFeedback();
    window.open(url, '_blank');
  };

  return (
    <ProfileSection title="Social Media" icon={Globe}>
      {instagram && (
        <ProfileListItem
          icon={Instagram}
          iconColor="text-pink-500"
          label="Instagram"
          value="View Profile"
          onPress={() => handleLinkPress(instagram)}
          showChevron
        />
      )}
      
      {facebook && (
        <ProfileListItem
          icon={Facebook}
          iconColor="text-blue-600"
          label="Facebook"
          value="View Profile"
          onPress={() => handleLinkPress(facebook)}
          showChevron
        />
      )}
      
      {youtube && (
        <ProfileListItem
          icon={Youtube}
          iconColor="text-red-600"
          label="YouTube"
          value="View Channel"
          onPress={() => handleLinkPress(youtube)}
          showChevron
        />
      )}
      
      {linkedin && (
        <ProfileListItem
          icon={Linkedin}
          iconColor="text-blue-700"
          label="LinkedIn"
          value="View Profile"
          onPress={() => handleLinkPress(linkedin)}
          showChevron
        />
      )}
    </ProfileSection>
  );
};
