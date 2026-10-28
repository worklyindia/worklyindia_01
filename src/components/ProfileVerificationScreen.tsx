import { useEffect, useState } from 'react';
import { Check, Loader2, User, Phone, MessageCircle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'checking' | 'complete' | 'incomplete';
}

interface ProfileVerificationScreenProps {
  profile: any;
  onVerificationComplete: (isComplete: boolean, missingFields: string[]) => void;
}

const ProfileVerificationScreen = ({ profile, onVerificationComplete }: ProfileVerificationScreenProps) => {
  const [steps, setSteps] = useState<VerificationStep[]>([
    { id: 'name', label: 'Checking your name...', icon: <User className="h-5 w-5" />, status: 'pending' },
    { id: 'phone', label: 'Verifying phone number...', icon: <Phone className="h-5 w-5" />, status: 'pending' },
    { id: 'whatsapp', label: 'Checking WhatsApp...', icon: <MessageCircle className="h-5 w-5" />, status: 'pending' },
    { id: 'address', label: 'Validating address...', icon: <MapPin className="h-5 w-5" />, status: 'pending' },
  ]);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const verifyProfile = async () => {
      const missingFields: string[] = [];
      
      // Step 1: Check name
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'checking' } : s));
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const hasName = profile?.full_name && profile.full_name.trim() !== '';
      if (!hasName) missingFields.push('Full Name');
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: hasName ? 'complete' : 'incomplete' } : s));
      setCurrentStep(1);

      // Step 2: Check phone
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'checking' } : s));
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const hasPhone = profile?.phone && profile.phone.trim() !== '';
      if (!hasPhone) missingFields.push('Phone Number');
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: hasPhone ? 'complete' : 'incomplete' } : s));
      setCurrentStep(2);

      // Step 3: Check WhatsApp
      setSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'checking' } : s));
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const hasWhatsApp = profile?.whatsapp_number && profile.whatsapp_number.trim() !== '';
      if (!hasWhatsApp) missingFields.push('WhatsApp Number');
      setSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: hasWhatsApp ? 'complete' : 'incomplete' } : s));
      setCurrentStep(3);

      // Step 4: Check address
      setSteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: 'checking' } : s));
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const hasCity = profile?.city && profile.city.trim() !== '';
      const hasState = profile?.state && profile.state.trim() !== '';
      const hasCountry = profile?.country && profile.country.trim() !== '';
      const hasPostalCode = profile?.postal_code && profile.postal_code.trim() !== '';
      const hasAddress = hasCity && hasState && hasCountry && hasPostalCode;
      
      if (!hasCity) missingFields.push('City');
      if (!hasState) missingFields.push('State');
      if (!hasCountry) missingFields.push('Country');
      if (!hasPostalCode) missingFields.push('Postal Code');
      
      setSteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: hasAddress ? 'complete' : 'incomplete' } : s));

      // Wait a moment before completing
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const isComplete = missingFields.length === 0;
      onVerificationComplete(isComplete, missingFields);
    };

    if (profile !== undefined) {
      verifyProfile();
    }
  }, [profile, onVerificationComplete]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Verifying Your Account
            </h1>
            <p className="text-muted-foreground text-sm">
              Please wait while we check your profile details
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
                  step.status === 'checking' && "bg-primary/5 border border-primary/20",
                  step.status === 'complete' && "bg-green-500/10 border border-green-500/20",
                  step.status === 'incomplete' && "bg-destructive/10 border border-destructive/20",
                  step.status === 'pending' && "bg-muted/30 border border-transparent"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    step.status === 'checking' && "bg-primary/20 text-primary",
                    step.status === 'complete' && "bg-green-500/20 text-green-600",
                    step.status === 'incomplete' && "bg-destructive/20 text-destructive",
                    step.status === 'pending' && "bg-muted text-muted-foreground"
                  )}
                >
                  {step.status === 'checking' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : step.status === 'complete' ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "font-medium transition-all duration-300",
                    step.status === 'checking' && "text-primary",
                    step.status === 'complete' && "text-green-600",
                    step.status === 'incomplete' && "text-destructive",
                    step.status === 'pending' && "text-muted-foreground"
                  )}
                >
                  {step.status === 'complete' 
                    ? step.label.replace('Checking', 'Verified').replace('Verifying', 'Verified').replace('Validating', 'Validated').replace('...', ' ✓')
                    : step.status === 'incomplete'
                    ? step.label.replace('Checking', 'Missing').replace('Verifying', 'Missing').replace('Validating', 'Missing').replace('...', '')
                    : step.label
                  }
                </span>
              </div>
            ))}
          </div>

          {/* Progress indicator */}
          <div className="mt-6 flex justify-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index <= currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileVerificationScreen;
