import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { useBrandAssets } from "@/hooks/useBrandAssets";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpaySubscriptionButtonProps {
  keyName: string;
  tier: string;
  onSuccess?: (apiKey: string) => void;
  onFailure?: () => void;
  className?: string;
}

const resolveCheckoutLogoUrl = (logoUrl?: string | null) => {
  if (!logoUrl) return undefined;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (typeof window === "undefined") return logoUrl;
  return new URL(logoUrl, window.location.origin).toString();
};

const RazorpaySubscriptionButton: React.FC<RazorpaySubscriptionButtonProps> = ({
  keyName,
  tier,
  onSuccess,
  onFailure,
  className
}) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const brandAssets = useBrandAssets();
  const checkoutLogoUrl = resolveCheckoutLogoUrl(brandAssets.logo_url);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscription = async () => {
    if (!user) {
      toast.error("Please login first");
      return;
    }

    // Check if user already has 2 pro keys
    const { data: existingProKeys } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('rate_limit_tier', 'pro')
      .eq('is_active', true);

    if (existingProKeys && existingProKeys.length >= 2) {
      toast.error("Pro tier limit reached! You can only have 2 pro API keys. Please delete an existing pro key to create a new one.");
      onFailure?.();
      return;
    }

    setLoading(true);

    try {
      const res = await loadRazorpayScript();
      if (!res) {
        throw new Error("Razorpay SDK failed to load");
      }

      console.log("Creating subscription...");
      const { data: subscription, error: subError } = await supabase.functions.invoke(
        'create-api-subscription',
        {
          body: { key_name: keyName, tier: tier }
        }
      );

      if (subError) {
        console.error("Subscription creation error:", subError);
        const ctxBody = (subError as any)?.context?.body;
        let serverMsg: string | undefined;
        try {
          serverMsg = ctxBody ? JSON.parse(ctxBody)?.message : undefined;
        } catch {}
        const readable = serverMsg || subError.message || "Failed to create subscription";
        toast.error(readable);
        throw new Error(readable);
      }

      if (!subscription || !subscription.subscription_id) {
        throw new Error("Invalid subscription response");
      }

      console.log("Opening Razorpay checkout...");
      const options = {
        key: subscription.key,
        subscription_id: subscription.subscription_id,
        name: brandAssets.brand_name || BRAND_CONFIG.name,
        description: `${subscription.plan_name} API Access`,
        image: checkoutLogoUrl,
        handler: async function (response: any) {
          try {
            console.log("Payment successful, verifying...");
            const { data: verification, error: verifyError } = await supabase.functions.invoke(
              'create-api-subscription',
              {
                body: {
                  action: 'verify',
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  key_name: keyName,
                }
              }
            );

            if (verifyError) {
              console.error("Payment verification error:", verifyError);
              toast.error("Payment verification failed");
              throw new Error(verifyError.message);
            }

            if (verification.status === 'success') {
              toast.success(`✅ Pro API Key activated! ${verification.requests_per_hour.toLocaleString()} req/hour`);
              onSuccess?.(verification.api_key);
            } else {
              toast.error("❌ Payment verification failed");
              onFailure?.();
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed");
            onFailure?.();
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: user.user_metadata?.full_name || "User",
          email: user.email,
        },
        theme: {
          color: brandAssets.primary_color || BRAND_CONFIG.firstWordColor,
        },
        modal: {
          ondismiss: function() {
            toast.error("Subscription cancelled");
            setLoading(false);
            onFailure?.();
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (error: any) {
      console.error("Subscription error:", error);
      toast.error(error?.message || "Failed to start subscription");
      setLoading(false);
      onFailure?.();
    }
  };

  return (
    <Button
      variant="primary"
      onClick={handleSubscription}
      disabled={loading}
      className={className}
    >
      {loading ? "Processing..." : "Subscribe to Pro - ₹999/month"}
    </Button>
  );
};

export default RazorpaySubscriptionButton;
