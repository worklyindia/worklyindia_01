import TurnstileWidget, { useTurnstileConfig, verifyTurnstile, type TurnstileHandle } from "@/components/auth/TurnstileWidget";
import SignupPage from '@/components/auth/SignupPage';
import PasswordRecoveryPage from '@/components/auth/PasswordRecoveryPage';
import RecoveryOtpVerify from '@/components/auth/RecoveryOtpVerify';
import useSignupEmailOtpSetting from '@/hooks/useSignupEmailOtpSetting';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast as sonnerToast } from 'sonner';
import employerHero from '@/assets/employer-hero.webp';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { useAuthImages } from '@/hooks/useAuthImages';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, Building2, ArrowLeft, AlertCircle, RefreshCw, Phone, Check, Loader2, Fingerprint, AlertTriangle, X, Zap, Home } from 'lucide-react';
import { useQuickLogin } from '@/hooks/useQuickLogin';
import { useDeviceRecognition } from '@/hooks/useDeviceRecognition';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import SEO from '@/components/SEO';
import { EmployerJobPostingSchema } from '@/components/seo';
import { useWhatsAppValidation } from '@/hooks/useWhatsAppValidation';
import { PhoneInput, CountryPickerSheet } from '@/components/ui/phone-input';
import { DEFAULT_COUNTRY, toE164, type CountryCode } from '@/lib/phone';
import { nextLoginIdentifier, loginLookupValue, isCompleteNationalPhone } from '@/lib/phoneFormat';
import { useEmailValidation } from '@/hooks/useEmailValidation';
import { useLoginEmailValidation } from '@/hooks/useLoginEmailValidation';
import { useSignupOTPCheck } from '@/hooks/useSignupOTPCheck';
import { usePhoneVerifySetting } from '@/hooks/usePhoneVerifySetting';

import ReferralCodeInput from '@/components/referral/ReferralCodeInput';
import { savePendingReferralCode } from '@/utils/pendingReferral';
import { Separator } from '@/components/ui/separator';
import { handleAuthError, validateLoginForm, validateSignupForm, validateForgotPasswordForm } from '@/utils/authErrorHandler';
import { useReferralSystem } from '@/hooks/useReferralSystem';
import PasswordResetForm from '@/components/PasswordResetForm';
import { supabase } from '@/integrations/supabase/client';
import { LoginNotificationPermission } from '@/components/LoginNotificationPermission';

import { isPhoneIdentifier, looksLikePhoneInput, sanitizeIdentifier } from '@/lib/loginIdentifier';
import AppDownloadButtons from '@/components/AppDownloadButtons';
import BrowserQuickLoginCard from '@/components/auth/BrowserQuickLoginCard';
import SignupVerifySheet from '@/components/auth/SignupVerifySheet';
import PhoneVerifyBox from '@/components/auth/PhoneVerifyBox';
import { useLogin2FA } from '@/hooks/useLogin2FA';
import Login2FAVerification from '@/components/auth/Login2FAVerification';
import PasswordReset2FAFlow from '@/components/auth/PasswordReset2FAFlow';
import { UnifiedNotificationService } from '@/services/UnifiedNotificationService';
import { usePasskeySupport } from '@/hooks/usePasskeySupport';
import { signInWithNativePasskey, describePasskeyError, isPasskeyServerUnavailable, isPasskeyDomainMismatch, getPasskeyDomainMessage } from '@/lib/nativePasskey';
import OAuthProviderButtons from '@/components/auth/OAuthProviderButtons';
import { getCurrentOrigin } from '@/config/domainConfig';
import TrustMarquee from '@/components/auth/TrustMarquee';
import { useTrustSeekers } from '@/hooks/useTrustSeekers';
import BrandSocialBar from '@/components/BrandSocialBar';
import { normalizePhoneE164 } from '@/hooks/usePhoneOtpLogin';
import { TransparentLogoImage } from '@/components/TransparentLogoImage';
import ConfirmEmailScreen from '@/components/auth/ConfirmEmailScreen';

const hiringVideo = 'https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-india-hiring-solved-30s.mp4';
const hiringVideoPoster = 'https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/employee-introduction.jpg';



