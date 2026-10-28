import { PhoneInput } from "@/components/ui/phone-input";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useParams, useNavigationType } from "react-router-dom";
import { markSetupComplete, isSetupComplete, clearSetupComplete, clearPreservedSetupRoutes } from "@/utils/setupCompletion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Building2, 
  Phone, 
  FileText, 
  Image, 
  MapPin, 
  CheckCircle, 
  ChevronRight,
  Loader2,
  AlertCircle,
  Check,
  BadgeCheck
} from "lucide-react";
import SupabaseLocationDetector from '@/components/SupabaseLocationDetector';
import ProfilePhotoUpload from "@/components/ProfilePhotoUpload";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { usePlatformStyle } from "@/hooks/usePlatformStyle";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import { useWhatsAppValidation } from "@/hooks/useWhatsAppValidation";
import { useWhatsAppTriggerCheck } from "@/hooks/useWhatsAppTriggerCheck";
import WhatsAppOTPVerification from "@/components/WhatsAppOTPVerification";
import { useCompanyNameValidation } from "@/hooks/useCompanyNameValidation";
import { Button } from "@/components/ui/button";
import { useTwoFactorAuth } from "@/hooks/useTwoFactorAuth";
import { useCompanyProfileRealtime } from "@/hooks/useProfileRealtime";
import { UnifiedNotificationService } from "@/services/UnifiedNotificationService";
import PhoneVerifyBox from "@/components/auth/PhoneVerifyBox";
import usePhoneVerifySetting from "@/hooks/usePhoneVerifySetting";
import { normalizePhoneE164 } from '@/hooks/usePhoneOtpLogin';
import SetupStepHeader from '@/components/profile-setup/SetupStepHeader';
import { confirmedAccountPhone, profilePhoneLocked } from '@/lib/onboardingPhone';

