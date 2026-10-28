import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ChevronLeft, Fingerprint, Mail } from 'lucide-react';
import { useTelegramStatus } from '@/hooks/useTelegramStatus';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GoogleAuthenticatorSetup } from '@/components/auth/GoogleAuthenticatorSetup';
import { RecoveryCodesDisplay } from '@/components/auth/RecoveryCodesDisplay';
import { PasskeySetup } from '@/components/auth/PasskeySetup';
import { deleteAllNativePasskeys, listNativePasskeys, getSavedPasskeyIdentity, clearSavedPasskeyIdentity, registerNativePasskey, describePasskeyError, isPasskeyDomainMismatch, getPasskeyDomainMessage } from '@/lib/nativePasskey';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { ConfirmationDialog } from '@/components/team/ConfirmationDialog';
import { FirebasePushService } from '@/services/FirebasePushService';
import { usePasskeySupport } from '@/hooks/usePasskeySupport';

type TwoFactorMethod = 'telegram' | 'google_authenticator' | 'passkey' | 'push_otp' | 'email_otp' | null;
type DisableDialogType = 'google' | 'telegram' | 'passkey' | 'push_otp' | 'email_otp' | 'all' | null;

const METHOD_CARD_CLASS = 'p-3 border rounded-xl transition-all';

