import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Check, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';

interface GoogleAuthenticatorSetupProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (recoveryCodes: string[]) => void;
  userId: string;
  userEmail: string;
  userType: 'job_seeker' | 'employer';
}

export const GoogleAuthenticatorSetup: React.FC<GoogleAuthenticatorSetupProps> = ({
  open,
  onClose,
  onSuccess,
  userId,
  userEmail,
  userType,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'qr' | 'verify'>('qr');
  const [totpUri, setTotpUri] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchOrGenerateSecret();
    } else {
      // Reset state when closed
      setStep('qr');
      setVerificationCode('');
      setError(null);
      // Don't reset totpUri and secret - keep them for persistence
    }
  }, [open]);

  const fetchOrGenerateSecret = async () => {
    // If we already have secret, don't regenerate
    if (secret && totpUri) {
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    try {
      // First check for existing pending verification
      const { data: existingData, error: existingError } = await supabase.functions.invoke('unified-totp', {
        body: { action: 'get-or-generate-secret', userId, userType, email: userEmail }
      });

      if (existingError) {
        console.error('Edge function error:', existingError);
        if (existingError.message?.includes('404') || existingError.message?.includes('NOT_FOUND')) {
          setError('Google Authenticator setup temporarily unavailable. Please try again later.');
          toast({
            title: "Service Unavailable",
            description: "Google Authenticator setup is not available at this time.",
            variant: "destructive",
          });
        } else {
          throw existingError;
        }
        return;
      }

      if (!existingData?.totpUri || !existingData?.secret) {
        throw new Error('Invalid response from server');
      }

      setTotpUri(existingData.totpUri);
      setSecret(existingData.secret);
    } catch (err) {
      console.error('Error fetching/generating secret:', err);
      setError('Failed to generate secret. Please try again.');
      toast({
        title: "Error",
        description: "Failed to generate setup code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyClick = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Secret key copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: "Error",
        description: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.functions.invoke('unified-totp', {
        body: { action: 'verify-setup', userId, userType, token: verificationCode }
      });

      if (verifyError) {
        console.error('Verify TOTP error:', verifyError);
        if (verifyError.message?.includes('404') || verifyError.message?.includes('NOT_FOUND')) {
          setError('Verification service temporarily unavailable. Please try again later.');
        } else {
          throw verifyError;
        }
        setVerificationCode('');
        return;
      }

      if (data?.success) {
        toast({
          title: "Success!",
          description: "Google Authenticator enabled successfully",
        });
        onSuccess(data.recoveryCodes || []);
      } else {
        setError(data?.error || 'Invalid verification code. Please check your code.');
        setVerificationCode('');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('Verification failed. Please check your code.');
      setVerificationCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(cleanValue);
    setError(null);
  };

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={onClose}
      title="Setup Google Authenticator"
      height="auto"
    >
      <div className="space-y-4 pb-2">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Generating setup code...</p>
          </div>
        ) : step === 'qr' ? (
          <>
            {/* Step 1: QR Code - Compact */}
            <div className="text-center">
              <h3 className="font-semibold text-base mb-1">Scan QR Code</h3>
              <p className="text-xs text-muted-foreground">
                Open Google Authenticator app and scan this QR code
              </p>
            </div>

            {/* QR Code - Compact */}
            {totpUri && (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <QRCodeSVG 
                    value={totpUri} 
                    size={150}
                    level="M"
                  />
                </div>
              </div>
            )}

            {/* Manual Entry Option - Compact */}
            <div className="p-3 bg-muted/50 rounded-xl space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Can't scan? Tap to copy this key:
              </p>
              <div 
                className="overflow-x-auto cursor-pointer active:scale-[0.98] transition-transform"
                onClick={handleKeyClick}
              >
                <code className={`block p-2 bg-background rounded-lg text-xs font-mono whitespace-nowrap border transition-colors ${copied ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  {secret}
                  {copied && <Check className="inline-block w-3 h-3 text-primary ml-2" />}
                </code>
              </div>
            </div>

            <Button 
              className="w-full h-11 rounded-xl"
              onClick={() => setStep('verify')}
            >
              Next: Enter Code
            </Button>
          </>
        ) : (
          <>
            {/* Step 2: Verification - Compact */}
            <div className="text-center">
              <h3 className="font-semibold text-base mb-1">Verify Setup</h3>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code from Google Authenticator
              </p>
            </div>

            <div className="space-y-3">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="text-center text-2xl tracking-[0.5em] h-14 rounded-xl font-mono"
                autoFocus
              />

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                className="w-full h-11 rounded-xl"
                onClick={handleVerify}
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Enable 2FA'
                )}
              </Button>

              <Button 
                variant="ghost"
                className="w-full h-9"
                onClick={() => setStep('qr')}
              >
                ← Back to QR Code
              </Button>
            </div>
          </>
        )}
      </div>
    </NativeBottomSheet>
  );
};

export default GoogleAuthenticatorSetup;
