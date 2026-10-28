import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type OTPPurpose = 'user_signup_otp' | 'user_profile_whatsapp_verify' | 'company_signup_otp' | 'company_profile_whatsapp_verify';

interface OTPState {
  isSending: boolean;
  isVerifying: boolean;
  otpSent: boolean;
  verified: boolean;
  error: string | null;
  retryAfter: number;
  remainingAttempts: number;
}

export const useWhatsAppOTP = () => {
  const { toast } = useToast();
  const [state, setState] = useState<OTPState>({
    isSending: false,
    isVerifying: false,
    otpSent: false,
    verified: false,
    error: null,
    retryAfter: 0,
    remainingAttempts: 3,
  });

  // Countdown timer for retry
  const startCountdown = useCallback((seconds: number) => {
    setState(prev => ({ ...prev, retryAfter: seconds }));
    const interval = setInterval(() => {
      setState(prev => {
        if (prev.retryAfter <= 1) {
          clearInterval(interval);
          return { ...prev, retryAfter: 0 };
        }
        return { ...prev, retryAfter: prev.retryAfter - 1 };
      });
    }, 1000);
  }, []);

  // Normalize phone number to consistent format (digits only, e.g., 919904923067)
  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, '');
  };

  const sendOTP = useCallback(async (
    phone: string,
    name: string,
    purpose: OTPPurpose,
    userId?: string
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isSending: true, error: null }));

    try {
      // Normalize phone number for consistent storage
      const cleanPhone = normalizePhone(phone);
      
      // Generate 6-digit OTP
      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database first
      const { error: storeError } = await supabase
        .from('whatsapp_otp_verifications')
        .upsert({
          phone: cleanPhone,
          otp_code: generatedOTP,
          purpose,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          attempts: 0,
          user_id: userId || null,
          verified_at: null // Reset verified_at for new OTP
        }, {
          onConflict: 'phone,purpose'
        });

      if (storeError) {
        console.error('Error storing OTP:', storeError);
        throw new Error('Failed to generate OTP');
      }

      // Call the WhatsApp Cloud API with trigger action
      const { data, error } = await supabase.functions.invoke('whatsapp-cloud-api', {
        body: { 
          action: 'trigger',
          audience: purpose.startsWith('company_') ? 'employer' : 'job_seeker',
          event_type: purpose,
          phone: cleanPhone,
          name,
          user_type: 'user',
          metadata: {
            otp: generatedOTP,
            name,
            user_id: userId
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send OTP');
      }

      setState(prev => ({ 
        ...prev, 
        isSending: false, 
        otpSent: true,
        error: null,
        remainingAttempts: 3
      }));

      toast({
        title: "OTP Sent",
        description: "Please check your WhatsApp for the OTP",
      });

      // Start 30 second countdown for resend
      startCountdown(30);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      setState(prev => ({ ...prev, isSending: false, error: errorMessage }));
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });

      return false;
    }
  }, [toast, startCountdown]);

  const verifyOTP = useCallback(async (
    phone: string,
    otp: string,
    purpose: OTPPurpose
  ): Promise<boolean> => {
    if (otp.length !== 6) {
      setState(prev => ({ ...prev, error: 'Please enter a 6-digit OTP' }));
      return false;
    }

    setState(prev => ({ ...prev, isVerifying: true, error: null }));

    try {
      // Normalize phone for verification
      const cleanPhone = normalizePhone(phone);
      
      // Step 1: Find OTP record (without strict filters first)
      const { data: otpRecord, error: fetchError } = await supabase
        .from('whatsapp_otp_verifications')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('purpose', purpose)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !otpRecord) {
        throw new Error('No OTP found. Please request a new OTP.');
      }

      // Step 2: Check if already verified
      if (otpRecord.verified_at) {
        throw new Error('This OTP was already used. Please request a new OTP.');
      }

      // Step 3: Check expiry
      if (new Date(otpRecord.expires_at) < new Date()) {
        throw new Error('OTP has expired. Please request a new OTP.');
      }

      // Step 4: Check max attempts (default 3)
      const maxAttempts = otpRecord.max_attempts || 3;
      if (otpRecord.attempts >= maxAttempts) {
        throw new Error('Too many attempts. Please request a new OTP.');
      }

      // Step 5: Update attempt count before verification
      await supabase
        .from('whatsapp_otp_verifications')
        .update({ attempts: (otpRecord.attempts || 0) + 1 })
        .eq('id', otpRecord.id);

      // Step 6: Verify OTP code
      if (otpRecord.otp_code !== otp) {
        const remainingAttempts = maxAttempts - (otpRecord.attempts || 0) - 1;
        setState(prev => ({ ...prev, remainingAttempts }));
        throw new Error(`Wrong OTP. ${remainingAttempts} attempt(s) remaining.`);
      }

      // Mark as verified
      await supabase
        .from('whatsapp_otp_verifications')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', otpRecord.id);

      // Update auth user metadata to set phone_verified: true
      try {
        await supabase.auth.updateUser({
          data: { phone_verified: true }
        });
        console.log('✅ phone_verified set to true in user metadata');
      } catch (metadataError) {
        console.error('⚠️ Failed to update phone_verified metadata:', metadataError);
        // Non-critical - continue with verification success
      }

      setState(prev => ({ 
        ...prev, 
        isVerifying: false, 
        verified: true,
        error: null 
      }));

      toast({
        title: "Verified ✓",
        description: "WhatsApp number verified successfully!",
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setState(prev => ({ ...prev, isVerifying: false, error: errorMessage }));
      
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: errorMessage,
      });

      return false;
    }
  }, [toast]);

  const resendOTP = useCallback(async (
    phone: string,
    name: string,
    purpose: OTPPurpose,
    userId?: string
  ): Promise<boolean> => {
    if (state.retryAfter > 0) {
      toast({
        variant: "destructive",
        title: "Please Wait",
        description: `You can resend OTP in ${state.retryAfter} seconds`,
      });
      return false;
    }

    return sendOTP(phone, name, purpose, userId);
  }, [state.retryAfter, sendOTP, toast]);

  const resetState = useCallback(() => {
    setState({
      isSending: false,
      isVerifying: false,
      otpSent: false,
      verified: false,
      error: null,
      retryAfter: 0,
      remainingAttempts: 3,
    });
  }, []);

  return {
    ...state,
    sendOTP,
    verifyOTP,
    resendOTP,
    resetState,
  };
};