const TwoFactorAuthSettings: React.FC<{ inSheet?: boolean }> = ({ inSheet = false }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine user type from URL
  const isEmployer = location.pathname.includes('employer');
  const { user } = useAuth();
  const { user: employerUser, company } = useEmployerAuth();
  
  const userId = isEmployer ? employerUser?.id : user?.id;
  const companyId = company?.id;
  const userType = isEmployer ? 'employer' : 'job_seeker';
  const profileSetupPath = isEmployer ? '/employer/company-profile-setup' : '/profile-setup';
  const backPath = isEmployer ? '/employer-settings' : '/settings';
  
  // Check passkey browser support
  const { isSupported: browserSupportsPasskey, isLoading: checkingPasskeySupport } = usePasskeySupport();
  
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<TwoFactorMethod>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [pushOtpEnabled, setPushOtpEnabled] = useState(false);
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [, setPasskeyLabel] = useState<string>('');

  
  // Push notification permission state
  const [pushPermissionGranted, setPushPermissionGranted] = useState(false);
  const [checkingPushPermission, setCheckingPushPermission] = useState(true);
  const [browserSupportsPush, setBrowserSupportsPush] = useState(false);
  const [requestingPushPermission, setRequestingPushPermission] = useState(false);
  
  // Google Authenticator setup states
  const [showGoogleAuthSetup, setShowGoogleAuthSetup] = useState(false);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  
  // Confirmation dialog state
  const [disableDialogType, setDisableDialogType] = useState<DisableDialogType>(null);
  
  // Check Telegram connection status
  const { isConnected: isTelegramConnected, isChatVerified, isLoading: telegramLoading } = useTelegramStatus({
    userType: isEmployer ? 'company' : 'profile',
    userId: userId ?? null,
    companyId: companyId ?? null,
  });

  // Check push notification permission and browser support
  useEffect(() => {
    const checkPushPermission = async () => {
      try {
        // First check if browser supports push notifications
        const browserSupports = FirebasePushService.isBrowserPushSupported();
        setBrowserSupportsPush(browserSupports);
        
        if (browserSupports) {
          const permission = await FirebasePushService.checkPermissionStatus();
          setPushPermissionGranted(permission === 'granted');
        } else {
          setPushPermissionGranted(false);
        }
      } catch (error) {
        console.error('Error checking push permission:', error);
        setPushPermissionGranted(false);
        setBrowserSupportsPush(false);
      } finally {
        setCheckingPushPermission(false);
      }
    };
    checkPushPermission();
  }, []);

  // Fetch user email
  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.email) {
        setUserEmail(authUser.email);
      }
    };
    fetchUserEmail();
  }, []);

  // Fetch 2FA status
  useEffect(() => {
    const fetch2FAStatus = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const tableName = isEmployer ? 'employer_settings' : 'user_settings';
        const { data, error } = await supabase
          .from(tableName)
          .select('two_factor_enabled, two_factor_method, totp_enabled, passkey_enabled, push_otp_enabled, telegram_2fa_enabled, email_otp_enabled')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;
        // Reconcile: a stored "passkey on" flag is only real if Supabase still
        // holds at least one registered passkey for this account.
        let realPasskeyEnabled = data?.passkey_enabled ?? false;
        if (realPasskeyEnabled) {
          // The identity captured while the passkey was actually saved is the
          // most accurate — it is exactly what the password manager shows.
          const savedIdentity = getSavedPasskeyIdentity();
          if (savedIdentity) setPasskeyLabel(savedIdentity);

          try {
            const registered = await listNativePasskeys();
            if (registered.length === 0) {
              realPasskeyEnabled = false;
              setPasskeyLabel('');
              clearSavedPasskeyIdentity();
              await supabase
                .from(tableName)
                .update({ passkey_enabled: false })
                .eq('user_id', userId);
            } else if (!savedIdentity) {
              const names = Array.from(
                new Set(
                  registered
                    .map((p) => (p.friendly_name || '').trim())
                    .filter(Boolean)
                )
              );
              if (names.length) setPasskeyLabel(names.join(', '));
            }
          } catch {
            // Could not verify (offline / API unavailable) — keep stored value
          }
        }

        setIsEnabled(data?.two_factor_enabled ?? false);
        setTotpEnabled(data?.totp_enabled ?? false);
        setPasskeyEnabled(realPasskeyEnabled);
        setPushOtpEnabled(data?.push_otp_enabled ?? false);
        setEmailOtpEnabled(data?.email_otp_enabled ?? false);
        // Use telegram_2fa_enabled column instead of checking method
        setTelegramEnabled(data?.telegram_2fa_enabled ?? false);
        const method = data?.two_factor_method as TwoFactorMethod;
        setCurrentMethod(method ?? (data?.totp_enabled ? 'google_authenticator' : (realPasskeyEnabled ? 'passkey' : (data?.push_otp_enabled ? 'push_otp' : (data?.email_otp_enabled ? 'email_otp' : (data?.telegram_2fa_enabled ? 'telegram' : null))))));

      } catch (error) {
        console.error('Error fetching 2FA status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetch2FAStatus();
  }, [userId, isEmployer]);

  const handleTelegramToggle = async (enabled: boolean) => {
    if (!userId) return;

    // If trying to enable 2FA, check Telegram connection first
    if (enabled) {
      if (!isTelegramConnected) {
        toast({
          title: "Telegram Not Connected",
          description: "Please connect your Telegram account first to enable 2FA",
          variant: "destructive",
        });
        return;
      }

      if (!isChatVerified) {
        toast({
          title: "Telegram Chat Not Verified",
          description: "Please start a chat with our Telegram bot to verify your connection",
          variant: "destructive",
        });
        return;
      }
    }

    setIsToggling(true);

    try {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      
      // Fetch current settings to preserve other enabled methods
      const { data: currentSettings } = await supabase
        .from(tableName)
        .select('totp_enabled, passkey_enabled, push_otp_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      const hasOtherMethods = currentSettings?.totp_enabled || currentSettings?.passkey_enabled || currentSettings?.push_otp_enabled;
      
      const { error } = await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          two_factor_enabled: enabled || hasOtherMethods,
          telegram_2fa_enabled: enabled, // Set the new column
          two_factor_method: enabled ? 'telegram' : (currentSettings?.totp_enabled ? 'google_authenticator' : (currentSettings?.passkey_enabled ? 'passkey' : (currentSettings?.push_otp_enabled ? 'push_otp' : null))),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setIsEnabled(enabled || hasOtherMethods);
      setTelegramEnabled(enabled);
      setCurrentMethod(enabled ? 'telegram' : (currentSettings?.totp_enabled ? 'google_authenticator' : (currentSettings?.passkey_enabled ? 'passkey' : (currentSettings?.push_otp_enabled ? 'push_otp' : null))));
      toast({
        title: enabled ? "Telegram 2FA Enabled" : "Telegram 2FA Disabled",
        description: enabled 
          ? "You'll receive OTP on Telegram during login" 
          : hasOtherMethods 
            ? "Telegram disabled. Other 2FA methods are still active."
            : "Two-factor authentication has been disabled",
      });
    } catch (error) {
      console.error('Error updating 2FA status:', error);
      toast({
        title: "Error",
        description: "Failed to update 2FA settings",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleGoogleAuthSetup = () => {
    if (!userId || !userEmail) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive",
      });
      return;
    }
    setShowGoogleAuthSetup(true);
  };

  const handleGoogleAuthSuccess = async (codes: string[]) => {
    setShowGoogleAuthSetup(false);
    setRecoveryCodes(codes);
    setShowRecoveryCodes(true);
    setIsEnabled(true);
    setTotpEnabled(true);
    
    // Check if other methods were already enabled to preserve them
    if (userId) {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      const { data: currentSettings } = await supabase
        .from(tableName)
        .select('two_factor_method')
        .eq('user_id', userId)
        .maybeSingle();
      
      // If Telegram was the primary method, keep it as primary
      if (currentSettings?.two_factor_method === 'telegram') {
        setCurrentMethod('telegram');
      } else {
        setCurrentMethod('google_authenticator');
      }
    } else {
      setCurrentMethod('google_authenticator');
    }
  };

  const handleRecoveryCodesConfirmed = () => {
    setShowRecoveryCodes(false);
    toast({
      title: "Setup Complete!",
      description: "Google Authenticator 2FA is now enabled",
    });
  };

  const handleDisableGoogleAuth = async () => {
    if (!userId) return;

    setIsToggling(true);

    try {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      const hasOtherMethods = telegramEnabled || passkeyEnabled || pushOtpEnabled;
      
      const { error } = await supabase
        .from(tableName)
        .update({
          totp_enabled: false,
          totp_secret: null,
          recovery_codes: [],
          two_factor_enabled: hasOtherMethods,
          two_factor_method: telegramEnabled ? 'telegram' : (passkeyEnabled ? 'passkey' : (pushOtpEnabled ? 'push_otp' : null)),
        })
        .eq('user_id', userId);

      if (error) throw error;

      setTotpEnabled(false);
      setIsEnabled(hasOtherMethods);
      setCurrentMethod(telegramEnabled ? 'telegram' : (passkeyEnabled ? 'passkey' : (pushOtpEnabled ? 'push_otp' : null)));
      toast({
        title: "Google Authenticator Disabled",
        description: hasOtherMethods 
          ? "Google Authenticator disabled. Other 2FA methods are still active."
          : "Two-factor authentication has been disabled",
      });
    } catch (error) {
      console.error('Error disabling Google Authenticator:', error);
      toast({
        title: "Error",
        description: "Failed to disable Google Authenticator",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!userId) return;

    setIsToggling(true);

    try {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      
      const { error } = await supabase
        .from(tableName)
        .update({
          two_factor_enabled: false,
          two_factor_method: null,
          totp_enabled: false,
          totp_secret: null,
          recovery_codes: [],
          passkey_enabled: false,
          passkey_credentials: [],
          push_otp_enabled: false,
        })
        .eq('user_id', userId);

      if (error) throw error;

      setIsEnabled(false);
      setTotpEnabled(false);
      setTelegramEnabled(false);
      setPasskeyEnabled(false);
      setPushOtpEnabled(false);
      setCurrentMethod(null);
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled",
      });
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      toast({
        title: "Error",
        description: "Failed to disable 2FA",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Enable passkeys directly with the device prompt (no extra sheet)
  const handlePasskeySetup = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive",
      });
      return;
    }

    if (isPasskeyDomainMismatch()) {
      toast({ title: "Passkeys unavailable", description: getPasskeyDomainMessage(), variant: "destructive" });
      return;
    }

    setIsRegisteringPasskey(true);
    try {
      await registerNativePasskey();

      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      // Passkeys unlock the device only — they never turn on login 2FA.
      await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          passkey_enabled: true,
        }, { onConflict: 'user_id' });

      setPasskeyEnabled(true);
      toast({
        title: "Passkeys Enabled",
        description: "You can now verify your login with fingerprint, face or device PIN.",
      });
    } catch (err) {
      console.error('Passkey setup error:', err);
      toast({
        title: "Passkey setup failed",
        description: describePasskeyError(err, 'Failed to setup passkey'),
        variant: "destructive",
      });
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handlePasskeySuccess = () => {
    setShowPasskeySetup(false);
    setPasskeyEnabled(true);
  };

  const handleDisablePasskey = async () => {
    if (!userId) return;

    setIsToggling(true);

    try {
      // Best effort: removing the device credentials must never block turning
      // the setting off (the API can be unavailable on some devices/domains).
      try {
        await deleteAllNativePasskeys();
      } catch (cleanupError) {
        console.warn('Could not remove device passkeys:', cleanupError);
      }
      clearSavedPasskeyIdentity();
      setPasskeyLabel('');

      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      const { error } = await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          passkey_enabled: false,
          passkey_credentials: [],
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setPasskeyEnabled(false);

      toast({
        title: "Passkeys Disabled",
        description: "Passkey unlock has been turned off for this device.",
      });
    } catch (error) {
      console.error('Error disabling passkeys:', error);
      toast({
        title: "Error",
        description: "Failed to disable passkeys",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };


  // Request push notification permission
  const handleRequestPushPermission = async () => {
    setRequestingPushPermission(true);
    try {
      // Keep the native browser prompt directly attached to this click.
      const permission = await FirebasePushService.ensurePermission();
      if (permission !== 'granted') {
        toast({
          title: permission === 'denied' ? "Notifications Blocked" : "Permission Needed",
          description: permission === 'denied'
            ? "Allow notifications in this site's browser settings, then try again."
            : "Tap Allow in the browser notification prompt.",
          variant: "destructive",
        });
        return;
      }
      const success = await FirebasePushService.requestPermissionAndSaveToken(false);
      if (success) {
        setPushPermissionGranted(true);
        toast({
          title: "Push Notifications Enabled",
          description: "You can now enable Push OTP for 2FA",
        });
      } else {
        toast({
          title: "Permission Denied",
          description: "Please allow notifications from browser settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
      toast({
        title: "Error",
        description: "Failed to enable push notifications",
        variant: "destructive",
      });
    } finally {
      setRequestingPushPermission(false);
    }
  };

  // Push OTP handlers
  const handlePushOtpSetup = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive",
      });
      return;
    }

    // Check if at least one OTP method is enabled (required for Push OTP)
    if (!totpEnabled && !telegramEnabled && !emailOtpEnabled) {
      toast({
        title: "Prerequisite Required",
        description: "Enable Google Authenticator, Telegram OTP, or Email OTP first to use Push OTP",
        variant: "destructive",
      });
      return;
    }

    if (!pushPermissionGranted) {
      toast({
        title: "Push Notifications Required",
        description: "Please enable push notifications first",
        variant: "destructive",
      });
      return;
    }

    setIsToggling(true);

    try {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      
      const { error } = await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          push_otp_enabled: true,
          two_factor_enabled: true,
          two_factor_method: currentMethod || 'push_otp',
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setPushOtpEnabled(true);
      setIsEnabled(true);
      if (!totpEnabled && !telegramEnabled && !passkeyEnabled) {
        setCurrentMethod('push_otp');
      }
      
      toast({
        title: "Push OTP Enabled",
        description: "You'll receive OTP via push notification during login",
      });
    } catch (error) {
      console.error('Error enabling Push OTP:', error);
      toast({
        title: "Error",
        description: "Failed to enable Push OTP",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleDisablePushOtp = async () => {
    if (!userId) return;

    setIsToggling(true);

    try {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      const hasOtherMethods = totpEnabled || telegramEnabled || passkeyEnabled;
      
      const { error } = await supabase
        .from(tableName)
        .update({
          push_otp_enabled: false,
          two_factor_enabled: hasOtherMethods,
          two_factor_method: totpEnabled ? 'google_authenticator' : (passkeyEnabled ? 'passkey' : (telegramEnabled ? 'telegram' : null)),
        })
        .eq('user_id', userId);

      if (error) throw error;

      setPushOtpEnabled(false);
      setIsEnabled(hasOtherMethods);
      if (!hasOtherMethods) {
        setCurrentMethod(null);
      } else if (currentMethod === 'push_otp') {
        setCurrentMethod(passkeyEnabled ? 'passkey' : (totpEnabled ? 'google_authenticator' : 'telegram'));
      }
      
      toast({
        title: "Push OTP Disabled",
        description: hasOtherMethods 
          ? "Push OTP disabled. Other 2FA methods are still active."
          : "Two-factor authentication has been disabled",
      });
    } catch (error) {
      console.error('Error disabling Push OTP:', error);
      toast({
        title: "Error",
        description: "Failed to disable Push OTP",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleEmailOtpSetup = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive",
      });
      return;
    }

    setIsToggling(true);

    try {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      
      const { error } = await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          email_otp_enabled: true,
          two_factor_enabled: true,
          two_factor_method: currentMethod || 'email_otp',
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setEmailOtpEnabled(true);
      setIsEnabled(true);
      if (!totpEnabled && !telegramEnabled && !passkeyEnabled && !pushOtpEnabled) {
        setCurrentMethod('email_otp');
      }
      
      toast({
        title: "Email OTP Enabled",
        description: "You'll receive OTP via email during login",
      });
    } catch (error) {
      console.error('Error enabling Email OTP:', error);
      toast({
        title: "Error",
        description: "Failed to enable Email OTP",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleDisableEmailOtp = async () => {
    if (!userId) return;

    setIsToggling(true);

    try {
      const tableName = isEmployer ? 'employer_settings' : 'user_settings';
      const hasOtherMethods = totpEnabled || telegramEnabled || passkeyEnabled || pushOtpEnabled;
      
      const { error } = await supabase
        .from(tableName)
        .update({
          email_otp_enabled: false,
          two_factor_enabled: hasOtherMethods,
          two_factor_method: passkeyEnabled ? 'passkey' : (totpEnabled ? 'google_authenticator' : (pushOtpEnabled ? 'push_otp' : (telegramEnabled ? 'telegram' : null))),
        })
        .eq('user_id', userId);

      if (error) throw error;

      setEmailOtpEnabled(false);
      setIsEnabled(hasOtherMethods);
      if (!hasOtherMethods) {
        setCurrentMethod(null);
      } else if (currentMethod === 'email_otp') {
        setCurrentMethod(passkeyEnabled ? 'passkey' : (totpEnabled ? 'google_authenticator' : (pushOtpEnabled ? 'push_otp' : 'telegram')));
      }
      
      toast({
        title: "Email OTP Disabled",
        description: hasOtherMethods 
          ? "Email OTP disabled. Other 2FA methods are still active."
          : "Two-factor authentication has been disabled",
      });
    } catch (error) {
      console.error('Error disabling Email OTP:', error);
      toast({
        title: "Error",
        description: "Failed to disable Email OTP",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading || telegramLoading) {
    return (
      <div className={`${inSheet ? 'py-16' : 'min-h-screen'} bg-background flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={inSheet ? 'bg-background' : 'min-h-screen bg-background'}>
      {/* Header */}
      {!inSheet && (
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-3 p-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full min-h-[44px] min-w-[44px]"
              onClick={() => navigate(backPath)}
              onTouchEnd={(e) => {
                e.preventDefault();
                navigate(backPath);
              }}
              style={{ touchAction: 'manipulation' }}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Two-Factor Authentication</h1>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={inSheet ? 'space-y-4 pb-4' : 'p-4 pb-24 space-y-4'}>


        {/* Method Options */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Choose 2FA Method:</Label>

          {/* Telegram Option */}
          <div className={`${METHOD_CARD_CLASS} ${telegramEnabled ? 'border-blue-500 bg-blue-500/5' : 'border-border'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="flex-1 min-w-0 font-medium text-sm truncate">Telegram OTP</h3>
              <Switch
                checked={telegramEnabled}
                disabled={isToggling}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setDisableDialogType('telegram');
                  } else if (!isTelegramConnected || !isChatVerified) {
                    navigate(profileSetupPath);
                  } else {
                    handleTelegramToggle(true);
                  }
                }}
              />
            </div>
          </div>

          {/* Passkeys Option - Only show if browser supports it or if already enabled */}
          {(browserSupportsPasskey || passkeyEnabled) && !checkingPasskeySupport && (
            <div className={`${METHOD_CARD_CLASS} ${passkeyEnabled ? 'border-purple-500 bg-purple-500/5' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className="flex-1 min-w-0 font-medium text-sm truncate">Passkeys</h3>
                {isRegisteringPasskey ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={passkeyEnabled}
                    disabled={isToggling || (!passkeyEnabled && !browserSupportsPasskey)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handlePasskeySetup();
                      } else {
                        setDisableDialogType('passkey');
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Email OTP Option */}
          <div className={`${METHOD_CARD_CLASS} ${emailOtpEnabled ? 'border-indigo-500 bg-indigo-500/5' : 'border-border'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="flex-1 min-w-0 font-medium text-sm truncate">Email OTP</h3>
              <Switch
                checked={emailOtpEnabled}
                disabled={isToggling}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleEmailOtpSetup();
                  } else {
                    setDisableDialogType('email_otp');
                  }
                }}
              />
            </div>
          </div>
        </div>




      </div>

      {/* Google Authenticator Setup Modal */}
      {userId && userEmail && (
        <GoogleAuthenticatorSetup
          open={showGoogleAuthSetup}
          onClose={() => setShowGoogleAuthSetup(false)}
          onSuccess={handleGoogleAuthSuccess}
          userId={userId}
          userEmail={userEmail}
          userType={userType as 'job_seeker' | 'employer'}
        />
      )}

      {/* Passkey Setup Modal */}
      {userId && (
        <PasskeySetup
          open={showPasskeySetup}
          onClose={() => setShowPasskeySetup(false)}
          onSuccess={handlePasskeySuccess}
          userId={userId}
          userType={userType as 'job_seeker' | 'employer'}
        />
      )}

      {/* Recovery Codes Display Modal */}
      <RecoveryCodesDisplay
        open={showRecoveryCodes}
        onClose={() => setShowRecoveryCodes(false)}
        codes={recoveryCodes}
        onConfirmed={handleRecoveryCodesConfirmed}
      />

      {/* Confirmation Dialog for Disable Actions */}
      <ConfirmationDialog
        open={disableDialogType !== null}
        onClose={() => setDisableDialogType(null)}
        onConfirm={() => {
          if (disableDialogType === 'google') handleDisableGoogleAuth();
          else if (disableDialogType === 'telegram') handleTelegramToggle(false);
          else if (disableDialogType === 'passkey') handleDisablePasskey();
          else if (disableDialogType === 'push_otp') handleDisablePushOtp();
          else if (disableDialogType === 'email_otp') handleDisableEmailOtp();
          else if (disableDialogType === 'all') handleDisable2FA();
        }}
        title={
          disableDialogType === 'all' 
            ? 'Disable All 2FA?' 
            : disableDialogType === 'google'
              ? 'Disable Google Authenticator?'
              : disableDialogType === 'telegram'
                ? 'Disable Telegram OTP?'
                : disableDialogType === 'push_otp'
                  ? 'Disable Push OTP?'
                  : disableDialogType === 'email_otp'
                    ? 'Disable Email OTP?'
                    : 'Disable Passkeys?'
        }
        description={
          disableDialogType === 'all'
            ? 'This will remove ALL two-factor authentication methods. Your account will be less secure.'
            : disableDialogType === 'google'
              ? `Are you sure you want to disable Google Authenticator? ${telegramEnabled || passkeyEnabled || pushOtpEnabled || emailOtpEnabled ? 'Other 2FA methods will remain active.' : 'Your account will be less secure.'}`
              : disableDialogType === 'telegram'
                ? `Are you sure you want to disable Telegram OTP? ${totpEnabled || passkeyEnabled || pushOtpEnabled || emailOtpEnabled ? 'Other 2FA methods will remain active.' : 'Your account will be less secure.'}`
                : disableDialogType === 'push_otp'
                  ? `Are you sure you want to disable Push OTP? ${totpEnabled || telegramEnabled || passkeyEnabled || emailOtpEnabled ? 'Other 2FA methods will remain active.' : 'Your account will be less secure.'}`
                  : disableDialogType === 'email_otp'
                    ? `Are you sure you want to disable Email OTP? ${totpEnabled || telegramEnabled || passkeyEnabled || pushOtpEnabled ? 'Other 2FA methods will remain active.' : 'Your account will be less secure.'}`
                    : 'Are you sure you want to disable Passkeys? You will no longer be able to unlock with fingerprint, face or device PIN. Your 2FA settings stay unchanged.'
        }
        confirmText="Confirm Disable"
      />
    </div>
  );
};

export default TwoFactorAuthSettings;
