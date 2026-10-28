import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User, Mail, Type, FileText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { usePlatformStyle } from "@/hooks/usePlatformStyle";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  avatar: string;
}

const ProfileCreation = () => {
  const { toast } = useToast();
  const { tapFeedback, successFeedback } = useNativeFeel();
  const { isIOS, isAndroid, containerClass, cardClass } = usePlatformStyle();
  
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    avatar: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    successFeedback();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Profile Created!",
        description: "Your profile has been successfully created.",
      });
    }, 2000);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      tapFeedback();
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileData(prev => ({
          ...prev,
          avatar: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = () => {
    return `${profileData.firstName.charAt(0)}${profileData.lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Native Header - Sticky */}
      <header 
        className={`sticky top-0 z-50 ${containerClass} border-b border-border/30`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <NativeFeedbackButton
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </NativeFeedbackButton>
          <h1 className="text-lg font-semibold">Create Profile</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="px-4 pb-32 pt-6 space-y-8 animate-fade-in">
        {/* Avatar Upload Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group">
            <Avatar className={`w-28 h-28 ring-4 ring-primary/10 transition-all duration-300 group-hover:ring-primary/20 ${isIOS ? 'shadow-sm' : 'shadow-md'}`}>
              <AvatarImage src={profileData.avatar} />
              <AvatarFallback className="text-2xl font-semibold bg-gradient-primary text-primary-foreground">
                {getInitials() || <User className="w-10 h-10" />}
              </AvatarFallback>
            </Avatar>
            <label 
              htmlFor="avatar-upload" 
              className={`absolute inset-0 flex items-center justify-center ${isIOS ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/60'} rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer active:scale-95`}
            >
              <Upload className="w-7 h-7 text-white" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <p className="text-sm text-muted-foreground">Tap to upload photo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Fields - Native Input Group */}
          <div className={`native-input-group ${cardClass}`}>
            <div className="p-4 space-y-2">
              <Label htmlFor="firstName" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <User className="w-3.5 h-3.5 text-primary" />
                First Name
              </Label>
              <Input
                id="firstName"
                placeholder="Enter your first name"
                value={profileData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className="native-input"
                required
              />
            </div>
            
            <div className="native-divider" />
            
            <div className="p-4 space-y-2">
              <Label htmlFor="lastName" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <Type className="w-3.5 h-3.5 text-primary" />
                Last Name
              </Label>
              <Input
                id="lastName"
                placeholder="Enter your last name"
                value={profileData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                className="native-input"
                required
              />
            </div>
          </div>

          {/* Email Field - Native Input Group */}
          <div className={`native-input-group ${cardClass}`}>
            <div className="p-4 space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <Mail className="w-3.5 h-3.5 text-primary" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={profileData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="native-input"
                required
              />
            </div>
          </div>

          {/* Bio Field - Native Input Group */}
          <div className={`native-input-group ${cardClass}`}>
            <div className="p-4 space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Bio
              </Label>
              <Textarea
                id="bio"
                placeholder="Tell us a bit about yourself..."
                value={profileData.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                className="native-input min-h-[120px] resize-none"
                rows={4}
              />
            </div>
          </div>
        </form>
      </main>

      {/* Fixed Bottom Action Bar - Native Style */}
      <footer 
        className={`fixed bottom-0 left-0 right-0 native-bottom-nav px-4 py-4 ${isIOS ? 'backdrop-blur-xl' : 'shadow-2xl'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <NativeFeedbackButton
          type="button"
          disabled={isLoading}
          onClick={() => {
            const form = document.querySelector('form');
            if (form) {
              form.requestSubmit();
            }
          }}
          feedbackType="success"
          className={`w-full h-14 text-base font-semibold bg-gradient-primary hover:opacity-90 ${isIOS ? 'rounded-2xl' : 'rounded-xl'} transition-all duration-300 shadow-soft`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Profile...
            </div>
          ) : (
            "Create Profile ✓"
          )}
        </NativeFeedbackButton>
      </footer>
    </div>
  );
};

export default ProfileCreation;