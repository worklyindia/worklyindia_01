import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { triggerTelegramEvent } from "@/hooks/useTelegramTrigger";
import { triggerWhatsAppEvent } from "@/hooks/useWhatsAppTrigger";
import { FirebasePushService } from "@/services/FirebasePushService";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { useBrandAssets } from "@/hooks/useBrandAssets";
import { reportPaymentEvent } from "@/lib/paymentEventNotify";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayButtonProps {
  amount: number;
  points: number;
  packageName: string;
  onSuccess?: () => void;
  onFailure?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const resolveCheckoutLogoUrl = (logoUrl?: string | null) => {
  if (!logoUrl) return undefined;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (typeof window === "undefined") return logoUrl;
  return new URL(logoUrl, window.location.origin).toString();
};

const RazorpayButton: React.FC<RazorpayButtonProps> = ({
  amount,
  points,
  packageName,
  onSuccess,
  onFailure,
  className,
  children
}) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const brandAssets = useBrandAssets();
  const checkoutLogoUrl = resolveCheckoutLogoUrl(brandAssets.logo_url);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      // Only load if not already loaded
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

  const handlePayment = async () => {
    if (!user) {
      toast.error("Please login to purchase points");
      return;
    }

    setLoading(true);

    try {
      // Load Razorpay script
      const res = await loadRazorpayScript();
      if (!res) {
        throw new Error("Razorpay SDK failed to load");
      }

      // Create order via Edge function
      const { data: order, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { 
          plan: { 
            name: packageName,
            points_amount: points,
            price_inr: amount 
          } 
        }
      });

      if (orderError) {
        console.error("Order creation error:", orderError);
        // Surface server error toasts to help debug
        const rawMsg = orderError?.message || "";
        let errorMsg = "Problem creating order";
        if (rawMsg.includes("Invalid Razorpay") || rawMsg.includes("Authentication failed")) {
          errorMsg = "Invalid Razorpay settings - Please use correct API keys";
        } else if (rawMsg.includes("credentials")) {
          errorMsg = "Invalid Razorpay credentials - Please contact Admin";
        } else if (rawMsg.includes("format")) {
          errorMsg = "Invalid API key format";
        } else if (rawMsg.includes("network") || rawMsg.includes("timeout")) {
          errorMsg = "Network connection issue - Please try again";
        }
        toast.error(`${errorMsg}${rawMsg ? `: ${rawMsg}` : ''}`);
        throw new Error(errorMsg);
      }

      if (!order || !order.order_id) {
        throw new Error("Invalid order response from server");
      }

      // Razorpay checkout options
      const options = {
        key: order.key, // Use the key from server response
        amount: order.amount,
        currency: "INR",
        name: brandAssets.brand_name || BRAND_CONFIG.name,
        description: `${packageName} - ${points} Points`,
        image: checkoutLogoUrl,
        order_id: order.order_id,
        handler: async function (response: any) {
          try {
            // Verify payment
            const { data: verification, error: verifyError } = await supabase.functions.invoke('unified-verify-payment', {
              body: {
                action: 'verify-points',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                user_id: user.id,
                plan: {
                  name: packageName,
                  points_amount: points,
                  price_inr: amount
                }
              }
            });

            if (verifyError) {
              console.error("Payment verification error:", verifyError);
              
              let verifyErrorMsg = "Payment verification failed";
              if (verifyError.message?.includes("signature")) {
                verifyErrorMsg = "Payment security check failed";
              } else if (verifyError.message?.includes("timeout")) {
                verifyErrorMsg = "Payment verification timed out";
              }
              
              throw new Error(verifyErrorMsg);
            }

            if (verification.status === 'success') {
              toast.success(`✅ Payment successful! ${points} points added to your wallet`);
              
              const userName = user.user_metadata?.full_name || 'User';
              const userPhone = user.user_metadata?.phone || user.phone;
              
              // Send Telegram notification for payment success
              triggerTelegramEvent('user_payment_success', user.id, 'user', userName, {
                amount: `₹${amount}`,
                package_name: packageName,
                transaction_id: response.razorpay_payment_id
              });

              // Send WhatsApp notification for payment success
              if (userPhone) {
                triggerWhatsAppEvent('payment_successful', userPhone, userName, {
                  amount: `₹${amount}`,
                  package_name: packageName,
                  transaction_id: response.razorpay_payment_id
                });
              }

              // Send OneSignal push notification for payment success
              FirebasePushService.sendEmployerNotification(
                user.id,
                'Payment Successful! 💳',
                `₹${amount} payment for ${packageName} completed. ${points} points added!`,
                '/employer-portal'
              );

              console.log('✅ Payment success - Telegram, WhatsApp & OneSignal notifications sent');
              
              onSuccess?.();
            } else {
              toast.error("❌ Payment verification failed");
              
              const userName = user.user_metadata?.full_name || 'User';
              const userPhone = user.user_metadata?.phone || user.phone;
              
              // Send Telegram notification for payment failed
              triggerTelegramEvent('user_payment_failed', user.id, 'user', userName, {
                amount: `₹${amount}`,
                reason: 'Verification failed'
              });

              // Send WhatsApp notification for payment failed
              if (userPhone) {
                triggerWhatsAppEvent('payment_failed', userPhone, userName, {
                  amount: `₹${amount}`,
                  reason: 'Verification failed'
                });
              }

              // Send OneSignal push notification for payment failed
              FirebasePushService.sendEmployerNotification(
                user.id,
                'Payment Failed ❌',
                `₹${amount} payment for ${packageName} failed. Please try again.`,
                '/employer-portal'
              );

               console.log('✅ Payment failed - Telegram, WhatsApp & OneSignal notifications sent');

               void reportPaymentEvent({
                 status: 'failed',
                 itemName: packageName,
                 amountInr: amount,
                 paymentId: response?.razorpay_payment_id,
                 orderId: response?.razorpay_order_id,
                 reason: 'Payment verification failed',
               });

               onFailure?.();
             }
           } catch (error) {
             console.error("Payment verification error:", error);
             toast.error("Payment verification failed");
             void reportPaymentEvent({
               status: 'failed',
               itemName: packageName,
               amountInr: amount,
               paymentId: response?.razorpay_payment_id,
               orderId: response?.razorpay_order_id,
               reason: 'Payment verification could not be completed',
             });
             onFailure?.();
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: user.user_metadata?.full_name || "User",
          email: user.email,
        },
        notes: {
          user_id: user.id,
          package: packageName,
        },
        theme: {
          color: brandAssets.primary_color || BRAND_CONFIG.firstWordColor,
        },
        modal: {
          ondismiss: function() {
            toast.error("Payment cancelled by user");
            void reportPaymentEvent({
              status: 'cancelled',
              itemName: packageName,
              amountInr: amount,
              orderId: order.order_id,
              reason: 'You closed the payment window',
            });
            setLoading(false);
            onFailure?.();
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      // Listen for failures explicitly to capture detailed reasons
      if (paymentObject && paymentObject.on) {
        paymentObject.on('payment.failed', function (resp: any) {
          console.error('Razorpay payment.failed:', resp);
          const reason = resp?.error?.description || resp?.error?.reason || 'Payment failed';
          toast.error(`Payment failed: ${reason}`);
          void reportPaymentEvent({
            status: 'failed',
            itemName: packageName,
            amountInr: amount,
            paymentId: resp?.error?.metadata?.payment_id,
            orderId: resp?.error?.metadata?.order_id || order.order_id,
            reason,
          });
          setLoading(false);
          onFailure?.();
        });
      }
      paymentObject.open();

    } catch (error: any) {
      console.error("Payment error:", error);
      
      // Clear error messages for different scenarios
      let errorMessage = "Problem starting payment";
      
      if (error?.message?.includes("Authentication failed")) {
        errorMessage = "Razorpay configuration issue - Please contact Admin";
      } else if (error?.message?.includes("Plan")) {
        errorMessage = "Package data error - Please try again";
      } else if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
        errorMessage = "Network connection issue - Please try again";
      } else if (error?.message?.includes("Razorpay SDK")) {
        errorMessage = "Razorpay not loading - Please refresh page";
      }
      
      toast.error(errorMessage);
      console.error("Detailed error:", {
        message: error?.message,
        cause: error?.cause,
        stack: error?.stack
      });
      
      setLoading(false);
      onFailure?.();
    }
  };

  return (
    <Button
      variant="primary"
      onClick={handlePayment}
      disabled={loading}
      className={className}
    >
      {loading ? "Processing..." : children || `Pay ₹${amount}`}
    </Button>
  );
};

export default RazorpayButton;