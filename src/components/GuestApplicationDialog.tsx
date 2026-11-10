import { useState, useEffect, useRef } from 'react';
import TurnstileWidget, { useTurnstileConfig, verifyTurnstile, type TurnstileHandle } from '@/components/auth/TurnstileWidget';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { StandardSheetHeader } from '@/components/StandardSheetHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { useSignupOTPCheck } from '@/hooks/useSignupOTPCheck';
import WhatsAppOTPVerification from '@/components/WhatsAppOTPVerification';
import { PhoneInput } from '@/components/ui/phone-input';
import { isValidE164, toE164 } from '@/lib/phone';
import { useLocationDetection } from '@/hooks/useLocationDetection';
import { Navigation, Loader2 } from 'lucide-react';

const guestApplicationSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  phone: z.string()
    .trim()
    .refine(isValidE164, "Please enter a valid phone number"),
  email: z.string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  bio: z.string()
    .trim()
    .max(500, "About must be less than 500 characters")
    .optional()
    .or(z.literal('')),
  location: z.string()
    .trim()
    .min(2, "Location is required")
    .max(500, "Location must be less than 500 characters")
});

export interface GuestInfo {
  name: string;
  whatsapp_number: string;
  phone: string;
  email: string;
  bio?: string;
  location: string;
}

interface GuestApplicationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: GuestInfo) => void;
  isSubmitting?: boolean;
}

const STORAGE_KEY = 'wfh_guest_applicant_info';

