import { PhoneInput } from '@/components/ui/phone-input';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams, useNavigationType } from 'react-router-dom';
import { markSetupComplete, isSetupComplete, clearSetupComplete, clearPreservedSetupRoutes } from '@/utils/setupCompletion';
import SetupStepHeader from '@/components/profile-setup/SetupStepHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BirthDetailsDisplay } from '@/components/BirthDetailsDisplay';
import { User, Phone, MapPin, Briefcase, GraduationCap, Code, FileText, CheckCircle, MessageCircle, ArrowLeft, ChevronRight, Loader2, AlertCircle, Check, BadgeCheck, CalendarIcon, Cake } from 'lucide-react';
import { format, differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useWhatsAppValidation, formatWhatsAppNumber } from '@/hooks/useWhatsAppValidation';
import { usePhoneValidation } from '@/hooks/usePhoneValidation';
import { useWhatsAppTriggerCheck } from '@/hooks/useWhatsAppTriggerCheck';
import { NativeFeedbackButton } from '@/components/NativeFeedbackButton';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import MultipleExperienceInput from '@/components/MultipleExperienceInput';
import MultipleEducationInput from '@/components/MultipleEducationInput';
import MultipleCertificationsInput from '@/components/MultipleCertificationsInput';
import LanguagesSelector from '@/components/LanguagesSelector';
import SkillsSelector from '@/components/SkillsSelector';
import SupabaseLocationDetector from '@/components/SupabaseLocationDetector';
import LocationDetailsDisplay from '@/components/LocationDetailsDisplay';
import WhatsAppOTPVerification from '@/components/WhatsAppOTPVerification';
import { useTwoFactorAuth } from '@/hooks/useTwoFactorAuth';
import { useJobSeekerProfileRealtime } from '@/hooks/useProfileRealtime';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneE164 } from '@/hooks/usePhoneOtpLogin';
import { UnifiedNotificationService } from '@/services/UnifiedNotificationService';
import PhoneVerifyBox from '@/components/auth/PhoneVerifyBox';
import usePhoneVerifySetting from '@/hooks/usePhoneVerifySetting';
import { confirmedAccountPhone, profilePhoneLocked } from '@/lib/onboardingPhone';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, updateProfile, checkProfileCompletion, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const { step: urlStep } = useParams();
  // Detect edit mode from route path instead of query param
  const isEditMode = window.location.pathname.includes('/JobSeeker/Profile/Edit/');
  const redirectUrl = searchParams.get('redirect');
  
  const [isLoading, setIsLoading] = useState(false);
  const totalSteps = 6;
  
  // Get current step from URL, default to 1
  const currentStep = Math.min(Math.max(parseInt(urlStep || '1', 10), 1), totalSteps);

  // After the setup was finished, browser-back must not land back in the wizard.
  // Deliberate re-entry (clicking Edit) is a PUSH and clears the finished flag.
  const navigationType = useNavigationType();
  useEffect(() => {
    if (!isSetupComplete('jobseeker')) return;
    if (navigationType === 'POP') {
      clearPreservedSetupRoutes();
      navigate(redirectUrl ? decodeURIComponent(redirectUrl) : '/', { replace: true });
    } else {
      clearSetupComplete('jobseeker');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationType, currentStep]);
  
  
  const [slideDirection, setSlideDirection] = useState('');
  const [isWhatsAppVerified, setIsWhatsAppVerified] = useState(false);
  const [isLocationValid, setIsLocationValid] = useState(false);
  const [locationFormData, setLocationFormData] = useState({
    fullAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });
  
  // Track original WhatsApp number for smart verification
  const originalWhatsAppRef = useRef<string>('');
  const [originalWhatsAppVerified, setOriginalWhatsAppVerified] = useState(false);
  
  // Check if WhatsApp verification is required (from automation rules)
  const { isVerificationRequired: isWhatsAppVerificationRequired, isLoading: isTriggerLoading } = useWhatsAppTriggerCheck('user_profile_whatsapp_verify');
  
  // Native hooks
  const { tapFeedback, successFeedback, swipeFeedback } = useNativeFeel();
  const { isIOS, containerClass, cardClass } = usePlatformStyle();
  
  // Telegram bot hook
  
  // 2FA status hook
  const { isEnabled: is2FAEnabled } = useTwoFactorAuth({ userType: 'job_seeker', userId: user?.id || null });
  // Real-time profile updates (for Telegram connection, etc.)
  useJobSeekerProfileRealtime(user?.id, (updatedData) => {
    console.log('📡 Profile updated in real-time:', updatedData);
    // Refresh profile context when updates occur
    refreshProfile();
  });

  // WhatsApp validation hook
  const { 
    whatsappNumber: validatedWhatsApp, 
    setWhatsappNumber: setValidatedWhatsApp, 
    isChecking: isCheckingWhatsApp, 
    isAvailable: isWhatsAppAvailable, 
    error: whatsAppError,
    isDuplicate: isWhatsAppDuplicate,
    getFormattedNumber
  } = useWhatsAppValidation('job_seeker', user?.id);

  // Phone validation hook
  const {
    phone: validatedPhone,
    setPhone: setValidatedPhone,
    isChecking: isCheckingPhone,
    isAvailable: isPhoneAvailable,
    error: phoneError,
    isDuplicate: isPhoneDuplicate,
    getFormattedNumber: getFormattedPhone
  } = usePhoneValidation('job_seeker', user?.id);

  // Owner switch: SMS OTP verification for phone number changes
  const { phoneVerifyEnabled, phoneVerifyLoading } = usePhoneVerifySetting('phone_verify_jobseeker_profile');
  // A number on the login account is shown locked here; it changes only from Settings.
  const authPhone = confirmedAccountPhone(user);
  const phoneLocked = profilePhoneLocked(phoneVerifyEnabled, authPhone);
  const [isPhoneSmsVerified, setIsPhoneSmsVerified] = useState(false);
  const originalPhone = (profile?.phone || '').replace(/\D/g, '').slice(-10);
  const isPhoneNumberChanged =
    validatedPhone.replace(/\D/g, '').slice(-10).length === 10 &&
    validatedPhone.replace(/\D/g, '').slice(-10) !== originalPhone;
  const needsPhoneSmsVerify =
    phoneVerifyLoading || (phoneVerifyEnabled && !phoneLocked && !isPhoneSmsVerified);


  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    whatsapp_number: '',
    location: '',
    current_position: '',
    company: '',
    experience_years: '',
    education: '',
    skills: [] as string[],
    bio: '',
    profile_image_url: '',
    instagram_link: '',
    facebook_link: '',
    youtube_link: '',
    linkedin_link: '',
    languages: [] as string[],
    date_of_birth: '',
    gender: ''
  });
  
  // Multiple entries state
  const [professionalExperiences, setProfessionalExperiences] = useState<Array<{
    id?: string;
    position: string;
    company: string;
    experience_years: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    description: string;
  }>>([{
    position: '',
    company: '',
    experience_years: '',
    start_date: '',
    end_date: '',
    is_current: false,
    description: ''
  }]);
  
  const [educationEntries, setEducationEntries] = useState<Array<{
    id?: string;
    degree: string;
    institution: string;
    field_of_study: string;
    start_year: string;
    end_year: string;
    grade: string;
    description: string;
  }>>([{
    degree: '',
    institution: '',
    field_of_study: '',
    start_year: '',
    end_year: '',
    grade: '',
    description: ''
  }]);

  const [certifications, setCertifications] = useState<Array<{
    id?: string;
    certification_name: string;
    issuing_organization: string;
    issue_date: string;
    expiry_date: string;
    credential_id: string;
    credential_url: string;
    description: string;
  }>>([{
    certification_name: '',
    issuing_organization: '',
    issue_date: '',
    expiry_date: '',
    credential_id: '',
    credential_url: '',
    description: ''
  }]);
  
  

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (profile) {
      // Get phone from user metadata if not in profile
      const phoneFromAuth = user?.phone || user?.user_metadata?.phone || '';
      
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || phoneFromAuth,
        whatsapp_number: profile.whatsapp_number || '',
        location: profile.location || '',
        current_position: profile.current_position || '',
        company: profile.company || '',
        experience_years: profile.experience_years?.toString() || '',
        education: profile.education || '',
        skills: profile.skills || [],
        bio: profile.bio || '',
        profile_image_url: profile.profile_image_url || '',
        instagram_link: (profile as any).instagram_link || '',
        facebook_link: (profile as any).facebook_link || '',
        youtube_link: (profile as any).youtube_link || '',
        linkedin_link: (profile as any).linkedin_link || '',
        languages: (profile as any).languages || [],
        date_of_birth: (profile as any).date_of_birth || '',
        gender: (profile as any).gender || ''
      });
      
      // Load existing location data for edit mode
      setLocationFormData({
        fullAddress: (profile as any).precise_address || '',
        city: (profile as any).city || '',
        state: (profile as any).state || '',
        postalCode: (profile as any).postal_code || '',
        country: (profile as any).country || ''
      });
      
      // Set location valid if we have city data
      if ((profile as any).city) {
        setIsLocationValid(true);
      }
      
      // Store original WhatsApp number and verified status for smart verification
      if (profile.whatsapp_number && !originalWhatsAppRef.current) {
        originalWhatsAppRef.current = profile.whatsapp_number;
        const isAlreadyVerified = (profile as any).whatsapp_verified ?? false;
        setOriginalWhatsAppVerified(isAlreadyVerified);
        // If already verified and same number, set verification state
        if (isAlreadyVerified) {
          setIsWhatsAppVerified(true);
        }
      }
      
      // Load professional experiences and education entries
        const loadData = async () => {
          await Promise.all([
            loadProfessionalExperiences(),
            loadEducationEntries(),
            loadCertifications()
          ]);
        };
      
      loadData();
      
      if (checkProfileCompletion() && !isEditMode) {
        navigate('/');
      }
    }
  }, [user, profile?.id, isEditMode]); // Simplified dependencies

  // Sync validated WhatsApp number with form data
  useEffect(() => {
    if (profile?.whatsapp_number) {
      setValidatedWhatsApp(profile.whatsapp_number);
    }
  }, [profile?.whatsapp_number, setValidatedWhatsApp]);

  // WhatsApp number always mirrors the phone number.
  useEffect(() => { setValidatedWhatsApp(validatedPhone); }, [validatedPhone, setValidatedWhatsApp]);

  // Sync validatedWhatsApp to formData
  useEffect(() => {
    if (validatedWhatsApp) {
      setFormData(prev => ({ ...prev, whatsapp_number: getFormattedNumber() }));
    }
  }, [validatedWhatsApp, getFormattedNumber]);

  // Use Auth as a fallback only. Profile-only edits must remain intact when
  // SMS verification is disabled, while an empty profile inherits Auth phone.
  useEffect(() => {
    const initialPhone = phoneLocked ? authPhone : (profile?.phone || authPhone || user?.user_metadata?.mobile_number || '');
    if (initialPhone) {
      setValidatedPhone(initialPhone);
      setIsPhoneSmsVerified(
        Boolean(authPhone) && normalizePhoneE164(authPhone) === normalizePhoneE164(initialPhone)
      );
    }
  }, [authPhone, phoneLocked, user?.user_metadata?.mobile_number, profile?.phone, setValidatedPhone]);

  // Sync validatedPhone to formData
  useEffect(() => {
    if (validatedPhone) {
      setFormData(prev => ({ ...prev, phone: getFormattedPhone() }));
    }
  }, [validatedPhone, getFormattedPhone]);

  // State for location details - including postal_code for database compatibility
  const [locationDetails, setLocationDetails] = React.useState<{
    city?: string;
    state?: string;
    country?: string;
    fullAddress?: string;
    postcode?: string;
    postal_code?: string; // Database field name
  } | null>(null);

  // Helper to sanitize postal code
  const sanitizePostcode = (postcode: any): string => {
    if (!postcode) return '';
    const postcodeStr = String(postcode).trim();
    if (postcodeStr === '' || postcodeStr === 'undefined' || postcodeStr === 'null' || 
        postcodeStr === '[object Object]' || postcodeStr.toLowerCase().includes('object')) {
      return '';
    }
    return postcodeStr;
  };

  // Listen for location detection events
  useEffect(() => {
    const handleLocationDetected = (event: CustomEvent) => {
      const { city, state, country, latitude, longitude, fullAddress, ip, postcode } = event.detail;
      
      console.log('📍 [ProfileSetup] Location detected:', event.detail);
      console.log('📮 [ProfileSetup] Postal code received:', postcode || '(EMPTY)');
      
      // Sanitize postal code
      const sanitizedPostcode = sanitizePostcode(postcode);
      console.log('📮 [ProfileSetup] Sanitized postal code:', sanitizedPostcode || '(EMPTY)');
      
      // Store location details for the LocationDetailsDisplay
      setLocationDetails({
        city,
        state,
        country,
        fullAddress,
        postcode: sanitizedPostcode,
        postal_code: sanitizedPostcode
      });
      
      // Prioritize GPS location (with fullAddress) over IP location
      const isGPSLocation = !!latitude && !!longitude;
      
      let locationString = '';
      if (isGPSLocation && fullAddress) {
        // Use full GPS address for accurate location
        locationString = fullAddress;
        console.log('✅ Using GPS full address:', locationString);
      } else {
        // Fallback to city, state format
        locationString = `${city}, ${state}`;
        console.log('📍 Using basic location format:', locationString);
      }
      
      setFormData(prev => ({
        ...prev,
        location: locationString
      }));
    };

    // Listen for location-detected events
    window.addEventListener('location-detected', handleLocationDetected as EventListener);
    
    return () => {
      window.removeEventListener('location-detected', handleLocationDetected as EventListener);
    };
  }, []);

  const loadProfessionalExperiences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('professional_experiences')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading professional experiences:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setProfessionalExperiences(data.map(exp => ({
          id: exp.id,
          position: exp.position || '',
          company: exp.company || '',
          experience_years: exp.experience_years?.toString() || '',
          start_date: exp.start_date || '',
          end_date: exp.end_date || '',
          is_current: exp.is_current || false,
          description: exp.description || ''
        })));
      }
    } catch (error) {
      console.error('Error loading professional experiences:', error);
    }
  };

  const loadEducationEntries = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('education_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading education entries:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setEducationEntries(data.map(edu => ({
          id: edu.id,
          degree: edu.degree || '',
          institution: edu.institution || '',
          field_of_study: edu.field_of_study || '',
          start_year: edu.start_year?.toString() || '',
          end_year: edu.end_year?.toString() || '',
          grade: edu.grade || '',
          description: edu.description || ''
        })));
      }
    } catch (error) {
      console.error('Error loading education entries:', error);
    }
  };

  const loadCertifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('certifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading certifications:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setCertifications(data.map(cert => ({
          id: cert.id,
          certification_name: cert.certification_name || '',
          issuing_organization: cert.issuing_organization || '',
          issue_date: cert.issue_date || '',
          expiry_date: cert.expiry_date || '',
          credential_id: cert.credential_id || '',
          credential_url: cert.credential_url || '',
          description: cert.description || ''
        })));
      }
    } catch (error) {
      console.error('Error loading certifications:', error);
    }
  };

  const getProgress = () => {
    return (currentStep / totalSteps) * 100;
  };

  // Navigate to step via URL
  const navigateToStep = (step: number) => {
    navigate(`/JobSeeker/Profile/Edit/${step}`);
  };

  const handleSkillsChange = (newSkills: string[]) => {
    setFormData(prev => ({
      ...prev,
      skills: newSkills
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      swipeFeedback(); // 🔊 Native sound + haptic
      setSlideDirection('animate-slide-in-from-right');
      setTimeout(() => setSlideDirection(''), 300);
      navigateToStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      swipeFeedback(); // 🔊 Native sound + haptic
      setSlideDirection('animate-slide-in-from-left');
      setTimeout(() => setSlideDirection(''), 300);
      navigateToStep(currentStep - 1);
    }
  };
  
  const handleBack = () => {
    tapFeedback();
    navigate(-1);
  };

  const handleComplete = async () => {
    if (!validateCurrentStep()) return;
    if (needsPhoneSmsVerify) {
      toast({
        variant: 'destructive',
        title: 'Verify mobile number',
        description: 'Please verify your number with OTP first.',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Generate location string for profile
      const locationString = locationFormData.fullAddress.trim() || 
        (locationFormData.city && locationFormData.state 
          ? `${locationFormData.city.trim()}, ${locationFormData.state.trim()}, ${locationFormData.country.trim()}`
          : '');

      // Save location data first
      if (isLocationValid && locationFormData.city && user) {
        const { error: locationError } = await supabase
          .from('profiles')
          .update({
            city: locationFormData.city.trim(),
            state: locationFormData.state.trim(),
            country: locationFormData.country.trim(),
            precise_address: locationFormData.fullAddress.trim(),
            postal_code: locationFormData.postalCode.trim(),
            location: locationString  // ✅ Save location field
          })
          .eq('user_id', user.id);

        if (locationError) {
          console.error('Location save error:', locationError);
        }
      }

      // Step 1: Save profile (main data)
      // Determine if WhatsApp should be marked as verified
      const shouldMarkWhatsAppVerified = isWhatsAppVerified || (!needsWhatsAppVerification() && originalWhatsAppVerified && !isWhatsAppNumberChanged());
      
      const profileData = {
        ...formData,
        location: locationString || formData.location,
        experience_years: parseInt(formData.experience_years) || 0,
        is_profile_complete: true,
        whatsapp_verified: shouldMarkWhatsAppVerified,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null
      };
      
      const { error: profileError } = await updateProfile(profileData);
      if (profileError) throw new Error('Profile update failed: ' + profileError.message);

      // Step 2: Save related data with error recovery
      const savePromises = [
        saveProfessionalExperiences(),
        saveEducationEntries(),
        saveCertifications()
      ];
      
      const results = await Promise.allSettled(savePromises);
      
      // Check for failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('Some data failed to save:', failures);
        toast({
          variant: "destructive",
          title: "Partial Save Error",
          description: `Profile saved but ${failures.length} section(s) failed. Please try saving again.`
        });
        return; // Don't navigate away - let user retry
      }
      
      // Refresh profile data to update cache with new location data
      await refreshProfile();
      
      // Send profile complete notification via all channels (OneSignal + WhatsApp + Telegram)
      if (user && !isEditMode) {
        UnifiedNotificationService.notifyUserProfileComplete(user.id, formData.full_name).catch(err => {
          console.error('Failed to send profile complete notification:', err);
        });
      }
      
      // Success!
      successFeedback(); // 🎉 Native celebration
      toast({
        title: "Success",
        description: isEditMode ? "Profile updated successfully!" : "Profile completed successfully!"
      });
      
      // Setup is finished: forget the wizard so back never returns to it
      clearPreservedSetupRoutes();
      markSetupComplete('jobseeker');

      if (isEditMode) {
        navigate('/', { replace: true });
      } else if (redirectUrl) {
        navigate(decodeURIComponent(redirectUrl), { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save profile data"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfessionalExperiences = async () => {
    if (!user) return;
    
    console.log('Saving professional experiences:', professionalExperiences);
    
    try {
      // Prepare data with IDs for UPSERT
      const experiencesToSave = professionalExperiences
        .filter(exp => exp.position.trim() && exp.company.trim())
        .map(exp => ({
          ...(exp.id && { id: exp.id }), // Include ID if exists
          user_id: user.id,
          position: exp.position,
          company: exp.company,
          experience_years: parseInt(exp.experience_years) || null,
          start_date: exp.start_date || null,
          end_date: exp.is_current ? null : exp.end_date || null,
          is_current: exp.is_current,
          description: exp.description || null
        }));
      
      console.log('Experiences to save:', experiencesToSave);
      
      if (experiencesToSave.length > 0) {
        // UPSERT: Update existing or insert new (safer than delete-then-insert)
        const { error } = await supabase
          .from('professional_experiences')
          .upsert(experiencesToSave, {
            onConflict: 'id'
          });
          
        if (error) {
          console.error('Error upserting experiences:', error);
          throw error;
        }
        
        console.log('Professional experiences saved successfully');
        
        // Update the main profile with the maximum experience years
        const maxExperience = Math.max(...experiencesToSave.map(exp => exp.experience_years || 0));
        if (maxExperience > 0) {
          await supabase
            .from('profiles')
            .update({ experience_years: maxExperience })
            .eq('user_id', user.id);
          // Also sync AuthContext so Profile screen updates immediately
          try {
            await updateProfile({ experience_years: maxExperience });
          } catch {}
        }
        
        // Delete entries that were removed from form
        const savedIds = experiencesToSave
          .map(exp => exp.id)
          .filter(id => id !== undefined);
        
        if (savedIds.length > 0) {
          await supabase
            .from('professional_experiences')
            .delete()
            .eq('user_id', user.id)
            .not('id', 'in', `(${savedIds.join(',')})`);
        }
      } else {
        // If no experiences to save, delete all
        await supabase
          .from('professional_experiences')
          .delete()
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error in saveProfessionalExperiences:', error);
      throw error;
    }
  };

  const saveEducationEntries = async () => {
    if (!user) return;
    
    console.log('Saving education entries:', educationEntries);
    
    try {
      // Prepare data with IDs for UPSERT
      const educationToSave = educationEntries
        .filter(edu => edu.degree.trim() && edu.institution.trim())
        .map(edu => ({
          ...(edu.id && { id: edu.id }), // Include ID if exists
          user_id: user.id,
          degree: edu.degree,
          institution: edu.institution,
          field_of_study: edu.field_of_study || null,
          start_year: parseInt(edu.start_year) || null,
          end_year: parseInt(edu.end_year) || null,
          grade: edu.grade || null,
          description: edu.description || null
        }));
      
      console.log('Education to save:', educationToSave);
      
      if (educationToSave.length > 0) {
        // UPSERT: Update existing or insert new (safer than delete-then-insert)
        const { error } = await supabase
          .from('education_entries')
          .upsert(educationToSave, {
            onConflict: 'id'
          });
          
        if (error) {
          console.error('Error upserting education:', error);
          throw error;
        }
        
        console.log('Education entries saved successfully');
        
        // Delete entries that were removed from form
        const savedIds = educationToSave
          .map(edu => edu.id)
          .filter(id => id !== undefined);
        
        if (savedIds.length > 0) {
          await supabase
            .from('education_entries')
            .delete()
            .eq('user_id', user.id)
            .not('id', 'in', `(${savedIds.join(',')})`);
        }
      } else {
        // If no education to save, delete all
        await supabase
          .from('education_entries')
          .delete()
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error in saveEducationEntries:', error);
      throw error;
    }
  };

  const saveCertifications = async () => {
    if (!user) return;
    
    console.log('Saving certifications:', certifications);
    
    try {
      // Prepare data with IDs for UPSERT
      const certificationsToSave = certifications
        .filter(cert => cert.certification_name.trim() && cert.issuing_organization.trim())
        .map(cert => ({
          ...(cert.id && { id: cert.id }), // Include ID if exists
          user_id: user.id,
          certification_name: cert.certification_name,
          issuing_organization: cert.issuing_organization,
          issue_date: cert.issue_date || null,
          expiry_date: cert.expiry_date || null,
          credential_id: cert.credential_id || null,
          credential_url: cert.credential_url || null,
          description: cert.description || null
        }));
      
      console.log('Certifications to save:', certificationsToSave);
      
      if (certificationsToSave.length > 0) {
        // UPSERT: Update existing or insert new (safer than delete-then-insert)
        const { error } = await supabase
          .from('certifications')
          .upsert(certificationsToSave, {
            onConflict: 'id'
          });
          
        if (error) {
          console.error('Error upserting certifications:', error);
          throw error;
        }
        
        console.log('Certifications saved successfully');
        
        // Delete entries that were removed from form
        const savedIds = certificationsToSave
          .map(cert => cert.id)
          .filter(id => id !== undefined);
        
        if (savedIds.length > 0) {
          await supabase
            .from('certifications')
            .delete()
            .eq('user_id', user.id)
            .not('id', 'in', `(${savedIds.join(',')})`);
        }
      } else {
        // If no certifications to save, delete all
        await supabase
          .from('certifications')
          .delete()
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error in saveCertifications:', error);
      throw error;
    }
  };

  // Smart WhatsApp verification check - determines if OTP is needed
  const isWhatsAppNumberChanged = () => {
    const currentNumber = getFormattedNumber();
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

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        const baseValidation = formData.full_name.trim() && 
               validatedPhone.length >= 10 && 
               !isPhoneDuplicate && !needsPhoneSmsVerify &&
               isLocationValid;
        // Add WhatsApp verification check
        return baseValidation && isWhatsAppVerificationComplete();
      case 2:
        return professionalExperiences.some(exp => exp.position.trim() && exp.company.trim());
      case 3:
        return formData.skills.length > 0;
      case 4:
        return educationEntries.some(edu => edu.degree.trim() && edu.institution.trim());
      case 5:
        return true; // Certifications are optional
      case 6:
        return true; // Languages & Social is optional
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
              <User className="mx-auto w-12 h-12 text-primary mb-2" />
              <h3 className="text-lg font-semibold">Personal Information</h3>
              <p className="text-muted-foreground text-sm">Let's start with your basic details</p>
            </div>

            {/* Profile Photo Upload */}
            <div className="flex justify-center mb-6">
              <ProfilePhotoUpload
                currentPhoto={formData.profile_image_url}
                onPhotoUpdate={(photoUrl) => {
                  tapFeedback();
                  setFormData(prev => ({ ...prev, profile_image_url: photoUrl }));
                }}
              />
            </div>
            
            {/* Native Input Group */}
            <div className="native-input-group space-y-0 divide-y divide-border/50">
              <div className="p-4 space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 22) {
                      setFormData(prev => ({ ...prev, full_name: value }));
                    }
                  }}
                  placeholder="Enter your full name"
                  maxLength={22}
                  className="native-input h-14 text-base"
                />
                <p className="text-xs text-muted-foreground">{formData.full_name.length}/22 characters</p>
              </div>
              
              {/* Birthday Date Picker */}
              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase flex-wrap">
                  <Cake className="w-3.5 h-3.5 text-primary" />
                  Date of Birth
                  {formData.date_of_birth && (() => {
                    const bd = new Date(formData.date_of_birth + 'T00:00:00');
                    const n = new Date();
                    const y = differenceInYears(n, bd);
                    const am = addYears(bd, y);
                    const m = differenceInMonths(n, am);
                    const aM = addMonths(am, m);
                    const d = differenceInDays(n, aM);
                    return (
                      <span className="text-[10px] font-semibold text-primary ml-1">
                        ({y}Y, {m}M, {d}D)
                      </span>
                    );
                  })()}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-start text-left font-normal text-base",
                        !formData.date_of_birth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date_of_birth
                        ? format(new Date(formData.date_of_birth + 'T00:00:00'), "dd MMMM yyyy")
                        : "Select your birthday"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.date_of_birth ? new Date(formData.date_of_birth + 'T00:00:00') : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const formatted = format(date, 'yyyy-MM-dd');
                          setFormData(prev => ({ ...prev, date_of_birth: formatted }));
                        }
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1940-01-01")
                      }
                      initialFocus
                      captionLayout="dropdown-buttons"
                      fromYear={1940}
                      toYear={new Date().getFullYear()}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {/* Age Display */}
                {formData.date_of_birth && <BirthDetailsDisplay dateOfBirth={formData.date_of_birth} />}
              </div>

              {/* Gender Select */}
              <div className="p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Gender
                </Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                >
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  Phone Number *
                </Label>
                <div className="relative">
                  <PhoneInput
                    id="phone"
                    value={validatedPhone}
                    disabled={phoneLocked}
                    onChange={(v) => {
                      if (phoneLocked) return;
                      setValidatedPhone(v);
                      setIsPhoneSmsVerified(false);
                    }}
                    className={`h-14 text-base ${isPhoneDuplicate ? 'border-destructive' : isPhoneAvailable ? 'border-success' : ''}`}
                  />
                  {isCheckingPhone && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {!isCheckingPhone && isPhoneAvailable && (
                    <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                  {!isCheckingPhone && isPhoneDuplicate && (
                    <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-destructive" />
                  )}
                </div>
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
                {!phoneError && (
                  <p className="text-xs text-muted-foreground">{phoneLocked ? 'Verified number.' : 'Format: +91XXXXXXXXXX.'}</p>
                )}

                {/* SMS OTP verification — only when the owner switch is ON and the number changed */}
                {!phoneLocked && phoneVerifyEnabled && !phoneVerifyLoading && isPhoneAvailable === true && !isCheckingPhone && (
                  <PhoneVerifyBox
                    phone={getFormattedPhone()}
                    mode="profile"
                    autoSend={false}
                    verified={isPhoneSmsVerified}
                    onVerified={(verifiedPhone) => {
                      setIsPhoneSmsVerified(true);
                      setValidatedPhone(verifiedPhone);
                    }}
                    className="mt-3"
                  />
                )}
              </div>


            </div>
            
            <div className="space-y-4 mt-6">
              <SupabaseLocationDetector
                type="profile"
                autoDetect={false}
                autoSave={false}
                hideSaveButton={true}
                onLocationSaved={(location) => {
                  console.log('📍 Location saved callback:', location);
                  setLocationDetails(location);
                  
                  // Update form data with location string
                  const locationString = location.fullAddress || 
                    (location.city && location.state 
                      ? `${location.city}, ${location.state}, ${location.country}`
                      : '');
                  
                  setFormData(prev => ({
                    ...prev,
                    location: locationString
                  }));
                }}
                onValidationChange={setIsLocationValid}
                onFormDataChange={setLocationFormData}
              />
            </div>
          </div>
        );
        
      case 2:
        return (
          <MultipleExperienceInput
            experiences={professionalExperiences}
            onChange={setProfessionalExperiences}
          />
        );
        
      case 3:
        return (
          <div className="space-y-6 p-4">
            <div className="text-center mb-6">
              <Code className="mx-auto w-12 h-12 text-primary mb-2" />
              <h3 className="text-lg font-semibold">Skills & Expertise</h3>
              <p className="text-muted-foreground text-sm">Add your technical and professional skills</p>
            </div>
            
            <SkillsSelector
              selectedSkills={formData.skills}
              onSkillsChange={handleSkillsChange}
              required={true}
            />
          </div>
        );
        
      case 4:
        return (
          <MultipleEducationInput
            educationEntries={educationEntries}
            onChange={setEducationEntries}
            bio={formData.bio}
            onBioChange={(bio) => setFormData(prev => ({ ...prev, bio }))}
          />
        );

      case 5:
        return (
          <MultipleCertificationsInput
            certifications={certifications}
            onChange={setCertifications}
          />
        );

      case 6:
        return (
          <div className="space-y-6 p-4">
            <LanguagesSelector
              languages={formData.languages}
              onChange={(languages) => setFormData(prev => ({ ...prev, languages }))}
            />

            {/* Social Media Links */}
            <div className="mt-8 space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold">Social Media Links</h3>
                <p className="text-muted-foreground text-sm">Add your social media profiles (optional)</p>
              </div>
              
              <div className="native-input-group space-y-0 divide-y divide-border/50">
                <div className="p-4 space-y-2">
                  <Label htmlFor="instagram_link" className="text-xs font-medium text-muted-foreground uppercase">Instagram Profile</Label>
                  <Input
                    id="instagram_link"
                    value={formData.instagram_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, instagram_link: e.target.value }))}
                    placeholder="https://instagram.com/your_username"
                    className="native-input h-14 text-base"
                  />
                </div>
                
                <div className="p-4 space-y-2">
                  <Label htmlFor="facebook_link" className="text-xs font-medium text-muted-foreground uppercase">Facebook Profile</Label>
                  <Input
                    id="facebook_link"
                    value={formData.facebook_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, facebook_link: e.target.value }))}
                    placeholder="https://facebook.com/your_profile"
                    className="native-input h-14 text-base"
                  />
                </div>
                
                <div className="p-4 space-y-2">
                  <Label htmlFor="youtube_link" className="text-xs font-medium text-muted-foreground uppercase">YouTube Channel</Label>
                  <Input
                    id="youtube_link"
                    value={formData.youtube_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, youtube_link: e.target.value }))}
                    placeholder="https://youtube.com/@your_channel"
                    className="native-input h-14 text-base"
                  />
                </div>
                
                <div className="p-4 space-y-2">
                  <Label htmlFor="linkedin_link" className="text-xs font-medium text-muted-foreground uppercase">LinkedIn Profile</Label>
                  <Input
                    id="linkedin_link"
                    value={formData.linkedin_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, linkedin_link: e.target.value }))}
                    placeholder="https://linkedin.com/in/your_profile"
                    className="native-input h-14 text-base"
                  />
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Resume-style Step Header */}
      <SetupStepHeader
        title={isEditMode ? 'Edit Your Profile' : 'Complete Profile'}
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
      <main className="px-4 pb-32 pt-4 animate-fade-in">
        {/* Step Content with Slide Animation - Rounded Card with Shadow */}
        <div className={`transition-all duration-300 ${slideDirection}`}>
          <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
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
          {/* Skip button on the left for optional steps */}
          {currentStep >= 2 && currentStep < totalSteps && (
            <NativeFeedbackButton
              variant="outline"
              onClick={handleNext}
              className="flex-1 h-14 text-base rounded-full border-2"
            >
              Skip
            </NativeFeedbackButton>
          )}
          
          <NativeFeedbackButton
            onClick={currentStep === totalSteps ? handleComplete : handleNext}
            disabled={!validateCurrentStep() || isLoading}
            feedbackType={currentStep === totalSteps ? 'success' : 'tap'}
            className={`${currentStep >= 2 && currentStep < totalSteps ? 'flex-1' : 'w-full'} h-14 text-base font-semibold bg-gradient-to-r from-primary to-secondary rounded-full shadow-lg shadow-primary/30`}
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

export default ProfileSetup;
