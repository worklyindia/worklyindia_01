import { Loader2, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import useWebOTP from '@/hooks/useWebOTP';

interface PhoneOtpFieldProps {
  id?: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onSend: () => void;
  secondsLeft: number;
  sending: boolean;
  canSend: boolean;
  error?: string;
  otpSent?: boolean;
}

/**
 * OTP input that replaces the password box when the user types a mobile number.
 * Blue "Send" button with a 60s countdown that survives a page refresh.
 */
export const PhoneOtpField = ({
  id = 'login-otp',
  otp,
  onOtpChange,
  onSend,
  secondsLeft,
  sending,
  canSend,
  error,
  otpSent,
}: PhoneOtpFieldProps) => {
  // Chrome Android SMS auto-fill
  useWebOTP((code) => onOtpChange(code), true, true);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>OTP</Label>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            id={id}
            name="one-time-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`pl-10 tracking-[0.25em] placeholder:text-xs placeholder:tracking-normal ${error ? 'border-destructive' : ''}`}
            required
          />
        </div>
        <Button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="shrink-0 min-w-[100px] whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-70"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : secondsLeft > 0 ? (
            `${secondsLeft}s`
          ) : otpSent ? (
            'Resend'
          ) : (
            'Send'
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive leading-tight">{error}</p>}
      {!error && otpSent && (
        <p className="text-xs text-muted-foreground">OTP sent on SMS. Valid for a few minutes.</p>
      )}
    </div>
  );
};

export default PhoneOtpField;