const EmployerAuth = ({ forgotPasswordPage = false, signupPage = false }: { forgotPasswordPage?: boolean; signupPage?: boolean }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { signIn, signUp, signInWithGoogle, signInWithLinkedIn, signInWithTwitter, signInWithGitHub, signInWithGitLab, resetPassword, user, company, loading, companyLoading, checkCompanyCompletion } = useEmployerAuth();
  const { createReferralRelationship } = useReferralSystem();
  const { isSupported: isPasskeySupported, isLoading: isPasskeySupportLoading } = usePasskeySupport();
  const { quickLogin, loading: quickLoginLoading } = useQuickLogin('employer');
  const { recognized: recognizedAccount } = useDeviceRecognition('employer');
  const handleQuickLogin = async () => {
    const result = await quickLogin();
    if (result.ok === true) {
      toast({ title: 'Welcome back!', description: `Logged in as ${result.email}` });
      return;
    }
    const reason: 'not_found' | 'error' = result.reason;
    const message: string = result.message;
    toast({
      variant: 'destructive',
      title: reason === 'not_found' ? 'No Account Found' : 'Quick Login Failed',
      description: message,
    });
  };
  const { data: authImages, isLoading: isAuthImagesLoading } = useAuthImages();
  const { data: trustSeekers } = useTrustSeekers();

  
  const activeTab = signupPage ? 'signup' : 'login';
  const accountPath = (mode: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete('tab');
    params.delete('type');
    params.set('mode', mode);
    return `${mode === 'signup' ? '/employer-signup' : '/employer-auth'}?${params.toString()}`;
  };
  const setActiveTab = (mode: string) => navigate(accountPath(mode));
  useEffect(() => {
    if (!forgotPasswordPage && !signupPage && (
      searchParams.get('tab') === 'signup' || searchParams.get('mode') === 'signup' ||
      (searchParams.has('ref') && searchParams.get('mode') !== 'login')
    )) {
      const params = new URLSearchParams(searchParams);
      params.delete('tab');
      params.set('mode', 'signup');
      navigate(`/employer-signup?${params.toString()}`, { replace: true });
    }
  }, [forgotPasswordPage, signupPage, searchParams, navigate]);
  // Set only when Supabase "Confirm email" is ON and a new account was created.
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employerAvatarError, setEmployerAvatarError] = useState(false);
  
  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginEmailError, setLoginEmailError] = useState('');
  const [loginPasswordError, setLoginPasswordError] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  // Call these on every render, including signup confirmation and login redirects.
  const [loginCountry, setLoginCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [loginCountryOpen, setLoginCountryOpen] = useState(false);
  
  // 2FA State
  const { check2FABeforeLogin, isChecking: is2FAChecking } = useLogin2FA({ userType: 'employer' });
  const { data: turnstileCfg } = useTurnstileConfig();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [signupTurnstileToken, setSignupTurnstileToken] = useState<string | null>(null);
  const signupTurnstileRef = useRef<TurnstileHandle>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pending2FAData, setPending2FAData] = useState<{
    userId: string;
    telegramConnected: boolean;
    twoFactorMethod: 'telegram' | 'google_authenticator' | 'passkey' | 'push_otp' | 'email_otp' | null;
    totpEnabled: boolean;
    passkeyEnabled: boolean;
    pushOtpEnabled: boolean;
    emailOtpEnabled: boolean;
  } | null>(null);
  
  // Signup state
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [referralData, setReferralData] = useState<{referrerId?: string; companyName?: string} | null>(null);
  const [referralCodeFromUrl, setReferralCodeFromUrl] = useState('');
  
  // WhatsApp validation hook
  const { 
    whatsappNumber, 
    setWhatsappNumber, 
    isChecking: isCheckingWhatsApp, 
    isAvailable: isWhatsAppAvailable, 
    error: whatsAppError,
    isDuplicate: isWhatsAppDuplicate,
    resetValidation: resetWhatsAppValidation,
    getFormattedNumber
  } = useWhatsAppValidation('employer');

  // OTP verification check
  const { isActive: isOTPRequired, isLoading: isOTPCheckLoading } = useSignupOTPCheck('company_signup_otp');
  const [isWhatsAppOTPVerified, setIsWhatsAppOTPVerified] = useState(false);
  const [verifySheetOpen, setVerifySheetOpen] = useState(false);

  // Owner-controlled SMS phone verification
  const { phoneVerifyEnabled } = usePhoneVerifySetting('phone_verify_employer_signup');
  const emailOtpEnabled = useSignupEmailOtpSetting('employer');
  const [emailOtpVerifiedFor, setEmailOtpVerifiedFor] = useState('');
  const [smsVerifiedFor, setSmsVerifiedFor] = useState('');
  const isPhoneSmsVerified = smsVerifiedFor !== '' && smsVerifiedFor === normalizePhoneE164(whatsappNumber || '');
  const SIGNUP_DRAFT_KEY = 'workly_employer_signup_draft';


  // Email validation hook
  const {
    email: signupEmail,
    setEmail: setSignupEmail,
    isChecking: isCheckingEmail,
    isAvailable: isEmailAvailable,
    error: emailError,
    isDuplicate: isEmailDuplicate,
    verifyAvailabilityNow: verifyEmailAvailabilityNow,
  } = useEmailValidation('employer');
  const isEmailOtpVerified = emailOtpVerifiedFor !== '' && emailOtpVerifiedFor === signupEmail.trim().toLowerCase();

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(SIGNUP_DRAFT_KEY) || 'null');
      if (!draft) return;
      if (draft.email) setSignupEmail(draft.email);
      if (draft.companyName) setCompanyName(draft.companyName);
      if (draft.whatsappNumber) setWhatsappNumber(draft.whatsappNumber);
      if (draft.phone && normalizePhoneE164(draft.phone) === normalizePhoneE164(draft.whatsappNumber || '')) {
        if (draft.phoneVerified === true) setSmsVerifiedFor(normalizePhoneE164(draft.phone));
      }
    } catch { /* ignore unavailable draft storage */ }
  }, [setSignupEmail, setWhatsappNumber]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({
        email: signupEmail,
        companyName,
        whatsappNumber,
        phone: getFormattedNumber(),
        phoneVerified: isPhoneSmsVerified,
      }));
    } catch { /* ignore unavailable draft storage */ }
  }, [signupEmail, companyName, whatsappNumber, isPhoneSmsVerified, getFormattedNumber]);

  // Login email validation hook
  const {
    setEmail: setLoginEmailValidation,
    isChecking: isCheckingLoginEmail,
    exists: loginEmailExists,
    error: loginEmailValidationError,
    isValid: isLoginEmailValid,
    notRegistered: isLoginEmailNotRegistered,
  } = useLoginEmailValidation('employer');
  
  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  // 2FA Password Reset state
  const [isChecking2FA, setIsChecking2FA] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [reset2FAData, setReset2FAData] = useState<{
    userId: string;
    telegramConnected: boolean;
    totpEnabled: boolean;
    passkeyEnabled: boolean;
    pushOtpEnabled: boolean;
  } | null>(null);
  const [showReset2FAModal, setShowReset2FAModal] = useState(false);
  useEffect(() => {
    setResetEmailSent(false);
    setForgotEmail('');
    setHas2FA(false);
    setReset2FAData(null);
    setShowReset2FAModal(false);
  }, [forgotPasswordPage]);

  // Check if this is a password recovery flow with access token
  const isPasswordRecovery = searchParams.get('type') === 'recovery' && 
    (window.location.hash.includes('access_token') || searchParams.get('access_token'));

  // Reset OTP verification when WhatsApp number changes
  useEffect(() => {
    setIsWhatsAppOTPVerified(false);
  }, [whatsappNumber]);

  // OAuth ban error — shown as full inline red banner
  const [oauthBanError, setOauthBanError] = useState<string | null>(null);

  // Check for OAuth error in URL hash (e.g., banned user redirect)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDescription = params.get('error_description') || params.get('error');
      if (errorDescription) {
        const lower = errorDescription.toLowerCase();
        if (lower.includes('banned') || lower.includes('suspended') || lower.includes('user is banned')) {
          setOauthBanError("Account suspended. You cannot log in. Contact support.");
        } else {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: decodeURIComponent(errorDescription),
          });
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [toast]);

  useEffect(() => {
    // Check for referral code in URL
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCodeFromUrl(refParam);
      savePendingReferralCode(refParam);
    }
  }, [searchParams]);

  useEffect(() => {
    // Wait for both auth and company loading to complete before redirecting
    if (user && !loading && !companyLoading && !forgotPasswordPage && !isPasswordRecovery) {
      // Referral relationship is created globally by <PendingReferralApplier />.
      
      
      // Set employer auto-redirect flag in localStorage
      localStorage.setItem('employerAutoRedirect', 'true');
      
      const redirectUrlParam = searchParams.get('redirect');
      if (redirectUrlParam) {
        navigate(decodeURIComponent(redirectUrlParam), { replace: true });
      } else {
        // Check if profile is complete before redirecting
        const isProfileComplete = checkCompanyCompletion();
        console.log('🔄 Login redirect check - Profile complete:', isProfileComplete);
        
        if (isProfileComplete) {
          navigate('/employer-portal', { replace: true });
        } else {
          navigate('/Employer/Setup', { replace: true });
        }
      }
    }
  }, [user, loading, companyLoading, company, navigate, searchParams, referralData, referralCodeFromUrl, createReferralRelationship, checkCompanyCompletion, forgotPasswordPage, isPasswordRecovery]);

  // Keep this hook above the authenticated-user return so every render calls
  // the same hooks in the same order during the login state transition.
  const performSignUp = useCallback(async () => {
    setIsLoading(true);
    
    
    try {
      // Authoritative server-side check right before creating the account
      const availability = await verifyEmailAvailabilityNow(signupEmail);
      if (availability === false) {
        toast({
          variant: "destructive",
          title: "Email already registered",
          description: "This email is already registered. Please log in instead."
        });
        setIsLoading(false);
        return;
      }
      if (availability === null) {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: "Could not verify this email right now. Please try again."
        });
        setIsLoading(false);
        return;
      }

      const { error, needsEmailConfirmation } = await signUp(signupEmail, signupPassword, companyName, getFormattedNumber(), undefined, isPhoneSmsVerified || isWhatsAppOTPVerified || (() => { try { const d = JSON.parse(sessionStorage.getItem(SIGNUP_DRAFT_KEY) || '{}'); return d.phoneVerified === true && normalizePhoneE164(d.phone || '') === normalizePhoneE164(getFormattedNumber()); } catch { return false; } })());
      
      
      if (error) {
        const errorMessage = handleAuthError(error);
        toast({
          variant: errorMessage.variant,
          title: errorMessage.title,
          description: errorMessage.description
        });
      } else {
        try { sessionStorage.removeItem(SIGNUP_DRAFT_KEY); } catch { /* ignore */ }
        if (needsEmailConfirmation) {
          // Email confirmation is ON → show the dedicated verify screen
          setConfirmEmailFor(signupEmail);
        } else {
          toast({
            title: "Success",
            description: "Company account created! You are signed in."
          });
        }
      }
    } catch (err) {
      const errorMessage = handleAuthError(err);
      toast({
        variant: errorMessage.variant,
        title: errorMessage.title,
        description: errorMessage.description
      });
    }
    
    setIsLoading(false);
  }, [signupEmail, signupPassword, companyName, isPhoneSmsVerified, isWhatsAppOTPVerified, verifyEmailAvailabilityNow, signUp, getFormattedNumber, toast]);

  // Shown only when Supabase email confirmation is ON after a fresh signup
  if (confirmEmailFor) {
    return (
      <ConfirmEmailScreen
        email={confirmEmailFor}
        onBack={() => {
          setConfirmEmailFor(null);
          setActiveTab('login');
        }}
      />
    );
  }


  // Don't render the auth form if user is already logged in
  if (user && !loading && !companyLoading && !forgotPasswordPage && !isPasswordRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginEmailError('');
    setLoginPasswordError('');

    // Client-side validation (clean up autofill/paste artifacts first)
    const cleanEmail = sanitizeIdentifier(loginEmail);
    if (cleanEmail !== loginEmail) setLoginEmail(cleanEmail);
    if (!cleanEmail) {
      setLoginEmailError('Please enter your email or mobile number');
      return;
    }

    const isPhone = looksLikePhoneInput(cleanEmail) ? isPhoneIdentifier(loginLookupValue(cleanEmail, loginCountry)) : isPhoneIdentifier(cleanEmail);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!isPhone && !emailRegex.test(cleanEmail)) {
      setLoginEmailError('Please enter a valid email address or mobile number');
      return;
    }

    // Phone login: combine the typed digits with the picked country code so
    // accounts from any country can sign in.
    const loginIdentifierValue = isPhone || looksLikePhoneInput(cleanEmail) ? loginLookupValue(cleanEmail, loginCountry) : cleanEmail;
    
    if (!loginPassword) {
      setLoginPasswordError('Please enter your password');
      return;
    }
    
    if (turnstileCfg?.enabled) {
      if (!turnstileToken) { setLoginPasswordError('Please complete the security check'); return; }
      setIsLoading(true);
      const passed = await verifyTurnstile(turnstileToken);
      turnstileRef.current?.reset();
      if (!passed) { setLoginPasswordError('Security check failed. Please try again.'); setIsLoading(false); return; }
    }
    setIsLoading(true);
    
    try {
      // Check if 2FA is required before login
      const twoFAResult = isPhone
        ? { required: false } as any
        : await check2FABeforeLogin(cleanEmail);
      
      if (twoFAResult.required && twoFAResult.userId) {
        // 2FA is required - show OTP modal
        setPending2FAData({
          userId: twoFAResult.userId,
          telegramConnected: twoFAResult.telegramConnected,
          twoFactorMethod: twoFAResult.twoFactorMethod,
          totpEnabled: twoFAResult.totpEnabled,
          passkeyEnabled: twoFAResult.passkeyEnabled,
          pushOtpEnabled: twoFAResult.pushOtpEnabled,
          emailOtpEnabled: twoFAResult.emailOtpEnabled
        });
        setShow2FAModal(true);
        setIsLoading(false);
        return;
      }
      
      // No 2FA required - proceed with direct login
      const { error } = await signIn(loginIdentifierValue, loginPassword);
      
      if (error) {
        const errMsg = error.message?.toLowerCase() || '';
        if (errMsg.includes('banned') || errMsg.includes('user is banned') || errMsg.includes('banned_until')) {
          toast({
            variant: "destructive",
            title: "Account Suspended",
            description: "Your account has been suspended by the administrator. You cannot log in at this time. Please contact support via the Contact Us page.",
          });
          setLoginPasswordError('Your account has been suspended. Please contact support.');
        } else {
          setLoginPasswordError('The password you entered is incorrect. Please check and try again.');
        }
      } else {
        toast({
          title: "Success",
          description: "Successfully logged in!"
        });
      }
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || '';
      if (errMsg.includes('banned') || errMsg.includes('user is banned') || errMsg.includes('banned_until')) {
        toast({
          variant: "destructive",
          title: "Account Suspended",
          description: "Your account has been suspended by the administrator. You cannot log in at this time. Please contact support via the Contact Us page.",
        });
        setLoginPasswordError('Your account has been suspended. Please contact support.');
      } else {
        setLoginPasswordError('The password you entered is incorrect. Please check and try again.');
      }
    }
    
    setIsLoading(false);
  };

  // Handle 2FA verification success - complete the login
  const handle2FAVerified = async () => {
    setShow2FAModal(false);
    setIsLoading(true);
    
    try {
      const { error } = await signIn(loginEmail, loginPassword);
      
      if (error) {
        const errMsg = error.message?.toLowerCase() || '';
        if (errMsg.includes('banned') || errMsg.includes('user is banned') || errMsg.includes('banned_until')) {
          toast({
            variant: "destructive",
            title: "Account Suspended",
            description: "Your account has been suspended by the administrator. You cannot log in at this time. Please contact support via the Contact Us page.",
          });
          setLoginPasswordError('Your account has been suspended. Please contact support.');
        } else {
          setLoginPasswordError('The password you entered is incorrect. Please check and try again.');
        }
      } else {
        toast({
          title: "Success",
          description: "Successfully logged in!"
        });
      }
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || '';
      if (errMsg.includes('banned') || errMsg.includes('user is banned') || errMsg.includes('banned_until')) {
        toast({
          variant: "destructive",
          title: "Account Suspended",
          description: "Your account has been suspended by the administrator. You cannot log in at this time. Please contact support via the Contact Us page.",
        });
        setLoginPasswordError('Your account has been suspended. Please contact support.');
      } else {
        setLoginPasswordError('Login failed. Please try again.');
      }
    }
    
    setIsLoading(false);
    setPending2FAData(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Email check still running — don't let the form submit on a stale badge
    if (isCheckingEmail) {
      toast({
        variant: "destructive",
        title: "Please wait",
        description: "Verifying email address..."
      });
      return;
    }

    // Check if email is duplicate
    if (isEmailDuplicate) {
      toast({
        variant: "destructive",
        title: "Form Error",
        description: emailError || "This email is already registered"
      });
      return;
    }
    
    
    // Check if WhatsApp number is duplicate
    if (isWhatsAppDuplicate) {
      toast({
        variant: "destructive",
        title: "Form Error",
        description: whatsAppError || "This number is already registered"
      });
      return;
    }

    // Client-side validation with company name and mobile number validation
    const validationErrors = validateSignupForm(signupEmail, signupPassword, confirmPassword, companyName, whatsappNumber);
    if (validationErrors.length > 0) {
      toast({
        variant: "destructive",
        title: "Form Error",
        description: validationErrors[0]
      });
      return;
    }
    
    if (!companyName.trim()) {
      toast({
        variant: "destructive",
        title: "Form Error",
        description: "Company name is required"
      });
      return;
    }

    if (turnstileCfg?.enabled) {
      if (!signupTurnstileToken) {
        toast({ variant: "destructive", title: "Security check", description: "Please complete the security check" });
        return;
      }
      const passed = await verifyTurnstile(signupTurnstileToken);
      signupTurnstileRef.current?.reset();
      if (!passed) {
        toast({ variant: "destructive", title: "Security check failed", description: "Please try again" });
        return;
      }
    }

    // Verification ON → slide the OTP sheet up instead of blocking the button
    const needsWhatsAppOtp = isOTPRequired && !isOTPCheckLoading && !isWhatsAppOTPVerified;
    const needsSmsOtp = phoneVerifyEnabled && !isPhoneSmsVerified;
    const needsEmailOtp = emailOtpEnabled && !isEmailOtpVerified;
    if (needsSmsOtp && !needsEmailOtp && !needsWhatsAppOtp) {
      toast({ variant: "destructive", title: "Verify number", description: "Please verify your mobile number with OTP first" });
      return;
    }
    if (needsEmailOtp || needsWhatsAppOtp) {
      setVerifySheetOpen(true);
      return;
    }

    await performSignUp();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    const validationErrors = validateForgotPasswordForm(forgotEmail);
    if (validationErrors.length > 0) {
      toast({
        variant: "destructive",
        title: "Form Error",
        description: validationErrors[0]
      });
      return;
    }
    
    setIsChecking2FA(true);
    
    try {
      // First check if 2FA is enabled for this email
      const { data: twoFAData, error: twoFAError } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'check-login', email: forgotEmail, userType: 'employer' }
      });

      if (!twoFAError && twoFAData?.required && twoFAData?.userId) {
        // 2FA is enabled - show options
        setHas2FA(true);
        setReset2FAData({
          userId: twoFAData.userId,
          telegramConnected: twoFAData.telegramConnected || false,
          totpEnabled: twoFAData.totpEnabled || false,
          passkeyEnabled: twoFAData.passkeyEnabled || false,
          pushOtpEnabled: twoFAData.pushOtpEnabled || false,
        });
        setIsChecking2FA(false);
        return;
      }

      // No 2FA - proceed with email reset
      setIsLoading(true);
      const { error } = await resetPassword(forgotEmail);
      
      if (error) {
        const errorMessage = handleAuthError(error);
        toast({
          variant: errorMessage.variant,
          title: errorMessage.title,
          description: errorMessage.description
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: "Success",
          description: "If this email is registered, a reset link has been sent. Please check your inbox."
        });
      }
    } catch (err) {
      const errorMessage = handleAuthError(err);
      toast({
        variant: errorMessage.variant,
        title: errorMessage.title,
        description: errorMessage.description
      });
    }
    
    setIsChecking2FA(false);
    setIsLoading(false);
  };

  const handleReset2FA = () => {
    setShowReset2FAModal(true);
  };

  const handleResetViaEmail = async () => {
    setHas2FA(false);
    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(forgotEmail);
      
      if (error) {
        const errorMessage = handleAuthError(error);
        toast({
          variant: errorMessage.variant,
          title: errorMessage.title,
          description: errorMessage.description
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: "Success",
          description: "If this email is registered, a reset link has been sent. Please check your inbox."
        });
      }
    } catch (err) {
      const errorMessage = handleAuthError(err);
      toast({
        variant: errorMessage.variant,
        title: errorMessage.title,
        description: errorMessage.description
      });
    }
    
    setIsLoading(false);
  };

  const openInNewTab = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  
  const handleOpenMailApp = () => {
    const email = forgotEmail?.trim().toLowerCase() || '';
    const domain = email.split('@')[1] || '';
    
    if (domain.includes('gmail')) return openInNewTab('https://mail.google.com/mail/u/0/#inbox');
    if (domain.includes('outlook') || domain.includes('live') || domain.includes('hotmail') || domain.includes('office'))
      return openInNewTab('https://outlook.live.com/mail/0/inbox');
    if (domain.includes('yahoo')) return openInNewTab('https://mail.yahoo.com/d/folders/1');
    
    return openInNewTab('https://mail.google.com');
  };

  const handleResendResetEmail = async () => {
    setResetEmailSent(false);
    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(forgotEmail);
      
      if (!error) {
        toast({
          title: "Success",
          description: "Reset email resent successfully!"
        });
        setResetEmailSent(true);
      }
    } catch (err) {
      const errorMessage = handleAuthError(err);
      toast({
        variant: errorMessage.variant,
        title: errorMessage.title,
        description: errorMessage.description
      });
    }
    
    setIsLoading(false);
  };

  const oauthSignIn = async (
    fn: () => Promise<{ error: any }>,
    label: string
  ) => {
    setIsLoading(true);
    const { error } = await fn();
    if (error) {
      toast({
        variant: "destructive",
        title: `${label} Sign-In Failed`,
        description: error.message || `Unable to sign in with ${label}. Please try again.`
      });
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => oauthSignIn(signInWithGoogle, 'Google');
  const handleLinkedInSignIn = () => oauthSignIn(signInWithLinkedIn, 'LinkedIn');
  const handleTwitterSignIn = () => oauthSignIn(signInWithTwitter, 'X');
  const handleGitHubSignIn = () => oauthSignIn(signInWithGitHub, 'GitHub');
  const handleGitLabSignIn = () => oauthSignIn(signInWithGitLab, 'GitLab');

  const handlePasskeyLogin = async () => {
    setIsLoading(true);
    setLoginEmailError('');
    setLoginPasswordError('');

    try {
      // Native Supabase passkey sign-in (full WebAuthn ceremony + session)
      await signInWithNativePasskey();

      toast({
        title: "✅ Welcome!",
        description: "Logged in successfully with passkey",
      });

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        navigate(decodeURIComponent(redirectUrl), { replace: true });
      } else {
        navigate('/employer-portal', { replace: true });
      }
    } catch (err: any) {
      console.error('Passkey login error:', err);

      if (isPasskeyDomainMismatch()) {
        toast({
          variant: "destructive",
          title: "Passkey Not Available Here",
          description: getPasskeyDomainMessage(),
        });
      } else if (isPasskeyServerUnavailable(err)) {
        toast({
          variant: "destructive",
          title: "Passkeys Unavailable",
          description: "Passkey sign-in is temporarily unavailable. Please login with email/password.",
        });

      } else if (err?.name === 'NotAllowedError') {
        toast({
          title: "Cancelled",
          description: "Passkey authentication was cancelled or timed out",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Passkey Login Failed",
          description: describePasskeyError(err, "Unable to login with passkey. Please try email/password."),
        });
      }
    }

    setIsLoading(false);
  };


  const handleRetry = () => {
    setLoginEmailError('');
    setLoginPasswordError('');
    // Reset form states
    if (activeTab === 'login') {
      setLoginEmail('');
      setLoginPassword('');
    } else if (activeTab === 'signup') {
      setSignupEmail('');
      setSignupPassword('');
      setConfirmPassword('');
      setCompanyName('');
      resetWhatsAppValidation();
      setIsWhatsAppOTPVerified(false);
    } else {
      setForgotEmail('');
    }
  };


  if (loading || companyLoading) {
    return null;
  }

  if (forgotPasswordPage) {
    return (
      <PasswordRecoveryPage audience="employer">
                <div className="space-y-4">
                  {!resetEmailSent && !has2FA ? (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input
                            id="forgot-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="Enter your email"
                            value={forgotEmail}
                            onChange={(e) => {
                              setForgotEmail(e.target.value);
                              setHas2FA(false);
                              setReset2FAData(null);
                            }}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      
                      <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary" disabled={isLoading || isChecking2FA}>
                        {isChecking2FA ? "Checking..." : isLoading ? "Sending..." : "Continue"}
                      </Button>
                    </form>
                  ) : has2FA && reset2FAData ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                        <div className="mb-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Lock className="w-6 h-6 text-blue-600" />
                          </div>
                          <h3 className="font-semibold text-blue-900 mb-1">
                            2FA Enabled
                          </h3>
                          <p className="text-sm text-blue-700 mb-1">
                            Your account has Two-Factor Authentication enabled. You can reset your password using 2FA or via email.
                          </p>
                        </div>
                      </div>

                      <Button 
                        onClick={handleReset2FA}
                        className="w-full bg-gradient-to-r from-primary to-secondary"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Reset via 2FA
                      </Button>

                      <Button 
                        onClick={handleResetViaEmail}
                        variant="outline"
                        className="w-full"
                        disabled={isLoading}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {isLoading ? "Sending..." : "Send Reset Email Instead"}
                      </Button>

                      <Button 
                        onClick={() => {
                          setHas2FA(false);
                          setReset2FAData(null);
                        }}
                        variant="ghost"
                        className="w-full text-sm"
                      >
                        ← Change Email
                      </Button>
                    </div>
                  ) : resetEmailSent ? (
                    <RecoveryOtpVerify email={forgotEmail} loginPath="/employer-auth" resending={isLoading} onResend={handleResendResetEmail} onChangeEmail={() => setResetEmailSent(false)} />
                  ) : null}
                  

                </div>
      {/* 2FA Password Reset Modal */}
      {reset2FAData && (
        <PasswordReset2FAFlow
          open={showReset2FAModal}
          onClose={() => {
            setShowReset2FAModal(false);
          }}
          userId={reset2FAData.userId}
          userEmail={forgotEmail}
          userType="employer"
          telegramConnected={reset2FAData.telegramConnected}
          totpEnabled={reset2FAData.totpEnabled}
          passkeyEnabled={reset2FAData.passkeyEnabled}
          pushOtpEnabled={reset2FAData.pushOtpEnabled}
        />
      )}
      </PasswordRecoveryPage>
    );
  }

  // Show password reset form if user clicked link from email
  if (isPasswordRecovery) {
    return <PasswordResetForm isEmployer={true} />;
  }

  if (signupPage) {
    return (
      <SignupPage audience="employer">
                <div className="space-y-4">
                  {/* Google & LinkedIn Sign-Up Buttons */}
                  <div className="space-y-2">
                    <OAuthProviderButtons
                      onGoogle={handleGoogleSignIn}
                      onLinkedIn={handleLinkedInSignIn}
                      onTwitter={handleTwitterSignIn}
                      onGitHub={handleGitHubSignIn}
                      onGitLab={handleGitLabSignIn}
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or sign up with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleSignUp} method="post" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="company-name"
                          name="organization"
                          type="text"
                          autoComplete="organization"
                          placeholder="Enter your company name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="flex items-center gap-2">
                        Business Email
                        {!isCheckingEmail && isEmailAvailable && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            <Check className="w-3 h-3" />
                            Available
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="signup-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="Enter your business email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className={`pl-10 pr-10 ${isEmailDuplicate ? 'border-destructive focus-visible:ring-destructive' : isEmailAvailable ? 'border-green-500 focus-visible:ring-green-500' : ''}`}
                          required
                        />
                        {isCheckingEmail && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        {!isCheckingEmail && isEmailAvailable && (
                          <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                        {!isCheckingEmail && isEmailDuplicate && (
                          <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-destructive" />
                        )}
                      </div>
                      {emailError && (
                        <p className="text-xs text-destructive truncate">{emailError}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp-number" className="flex items-center gap-2">
                        Number
                        {(isWhatsAppOTPVerified || (phoneVerifyEnabled && isPhoneSmsVerified)) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <PhoneInput
                          id="whatsapp-number"
                          value={whatsappNumber}
                          disabled={isPhoneSmsVerified || isWhatsAppOTPVerified}
                          onChange={(v) => { if (!(isPhoneSmsVerified || isWhatsAppOTPVerified)) setWhatsappNumber(v); }}
                          className={isWhatsAppDuplicate ? '[&_input]:border-destructive' : isWhatsAppAvailable ? '[&_input]:border-green-500' : ''}
                        />
                        {isCheckingWhatsApp && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        {!isCheckingWhatsApp && isWhatsAppAvailable && (
                          <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                        {!isCheckingWhatsApp && isWhatsAppDuplicate && (
                          <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-destructive" />
                        )}
                      </div>
                      {whatsAppError && (
                        <p className="text-xs text-destructive truncate">{whatsAppError}</p>
                      )}
                      
                      {/* Number Verify ON: verify the number right here (code on WhatsApp).
                          The bottom sheet still opens on submit if it isn't done yet. */}
                      {phoneVerifyEnabled && !isPhoneSmsVerified && isWhatsAppAvailable && !isWhatsAppDuplicate && !verifySheetOpen && (
                        <PhoneVerifyBox
                          phone={getFormattedNumber()}
                          mode="signup"
                          verified={false}
                          autoSend={false}
                          onVerified={(verifiedPhone) => {
                            setSmsVerifiedFor(normalizePhoneE164(verifiedPhone));
                            try {
                              const draft = JSON.parse(sessionStorage.getItem(SIGNUP_DRAFT_KEY) || '{}');
                              sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ ...draft, phone: verifiedPhone, phoneVerified: true }));
                            } catch { /* ignore */ }
                          }}
                        />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="signup-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Create a password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="confirm-password"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <ReferralCodeInput 
                      onValidCode={(referrerId, companyName) => {
                        setReferralData({ referrerId, companyName });
                      }}
                      className="mt-4"
                    />

                    {/* Terms and Privacy Agreement */}
                    <div className="text-xs text-muted-foreground text-center py-3">
                      By continuing, you agree to the{" "}
                      <Link to="/terms-conditions" className="text-auth-link hover:text-auth-link/80 underline font-medium">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy" className="text-auth-link hover:text-auth-link/80 underline font-medium">
                        Privacy Policy
                      </Link>
                    </div>
                    
                    {turnstileCfg?.enabled && turnstileCfg.siteKey && (
                      <TurnstileWidget ref={signupTurnstileRef} siteKey={turnstileCfg.siteKey} onToken={setSignupTurnstileToken} />
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-secondary"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating Account..." : "Create Company Account"}
                    </Button>
                  </form>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Button asChild variant="link" className="h-auto p-0 text-auth-link"><Link to={accountPath('login')}>Log in</Link></Button>
                  </p>

                  <SignupVerifySheet
                    open={verifySheetOpen}
                    onOpenChange={setVerifySheetOpen}
              needEmail={emailOtpEnabled}
              emailVerified={isEmailOtpVerified}
              email={signupEmail.trim().toLowerCase()}
              emailPage="employer"
              onEmailVerified={() => setEmailOtpVerifiedFor(signupEmail.trim().toLowerCase())}
                    phone={getFormattedNumber()}
                    name={companyName}
                    needWhatsApp={isOTPRequired && !isOTPCheckLoading}
                    whatsAppVerified={isWhatsAppOTPVerified}
                    whatsAppPurpose="company_signup_otp"
                    onWhatsAppVerified={() => setIsWhatsAppOTPVerified(true)}
                    needSms={phoneVerifyEnabled}
                    smsVerified={isPhoneSmsVerified}
                    onSmsVerified={(verifiedPhone) => {
                      setSmsVerifiedFor(normalizePhoneE164(verifiedPhone));
                      try {
                        const draft = JSON.parse(sessionStorage.getItem(SIGNUP_DRAFT_KEY) || '{}');
                        sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ ...draft, phone: verifiedPhone, phoneVerified: true }));
                      } catch { /* ignore */ }
                    }}
                    onAllVerified={() => { void performSignUp(); }}
                  />
                  

                </div>
      </SignupPage>
    );
  }

  return (
    <div className="auth-page min-h-screen flex flex-col bg-white dark:bg-background">
      <LoginNotificationPermission />
      <SEO 

        title="Post Jobs Free India | Employer Login | Hire remote professionals 2026"
        description="Free job posting for employers in India. Post remote jobs, hire remote employees, reach 75,000+ verified candidates. No registration fees. Start hiring today on India's #1 Remote job portal!"
        keywords="post jobs free india, employer login, hire remote professionals india, job posting sites india, free job posting, hire employees online, recruitment platform india, Workly India hiring, remote hiring india 2026"
        canonical={signupPage ? "/employer-signup" : "/employer-auth"}
        noindex={false}
      />
      <EmployerJobPostingSchema />
      <div className="auth-page-content flex-1 flex flex-col items-center justify-center px-1 py-0 lg:px-8 lg:py-10">
        <div className="auth-page-width w-full max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]">
          <Card className="auth-card relative shadow-lg shadow-black/10 border-0 bg-card/80 backdrop-blur-sm">
            {/* Home shortcut sits in the card's empty top-left corner — absolute
                so it never adds a row above the logo. */}
            <Link
              to="/"
              aria-label="Go to home page"
              title="Home"
              className="absolute left-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
            >
              <Home className="h-[18px] w-[18px]" />
            </Link>
            <CardHeader className="space-y-1 text-center">
              {/* Spacing */}
              
              <div className="mx-auto w-28 h-28 overflow-hidden mb-4 animate-scale-in flex items-center justify-center">
                {(() => {
                  const supabaseUrl = normalizeImageUrl(authImages?.employer_avatar);
                  // Only show Supabase-hosted logo. While loading / missing /
                  // failed, show a loading spinner instead of a different fallback logo.
                  if (isAuthImagesLoading || !supabaseUrl || employerAvatarError) {
                     return (
                       <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-primary/60 animate-spin" />
                      </div>
                    );
                  }
                  return (
                    <TransparentLogoImage
                      loading="eager"
                      src={supabaseUrl}
                      alt="Employer"
                      className="w-full h-full object-contain"
                      onError={() => setEmployerAvatarError(true)}
                    />
                  );
                })()}
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Employer Portal
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Access your hiring dashboard and manage job postings
              </CardDescription>
            </CardHeader>
            
            {/* Full-width red ban error banner */}
            {oauthBanError && (
              <div className="px-6 pt-2">
                <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <AlertTitle className="text-destructive font-bold text-base">Account Suspended</AlertTitle>
                      <AlertDescription className="text-destructive/90 mt-1">{oauthBanError}</AlertDescription>
                    </div>
                    <button onClick={() => setOauthBanError(null)} className="ml-3 text-destructive hover:text-destructive/70 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </Alert>
              </div>
            )}

              <CardContent>
              

                {!signupPage && <div className="space-y-4">
                  {/* Google & Passkey Login Buttons */}
                  <div className="space-y-2">
                    <OAuthProviderButtons
                      onGoogle={handleGoogleSignIn}
                      onLinkedIn={handleLinkedInSignIn}
                      onTwitter={handleTwitterSignIn}
                      onGitHub={handleGitHubSignIn}
                      onGitLab={handleGitLabSignIn}
                      disabled={isLoading}
                    />
                    {isPasskeySupported && !isPasskeySupportLoading && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full h-9 text-xs" 
                        onClick={handlePasskeyLogin}
                        disabled={isLoading}
                      >
                        <Fingerprint className="w-4 h-4 mr-2 text-purple-600" />
                        Passkey
                      </Button>
                    )}
                    <BrowserQuickLoginCard userType="employer" />

                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">Or continue with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} method="post" action="/employer-auth" className="space-y-4" autoComplete="on">
                    {/* Hidden field for password manager credential association */}
                    <input 
                      type="hidden" 
                      name="username" 
                      autoComplete="username" 
                      value={loginEmail} 
                    />
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="flex items-center gap-2">
                        Email or Mobile
                        {isCheckingLoginEmail && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Checking...
                          </span>
                        )}
                        {!isCheckingLoginEmail && isLoginEmailValid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            <Check className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        {looksLikePhoneInput(loginEmail) ? (
                          <button
                            type="button"
                            aria-label="Select country code"
                            onClick={() => setLoginCountryOpen(true)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 whitespace-nowrap text-sm font-medium"
                          >
                            <span>{loginCountry.flag}</span>
                            <span>+{loginCountry.dial}</span>
                          </button>
                        ) : (
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        )}
                        <Input
                          id="login-email"
                          name="email"
                          type="text"
                          inputMode={looksLikePhoneInput(loginEmail) ? 'tel' : 'text'}
                          autoComplete="username webauthn"
                          placeholder="Email or mobile number"
                          value={loginEmail}
                          onChange={(e) => {
                            const value = nextLoginIdentifier(loginEmail, sanitizeIdentifier(e.target.value), loginCountry);
                            setLoginEmail(value);
                            setLoginEmailError('');
                            const isPh = looksLikePhoneInput(value);
                            setLoginEmailValidation(isPh && !isCompleteNationalPhone(loginCountry.code, loginCountry.dial, value) ? '' : loginLookupValue(value, loginCountry));
                          }}
                          className={`${looksLikePhoneInput(loginEmail) ? 'pl-[4.75rem]' : 'pl-10'} pr-10 ${loginEmailError || isLoginEmailNotRegistered ? 'border-red-500' : isLoginEmailValid ? 'border-green-500' : ''}`}
                          required
                        />
                        {isCheckingLoginEmail && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                        )}
                        {!isCheckingLoginEmail && isLoginEmailValid && (
                          <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {loginEmailError && (
                        <p className="text-xs text-red-500 truncate">{loginEmailError}</p>
                      )}
                      {!loginEmailError && loginEmailValidationError && (
                        <p className="text-xs text-red-500 truncate">{loginEmailValidationError}</p>
                      )}
                      <CountryPickerSheet
                        open={loginCountryOpen}
                        onOpenChange={setLoginCountryOpen}
                        selected={loginCountry}
                        onSelect={(c) => {
                          setLoginCountry(c);
                          if (looksLikePhoneInput(loginEmail)) {
                            const v = nextLoginIdentifier('', loginEmail.replace(/\D/g, ''), c);
                            setLoginEmail(v);
                            setLoginEmailValidation(isCompleteNationalPhone(c.code, c.dial, v) ? loginLookupValue(v, c) : '');
                          }
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                          id="login-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => {
                            setLoginPassword(e.target.value);
                            setLoginPasswordError('');
                          }}
                          className={`pl-10 pr-10 ${loginPasswordError ? 'border-red-500' : ''}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowPassword(!showPassword);
                          }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {loginPasswordError && (
                        <p className="text-xs text-red-500 truncate">{loginPasswordError}</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button asChild variant="link" className="h-auto px-0 py-1 text-auth-link">
                        <Link to="/employer-forgot-password">Forgot password?</Link>
                      </Button>
                    </div>
                    
                    {turnstileCfg?.enabled && turnstileCfg.siteKey && (
                      <TurnstileWidget ref={turnstileRef} siteKey={turnstileCfg.siteKey} onToken={setTurnstileToken} />
                    )}
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-primary to-secondary" 
                      disabled={isLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLogin(e);
                      }}
                    >
                      {isLoading ? "Signing In..." : "Sign In to Portal"}
                    </Button>
                  </form>
                  <p className="text-center text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Button asChild variant="link" className="h-auto p-0 text-auth-link"><Link to={accountPath('signup')}>Create an account</Link></Button>
                  </p>
                  <p className="text-center text-sm text-muted-foreground">
                    Looking for a job?{' '}
                    <Button asChild variant="link" className="h-auto p-0 text-auth-link"><Link to="/auth?mode=login">Job Seeker Login</Link></Button>
                  </p>

                  {recognizedAccount && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11"
                      onClick={handleQuickLogin}
                      disabled={isLoading || quickLoginLoading}
                      title={recognizedAccount.full_name || recognizedAccount.email}
                    >
                      {quickLoginLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                      ) : recognizedAccount.image_url ? (
                        <img
                          src={recognizedAccount.image_url}
                          alt={recognizedAccount.full_name || 'Company'}
                          loading="lazy"
                          decoding="async"
                          className="w-5 h-5 mr-2 rounded-full object-cover shrink-0 border border-slate-200"
                        />
                      ) : (
                        <Building2 className="w-4 h-4 mr-2 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate">
                        Quick Login as {recognizedAccount.full_name || recognizedAccount.email.split('@')[0]}
                      </span>
                    </Button>
                  )}
                  
                  <AppDownloadButtons userType="employer" clickedFrom="login" />
                </div>}
                

                

            </CardContent>
          
          <div className="px-6">
            <TrustMarquee
              variant="seekers"
              title="Join 500,000+ job seekers on Workly India"
              items={trustSeekers ?? []}
              defaultImageUrl={authImages?.default_job_seeker_avatar}
            />

          </div>

          </Card>

          {/* Hiring overview video — same style as the Employee landing page */}
          <section aria-label="How Workly India solves hiring" className="mt-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold">See how Workly India finds your candidates</h2>
              <p className="mt-3 text-muted-foreground">A quick look at how one job post brings the right applicants to you.</p>
            </div>
            <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
              <video
                src={hiringVideo}
                poster={hiringVideoPoster}
                aria-label="Workly India company hiring overview"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                controls={false}
                disablePictureInPicture
                controlsList="nodownload nofullscreen noremoteplayback"
                onContextMenu={(e) => e.preventDefault()}
                onPause={(e) => { void e.currentTarget.play().catch(() => {}); }}
                className="aspect-video w-full rounded-xl object-cover"
              />
            </div>
          </section>

          <div className="mt-8 px-4 pb-10">
            <BrandSocialBar title="Follow us" />
          </div>
        </div>
      </div>


      {/* 2FA Verification Modal */}
      {pending2FAData && (
        <Login2FAVerification
          open={show2FAModal}
          onClose={() => {
            setShow2FAModal(false);
            setPending2FAData(null);
          }}
          onVerified={handle2FAVerified}
          userId={pending2FAData.userId}
          userEmail={loginEmail}
          userType="employer"
          telegramConnected={pending2FAData.telegramConnected}
          twoFactorMethod={pending2FAData.twoFactorMethod}
          totpEnabled={pending2FAData.totpEnabled}
          passkeyEnabled={pending2FAData.passkeyEnabled}
          pushOtpEnabled={pending2FAData.pushOtpEnabled}
          emailOtpEnabled={pending2FAData.emailOtpEnabled}
        />
      )}


    </div>
  );
};

export default EmployerAuth;