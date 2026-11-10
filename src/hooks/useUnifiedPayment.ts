import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { useBrandAssets } from "@/hooks/useBrandAssets";

export interface PaymentPackage {
  id: string;
  name: string;
  price_inr: number;
  points_amount?: number;
  boost_days?: number;
  boost_level?: number;
  validity_days?: number;
  badge_color?: string;
}

export type PaymentType = 'boost' | 'verification';

const resolveCheckoutLogoUrl = (logoUrl?: string | null) => {
  if (!logoUrl) return undefined;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (typeof window === "undefined") return logoUrl;
  return new URL(logoUrl, window.location.origin).toString();
};

const setPaymentInProgress = (inProgress: boolean) => {
  try {
    if (inProgress) sessionStorage.setItem('payment_in_progress', 'true');
    else sessionStorage.removeItem('payment_in_progress');
  } catch { /* ignore */ }
};

export const useUnifiedPayment = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const brandAssets = useBrandAssets();
  const checkoutLogoUrl = resolveCheckoutLogoUrl(brandAssets.logo_url);

  const processPayment = async (
    paymentType: PaymentType,
    selectedPackage: PaymentPackage,
    jobId?: string,
    jobTitle?: string
  ) => {
    if (!user || !selectedPackage) {
      toast.error("Missing required information");
      return false;
    }

    setLoading(true);
    
    // Set payment flag BEFORE order creation to prevent any reload during entire payment process
    setPaymentInProgress(true);
    console.log('🔒 Payment in progress flag SET - preventing reloads');

    try {
      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        
        const scriptLoaded = await new Promise((resolve) => {
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

        if (!scriptLoaded) {
          throw new Error("Razorpay SDK failed to load");
        }
      }

      // Create order based on payment type
      let orderData, orderError;
      
      switch (paymentType) {
      case 'boost':
        ({ data: orderData, error: orderError } = await supabase.functions.invoke('create-boost-order', {
          body: { 
            job_id: jobId,
            boost_package_id: selectedPackage.id
          }
        }));
        break;
          
      case 'verification':
        ({ data: orderData, error: orderError } = await supabase.functions.invoke('create-verification-order', {
          body: { 
            verification_package_id: selectedPackage.id
          }
        }));
        break;
          
        default:
          throw new Error("Invalid payment type");
      }

      if (orderError) {
        throw new Error(orderError.message);
      }

      // Validate order data
      if (!orderData || !orderData.order_id) {
        throw new Error("Invalid order data received from server");
      }

      if (!orderData.key) {
        throw new Error("Razorpay key not provided by server");
      }

      // Setup Razorpay options
      const options = {
        key: orderData.key, // Use key from server response
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: brandAssets.brand_name || BRAND_CONFIG.name,
        description: getPaymentDescription(paymentType, selectedPackage, jobTitle),
        image: checkoutLogoUrl,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          // Clean up beforeunload handler
          const beforeUnloadHandler = (window as any).__paymentBeforeUnloadHandler;
          if (beforeUnloadHandler) {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            delete (window as any).__paymentBeforeUnloadHandler;
          }
          
          try {
            console.log("Payment successful, verifying with retry:", response);
            
            // Store payment context for recovery
            try {
              localStorage.setItem('pending_payment', JSON.stringify({
                paymentType,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                package: selectedPackage,
                timestamp: Date.now()
              }));
            } catch (e) {
              console.warn('Could not store pending payment');
            }
            
            // Use retry logic for verification
            const { data: verification, error: verifyError } = await verifyPaymentWithRetry(
              paymentType, 
              response, 
              orderData, 
              selectedPackage, 
              user.id
            );
            
            // Clear pending payment on success
            try {
              localStorage.removeItem('pending_payment');
            } catch (e) {}
            
            if (verifyError) {
              console.error("Verification error after retries:", verifyError);
              toast.error("Payment received! Points will be added shortly via backup process.");
              setPaymentInProgress(false);
              setLoading(false);
              return false;
            }

            if (verification?.status === 'success') {
              toast.success(
                getSuccessMessage(paymentType, selectedPackage, response.razorpay_payment_id),
                { duration: 8000 }
              );
              setPaymentInProgress(false);
              setLoading(false);
              return true;
            } else {
              console.error("Verification failed with status:", verification?.status);
              toast.error(
                getFailureMessage(selectedPackage, verification?.message || "Payment verification failed"),
                { duration: 10000 }
              );
              setPaymentInProgress(false);
              setLoading(false);
              return false;
            }
          } catch (error: any) {
            console.error("Payment verification error after all retries:", error);
            // More helpful message since webhook backup exists
            toast.error("Payment received! If it is not activated in 5 minutes, please contact support.");
            setPaymentInProgress(false);
            setLoading(false);
            return false;
          }
        },
        prefill: {
          name: user.user_metadata?.full_name || "User",
          email: user.email,
        },
        notes: {
          user_id: user.id,
          type: paymentType,
          package_name: selectedPackage.name,
        },
        theme: {
          color: brandAssets.primary_color || BRAND_CONFIG.firstWordColor,
        },
        modal: {
          ondismiss: function() {
            console.log("Payment modal dismissed by user");
            // Clean up beforeunload handler
            const beforeUnloadHandler = (window as any).__paymentBeforeUnloadHandler;
            if (beforeUnloadHandler) {
              window.removeEventListener('beforeunload', beforeUnloadHandler);
              delete (window as any).__paymentBeforeUnloadHandler;
            }
            setPaymentInProgress(false);
            setLoading(false);
          },
          escape: false, // Prevent closing with ESC key
          backdropclose: false, // Prevent closing by clicking backdrop
          confirm_close: true // Show confirmation before closing
        }
      };

      // Add beforeunload handler to prevent accidental page close
      const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Payment is in progress. Are you sure you want to leave?';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);

      // Add payment failure handler
      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast.error(
          getFailureMessage(selectedPackage, response.error?.description || response.error?.reason),
          { duration: 10000 }
        );
        setPaymentInProgress(false);
        setLoading(false);
        window.removeEventListener('beforeunload', beforeUnloadHandler);
      });

      console.log("Opening Razorpay with options:", {
        key: options.key.substring(0, 12) + "...",
        amount: options.amount,
        order_id: options.order_id
      });

      // Store the beforeunload handler for cleanup after payment
      (window as any).__paymentBeforeUnloadHandler = beforeUnloadHandler;
      
      paymentObject.open();

      return true;

    } catch (error: any) {
      console.error("Payment initiation error:", error);
      
      // Clean up on error
      setPaymentInProgress(false);
      const beforeUnloadHandler = (window as any).__paymentBeforeUnloadHandler;
      if (beforeUnloadHandler) {
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        delete (window as any).__paymentBeforeUnloadHandler;
      }
      
      // Enhanced error messaging
      let errorMessage = "Failed to initiate payment";
      if (error.message.includes("Authentication failed")) {
        errorMessage = "Payment configuration error. Please contact support.";
      } else if (error.message.includes("Invalid order")) {
        errorMessage = "Invalid payment details. Please try again.";
      } else if (error.message.includes("Razorpay")) {
        errorMessage = "Payment service unavailable. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

// Sleep utility for retry delays
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Verify payment with retry logic
  const verifyPaymentWithRetry = async (
    paymentType: PaymentType,
    paymentResponse: any,
    orderData: any,
    selectedPackage: PaymentPackage,
    userId: string,
    maxAttempts = 3
  ) => {
    const delays = [0, 2000, 5000]; // Immediate, 2s, 5s
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Verification retry attempt ${attempt + 1}/${maxAttempts} after ${delays[attempt]}ms delay`);
          await sleep(delays[attempt]);
        }

        const result = await verifyPaymentSingle(paymentType, paymentResponse, orderData, selectedPackage, userId);
        
        if (result.data?.status === 'success') {
          console.log(`✅ Payment verified on attempt ${attempt + 1}`);
          return result;
        }
        
        // If we got a response but it's not success, check if it's a retryable error
        if (result.error?.message?.includes('timeout') || 
            result.error?.message?.includes('network') ||
            result.error?.message?.includes('fetch')) {
          lastError = new Error(result.error.message);
          continue;
        }
        
        // Non-retryable error, return immediately
        return result;
        
      } catch (error: any) {
        console.error(`Verification attempt ${attempt + 1} failed:`, error);
        lastError = error;
        
        // Only retry on network/timeout errors
        if (!error.message?.includes('timeout') && 
            !error.message?.includes('network') &&
            !error.message?.includes('fetch') &&
            !error.message?.includes('Failed to fetch')) {
          throw error;
        }
      }
    }

    // All retries failed
    console.error('❌ All verification attempts failed');
    throw lastError || new Error('Payment verification failed after all retries');
  };

  const verifyPaymentSingle = async (
    paymentType: PaymentType,
    paymentResponse: any,
    orderData: any,
    selectedPackage: PaymentPackage,
    userId: string
  ) => {
    switch (paymentType) {
      case 'boost':
        return await supabase.functions.invoke('unified-verify-payment', {
          body: {
            action: 'verify-boost',
            razorpay_order_id: paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
            jobBoostId: orderData.jobBoostId
          }
        });
      
      case 'verification':
        return await supabase.functions.invoke('unified-verify-payment', {
          body: {
            action: 'verify-verification',
            razorpay_order_id: paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
            user_id: userId,
            verification_package_id: selectedPackage.id
          }
        });
      
      default:
        throw new Error("Invalid payment type");
    }
  };

  const getPaymentDescription = (paymentType: PaymentType, selectedPackage: PaymentPackage, jobTitle?: string) => {
    switch (paymentType) {
      case 'boost': 
        // Razorpay must never receive the word "job"
        return `Visibility plan - ${(selectedPackage as any).boost_days || ''} days`.replace(/\s+days$/, ' days');
      case 'verification': 
        return `${selectedPackage.name} Verification Package`;
      default: 
        return selectedPackage.name || "Payment";
    }
  };

  const formatInr = (amount?: number | null) =>
    typeof amount === "number" && !Number.isNaN(amount)
      ? `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`
      : "";

  const getSuccessMessage = (
    paymentType: PaymentType,
    selectedPackage: PaymentPackage,
    paymentId?: string
  ) => {
    const amount = formatInr(selectedPackage.price_inr);
    const ref = paymentId ? ` • Payment ID: ${paymentId}` : "";

    switch (paymentType) {
      case 'boost':
        return `🚀 Payment successful — ${amount} paid for ${selectedPackage.name}. Your job stays on top for ${selectedPackage.boost_days} days${ref}`;
      case 'verification':
        return `✅ Payment successful — ${amount} paid for ${selectedPackage.name}. Verification is now active${ref}`;
      default:
        return `✅ Payment successful — ${amount} paid${ref}`;
    }
  };

  const getFailureMessage = (
    selectedPackage: PaymentPackage,
    reason?: string
  ) => {
    const amount = formatInr(selectedPackage.price_inr);
    return `❌ Payment failed${amount ? ` — ${amount} for ${selectedPackage.name}` : ""}${
      reason ? ` • ${reason}` : ""
    } • If money was deducted it will be refunded automatically.`;
  };

  return {
    processPayment,
    loading
  };
};