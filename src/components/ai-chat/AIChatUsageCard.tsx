import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Mic, Volume2, Image, Crown, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAIChatSubscription } from '@/hooks/useAIChatSubscription';
import { cn } from '@/lib/utils';

export const AIChatUsageCard: React.FC = () => {
  const navigate = useNavigate();
  const { status, imageUsage, getUsagePercentage, getRemainingUsage, isFeatureLocked, getSubscriptionDates } = useAIChatSubscription();

  if (!status) return null;

  const remaining = getRemainingUsage();
  const plan = status.plan;
  const usage = status.usage;
  const isUnlimited = plan.messages_per_month >= 999999;
  const subscriptionDates = getSubscriptionDates();

  const usageItems = [
    {
      icon: <MessageSquare className="w-4 h-4" />,
      label: 'AI Messages',
      used: usage.messages_count,
      total: plan.messages_per_month,
      color: 'hsl(var(--primary))',
    },
    {
      icon: <Volume2 className="w-4 h-4" />,
      label: 'Voice Playback',
      used: usage.voice_playback_count,
      total: plan.voice_playback_per_month,
      color: 'hsl(var(--secondary))',
    },
    {
      icon: <Mic className="w-4 h-4" />,
      label: 'Voice Input',
      used: usage.voice_input_count,
      total: plan.voice_input_per_month,
      color: 'hsl(var(--accent))',
    },
    {
      icon: <Image className="w-4 h-4" />,
      label: 'Image Analysis',
      used: usage.image_analysis_count,
      total: plan.image_analysis_per_month,
      color: 'hsl(var(--muted-foreground))',
    },
  ];

  // AI Image Generation usage item
  const imageGenerationItem = imageUsage ? {
    icon: <Sparkles className="w-4 h-4" />,
    label: 'AI Generation',
    used: imageUsage.images_generated,
    total: imageUsage.monthly_limit,
    color: 'hsl(var(--chart-5))',
  } : null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
          {plan.name === 'Enterprise' && <Crown className="w-5 h-5 text-yellow-500" />}
            {plan.name} Plan
          </h3>
          {subscriptionDates && (
            <p className="text-sm text-muted-foreground">
              {subscriptionDates.isFree 
                ? `Resets: ${subscriptionDates.endDate}` 
                : `Expires: ${subscriptionDates.endDate}`}
            </p>
          )}
        </div>
        <Badge variant={plan.price_inr === 0 ? 'secondary' : 'default'}>
          {isUnlimited ? 'Owner' : plan.price_inr === 0 ? 'Free' : `₹${plan.price_inr}/month`}
        </Badge>
      </div>

      <div className="space-y-3">
        {usageItems.map((item, idx) => {
          const isLocked = isFeatureLocked(item.used, item.total);
          const percentage = getUsagePercentage(item.used, item.total);
          
          return (
            <div 
              key={idx} 
              className={cn("space-y-1 cursor-pointer", isLocked && "opacity-60")}
              onClick={() => isLocked && navigate('/ai-assistant/subscription')}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {isUnlimited ? (
                      <span className="text-primary">Unlimited</span>
                    ) : (
                      `${item.used}/${item.total}`
                    )}
                  </span>
                </div>
              </div>
              {!isUnlimited && (
                <Progress 
                  value={percentage} 
                  className={cn(
                    "h-2",
                    isLocked && "[&>div]:bg-destructive"
                  )}
                />
              )}
            </div>
          );
        })}

        {/* AI Image Generation Usage - Separate Section */}
        {imageGenerationItem && (
          <>
            <div>
              <div 
                className={cn(
                  "space-y-1 cursor-pointer", 
                  isFeatureLocked(imageGenerationItem.used, imageGenerationItem.total) && "opacity-60"
                )}
                onClick={() => isFeatureLocked(imageGenerationItem.used, imageGenerationItem.total) && navigate('/ai-assistant/subscription')}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {imageGenerationItem.icon}
                    <span className="font-medium">{imageGenerationItem.label}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {isUnlimited ? <span className="text-primary">Unlimited</span> : `${imageGenerationItem.used}/${imageGenerationItem.total}`}
                    </span>
                  </div>
                </div>
                {!isUnlimited && <Progress 
                  value={getUsagePercentage(imageGenerationItem.used, imageGenerationItem.total)} 
                  className={cn(
                    "h-2",
                    isFeatureLocked(imageGenerationItem.used, imageGenerationItem.total) && "[&>div]:bg-destructive"
                  )}
                />}
              </div>
            </div>
          </>
        )}
      </div>

    </Card>
  );
};