const CompanyProfileSetup = () => {
  const navigate = useNavigate();
  const { user, company, updateCompany, refreshCompany } = useEmployerAuth();
  const [searchParams] = useSearchParams();
  const { step: urlStep } = useParams();
  const isEditMode = searchParams.get('edit') === 'true';
  
  const [isLoading, setIsLoading] = useState(false);
  const totalSteps = 5;
  
  // Get current step from URL parameter
  const currentStep = Math.min(Math.max(parseInt(urlStep || '1', 10), 1), totalSteps);

  // After the company setup was finished, browser-back must not re-open the wizard.
  const navigationType = useNavigationType();
  useEffect(() => {
    if (!isSetupComplete('employer')) return;
    if (navigationType === 'POP') {
      clearPreservedSetupRoutes();
      navigate('/employer-portal', { replace: true });
    } else {
      clearSetupComplete('employer');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationType, currentStep]);
  
  
  const [slideDirection, setSlideDirection] = useState('');
  const [locationCompleted, setLocationCompleted] = useState(false);
  const [isLocationValid, setIsLocationValid] = useState(false);
  
  // Ref to track if we're navigating between steps (to prevent data overwrite)
  const isStepNavigationRef = useRef(false);
  const [locationFormData, setLocationFormData] = useState({
    fullAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });
  
  // WhatsApp verification states
  const [isWhatsAppVerified, setIsWhatsAppVerified] = useState(false);
  const originalWhatsAppRef = useRef<string>('');
  const [originalWhatsAppVerified, setOriginalWhatsAppVerified] = useState(false);
  
  // Check if WhatsApp verification is required (from Auto-Triggers)
  const { isVerificationRequired: isWhatsAppVerificationRequired, isLoading: isTriggerLoading } = useWhatsAppTriggerCheck('company_profile_whatsapp_verify');
  
  // Native hooks
  const { tapFeedback, successFeedback, swipeFeedback, errorFeedback } = useNativeFeel();
  const { isIOS, containerClass, cardClass } = usePlatformStyle();
  
  // Telegram bot hook
  
  // 2FA status hook
  const { isEnabled: is2FAEnabled } = useTwoFactorAuth({ userType: 'employer', userId: user?.id || null });
  // Real-time company updates (for Telegram connection, etc.)
  useCompanyProfileRealtime(company?.id, (updatedData) => {
    console.log('📡 Company updated in real-time:', updatedData);
    // Refresh company context when updates occur
    refreshCompany();
  });

  // Phone and WhatsApp validation hooks - pass user ID and company ID to exclude own records
  const phoneValidation = usePhoneValidation('employer', user?.id, company?.id);
  const whatsAppValidation = useWhatsAppValidation('employer', user?.id, company?.id);
  const companyNameValidation = useCompanyNameValidation(user?.id, company?.id);

  // Owner switch: SMS OTP verification when the company phone number changes
  const { phoneVerifyEnabled, phoneVerifyLoading } = usePhoneVerifySetting('phone_verify_employer_profile');
  // A number on the login account is shown locked here; it changes only from Settings.
  const authPhone = confirmedAccountPhone(user);
  const phoneLocked = profilePhoneLocked(phoneVerifyEnabled, authPhone);
  const [isPhoneSmsVerified, setIsPhoneSmsVerified] = useState(false);
  const originalCompanyPhone = (company?.phone || '').replace(/\D/g, '').slice(-10);
  const currentCompanyPhone = phoneValidation.phone.replace(/\D/g, '').slice(-10);
  const isPhoneNumberChanged =
    currentCompanyPhone.length === 10 && currentCompanyPhone !== originalCompanyPhone;
  const needsPhoneSmsVerify =
    phoneVerifyLoading || (phoneVerifyEnabled && !phoneLocked && !isPhoneSmsVerified);

  useEffect(() => {
    if (phoneLocked && authPhone) phoneValidation.setPhone(authPhone);
  }, [phoneLocked, authPhone, phoneValidation.setPhone]);

  
  const [formData, setFormData] = useState({
    company_name: "",
    legal_name: "",
    business_type: "",
    incorporation_date: "",
    email: "",
    phone: "",
    whatsapp_number: "",
    hr_contact_name: "",
    website: "",
    company_details: "",
    organisation_size: "",
    industry: "",
    logo_url: "",
    instagram_link: "",
    facebook_link: "",
    youtube_link: "",
    linkedin_link: ""
  });

  useEffect(() => {
    // Only fetch on initial load, not during step navigation
    if (user && !isStepNavigationRef.current) {
      fetchCompanyProfile();
    }
    // Reset the flag after effect runs
    isStepNavigationRef.current = false;
  }, [user]);

  // Load original WhatsApp verified status from company data
  useEffect(() => {
    if (company) {
      if (company.whatsapp_number && !originalWhatsAppRef.current) {
        originalWhatsAppRef.current = company.whatsapp_number;
        const isAlreadyVerified = (company as any).whatsapp_verified ?? false;
        setOriginalWhatsAppVerified(isAlreadyVerified);
        if (isAlreadyVerified) {
          setIsWhatsAppVerified(true);
        }
      }
    }
  }, [company]);

  // Check for existing location
  useEffect(() => {
    const checkExistingLocation = async () => {
      if (!user) return;
      
      try {
        const { data: companyData, error } = await supabase
          .from('companies')
          .select('city, state, country, precise_address')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') return;
        if (companyData?.city && companyData?.state && companyData?.country) {
          setLocationCompleted(true);
        }
      } catch (error) {
        console.error('Error checking location:', error);
      }
    };

    checkExistingLocation();
  }, [user]);

  const fetchCompanyProfile = async () => {
    if (!user) return;
    
    try {
      const { data: companyData, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') return;

      if (companyData) {
        setFormData({
          company_name: companyData.company_name || "",
          legal_name: companyData.legal_name || "",
          business_type: companyData.business_type || "",
          incorporation_date: companyData.incorporation_date || "",
          email: user?.email || companyData.email || "",
          phone: companyData.phone || user?.phone || user?.user_metadata?.phone || "",
          whatsapp_number: companyData.whatsapp_number || "",
          hr_contact_name: companyData.hr_contact_name || "",
          website: companyData.website || "",
          company_details: companyData.company_details || "",
          organisation_size: companyData.organisation_size || "",
          industry: companyData.industry || "",
          logo_url: companyData.logo_url || "",
          instagram_link: companyData.instagram_link || "",
          facebook_link: companyData.facebook_link || "",
          youtube_link: companyData.youtube_link || "",
          linkedin_link: companyData.linkedin_link || ""
        });
        // Set validation hooks with existing values
        if (companyData.phone || user?.phone || user?.user_metadata?.phone) {
          const initialPhone = phoneLocked ? authPhone : (companyData.phone || authPhone || user?.user_metadata?.mobile_number || '');
          phoneValidation.setPhone(initialPhone);
          setIsPhoneSmsVerified(
            Boolean(authPhone) && normalizePhoneE164(authPhone) === normalizePhoneE164(initialPhone)
          );
        }
        if (companyData.whatsapp_number) {
          whatsAppValidation.setWhatsappNumber(companyData.whatsapp_number);
        }
        if (companyData.company_name) {
          companyNameValidation.setCompanyName(companyData.company_name, true);
        }
      } else {
        // No existing company data - set email from user
        setFormData(prev => ({
          ...prev,
          email: user?.email || ""
        }));
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
    }
  };

  const validateInput = (field: string, value: string): string => {
    switch (field) {
      case 'company_name':
      case 'legal_name':
      case 'hr_contact_name':
        return value.replace(/[0-9]/g, '').slice(0, 22);
      case 'phone':
      case 'whatsapp_number':
        return value.replace(/[^0-9+\s-]/g, '');
      case 'website':
        return value.slice(0, 40);
      case 'company_details':
        return value.slice(0, 120);
      default:
        return value;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const validatedValue = validateInput(field, value);
    setFormData(prev => ({ ...prev, [field]: validatedValue }));
    if (field === 'company_name') {
      companyNameValidation.setCompanyName(validatedValue);
    }
  };

  // Smart WhatsApp verification check - determines if OTP is needed
  const isWhatsAppNumberChanged = () => {
    const currentNumber = whatsAppValidation.getFormattedNumber();
    const originalNumber = originalWhatsAppRef.current;
    // Normalize numbers for comparison (remove spaces and special chars)
    const normalizedCurrent = currentNumber.replace(/[\s-]/g, '');
    const normalizedOriginal = originalNumber.replace(/[\s-]/g, '');
    return normalizedCurrent !== normalizedOriginal;
  };

  const needsWhatsAppVerification = () => {
    // WhatsApp number always equals the phone number, verified through the phone.
    return false;
    // If trigger is off, no verification needed
    if (!isWhatsAppVerificationRequired) return false;
    // If number hasn't changed and was already verified, no need
    if (!isWhatsAppNumberChanged() && originalWhatsAppVerified) return false;
    // Otherwise, verification is needed
    return true;
  };

  const isWhatsAppVerificationComplete = () => {
    // If no verification needed, consider it complete
    if (!needsWhatsAppVerification()) return true;
    // Otherwise, check if verified
    return isWhatsAppVerified;
  };

  // Navigate to specific step
  const navigateToStep = (step: number) => {
    isStepNavigationRef.current = true; // Mark as step navigation to prevent data overwrite
    const params = searchParams.toString();
    const queryString = params ? `?${params}` : '';
    navigate(`/Employer/Profile/Edit/${step}${queryString}`);
  };

  // Save current step data to database (progressive save)
  const saveCurrentStepData = async (): Promise<boolean> => {
    if (!user) return false;
    if (needsPhoneSmsVerify) return false;
    
    try {
      const updateData: Record<string, any> = {
        // Step 1 fields
        company_name: formData.company_name,
        legal_name: formData.legal_name,
        business_type: formData.business_type,
        incorporation_date: formData.incorporation_date,
        // Step 2 fields
        phone: phoneValidation.getFormattedNumber(),
        whatsapp_number: phoneValidation.getFormattedNumber(),
        hr_contact_name: formData.hr_contact_name,
        website: formData.website,
        // Step 3 fields
        industry: formData.industry,
        organisation_size: formData.organisation_size,
        company_details: formData.company_details,
        // Step 4 fields
        logo_url: formData.logo_url,
        instagram_link: formData.instagram_link,
        facebook_link: formData.facebook_link,
        youtube_link: formData.youtube_link,
        linkedin_link: formData.linkedin_link,
        // Email from user
        email: user.email
      };
      
      const { error } = await updateCompany(updateData);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving step data:', error);
      return false;
    }
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      errorFeedback();
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Block navigation on step 2 if WhatsApp verification is required but not complete
    if (currentStep === 2 && !isWhatsAppVerificationComplete()) {
      errorFeedback();
      toast.error("Please verify your number first");
      return;
    }
    
    // Save current step data before navigating
    setIsLoading(true);
    const saved = await saveCurrentStepData();
    setIsLoading(false);
    
    if (!saved) {
      errorFeedback();
      toast.error("Failed to save data. Please try again.");
      return;
    }
    
    if (currentStep < totalSteps) {
      swipeFeedback();
      setSlideDirection('animate-slide-in-from-right');
      setTimeout(() => setSlideDirection(''), 300);
      navigateToStep(currentStep + 1);
    }
  };

  const handlePrevious = async () => {
    if (currentStep > 1) {
      // Save current data before going back to preserve progress
      setIsLoading(true);
      await saveCurrentStepData();
      setIsLoading(false);
      
      swipeFeedback();
      setSlideDirection('animate-slide-in-from-left');
      setTimeout(() => setSlideDirection(''), 300);
      navigateToStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) {
      errorFeedback();
      toast.error("You must be logged in");
      return;
    }

    if (needsPhoneSmsVerify) {
      toast.error('Please verify your number with OTP first');
      return;
    }
    setIsLoading(true);
    try {
      // Save location data first
      if (isLocationValid && locationFormData.city) {
        const { error: locationError } = await supabase
          .from('companies')
          .update({
            city: locationFormData.city.trim(),
            state: locationFormData.state.trim(),
            country: locationFormData.country.trim(),
            precise_address: locationFormData.fullAddress.trim(),
            postal_code: locationFormData.postalCode.trim()
          })
          .eq('user_id', user.id);

        if (locationError) {
          console.error('Location save error:', locationError);
        }
      }

      // Determine if WhatsApp should be marked as verified
      const shouldMarkWhatsAppVerified = isWhatsAppVerified || (!needsWhatsAppVerification() && originalWhatsAppVerified && !isWhatsAppNumberChanged());

      const { error } = await updateCompany({
        ...formData,
        phone: phoneValidation.getFormattedNumber(),
        whatsapp_number: phoneValidation.getFormattedNumber(),
        email: user.email || formData.email,
        is_profile_complete: true
      });

      if (error) throw new Error(error.message);

      // Update whatsapp_verified separately (direct update to avoid type issues)
      if (company?.id) {
        await supabase
          .from('companies')
          .update({ whatsapp_verified: shouldMarkWhatsAppVerified })
          .eq('id', company.id);
      }

      // Send company profile complete notification only on first-time setup (not edit mode)
      if (user && !company?.is_profile_complete) {
        UnifiedNotificationService.notifyCompanyProfileComplete(user.id, formData.company_name).catch(err => {
          console.error('Failed to send company profile complete notification:', err);
        });
      }

      successFeedback();
      toast.success("Company profile completed!");
      // Setup is finished: forget the wizard so back never returns to it
      clearPreservedSetupRoutes();
      markSetupComplete('employer');
      navigate("/employer-portal", { replace: true });
    } catch (error: any) {
      errorFeedback();
      toast.error(error.message || "Failed to complete profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSaved = (location: any) => {
    setLocationCompleted(true);
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return formData.company_name.trim() && formData.legal_name.trim() && formData.business_type && formData.incorporation_date && !companyNameValidation.isDuplicate && !companyNameValidation.isChecking;
      case 2:
        // Check phone and WhatsApp validation - must be valid and not duplicate
        const phoneValid = phoneValidation.phone.length >= 10 && !phoneValidation.isDuplicate && !phoneValidation.isChecking && !needsPhoneSmsVerify;
        return phoneValid && formData.hr_contact_name.trim();
      case 3:
        return formData.industry && formData.organisation_size && formData.company_details.trim();
      case 4:
        return true; // Logo is optional
      case 5:
        return locationCompleted && isLocationValid;
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 p-4">
            <div className="text-center mb-6">
              <Building2 className="mx-auto w-12 h-12 text-primary mb-2" />
              <h3 className="text-lg font-semibold">Company Information</h3>
              <p className="text-muted-foreground text-sm">Basic details about your company</p>
            </div>

            <div className="native-input-group space-y-0 divide-y divide-border/50">
              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  Company Name *
                </Label>
                <div className="relative">
                  <Input
                    value={formData.company_name}
                    onChange={(e) => handleInputChange("company_name", e.target.value)}
                    placeholder="Enter company name"
                    className={`native-input h-14 text-base pr-10 ${companyNameValidation.isDuplicate ? 'border-destructive focus:border-destructive' : companyNameValidation.isValid ? 'border-green-500 focus:border-green-500' : ''}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {companyNameValidation.isChecking && (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    )}
                    {companyNameValidation.isValid && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {companyNameValidation.isDuplicate && (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{formData.company_name.length}/22 characters</p>
                  {companyNameValidation.isValid && (
                    <p className="text-xs text-green-500 font-medium">✓ Name available</p>
                  )}
                </div>
                {companyNameValidation.isDuplicate && (
                  <p className="text-xs text-destructive font-medium">{companyNameValidation.error}</p>
                )}
              </div>

              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Legal Name *
                </Label>
                <Input
                  value={formData.legal_name}
                  onChange={(e) => handleInputChange("legal_name", e.target.value)}
                  placeholder="Legal registration name"
                  className="native-input h-14 text-base"
                />
                <p className="text-xs text-muted-foreground">{formData.legal_name.length}/22 characters</p>
              </div>

              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Business Type *
                </Label>
                <Select value={formData.business_type} onValueChange={(value) => handleInputChange("business_type", value)}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="llp">Limited Liability Partnership (LLP)</SelectItem>
                    <SelectItem value="private_limited">Private Limited Company</SelectItem>
                    <SelectItem value="public_limited">Public Limited Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Date of Incorporation *
                </Label>
                <Input
                  type="date"
                  value={formData.incorporation_date}
                  onChange={(e) => handleInputChange("incorporation_date", e.target.value)}
                  className="native-input h-14 text-base"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 p-4">
            <div className="text-center mb-6">
              <Phone className="mx-auto w-12 h-12 text-primary mb-2" />
              <h3 className="text-lg font-semibold">Contact Details</h3>
              <p className="text-muted-foreground text-sm">How can people reach your company?</p>
            </div>

            <div className="native-input-group space-y-0 divide-y divide-border/50">
              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Phone Number *
                </Label>
                <div className="relative">
                  <PhoneInput
                    value={phoneValidation.phone}
                    disabled={phoneLocked}
                    onChange={(v) => {
                      if (phoneLocked) return;
                      phoneValidation.setPhone(v);
                      setIsPhoneSmsVerified(false);
                    }}
                    className={`h-14 text-base ${phoneValidation.isDuplicate ? 'border-destructive' : phoneValidation.isValid ? 'border-success' : ''}`}
                  />
                  {phoneValidation.isChecking && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
                  )}
                  {phoneValidation.isValid && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                  )}
                  {phoneValidation.isDuplicate && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-destructive" />
                  )}
                </div>
                {phoneValidation.error ? (
                  <p className="text-xs text-destructive">{phoneValidation.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{phoneLocked ? 'Verified number.' : 'Format: +91XXXXXXXXXX.'}</p>
                )}

                {/* SMS OTP verification — only when the owner switch is ON and the number changed */}
                {!phoneLocked && phoneVerifyEnabled && !phoneVerifyLoading && phoneValidation.isAvailable === true && !phoneValidation.isChecking && (
                  <PhoneVerifyBox
                    phone={phoneValidation.getFormattedNumber()}
                    mode="profile"
                    autoSend={false}
                    verified={isPhoneSmsVerified}
                    onVerified={(verifiedPhone) => {
                      setIsPhoneSmsVerified(true);
                      phoneValidation.setPhone(verifiedPhone);
                    }}
                    className="mt-3"
                  />
                )}
              </div>


              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Email (Login Email)
                </Label>
                <Input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="native-input h-14 text-base bg-muted/50 cursor-not-allowed"
                />
              </div>

              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  HR Contact Name *
                </Label>
                <Input
                  value={formData.hr_contact_name}
                  onChange={(e) => handleInputChange("hr_contact_name", e.target.value)}
                  placeholder="e.g. Vishal Rajput"
                  className="native-input h-14 text-base"
                />
                <p className="text-xs text-muted-foreground">{formData.hr_contact_name.length}/22 characters</p>
              </div>

              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Website
                </Label>
                <Input
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  placeholder="https://www.yourcompany.com"
                  className="native-input h-14 text-base"
                />
                <p className="text-xs text-muted-foreground">{formData.website.length}/40 characters</p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 p-4">
            <div className="text-center mb-6">
              <FileText className="mx-auto w-12 h-12 text-primary mb-2" />
              <h3 className="text-lg font-semibold">About Company</h3>
              <p className="text-muted-foreground text-sm">Tell us about your company</p>
            </div>

            <div className="native-input-group space-y-0 divide-y divide-border/50">
              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Industry Focus *
                </Label>
                <Select value={formData.industry} onValueChange={(value) => handleInputChange("industry", value)}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="recruitment">Online Recruitment</SelectItem>
                    <SelectItem value="staffing">Staffing & HR</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="education">Education & Training</SelectItem>
                    <SelectItem value="marketing">Digital Marketing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Organisation Size *
                </Label>
                <Select value={formData.organisation_size} onValueChange={(value) => handleInputChange("organisation_size", value)}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select organisation size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="501-1000">501-1000 employees</SelectItem>
                    <SelectItem value="1000+">1000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  Company Description *
                </Label>
                <Textarea
                  value={formData.company_details}
                  onChange={(e) => handleInputChange("company_details", e.target.value)}
                  placeholder="Write about your company..."
                  rows={4}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">{formData.company_details.length}/120 characters</p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 p-4">
            <div className="text-center mb-6">
              <Image className="mx-auto w-12 h-12 text-primary mb-2" />
              <h3 className="text-lg font-semibold">Company Logo</h3>
              <p className="text-muted-foreground text-sm">Upload your company logo</p>
            </div>

            <div className="flex justify-center">
              <ProfilePhotoUpload
                currentPhoto={formData.logo_url}
                onPhotoUpdate={(photoUrl) => handleInputChange("logo_url", photoUrl)}
                className="mx-auto"
                useEmployerContext={true}
              />
            </div>

            {/* Social Media Links */}
            <div className="mt-8">
              <h4 className="text-center text-sm font-medium text-muted-foreground mb-4">Social Media Links (Optional)</h4>
              <div className="native-input-group space-y-0 divide-y divide-border/50">
                <div className="p-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Instagram</Label>
                  <Input
                    value={formData.instagram_link}
                    onChange={(e) => handleInputChange("instagram_link", e.target.value)}
                    placeholder="https://instagram.com/yourcompany"
                    className="native-input h-14 text-base"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Facebook</Label>
                  <Input
                    value={formData.facebook_link}
                    onChange={(e) => handleInputChange("facebook_link", e.target.value)}
                    placeholder="https://facebook.com/yourcompany"
                    className="native-input h-14 text-base"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">LinkedIn</Label>
                  <Input
                    value={formData.linkedin_link}
                    onChange={(e) => handleInputChange("linkedin_link", e.target.value)}
                    placeholder="https://linkedin.com/company/yourcompany"
                    className="native-input h-14 text-base"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">YouTube</Label>
                  <Input
                    value={formData.youtube_link}
                    onChange={(e) => handleInputChange("youtube_link", e.target.value)}
                    placeholder="https://youtube.com/@yourcompany"
                    className="native-input h-14 text-base"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 p-4">
            <div className="text-center mb-6">
              <MapPin className="mx-auto w-12 h-12 text-primary mb-2" />
              <h3 className="text-lg font-semibold">Business Location</h3>
              <p className="text-muted-foreground text-sm">Set your company's location</p>
            </div>

            <SupabaseLocationDetector
              type="company"
              autoDetect={false}
              autoSave={false}
              hideSaveButton={true}
              onLocationSaved={handleLocationSaved}
              onValidationChange={setIsLocationValid}
              onFormDataChange={setLocationFormData}
              className="w-full"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Resume-style Step Header */}
      <SetupStepHeader
        title={isEditMode ? 'Edit Company' : 'Company Setup'}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onBack={() => {
          if (currentStep > 1) {
            handlePrevious();
          } else {
            navigate(-1);
          }
        }}
      />

      {/* Scrollable Content */}
      <main className="px-4 pb-32 pt-6 animate-fade-in">
        {/* Step Content with Slide Animation */}
        <div className={`transition-all duration-300 ${slideDirection}`}>
          <div className={cardClass}>
            {renderStep()}
          </div>
        </div>
      </main>

      {/* Fixed Bottom Action Bar */}
      <footer 
        className={`fixed bottom-0 left-0 right-0 native-bottom-nav px-4 py-4 ${
          isIOS ? 'backdrop-blur-xl bg-background/90' : 'bg-background shadow-2xl'
        }`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="flex gap-3 items-center">
          {/* Skip button for optional steps */}
          {(currentStep === 4 || currentStep === 5) && (
            <NativeFeedbackButton
              variant="outline"
              onClick={handleNext}
              className={`flex-1 h-14 text-base ${isIOS ? 'rounded-2xl' : 'rounded-xl'}`}
            >
              Skip
            </NativeFeedbackButton>
          )}
          
          <NativeFeedbackButton
            onClick={currentStep === totalSteps ? handleComplete : handleNext}
            disabled={!validateCurrentStep() || isLoading}
            feedbackType={currentStep === totalSteps ? 'success' : 'tap'}
            className={`${currentStep === 4 ? 'flex-1' : 'w-full'} h-14 text-base font-semibold bg-gradient-to-r from-primary to-secondary ${
              isIOS ? 'rounded-2xl' : 'rounded-xl'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </div>
            ) : currentStep === totalSteps ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Complete
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Next <ChevronRight className="w-5 h-5" />
              </span>
            )}
          </NativeFeedbackButton>
        </div>
      </footer>
    </div>
  );
};

export default CompanyProfileSetup;