export const GuestApplicationDialog = ({
  open,
  onClose,
  onSubmit,
  isSubmitting = false
}: GuestApplicationDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    bio: '',
    location: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  
  const { isActive: isOTPRequired, isLoading: isOTPCheckLoading } = useSignupOTPCheck('user_signup_otp');
  const { data: turnstileCfg, isLoading: isTurnstileLoading } = useTurnstileConfig();
  const turnstileOn = !!(turnstileCfg?.enabled && turnstileCfg.siteKey);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [verifyingTurnstile, setVerifyingTurnstile] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);

  const { detectExactLocation, state: locationState } = useLocationDetection({
    onLocationDetected: (location) => {
      const fullAddress = location.fullAddress || 
        [location.city, location.state, location.country]
          .filter(Boolean)
          .join(', ');
      setFormData(prev => ({ ...prev, location: fullAddress }));
    }
  });

  const handleAutoDetect = async () => {
    await detectExactLocation();
  };

  useEffect(() => {
    if (open) {
      // Load saved guest info from localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Partial<GuestInfo>;
          const savedPhone = parsed.phone || parsed.whatsapp_number || '';
          if (parsed && parsed.name && savedPhone && parsed.email && parsed.location) {
            const loaded = {
              name: parsed.name,
              phone: savedPhone,
              email: parsed.email,
              bio: parsed.bio || '',
              location: parsed.location
            };
            setFormData(loaded);

            // Auto-apply only when no security check is required; otherwise the guest
            // confirms the prefilled form after completing Turnstile.
            if (!isOTPCheckLoading && !isTurnstileLoading && !turnstileOn) {
              setAutoApplying(true);
              setTimeout(() => {
                submitWithData(loaded);
              }, 500);
            }
          }
        } catch (e) {
          console.error('Failed to parse saved guest info:', e);
        }
      }
    } else {
      // Reset states when dialog closes
      setShowOTPVerification(false);
      setIsOTPVerified(false);
      setAutoApplying(false);
      setTurnstileToken(null);
    }
  }, [open, isOTPCheckLoading, isTurnstileLoading, turnstileOn]);

  const submitWithData = (data: typeof formData) => {
    try {
      const validated = guestApplicationSchema.parse(data);
      
      // Check if OTP verification is required
      if (isOTPRequired && !isOTPVerified) {
        setFormData(data);
        setShowOTPVerification(true);
        setAutoApplying(false);
        return;
      }
      
      // Save to localStorage for next time
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        name: validated.name,
        phone: validated.phone,
        email: validated.email,
        bio: validated.bio || '',
        location: validated.location
      }));

      // Same number is stored for both phone and WhatsApp — the guest enters it once.
      const e164 = toE164(validated.phone);
      onSubmit({
        name: validated.name,
        email: validated.email,
        whatsapp_number: e164,
        phone: e164,
        bio: validated.bio || undefined,
        location: validated.location
      });
    } catch (error) {
      setAutoApplying(false);
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (turnstileOn) {
      if (!turnstileToken) { setErrors({ turnstile: 'Please complete the security check' }); return; }
      setVerifyingTurnstile(true);
      const passed = await verifyTurnstile(turnstileToken);
      setVerifyingTurnstile(false);
      turnstileRef.current?.reset();
      if (!passed) { setErrors({ turnstile: 'Security check failed. Please try again.' }); return; }
    }
    submitWithData(formData);
  };

  const handleOTPVerified = () => {
    setIsOTPVerified(true);
    // Auto-submit after OTP verification
    try {
      const validated = guestApplicationSchema.parse(formData);
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        name: validated.name,
        phone: validated.phone,
        email: validated.email,
        bio: validated.bio || '',
        location: validated.location
      }));

      const e164 = toE164(validated.phone);
      onSubmit({
        name: validated.name,
        email: validated.email,
        whatsapp_number: e164,
        phone: e164,
        bio: validated.bio || undefined,
        location: validated.location
      });
    } catch (error) {
      console.error('Validation error after OTP:', error);
    }
  };

  const isPhoneValid = isValidE164(formData.phone);
  const isDetectingLocation = locationState === 'detecting-geo' || locationState === 'detecting-ip';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] [&>button]:hidden overflow-y-auto">
        <StandardSheetHeader 
          title={showOTPVerification ? "Verify Your WhatsApp" : autoApplying ? "Applying..." : "Please introduce yourself:"} 
          onClose={onClose}
        />

        {/* Auto-apply loading state */}
        {autoApplying && !showOTPVerification && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Using your saved details...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form Fields - Hidden when OTP verification or auto-applying */}
          {!showOTPVerification && !autoApplying && (
            <>
              {/* Required Fields */}
              <div className="space-y-2">
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name... *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`h-12 ${errors.name ? 'border-destructive' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <PhoneInput
                  id="phone"
                  placeholder="Phone number *"
                  value={formData.phone}
                  onChange={(v) => setFormData({ ...formData, phone: v })}
                  className={`h-12 ${errors.phone ? 'border-destructive' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email... *"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`h-12 ${errors.email ? 'border-destructive' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Optional Fields */}
              <div className="space-y-2">
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself (optional)"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className={`min-h-[80px] ${errors.bio ? 'border-destructive' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.bio && (
                  <p className="text-sm text-destructive">{errors.bio}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Textarea
                    id="location"
                    placeholder="Your city/location... *"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className={`min-h-[80px] pr-28 ${errors.location ? 'border-destructive' : ''}`}
                    disabled={isSubmitting || isDetectingLocation}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 text-xs gap-1 h-7 px-2"
                    onClick={handleAutoDetect}
                    disabled={isSubmitting || isDetectingLocation}
                  >
                    {isDetectingLocation ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    {isDetectingLocation ? 'Detecting...' : 'Auto-detect'}
                  </Button>
                </div>
                {errors.location && (
                  <p className="text-sm text-destructive">{errors.location}</p>
                )}
              </div>

              {turnstileOn && turnstileCfg?.siteKey && (
                <div className="space-y-1">
                  <TurnstileWidget ref={turnstileRef} siteKey={turnstileCfg.siteKey} onToken={setTurnstileToken} />
                  {errors.turnstile && <p className="text-sm text-destructive">{errors.turnstile}</p>}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={isSubmitting || isOTPCheckLoading || isTurnstileLoading || verifyingTurnstile}
              >
                {isSubmitting || verifyingTurnstile ? 'Sending...' : 'Send'}
              </Button>
            </>
          )}

          {/* OTP Verification Section - Shows after clicking Send, form is hidden */}
          {showOTPVerification && isOTPRequired && !isOTPVerified && (
            <WhatsAppOTPVerification
              phone={toE164(formData.phone)}
              name={formData.name}
              purpose="user_signup_otp"
              onVerified={handleOTPVerified}
              isPhoneValid={isPhoneValid}
              autoSend={true}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};
