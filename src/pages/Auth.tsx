import TurnstileWidget, { useTurnstileConfig, verifyTurnstile, type TurnstileHandle } from "@/components/auth/TurnstileWidget";
import SignupPage from '@/components/auth/SignupPage';
import PasswordRecoveryPage from '@/components/auth/PasswordRecoveryPage';
import RecoveryOtpVerify from '@/components/auth/RecoveryOtpVerify';
import useSignupEmailOtpSetting from '@/hooks/useSignupEmailOtpSetting';
import { useState, useEffect, useCallback, useRef } from 'react';
import jobSeekerHero from '@/assets/job-seeker-hero.webp';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { useAuthImages } from '@/hooks/useAuthImages';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, AlertCircle, RefreshCw, Phone, Check, Loader2, Fingerprint, AlertTriangle, X, Home } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SEO from '@/components/SEO';
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
import { isPhoneIdentifier, looksLikePhoneInput, sanitizeIdentifier } from '@/lib/loginIdentifier';
import AppDownloadButtons from '@/components/AppDownloadButtons';
import BrowserQuickLoginCard from '@/components/auth/BrowserQuickLoginCard';
import SignupVerifySheet from '@/components/auth/SignupVerifySheet';
import PhoneVerifyBox from '@/components/auth/PhoneVerifyBox';
import ConfirmEmailScreen from '@/components/auth/ConfirmEmailScreen';
import { LoginNotificationPermission } from '@/components/LoginNotificationPermission';

import { useLogin2FA } from '@/hooks/useLogin2FA';
import Login2FAVerification from '@/components/auth/Login2FAVerification';
import PasswordReset2FAFlow from '@/components/auth/PasswordReset2FAFlow';
import ProfileVerificationScreen from '@/components/ProfileVerificationScreen';
import { toast as sonnerToast } from 'sonner';
import { UnifiedNotificationService } from '@/services/UnifiedNotificationService';
import { usePasskeySupport } from '@/hooks/usePasskeySupport';
import { signInWithNativePasskey, describePasskeyError, isPasskeyServerUnavailable, isPasskeyDomainMismatch, getPasskeyDomainMessage } from '@/lib/nativePasskey';
import OAuthProviderButtons from '@/components/auth/OAuthProviderButtons';
import { useQuickLogin } from '@/hooks/useQuickLogin';
import { useDeviceRecognition } from '@/hooks/useDeviceRecognition';
import { Zap } from 'lucide-react';
import { getCurrentOrigin } from '@/config/domainConfig';
import TrustMarquee from '@/components/auth/TrustMarquee';
import { useTrustCompanies } from '@/hooks/useTrustCompanies';
import BrandSocialBar from '@/components/BrandSocialBar';
import { readPendingPlatform, clearPendingPlatform, retryAfterAlreadyLinked } from '@/lib/socialOAuth';
import { normalizePhoneE164 } from '@/hooks/usePhoneOtpLogin';
import { TransparentLogoImage } from '@/components/TransparentLogoImage';

// Job seeker story video — same layout as the Employee login video section
const seekerVideo = 'https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-india-apply-free-candidates-30s.mp4';
const seekerVideoPoster = 'https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/02-Work-from-Home.png';



