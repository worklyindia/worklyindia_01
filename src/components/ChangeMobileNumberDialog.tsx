import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { AccountChangeFrame } from "@/components/auth/AccountChangeFrame";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidE164, toE164 } from "@/lib/phone";

interface ChangeMobileNumberDialogProps {
  children?: React.ReactNode;
  standalone?: boolean;
  currentPhone?: string | null;
  userId?: string;
  userName?: string;
  companyId?: string;
  /** Kept for call-site compatibility; the OTP itself is sent by Supabase Auth. */
  purpose?: string;
  onUpdated?: (phone: string) => void;
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const toLocal10 = (value?: string | null) => digitsOnly(value ? toE164(value) : "");

export function ChangeMobileNumberDialog({
  children,
  standalone,
  currentPhone,
  companyId,
  onUpdated,
}: ChangeMobileNumberDialogProps) {
  const navigate = useNavigate();
  const fallback = useLocation().pathname.startsWith('/employer') ? '/employer-settings' : '/settings';
  const close = () => { reset(); standalone ? navigate(fallback) : setOpen(false); };
  const [open, setOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const hasAuthPhone = !!toLocal10(currentPhone);
  const isValid = isValidE164(newPhone);
  const isSameAsCurrent = isValid && digitsOnly(newPhone) === toLocal10(currentPhone);
  const e164 = isValid ? `+${digitsOnly(newPhone)}` : "";

  const reset = () => {
    setNewPhone("");
    setOtpSent(false);
    setCode("");
    setSending(false);
    setSaving(false);
    setDone(false);
  };

  const sendOtp = async () => {
    setSending(true);
    try {
      // Rule check first: only an existing login number can be changed.
      const { data: check, error: checkErr } = await supabase.functions.invoke("unified-2fa", {
        body: { action: "check-auth-phone", newPhone: digitsOnly(newPhone) },
      });
      const checkError = (check as any)?.error || checkErr?.message;
      if (checkError) {
        toast({
          title: "Could not send OTP",
          description: (check as any)?.message || String(checkError),
          variant: "destructive",
        });
        return;
      }

      // Native Supabase Auth phone change — sends the SMS OTP to the new number.
      const { error } = await supabase.auth.updateUser({ phone: e164 });
      if (error) {
        toast({ title: "Could not send OTP", description: error.message, variant: "destructive" });
        return;
      }

      setOtpSent(true);
      toast({ title: "OTP sent", description: `6-digit code sent on WhatsApp to ${e164}` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to send OTP", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: code,
        type: "phone_change",
      });
      if (error) {
        toast({ title: "Invalid OTP", description: error.message, variant: "destructive" });
        setCode("");
        return;
      }

      // Mirror the new auth phone into the profile / company record.
      await supabase.functions.invoke("unified-2fa", {
        body: { action: "sync-auth-phone", newPhone: digitsOnly(newPhone), companyId },
      });

      setDone(true);
      onUpdated?.(e164);
      toast({ title: "Mobile number updated", description: `${e164} is now your login number.` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Verification failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountChangeFrame standalone={standalone} title="Change Mobile Number" fallback={fallback} trigger={children}
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) reset();
      }}
    >
        {!standalone && <StandardSheetHeader
          title="Change Mobile Number"
          onClose={close}
          subtitle={
            hasAuthPhone ? "Verify your new number with the WhatsApp OTP to update your login number." : undefined
          }
        />}

        {!hasAuthPhone ? (
          <div className="py-4 space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No mobile number linked</AlertTitle>
              <AlertDescription>
                This account was created without a mobile number. A new number can't be added here —
                only an existing login number can be updated. Please contact support if you need one added.
              </AlertDescription>
            </Alert>
            <Button className="w-full" variant="outline" onClick={close}>
              Close
            </Button>
          </div>
        ) : done ? (
          <div className="py-6 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4">
                <CheckCircle className="w-14 h-14 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Mobile Number Updated</h3>
              <p className="text-muted-foreground">Your login mobile number is now {e164}</p>
            </div>
            <Button className="w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="current-mobile">Current Mobile Number</Label>
              <Input id="current-mobile" value={currentPhone ? toE164(currentPhone) : ""} disabled className="bg-muted" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-mobile">New Mobile Number</Label>
              <PhoneInput
                id="new-mobile"
                value={newPhone}
                onChange={(v) => {
                  setNewPhone(v);
                  setOtpSent(false);
                  setCode("");
                }}
                disabled={otpSent || sending || saving}
              />
              {digitsOnly(newPhone).length >= 7 && !isValid && (
                <p className="text-sm text-destructive">Enter a valid mobile number.</p>
              )}
              {isSameAsCurrent && (
                <p className="text-sm text-destructive">This is already your current number.</p>
              )}
            </div>

            {!otpSent ? (
              <Button className="w-full" disabled={!isValid || isSameAsCurrent || sending} onClick={sendOtp}>
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Send OTP on WhatsApp
              </Button>
            ) : (
              <div className="space-y-3">
                <Label>Enter the 6-digit OTP</Label>
                <InputOTP maxLength={6} value={code} onChange={setCode} disabled={saving}>
                  <InputOTPGroup className="justify-center w-full">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <Button className="w-full" disabled={code.length !== 6 || saving} onClick={verifyOtp}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Verify & Update
                </Button>
                <Button variant="ghost" className="w-full" disabled={sending || saving} onClick={sendOtp}>
                  Resend OTP
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>OTP is sent on WhatsApp to the new number</li>
                <li>Your login mobile number changes only after OTP verification</li>
                <li>A number already used by another account can't be set</li>
              </ul>
            </div>
          </div>
        )}
    </AccountChangeFrame>
  );
}
