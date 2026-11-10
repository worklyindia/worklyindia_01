import { Mail, Phone, MessageCircle, MapPin, Send } from "lucide-react";
import { ProfileSection, ProfileListItem } from "./ProfileSection";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { TelegramStatusBadge } from "@/components/TelegramNotificationSection";

interface ProfileContactSectionProps {
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  location?: string;
  userId?: string;
  showTelegramStatus?: boolean;
}

export const ProfileContactSection = ({ 
  email, 
  phone, 
  whatsappNumber, 
  location,
  userId,
  showTelegramStatus = true
}: ProfileContactSectionProps) => {
  const { tapFeedback } = useNativeFeel();

  const handleEmailPress = () => {
    if (email) {
      tapFeedback();
      window.open(`mailto:${email}`, '_self');
    }
  };

  const handlePhonePress = () => {
    if (phone) {
      tapFeedback();
      window.open(`tel:${phone}`, '_self');
    }
  };

  const handleWhatsAppPress = () => {
    if (whatsappNumber) {
      tapFeedback();
      const cleanNumber = whatsappNumber.replace(/[^\d]/g, '');
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
    }
  };

  return (
    <ProfileSection title="Contact Information" icon={Mail}>
      <ProfileListItem
        icon={Mail}
        label="Email"
        value={email || "Not set"}
        onPress={email ? handleEmailPress : undefined}
        showChevron={!!email}
      />
      
      {phone && (
        <ProfileListItem
          icon={Phone}
          label="Phone"
          value={phone}
          onPress={handlePhonePress}
          showChevron
        />
      )}
      
      {whatsappNumber && (
        <ProfileListItem
          icon={MessageCircle}
          iconColor="text-green-500"
          label="WhatsApp"
          value={whatsappNumber}
          onPress={handleWhatsAppPress}
          showChevron
        />
      )}
      
      <ProfileListItem
        icon={MapPin}
        label="Location"
        value={location || "Not set"}
      />
      
      {/* Telegram Status */}
      {showTelegramStatus && userId && (
        <div className="flex items-center justify-between py-3 px-1">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-[hsl(200,80%,50%)]" />
            <span className="text-sm font-medium text-foreground">Telegram</span>
          </div>
          <TelegramStatusBadge
            userType="profile"
            userId={userId}
            settingsPath="/settings"
          />
        </div>
      )}
    </ProfileSection>
  );
};