const Auth = ({ forgotPasswordPage = false, signupPage = false }: { forgotPasswordPage?: boolean; signupPage?: boolean }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { signIn, signUp, signInWithGoogle, signInWithLinkedIn, signInWithTwitter, signInWithGitHub, signInWithGitLab, resetPassword, user, loading, profile, profileLoading } = useAuth();
  const { createReferralRelationship } = useReferralSystem();
  const { isSupported: isPasskeySupported, isLoading: isPasskeySupportLoading } = usePasskeySupport();
  const { quickLogin, loading: quickLoginLoading } = useQuickLogin('job_seeker');
  const { recognized: recognizedAccount } = useDeviceRecognition('job_seeker');
  const handleQuickLogin = async () => {
    const result = await quickLogin();
    if (result.ok === true) {
      toast({ title: 'Welcome back!', description: `Logged in as ${result.email}` });
      return;
    }
    // Quick login couldn't establish a session (e.g. one-tap token could not be
    // issued for this account). Instead of a dead-end "No Account Found" error,
    // fall back to normal login by pre-filling the recognized email so the user
    // can just enter their password (or use Google/LinkedIn) to continue.
    if (recognizedAccount?.email) {
      setActiveTab('login');
      setLoginEmail(recognizedAccount.email);
      setLoginEmailValidation(recognizedAccount.email);
      setLoginEmailError('');
      requestAnimationFrame(() => {
        document.getElementById('login-password')?.focus();
      });
      toast({
        title: 'Almost there',
        description: `We recognized ${recognizedAccount.full_name || recognizedAccount.email}. Enter your password to sign in.`,
      });
      return;
    }
    toast({
      variant: 'destructive',
      title: result.reason === 'not_found' ? 'No Account Found' : 'Quick Login Failed',
      description: result.message,
    });
  };
  const { data: authImages, isLoading: isAuthImagesLoading } = useAuthImages();
  const { data: trustCompanies } = useTrustCompanies();

  
  
  const activeTab = signupPage ? 'signup' : 'login';
  const accountPath = (mode: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete('tab');
    params.delete('type');
    params.set('mode', mode);
    return `${mode === 'signup' ? '/signup' : '/auth'}?${params.toString()}`;
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
      navigate(`/signup?${params.toString()}`, { replace: true });
    }
  }, [forgotPasswordPage, signupPage, searchParams, navigate]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [jobSeekerAvatarError, setJobSeekerAvatarError] = useState(false);
  
  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginEmailError, setLoginEmailError] = useState('');
  const [loginPasswordError, setLoginPasswordError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const providerLabel = (providers: string[]) => {
    const labels: Record<string, string> = {
      x: 'X (Twitter)', twitter: 'X (Twitter)', google: 'Google', linkedin: 'LinkedIn',
      linkedin_oidc: 'LinkedIn', github: 'GitHub', gitlab: 'GitLab', azure: 'Microsoft',
      workos: 'WorkOS', email: 'email and password',
    };
    return providers.map((provider) => labels[provider] || provider).join(' or ');
  };
  
  // 2FA State
  const { check2FABeforeLogin, isChecking: is2FAChecking } = useLogin2FA({ userType: 'job_seeker' });
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
  
  // Profile verification state
  const [showVerification, setShowVerification] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Signup state
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
  } = useWhatsAppValidation('job_seeker');

  // OTP verification check
  const { isActive: isOTPRequired, isLoading: isOTPCheckLoading } = useSignupOTPCheck('user_signup_otp');
  const [isWhatsAppOTPVerified, setIsWhatsAppOTPVerified] = useState(false);
  const [verifySheetOpen, setVerifySheetOpen] = useState(false);
  // Set only when Supabase "Confirm email" is ON and a new account was created.
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);

  // Owner-controlled SMS phone verification
  const { phoneVerifyEnabled } = usePhoneVerifySetting('phone_verify_jobseeker_signup');
  const emailOtpEnabled = useSignupEmailOtpSetting('jobseeker');
  const [emailOtpVerifiedFor, setEmailOtpVerifiedFor] = useState('');
  const [smsVerifiedFor, setSmsVerifiedFor] = useState('');
  const isPhoneSmsVerified = smsVerifiedFor !== '' && smsVerifiedFor === normalizePhoneE164(whatsappNumber || '');
  const SIGNUP_DRAFT_KEY = 'workly_signup_draft';


  // Email validation hook
  const {
    email: signupEmail,
    setEmail: setSignupEmail,
    isChecking: isCheckingEmail,
    isAvailable: isEmailAvailable,
    error: emailError,
    isDuplicate: isEmailDuplicate,
    providers: signupEmailProviders,
    verifyAvailabilityNow: verifyEmailAvailabilityNow,
  } = useEmailValidation('job_seeker');
  const isEmailOtpVerified = emailOtpVerifiedFor !== '' && emailOtpVerifiedFor === signupEmail.trim().toLowerCase();

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(SIGNUP_DRAFT_KEY) || 'null');
      if (!draft) return;
      if (draft.email) setSignupEmail(draft.email);
      if (draft.fullName) setFullName(draft.fullName);
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
        fullName,
        whatsappNumber,
        phone: getFormattedNumber(),
        phoneVerified: isPhoneSmsVerified,
      }));
    } catch { /* ignore unavailable draft storage */ }
  }, [signupEmail, fullName, whatsappNumber, isPhoneSmsVerified, getFormattedNumber]);

  // Login email validation hook
  const {
    setEmail: setLoginEmailValidation,
    isChecking: isCheckingLoginEmail,
    exists: loginEmailExists,
    error: loginEmailValidationError,
    isValid: isLoginEmailValid,
    notRegistered: isLoginEmailNotRegistered,
    providers: loginEmailProviders,
  } = useLoginEmailValidation('job_seeker');
  
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
  // Note: This is kept for backward compatibility but new flow uses /reset-password route
  const isPasswordRecovery = searchParams.get('type') === 'recovery' && 
    (window.location.hash.includes('access_token') || searchParams.get('access_token'));

  // OAuth ban error — shown as full inline red banner
  const [oauthBanError, setOauthBanError] = useState<string | null>(null);

  // Check for OAuth error in URL hash / query (e.g., banned user, failed link)
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const pick = (k: string) => hashParams.get(k) || queryParams.get(k);

    const errorDescription = pick('error_description') || pick('error');
    if (!errorDescription) return;

    const errorCode = (pick('error_code') || '').toLowerCase();
    const lower = decodeURIComponent(errorDescription).toLowerCase();

    // Social connect: the identity is already attached to this account, so
    // linkIdentity can never succeed. Re-run plain OAuth to harvest a fresh
    // provider token instead of dead-ending the user on an error toast.
    const alreadyLinked =
      errorCode === 'identity_already_exists' || lower.includes('identity is already linked');
    const pendingPlatform = readPendingPlatform();

    if (alreadyLinked && pendingPlatform) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      const returnPath =
        searchParams.get('redirect') ||
        (() => {
          try {
            return sessionStorage.getItem('oauth_return_path') || localStorage.getItem('oauth_return_path');
          } catch {
            return null;
          }
        })() ||
        '/ai-assistant/connect';
      retryAfterAlreadyLinked(pendingPlatform, decodeURIComponent(returnPath)).then(({ error }) => {
        if (error) {
          clearPendingPlatform();
          toast({
            variant: 'destructive',
            title: 'Connect failed',
            description:
              (error as Error)?.message || 'Could not reconnect this account. Please try again.',
          });
        }
      });
      return;
    }

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
  }, [toast, searchParams]);

  useEffect(() => {
    // Check for referral code in URL
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCodeFromUrl(refParam);
      savePendingReferralCode(refParam);
    }
  }, [searchParams]);

  // Redirect after login using profile from AuthContext (no duplicate fetch)
  useEffect(() => {
    if (user && !loading && !profileLoading && !forgotPasswordPage && !isPasswordRecovery) {
      // Referral relationship is created globally by <PendingReferralApplier />
      // using the stored referral code, so it also works after page reloads
      // and email confirmation.


      const storedRedirect = (() => {
        try {
          return sessionStorage.getItem('oauth_return_path') || localStorage.getItem('oauth_return_path');
        } catch {
          return null;
        }
      })();
      const redirectUrl = searchParams.get('redirect') || storedRedirect;

      // Social connect round-trip (AI Connect page): hand the session over to
      // the dedicated callback so the provider token is stored before any
      // profile-based redirect can send the user to the home page.
      const pendingSocial = readPendingPlatform();
      if (pendingSocial) {
        const back = redirectUrl ? decodeURIComponent(redirectUrl) : '/ai-assistant/connect';
        navigate(
          `/social-callback?platform=${pendingSocial}&return=${encodeURIComponent(back)}`,
          { replace: true },
        );
        return;
      }

      // AI Chat login (ChatWork AI): always land back in the chat, even when the
      // job-seeker profile is not filled in yet.
      const decodedRedirect = redirectUrl ? decodeURIComponent(redirectUrl) : null;
      if (decodedRedirect?.startsWith('/ai-assistant')) {
        try {
          sessionStorage.removeItem('oauth_return_path');
          localStorage.removeItem('oauth_return_path');
        } catch {
          /* ignore */
        }
        navigate(decodedRedirect, { replace: true });
        return;
      }

      // Check if profile is complete — trust is_profile_complete flag first
      const isComplete = profile && (
        profile.is_profile_complete === true ||
        (profile.full_name?.trim() && profile.whatsapp_number?.trim())
      );
      
      if (isComplete) {
        if (redirectUrl) {
          try {
            sessionStorage.removeItem('oauth_return_path');
            localStorage.removeItem('oauth_return_path');
          } catch {
            /* ignore */
          }
          navigate(decodeURIComponent(redirectUrl), { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        const targetPath = redirectUrl ? `/JobSeeker/Setup?redirect=${encodeURIComponent(redirectUrl)}` : '/JobSeeker/Setup';
        navigate(targetPath, { replace: true });
      }
    }
  }, [user, loading, profileLoading, profile, referralData, referralCodeFromUrl, createReferralRelationship, navigate, searchParams, forgotPasswordPage, isPasswordRecovery]);

  // Handle verification completion
  const handleVerificationComplete = useCallback((isComplete: boolean, missingFields: string[]) => {
    const redirectUrl = searchParams.get('redirect');
    
    if (isComplete) {
      // Profile is complete - go to home or redirect URL
      if (redirectUrl) {
        navigate(decodeURIComponent(redirectUrl));
      } else {
        navigate('/');
      }
    } else {
      // Profile incomplete - redirect to edit page
      // Profile completion toast removed — user is redirected to edit page silently
      const targetPath = redirectUrl ? `/JobSeeker/Setup?redirect=${encodeURIComponent(redirectUrl)}` : '/JobSeeker/Setup';
      navigate(targetPath);
    }
  }, [navigate, searchParams]);

  // Country used when the login identifier is a phone number (any country).
  const [loginCountry, setLoginCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [loginCountryOpen, setLoginCountryOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginEmailError('');
    setLoginPasswordError('');

    // Client-side validation (clean up autofill/paste artifacts first)
    const cleanEmail = sanitizeIdentifier(loginEmail);
    if (cleanEmail !== loginEmail) setLoginEmail(cleanEmail);
    if (!cleanEmail) {
      setLoginEmailError('Email or mobile number required');
      return;
    }

    const isPhone = looksLikePhoneInput(cleanEmail) ? isPhoneIdentifier(loginLookupValue(cleanEmail, loginCountry)) : isPhoneIdentifier(cleanEmail);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!isPhone && !emailRegex.test(cleanEmail)) {
      setLoginEmailError('Enter a valid email or mobile number');
      return;
    }

    // Phone login: combine the typed digits with the picked country code so
    // accounts from any country can sign in.
    const loginIdentifierValue = isPhone || looksLikePhoneInput(cleanEmail) ? loginLookupValue(cleanEmail, loginCountry) : cleanEmail;
    
    if (!loginPassword) {
      setLoginPasswordError('Password required');
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
      
      // Account exists only through a social provider (Google, X, etc.) — it has
      // no password, so stop here instead of showing "wrong password".
      if (!isPhone && loginEmailProviders.length > 0 && !loginEmailProviders.includes('email')) {
        setLoginEmailError(`This email is registered with ${providerLabel(loginEmailProviders)}. Tap that button above to sign in — no password was set for this account.`);
        setIsLoading(false);
        return;
      }

      // No 2FA required - proceed with direct login
      const { error } = await signIn(loginIdentifierValue, loginPassword);
      
      if (error) {
        const errMsg = error.message?.toLowerCase() || '';
        if (errMsg.includes('banned') || errMsg.includes('user is banned') || errMsg.includes('banned_until')) {
          setLoginEmailError('Account suspended. Contact support.');
        } else if (errMsg.includes('not confirmed') || errMsg.includes('email not confirmed') || errMsg.includes('confirm your email')) {
          setLoginEmailError('Your account exists but the email is not verified yet. Please open the verification link we emailed you.');
        } else if (loginEmailProviders.length > 0 && !loginEmailProviders.includes('email')) {
          setLoginEmailError(`This account uses ${providerLabel(loginEmailProviders)}. Please sign in with that option above.`);
        } else {
          setLoginPasswordError('Incorrect email or password');
        }
      }
      // No toast - verification screen will show
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || '';
      if (errMsg.includes('banned') || errMsg.includes('user is banned') || errMsg.includes('banned_until')) {
        setLoginEmailError('Account suspended. Contact support.');
      } else if (errMsg.includes('not confirmed') || errMsg.includes('confirm your email')) {
        setLoginEmailError('Your account exists but the email is not verified yet. Please open the verification link we emailed you.');
      } else {
        setLoginPasswordError('Incorrect email or password');
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
          setLoginEmailError('Account suspended. Contact support.');
        } else {
          setLoginPasswordError('Wrong password');
        }
      }
      // No toast - verification screen will show
    } catch (err: any) {
      const errMsg = err?.message?.toLowerCase() || '';
      if (errMsg.includes('banned') || errMsg.includes('user is banned') || errMsg.includes('banned_until')) {
        setLoginEmailError('Account suspended. Contact support.');
      } else {
        setLoginPasswordError('Login failed');
      }
    }
    
    setIsLoading(false);
    setPending2FAData(null);
  };

  // Creates the account. Runs straight away when verification is OFF, or right
  // after the OTP sheet reports every required step verified.
  const performSignUp = useCallback(async () => {
    setSignupError('');
    setIsLoading(true);

    try {
      // Authoritative server-side check right before creating the account
      const availability = await verifyEmailAvailabilityNow(signupEmail);
      if (availability === false) {
        const method = providerLabel(signupEmailProviders);
        setSignupError(method ? `Account already exists. Sign in with ${method}.` : 'Email already registered');
        setIsLoading(false);
        return;
      }
      if (availability === null) {
        setSignupError('Could not verify this email. Please try again.');
        setIsLoading(false);
        return;
      }

      const { error, needsEmailConfirmation } = await signUp(signupEmail, signupPassword, fullName, getFormattedNumber(), undefined, isPhoneSmsVerified || isWhatsAppOTPVerified || (() => { try { const d = JSON.parse(sessionStorage.getItem(SIGNUP_DRAFT_KEY) || '{}'); return d.phoneVerified === true && normalizePhoneE164(d.phone || '') === normalizePhoneE164(getFormattedNumber()); } catch { return false; } })());
      
      if (error) {
        setSignupError(handleAuthError(error).description);
      } else {
        // Note: Signup welcome notification will be sent after email verification
        // when user first logs in (handled by useJobStatusNotifications hook)
        try { sessionStorage.removeItem(SIGNUP_DRAFT_KEY); } catch { /* ignore */ }
        if (needsEmailConfirmation) {
          // Email confirmation is ON → show the dedicated verify screen
          setConfirmEmailFor(signupEmail);
        } else {
          sonnerToast.success('Account created! You are signed in.');
        }
      }
    } catch (err) {
      setSignupError(handleAuthError(err).description);
    }
    
    setIsLoading(false);
  }, [signupEmail, signupPassword, fullName, isPhoneSmsVerified, verifyEmailAvailabilityNow, signUp, getFormattedNumber, signupEmailProviders]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSignupError('');

    if (isCheckingEmail) {
      setSignupError('Verifying email, please wait');
      return;
    }

    if (isEmailDuplicate) {
      const method = providerLabel(signupEmailProviders);
      setSignupError(method ? `Account already exists. Sign in with ${method}.` : 'Email already registered');
      return;
    }


    if (isWhatsAppDuplicate) {
      setSignupError('Number already registered');
      return;
    }

    const validationErrors = validateSignupForm(signupEmail, signupPassword, confirmPassword, fullName, whatsappNumber);
    if (validationErrors.length > 0) {
      setSignupError(validationErrors[0]);
      return;
    }

    if (turnstileCfg?.enabled) {
      if (!signupTurnstileToken) { setSignupError('Please complete the security check'); return; }
      const passed = await verifyTurnstile(signupTurnstileToken);
      signupTurnstileRef.current?.reset();
      if (!passed) { setSignupError('Security check failed. Please try again.'); return; }
    }

    // Verification ON → slide the OTP sheet up instead of blocking the button
    const needsWhatsAppOtp = isOTPRequired && !isOTPCheckLoading && !isWhatsAppOTPVerified;
    const needsSmsOtp = phoneVerifyEnabled && !isPhoneSmsVerified;
    const needsEmailOtp = emailOtpEnabled && !isEmailOtpVerified;
    if (needsSmsOtp && !needsEmailOtp && !needsWhatsAppOtp) {
      setSignupError('Please verify your mobile number with OTP first');
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
    setForgotError('');
    const validationErrors = validateForgotPasswordForm(forgotEmail);
    if (validationErrors.length > 0) {
      setForgotError(validationErrors[0]);
      return;
    }
    
    setIsChecking2FA(true);

    try {
      // Does this email belong to an account at all, and how does it sign in?
      const cleanForgot = forgotEmail.trim().toLowerCase();
      const { data: accountInfo } = await supabase.functions.invoke('unified-ai-tricks', {
        body: { action: 'check_email_exists', email: cleanForgot },
      });

      if (accountInfo?.exists === false) {
        setForgotError('This email is not registered. Please sign up first.');
        setIsChecking2FA(false);
        return;
      }

      const forgotProviders: string[] = Array.isArray(accountInfo?.providers) ? accountInfo.providers : [];
      if (accountInfo?.exists === true && forgotProviders.length > 0 && !forgotProviders.includes('email')) {
        setForgotError(`This account signs in with ${providerLabel(forgotProviders)} — there is no password to reset. Use that button on the Login tab.`);
        setIsChecking2FA(false);
        return;
      }

      // First check if 2FA is enabled for this email
      const { data: twoFAData, error: twoFAError } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'check-login', email: forgotEmail, userType: 'job_seeker' }
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
        setForgotError(handleAuthError(error).description);
      } else {
        setResetEmailSent(true);
      }
    } catch (err) {
      setForgotError(handleAuthError(err).description);
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
        setForgotError(handleAuthError(error).description);
      } else {
        setResetEmailSent(true);
      }
    } catch (err) {
      setForgotError(handleAuthError(err).description);
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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await signInWithGoogle();
      
      if (error) {
        const errorMessage = handleAuthError(error);
        toast({
          variant: errorMessage.variant,
          title: errorMessage.title,
          description: errorMessage.description
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

  const handleLinkedInSignIn = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await signInWithLinkedIn();
      
      if (error) {
        const errorMessage = handleAuthError(error);
        toast({
          variant: errorMessage.variant,
          title: errorMessage.title,
          description: errorMessage.description
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

  const handleTwitterSignIn = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await signInWithTwitter();
      
      if (error) {
        const errorMessage = handleAuthError(error);
        toast({
          variant: errorMessage.variant,
          title: errorMessage.title,
          description: errorMessage.description
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

  const handleGitSignIn = async (provider: 'github' | 'gitlab') => {
    setIsLoading(true);
    try {
      const { error } = provider === 'github' ? await signInWithGitHub() : await signInWithGitLab();
      if (error) {
        const errorMessage = handleAuthError(error);
        toast({
          variant: errorMessage.variant,
          title: errorMessage.title,
          description: errorMessage.description
        });
        setIsLoading(false);
      }
    } catch (err) {
      const errorMessage = handleAuthError(err);
      toast({
        variant: errorMessage.variant,
        title: errorMessage.title,
        description: errorMessage.description
      });
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = () => handleGitSignIn('github');
  const handleGitLabSignIn = () => handleGitSignIn('gitlab');

  const handlePasskeyLogin = async () => {
    setIsLoading(true);
    setLoginEmailError('');
    setLoginPasswordError('');

    try {
      // Native Supabase passkey sign-in: runs the full WebAuthn ceremony and
      // establishes the session on success (no custom edge function needed).
      const result = await signInWithNativePasskey();

      toast({
        title: "✅ Welcome!",
        description: "Logged in successfully with passkey",
      });

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        navigate(decodeURIComponent(redirectUrl), { replace: true });
      } else {
        const metadata = (result?.user as { user_metadata?: Record<string, unknown> } | null)?.user_metadata;
        const isEmployer = metadata?.user_type === 'employer';
        navigate(isEmployer ? '/employer/dashboard' : '/', { replace: true });
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
      setFullName('');
      resetWhatsAppValidation();
      setIsWhatsAppOTPVerified(false);
    } else {
      setForgotEmail('');
    }
  };

  // Reset OTP verification when WhatsApp number changes
  useEffect(() => {
    setIsWhatsAppOTPVerified(false);
  }, [whatsappNumber]);

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


  // Show verification screen after login
  if (showVerification) {
    return (
      <ProfileVerificationScreen 
        profile={profileData} 
        onVerificationComplete={handleVerificationComplete}
      />
    );
  }

  if (loading || isLoadingProfile) {
    return null;
  }

  if (forgotPasswordPage) {
    return (
      <PasswordRecoveryPage audience="job_seeker">
                <div className="space-y-4">
                  {!resetEmailSent && !has2FA ? (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                          <Input
                            id="forgot-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="Enter your email"
                            value={forgotEmail}
                            onChange={(e) => {
                              setForgotEmail(e.target.value);
                              setForgotError('');
                              setHas2FA(false);
                              setReset2FAData(null);
                            }}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      
                      {forgotError && (
                        <p className="text-sm text-destructive break-words">{forgotError}</p>
                      )}

                      <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary" disabled={isLoading || isChecking2FA}>
                        {isChecking2FA ? "Checking..." : isLoading ? "Sending..." : "Continue"}
                      </Button>
                    </form>
                  ) : has2FA && reset2FAData ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
                        <div className="mb-3">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Lock className="w-6 h-6 text-primary" />
                          </div>
                          <h3 className="font-semibold text-foreground mb-1">
                            2FA Enabled
                          </h3>
                          <p className="text-sm text-muted-foreground mb-1">
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
                    <RecoveryOtpVerify email={forgotEmail} loginPath="/auth" resending={isLoading} onResend={handleResendResetEmail} onChangeEmail={() => setResetEmailSent(false)} />
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
          userType="job_seeker"
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
    return <PasswordResetForm isEmployer={false} />;
  }

  if (signupPage) {
    return (
      <SignupPage audience="job_seeker">
                <div className="space-y-4">
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
                      <span className="bg-background px-2 text-muted-foreground">Or create account with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleSignUp} method="post" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="full-name"
                          name="fullName"
                          type="text"
                          autoComplete="name"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="flex items-center gap-2">
                        Email
                        {!isCheckingEmail && isEmailAvailable && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
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
                          placeholder="Enter your email"
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
                        <p className="text-xs text-destructive">
                          {signupEmailProviders.length > 0
                            ? `Account already exists. Sign in with ${providerLabel(signupEmailProviders)}.`
                            : emailError}
                        </p>
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
                      <Link to="/terms-conditions" className="text-primary hover:text-primary/80 underline font-medium">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy" className="text-primary hover:text-primary/80 underline font-medium">
                        Privacy Policy
                      </Link>
                    </div>
                    
                    {signupError && (
                      <p className="truncate text-sm text-destructive">{signupError}</p>
                    )}

                    {turnstileCfg?.enabled && turnstileCfg.siteKey && (
                      <TurnstileWidget ref={signupTurnstileRef} siteKey={turnstileCfg.siteKey} onToken={setSignupTurnstileToken} />
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-secondary"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating Account..." : "Create Account"}
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
              emailPage="jobseeker"
              onEmailVerified={() => setEmailOtpVerifiedFor(signupEmail.trim().toLowerCase())}
                    phone={getFormattedNumber()}
                    name={fullName}
                    needWhatsApp={isOTPRequired && !isOTPCheckLoading}
                    whatsAppVerified={isWhatsAppOTPVerified}
                    whatsAppPurpose="user_signup_otp"
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

        title={signupPage ? "Create Account - Job Seeker Portal" : "Log In - Job Seeker Portal"}
        description="Join Workly India to find legitimate remote jobs. Create your free account and start applying to verified remote opportunities across India."
        keywords="login workly india, job seeker login, remote jobs signup, Workly India account, register job portal"
        canonical={signupPage ? "/signup" : "/auth"}
        noindex={false}
      />
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
                  const supabaseUrl = normalizeImageUrl(authImages?.job_seeker_avatar);
                  // Show the spinner only while the setting is being read. If the
                  // uploaded logo is missing or fails to load, show the built-in
                  // image instead of spinning forever.
                  if (isAuthImagesLoading) {
                     return (
                       <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-primary/60 animate-spin" />
                      </div>
                    );
                  }
                  if (!supabaseUrl || jobSeekerAvatarError) {
                    return (
                      <img
                        src={jobSeekerHero}
                        alt="Job Seeker"
                        className="w-full h-full object-contain"
                        loading="eager"
                        draggable={false}
                        onContextMenu={(event) => event.preventDefault()}
                      />
                    );
                  }
                  return (
                    <TransparentLogoImage
                      loading="eager"
                      src={supabaseUrl}
                      alt="Job Seeker"
                      className="w-full h-full object-contain"
                      onError={() => setJobSeekerAvatarError(true)}
                    />
                  );
                })()}
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Job Seeker Portal
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Your gateway to remote opportunities across India
              </CardDescription>
            </CardHeader>
            {/* Full-width red ban error banner — replaces old toast */}
            {oauthBanError && (
              <div className="px-6 pb-2">
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
                  <div className="space-y-2">
                    <OAuthProviderButtons
                      onGoogle={handleGoogleSignIn}
                      onLinkedIn={handleLinkedInSignIn}
                      onTwitter={handleTwitterSignIn}
                      onGitHub={handleGitHubSignIn}
                      onGitLab={handleGitLabSignIn}
                      disabled={isLoading}
                    />
                    
                    {/* Only show Passkey button if browser supports it */}
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
                    <BrowserQuickLoginCard userType="job_seeker" />

                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} method="post" action="/auth" className="space-y-4" autoComplete="on">
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
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
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
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
                          className={`${looksLikePhoneInput(loginEmail) ? 'pl-[4.75rem]' : 'pl-10'} pr-10 ${loginEmailError || isLoginEmailNotRegistered ? 'border-destructive' : isLoginEmailValid ? 'border-green-500' : ''}`}
                          required
                        />
                        {isCheckingLoginEmail && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        {!isCheckingLoginEmail && isLoginEmailValid && (
                          <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {loginEmailError && (
                        <p className="text-xs text-destructive">{loginEmailError}</p>
                      )}
                      {!loginEmailError && loginEmailValidationError && (
                        <p className="text-xs text-destructive">{loginEmailValidationError}</p>
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
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
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
                          className={`pl-10 pr-10 ${loginPasswordError ? 'border-destructive' : ''}`}
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
                      {loginPasswordError && (
                        <p className="text-xs text-destructive">{loginPasswordError}</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button asChild variant="link" className="h-auto px-0 py-1 text-auth-link">
                        <Link to="/forgot-password">Forgot password?</Link>
                      </Button>
                    </div>
                    
                    {turnstileCfg?.enabled && turnstileCfg.siteKey && (
                      <TurnstileWidget ref={turnstileRef} siteKey={turnstileCfg.siteKey} onToken={setTurnstileToken} />
                    )}
                    <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary" disabled={isLoading}>
                      {isLoading ? "Signing In..." : "Sign In"}
                    </Button>
                  </form>
                  <p className="text-center text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Button asChild variant="link" className="h-auto p-0 text-auth-link"><Link to={accountPath('signup')}>Create an account</Link></Button>
                  </p>
                  <p className="text-center text-sm text-muted-foreground">
                    Looking to hire talent?{' '}
                    <Button asChild variant="link" className="h-auto p-0 text-auth-link"><Link to="/employer-auth?mode=login">Employer Login</Link></Button>
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
                          alt={recognizedAccount.full_name || 'Profile'}
                          loading="lazy"
                          decoding="async"
                          className="w-5 h-5 mr-2 rounded-full object-cover shrink-0 border border-slate-200"
                        />
                      ) : (
                        <Zap className="w-4 h-4 mr-2 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">
                        Quick Login as {recognizedAccount.full_name || recognizedAccount.email.split('@')[0]}
                      </span>
                    </Button>
                  )}
                  
                  <AppDownloadButtons userType="job_seeker" clickedFrom="login" />
                </div>}
                

                

            </CardContent>
          
          <div className="px-6">
            <TrustMarquee
              variant="companies"
              title="Trusted by 5,000+ companies hiring on Workly India"
              items={trustCompanies ?? []}
              defaultImageUrl={authImages?.default_company_logo}
            />

          </div>

          </Card>

          {/* Job seeker story video — same style as the Employee login video section */}
          <section aria-label="How Workly India gets candidates hired" className="mt-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold">See how Workly India gets you hired</h2>
              <p className="mt-3 text-muted-foreground">A quick look at how one free application turns into real work.</p>
            </div>
            <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
              <video
                src={seekerVideo}
                poster={seekerVideoPoster}
                aria-label="Workly India job seeker story"
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
                className="aspect-video w-full rounded-xl object-cover object-top"
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
          userType="job_seeker"
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

export default Auth;
