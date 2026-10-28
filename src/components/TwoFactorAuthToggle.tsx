import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { StandardSheetHeader } from '@/components/StandardSheetHeader';
import TwoFactorAuthSettings from '@/pages/TwoFactorAuthSettings';

interface TwoFactorAuthToggleProps {
  userType: 'job_seeker' | 'employer';
  userId: string | null;
  companyId?: string | null;
  profileSetupPath?: string;
  hideConnectTelegram?: boolean;
}

type TwoFactorMethod = 'telegram' | 'google_authenticator' | 'passkey' | 'push_otp' | 'email_otp' | null;

export const TwoFactorAuthToggle: React.FC<TwoFactorAuthToggleProps> = ({
  userType,
  userId,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<TwoFactorMethod>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [pushOtpEnabled, setPushOtpEnabled] = useState(false);
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch 2FA status
  useEffect(() => {
    const fetch2FAStatus = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';
        const { data, error } = await supabase
          .from(tableName)
          .select('two_factor_enabled, two_factor_method, totp_enabled, passkey_enabled, telegram_2fa_enabled, push_otp_enabled, email_otp_enabled')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;
        setIsEnabled(data?.two_factor_enabled ?? false);
        setTotpEnabled(data?.totp_enabled ?? false);
        setTelegramEnabled(data?.telegram_2fa_enabled ?? false);
        setPasskeyEnabled(data?.passkey_enabled ?? false);
        setPushOtpEnabled(data?.push_otp_enabled ?? false);
        setEmailOtpEnabled(data?.email_otp_enabled ?? false);
        const method = data?.two_factor_method as TwoFactorMethod;
        setCurrentMethod(
          method ??
            (data?.totp_enabled
              ? 'google_authenticator'
              : data?.passkey_enabled
                ? 'passkey'
                : data?.push_otp_enabled
                  ? 'push_otp'
                  : data?.email_otp_enabled
                    ? 'email_otp'
                    : data?.telegram_2fa_enabled
                      ? 'telegram'
                      : null)
        );
      } catch (error) {
        console.error('Error fetching 2FA status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetch2FAStatus();
  }, [userId, userType, refreshKey]);

  const getStatusText = () => {
    // Passkeys and push are not login 2FA methods, so they never count here.
    const methods = [
      totpEnabled && 'Google Authenticator',
      telegramEnabled && 'Telegram OTP',
      emailOtpEnabled && 'Email OTP'
    ].filter(Boolean);

    if (methods.length === 0) return "Disabled";
    return `Enabled - ${methods.join(' & ')}`;
  };


  const handleOpen2FASheet = () => {
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      // Refresh status after sheet closes
      setRefreshKey((k) => k + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-xl">
        <div className="flex items-center space-x-3 flex-1">
          <Shield className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-foreground">Two-Factor Authentication</h4>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-xl">
      <div className="flex items-center space-x-3 flex-1">
        <div className="relative">
          <Shield className="w-5 h-5 text-primary flex-shrink-0" />
          {isEnabled && (
            <Check className="w-3 h-3 text-green-500 absolute -top-1 -right-1 bg-background rounded-full" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground">Two-Factor Authentication</h4>
          <p className="text-sm text-muted-foreground">
            {getStatusText()}
          </p>
        </div>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        className="rounded-xl w-full sm:w-auto flex-shrink-0 min-h-[44px]"
        onClick={handleOpen2FASheet}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleOpen2FASheet();
        }}
        style={{ touchAction: 'manipulation' }}
      >
        Change
      </Button>

      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
          <StandardSheetHeader
            title="Two-Factor Authentication"
            onClose={() => handleSheetOpenChange(false)}
          />
          <div className="mt-4">
            <TwoFactorAuthSettings inSheet />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TwoFactorAuthToggle;
