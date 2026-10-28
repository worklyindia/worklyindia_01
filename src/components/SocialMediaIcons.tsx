import { Instagram, Facebook, Youtube, Linkedin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SocialMediaIconsProps {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SocialMediaIcons = ({ 
  instagram, 
  facebook, 
  youtube, 
  linkedin, 
  className = "", 
  size = "sm" 
}: SocialMediaIconsProps) => {
  const socialLinks = [
    { url: instagram, icon: Instagram, name: "Instagram", color: "text-pink-600 hover:text-pink-700" },
    { url: facebook, icon: Facebook, name: "Facebook", color: "text-blue-600 hover:text-blue-700" },
    { url: youtube, icon: Youtube, name: "YouTube", color: "text-red-600 hover:text-red-700" },
    { url: linkedin, icon: Linkedin, name: "LinkedIn", color: "text-blue-700 hover:text-blue-800" }
  ].filter(social => social.url && social.url.trim());

  if (socialLinks.length === 0) {
    return null;
  }

  const iconSize = size === "sm" ? "w-4 h-4" : size === "md" ? "w-5 h-5" : "w-6 h-6";
  const buttonSize = size === "sm" ? "p-1" : size === "md" ? "p-1.5" : "p-2";

  const handleSocialClick = (url: string) => {
    // Ensure URL starts with http or https
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {socialLinks.map(({ url, icon: Icon, name, color }) => (
        <Button
          key={name}
          variant="ghost"
          size="icon"
          className={`${buttonSize} ${color} hover:bg-muted/80 rounded-lg transition-all duration-200`}
          onClick={() => handleSocialClick(url!)}
          title={`Visit ${name}`}
        >
          <Icon className={iconSize} />
        </Button>
      ))}
    </div>
  );
};

export default SocialMediaIcons;