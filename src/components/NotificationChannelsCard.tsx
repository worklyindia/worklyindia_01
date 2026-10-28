import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationChannelsCardProps {
  audience: 'job_seeker' | 'employer';
  userId: string | null;
  companyId?: string | null;
  emailEnabled: boolean;
  loading?: boolean;
  /** Called after the channel switch was saved, so the parent can refresh. */
  onChanged?: () => void;
}

/**
 * Email notification switch.
 * Turning email off stops every email notification until it is turned back on,
 * and the user receives one final confirmation email on that same channel.
 */
export const NotificationChannelsCard: React.FC<NotificationChannelsCardProps> = ({
  audience,
  userId,
  emailEnabled,
  loading = false,
  onChanged,
}) => {
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [emailOptimistic, setEmailOptimistic] = useState<boolean | null>(null);

  const emailChecked = emailOptimistic ?? emailEnabled;

  /** Direct table write — used when the confirmation function is unavailable. */
  const saveDirect = async (enabled: boolean) => {
    if (!userId) throw new Error('You need to be signed in to change this setting');
    const table = audience === 'employer' ? 'employer_settings' : 'user_settings';
    const { error } = await supabase
      .from(table)
      .upsert({ user_id: userId, email_notifications: enabled }, { onConflict: 'user_id' });
    if (error) throw error;
  };

  const save = async (enabled: boolean) => {
    setSaving(true);
    setEmailOptimistic(enabled);

    try {
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: { action: 'channel_preference', audience, channel: 'email', enabled },
      });

      if (error || data?.success === false) {
        // Never let a failed confirmation email block the preference itself.
        await saveDirect(enabled);
      }

      toast({
        title: enabled ? 'Subscribed' : 'Unsubscribed',
        description: enabled
          ? 'Email notifications are on.'
          : 'Email notifications are off. You can turn them back on anytime.',
      });

      onChanged?.();
    } catch (err) {
      setEmailOptimistic(null);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update notification settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <span>Notification Channels</span>
        </CardTitle>
        <CardDescription>
          Choose where you want to receive updates. Turning a channel off stops all notifications
          there until you turn it back on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 p-4 border rounded-xl">
          <div className="flex items-center gap-3 min-w-0">
            <Mail className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h4 className="font-medium text-foreground">Email Notifications</h4>
              <p className="text-sm text-muted-foreground">Receive updates by email</p>
            </div>
          </div>
          <Switch
            checked={emailChecked}
            onCheckedChange={save}
            disabled={loading || saving}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationChannelsCard;
