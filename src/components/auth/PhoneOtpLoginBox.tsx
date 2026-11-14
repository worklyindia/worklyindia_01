import { useEffect, useRef, useState } from 'react';
import { Loader2, Phone, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { usePhoneOtpLogin } from '@/hooks/usePhoneOtpLogin';
import useWebOTP from '@/hooks/useWebOTP';
import { getWorklyAndroidBridge } from '@/lib/nativeAppBridge';
import { useToast } from '@/hooks/use-toast';

interface PhoneOtpLoginBoxProps {
  /** Called after the mobile OTP is verified and the session is created. */
  onVerified: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Mobile-number OTP login. Only rendered when the owner has switched on
 * phone verification (app_settings.phone_verify_enabled) — used on both the
 * job seeker and employer login screens.
 */
export const PhoneOtpLoginBox: React.FC<PhoneOtpLoginBoxProps> = ({
  onVerified,
  disabled = false,
  className,
}) => {
  const { toast } = useToast();
  const lastAutoVerifyCode = useRef('');
  const [open, setOpen] = useState(false);
  const [rawPhone, setRawPhone] = useState('');
  const [code, setCode] = useState('');
  const { secondsLeft, canSend, sending, verifying, otpSent, error, setError, sendOtp, verifyOtp } =
    usePhoneOtpLogin(rawPhone);

  const handleSend = async () => {
    try { getWorklyAndroidBridge()?.startSmsUserConsent?.(); } catch { /* manual entry remains available */ }
    const ok = await sendOtp();
    if (ok) {
      toast({ title: 'OTP sent', description: 'Check your SMS for the 6-digit code.' });
    }
  };

  const handleVerify = async (value = code) => {
    const normalizedCode = value.replace(/\D/g, '').slice(0, 6);
    if (normalizedCode.length !== 6 || lastAutoVerifyCode.current === normalizedCode) return;
    lastAutoVerifyCode.current = normalizedCode;
    const ok = await verifyOtp(normalizedCode);
    if (ok) {
      toast({ title: 'Verified', description: 'Signing you in…' });
      onVerified();
    } else {
      lastAutoVerifyCode.current = '';
      setCode('');
    }
  };

  useWebOTP((detectedCode) => {
    setCode(detectedCode);
    void handleVerify(detectedCode);
  }, open && (sending || otpSent) && !verifying);

  useEffect(() => {
    if (code.length === 6 && !verifying) void handleVerify(code);
  }, [code]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className={cn('w-full h-9 text-xs', className)}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Phone className="w-4 h-4 mr-2 text-emerald-600" />
        Mobile OTP
      </Button>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border p-3 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Login with Mobile OTP
        </Label>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setOpen(false);
            setError('');
            setCode('');
          }}
        >
          Cancel
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="Mobile number"
            value={rawPhone}
            onChange={(e) => {
              setRawPhone(e.target.value);
              setError('');
            }}
            className="pl-10"
          />
        </div>
        <Button type="button" onClick={handleSend} disabled={!canSend || disabled} className="shrink-0">
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : secondsLeft > 0 ? (
            <span className="text-xs">{secondsLeft}s</span>
          ) : otpSent ? (
            <RefreshCw className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {otpSent && (
        <div className="space-y-2">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup className="justify-center w-full">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button
            type="button"
            className="w-full"
            onClick={handleVerify}
            disabled={code.replace(/\D/g, '').length !== 6 || verifying || disabled}
          >
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Verify & Sign In
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default PhoneOtpLoginBox;
