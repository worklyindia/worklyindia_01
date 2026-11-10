import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAIChatSubscription } from '@/hooks/useAIChatSubscription';

export const UsageAlertBanner: React.FC = () => {
  const navigate = useNavigate();
  const { status, getUsagePercentage, imageUsage } = useAIChatSubscription();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Reset dismissed state when usage changes
    setDismissed(false);
  }, [status?.usage]);

  if (!status || dismissed) return null;

  const plan = status.plan;
  const usage = status.usage;
  const isUnlimited = plan.messages_per_month >= 999999;

  if (isUnlimited) return null;

  

  // Check if any usage is at or above 80%
  const usageItems = [
    {
      label: 'AI Messages',
      percentage: getUsagePercentage(usage.messages_count, plan.messages_per_month),
      used: usage.messages_count,
      total: plan.messages_per_month,
    },
    {
      label: 'Voice Playback',
      percentage: getUsagePercentage(usage.voice_playback_count, plan.voice_playback_per_month),
      used: usage.voice_playback_count,
      total: plan.voice_playback_per_month,
    },
    {
      label: 'Voice Input',
      percentage: getUsagePercentage(usage.voice_input_count, plan.voice_input_per_month),
      used: usage.voice_input_count,
      total: plan.voice_input_per_month,
    },
    {
      label: 'Image Analysis',
      percentage: getUsagePercentage(usage.image_analysis_count, plan.image_analysis_per_month),
      used: usage.image_analysis_count,
      total: plan.image_analysis_per_month,
    },
    ...(imageUsage ? [{
      label: 'AI Generation',
      percentage: getUsagePercentage(imageUsage.images_generated, imageUsage.monthly_limit),
      used: imageUsage.images_generated,
      total: imageUsage.monthly_limit,
    }] : []),
  ];

  const highUsageItems = usageItems.filter(item => item.percentage >= 80);

  if (highUsageItems.length === 0) return null;

  const criticalItems = highUsageItems.filter(item => item.percentage >= 90);
  const isCritical = criticalItems.length > 0;

  return (
    <Alert 
      variant={isCritical ? 'destructive' : 'default'} 
      className="mb-4 rounded-2xl shadow-lg border-2"
    >
      <AlertDescription className="flex flex-col gap-4 p-4">
        {/* Header with Icon */}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isCritical ? 'bg-destructive/20' : 'bg-warning/20'
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base sm:text-lg leading-tight mb-2">
              {isCritical ? '⚠️ Critical: Usage Limit Nearly Reached!' : '⚡ High Usage Alert'}
            </p>
            <div className="space-y-1">
              {highUsageItems.map((item, idx) => (
                <p key={idx} className="text-sm font-medium">
                  {item.label}: <span className="font-bold">{item.used}/{item.total}</span> ({Math.round(item.percentage)}%)
                </p>
              ))}
            </div>
            {plan.price_inr === 0 && (
              <p className="text-sm mt-2 opacity-90">
                Upgrade to continue using AI Career Chat without interruption.
              </p>
            )}
          </div>
        </div>

        {/* Buttons - Full width on mobile, auto on desktop */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button
            size="lg"
            variant={isCritical ? 'default' : 'outline'}
            onClick={() => navigate('/ai-assistant/subscription')}
            className="w-full sm:flex-1 rounded-full font-semibold"
          >
            {plan.price_inr === 0 ? 'Upgrade Plan' : 'View Usage'}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="w-full sm:w-auto rounded-full"
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
