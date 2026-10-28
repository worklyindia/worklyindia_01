import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Sparkles, Star, Loader2 } from 'lucide-react';
import { useAIChatSubscription } from '@/hooks/useAIChatSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_CONFIG } from '@/config/brandConfig';
import { useBrandAssets } from '@/hooks/useBrandAssets';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface AIChatSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const loadRazorpayScript = (): Promise<boolean> => {
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

const resolveCheckoutLogoUrl = (logoUrl?: string | null) => {
  if (!logoUrl) return undefined;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (typeof window === 'undefined') return logoUrl;
  return new URL(logoUrl, window.location.origin).toString();
};

export const AIChatSubscriptionDialog: React.FC<AIChatSubscriptionDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const { plans, status, refetch } = useAIChatSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const brandAssets = useBrandAssets();
  const checkoutLogoUrl = resolveCheckoutLogoUrl(brandAssets.logo_url);

  const handleSelectPlan = async (planId: string, planName: string, price: number) => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    setLoading(planId);

    try {
      // For free plan
      if (price === 0) {
        const { data, error } = await supabase.functions.invoke('ai-chat-create-subscription', {
          body: { plan_id: planId }
        });

        if (error) throw error;

        toast.success('✅ Free plan activated!');
        refetch();
        onOpenChange(false);
        setLoading(null);
        return;
      }

      // For paid plans - create Razorpay order
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'ai-chat-create-subscription',
        { body: { plan_id: planId } }
      );

      if (orderError) throw orderError;

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway');
        setLoading(null);
        return;
      }

      // Open Razorpay payment
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: brandAssets.brand_name || BRAND_CONFIG.name,
        description: `AI Career Chat - ${planName}`,
        image: checkoutLogoUrl,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              'ai-chat-verify-subscription',
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_id: planId,
                },
              }
            );

            if (verifyError) throw verifyError;

            toast.success(`✅ ${planName} plan activated successfully!`);
            refetch();
            onOpenChange(false);
          } catch (error: any) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed');
          } finally {
            setLoading(null);
          }
        },
        prefill: {
          name: user.user_metadata?.full_name || '',
          email: user.email || '',
        },
        theme: {
          color: brandAssets.primary_color || BRAND_CONFIG.firstWordColor,
        },
        modal: {
          ondismiss: function () {
            setLoading(null);
            toast.info('Payment cancelled');
          },
        },
      };

      // Close dialog before opening Razorpay
      onOpenChange(false);

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.message || 'Failed to create subscription');
      setLoading(null);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'Basic':
        return <Sparkles className="w-6 h-6 text-primary" />;
      case 'Pro':
        return <Zap className="w-6 h-6 text-primary" />;
      case 'Enterprise':
        return <Crown className="w-6 h-6 text-yellow-500" />;
      default:
        return <Star className="w-6 h-6 text-primary" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullPage>
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Choose Your Plan
          </DialogTitle>
          <DialogDescription>
            Select the perfect plan for your career journey
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
          {plans?.map((plan) => {
            const isCurrentPlan = status?.plan.id === plan.id;
            const isUnlimited = plan.messages_per_month >= 999999;
            const isPopular = plan.name === 'Pro';

            return (
              <Card
                key={plan.id}
                className={`p-4 sm:p-5 space-y-4 relative transition-all hover:shadow-lg ${
                  isCurrentPlan ? 'ring-2 ring-primary shadow-md' : ''
                } ${isPopular ? 'border-primary/50' : ''}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary shadow-md">
                    <Star className="w-3 h-3 mr-1" />
                    Popular
                  </Badge>
                )}

                {isCurrentPlan && (
                  <Badge className="absolute -top-2 right-2 bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    {getPlanIcon(plan.name)}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <div className="text-2xl sm:text-3xl font-bold mt-1">
                      {plan.price_inr === 0 ? (
                        <span className="text-primary">Free</span>
                      ) : (
                        <>
                          ₹{plan.price_inr}
                          <span className="text-xs font-normal text-muted-foreground">
                            /month
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.slice(0, 3).map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-3 border-t space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>AI Messages:</span>
                    <span className="font-medium">{isUnlimited ? '∞' : plan.messages_per_month}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Voice Playback:</span>
                    <span className="font-medium">{isUnlimited ? '∞' : plan.voice_playback_per_month}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Voice Input:</span>
                    <span className="font-medium">{isUnlimited ? '∞' : plan.voice_input_per_month}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Image Analysis:</span>
                    <span className="font-medium">{isUnlimited ? '∞' : plan.image_analysis_per_month}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Generation:</span>
                    <span className="font-medium">{isUnlimited ? '∞' : (plan.ai_image_generation_per_month || 0)}</span>
                  </div>
                </div>

                <Button
                  className="w-full rounded-full"
                  variant={isCurrentPlan ? 'outline' : isPopular ? 'default' : 'secondary'}
                  disabled={isCurrentPlan || loading === plan.id}
                  onClick={() =>
                    handleSelectPlan(plan.id, plan.name, plan.price_inr)
                  }
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : plan.price_inr === 0 ? (
                    'Activate Free'
                  ) : (
                    'Upgrade Now'
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg text-xs sm:text-sm">
          <p className="font-medium mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            All plans include:
          </p>
          <ul className="space-y-1 ml-6 text-muted-foreground">
            <li>• Smart AI model based on queries</li>
            <li>• Multi-language (Hindi & English)</li>
            <li>• Voice input & output support</li>
            <li>• Image analysis capabilities</li>
            <li>• 30-day billing cycle</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};
