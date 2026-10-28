import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AIChatUsageCard } from '@/components/ai-chat/AIChatUsageCard';
import { AIChatSubscriptionDialog } from '@/components/ai-chat/AIChatSubscriptionDialog';
import { useAIChatSubscription } from '@/hooks/useAIChatSubscription';
import { ArrowLeft, Sparkles, Zap, TrendingUp, History, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const AIChatSubscription: React.FC = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { status, isLoading, getUsagePercentage, getSubscriptionDates } = useAIChatSubscription();
  const subscriptionDates = getSubscriptionDates();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 p-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Chat Subscription
            </h1>
            <p className="text-xs text-muted-foreground">Manage your plan</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/payment-history')}
            aria-label="Payment History"
            className="rounded-full"
          >
            <History className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 space-y-4 pb-24">
        {!isLoading && status && (
          <>
            {/* Current Plan Overview Card */}
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Plan</p>
                    <h2 className="text-2xl font-bold">{status.plan.name}</h2>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                </div>
                
                {status.plan.messages_per_month >= 999999 ? (
                  <div className="text-sm text-muted-foreground">Sab AI features unlimited</div>
                ) : status.plan.price_inr === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Limited features • Upgrade for unlimited access
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    ₹{status.plan.price_inr}/month • Premium features
                  </div>
                )}
              </div>
            </Card>

            {/* Subscription Dates Card */}
            {subscriptionDates && (
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Subscription Period</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Start Date:</span>
                        <span className="font-medium">{subscriptionDates.startDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {subscriptionDates.isFree ? 'Resets on:' : 'Expiry Date:'}
                        </span>
                        <span className="font-medium">{subscriptionDates.endDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Usage Stats */}
            <AIChatUsageCard />

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center">
                <Zap className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">AI Model</p>
                <p className="text-sm font-semibold">{status.plan.ai_model_tier}</p>
              </Card>
              <Card className="p-3 text-center">
                <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Messages</p>
                <p className="text-sm font-semibold">
                  {status.plan.messages_per_month >= 999999 
                    ? '∞' 
                    : status.plan.messages_per_month
                  }
                </p>
              </Card>
              <Card className="p-3 text-center">
                <Sparkles className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Support</p>
                <p className="text-sm font-semibold">
                  {status.plan.priority_support ? 'Priority' : 'Standard'}
                </p>
              </Card>
            </div>


            {/* Features Included */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Plan Features</h3>
              <div className="space-y-2">
                {(status.plan.messages_per_month >= 999999
                  ? ['Unlimited AI Messages', 'Unlimited Voice Playback & Input', 'Unlimited Image Analysis', 'Unlimited AI Generation', 'Priority Support']
                  : status.plan.features).map((feature: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Loading subscription...</p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Button */}
      {status?.plan.messages_per_month < 999999 && (
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t">
        <Button
          size="lg"
          className="w-full rounded-full font-semibold shadow-lg"
          onClick={() => setDialogOpen(true)}
          disabled={isLoading}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          {status?.plan.price_inr === 0 ? 'Upgrade Plan' : 'Change Plan'}
        </Button>
      </div>
      )}

      <AIChatSubscriptionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default AIChatSubscription;
