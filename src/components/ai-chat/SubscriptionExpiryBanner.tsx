import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAIChatSubscription } from '@/hooks/useAIChatSubscription';

export const SubscriptionExpiryBanner: React.FC = () => {
  const navigate = useNavigate();
  const { status } = useAIChatSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (!status || dismissed) return null;

  const subscription = status.subscription;
  const plan = status.plan;

  // Only show for paid plans with active subscriptions
  if (!subscription || plan.price_inr === 0 || subscription.status !== 'active') {
    return null;
  }

  const endsAt = new Date(subscription.ends_at);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Show banner if expiring within 5 days
  if (daysUntilExpiry > 5 || daysUntilExpiry < 0) return null;

  const isExpiringSoon = daysUntilExpiry <= 2;

  return (
    <Alert variant={isExpiringSoon ? 'destructive' : 'default'} className="mb-4">
      <Clock className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">
            {isExpiringSoon 
              ? `🚨 Subscription Expiring in ${daysUntilExpiry} Day${daysUntilExpiry !== 1 ? 's' : ''}!` 
              : `⏰ Subscription Renewal Reminder`
            }
          </p>
          <p className="text-sm mt-1">
            Your {plan.name} plan expires on {endsAt.toLocaleDateString('en-IN')}. 
            {isExpiringSoon 
              ? ' Renew now to avoid service interruption!' 
              : ' Renew before expiry to continue enjoying premium features.'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isExpiringSoon ? 'default' : 'outline'}
            onClick={() => navigate('/ai-assistant/subscription')}
          >
            Renew Now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
