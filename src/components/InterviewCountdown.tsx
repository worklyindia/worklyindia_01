import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InterviewCountdownProps {
  scheduledAt: string;
  scheduledEndAt?: string | null;
  onCanJoin?: (canJoin: boolean) => void;
  variant?: 'full' | 'compact';
}

export const InterviewCountdown = ({ 
  scheduledAt, 
  scheduledEndAt, 
  onCanJoin,
  variant = 'full'
}: InterviewCountdownProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  // Sync with IST server time on mount
  useEffect(() => {
    const syncServerTime = async () => {
      try {
        const { data, error } = await supabase.rpc('get_server_time_ist');
        if (!error && data) {
          const serverTimeEpoch = data as number;
          setCurrentTime(new Date(serverTimeEpoch));
        } else {
          console.error('Error fetching server time:', error);
          setCurrentTime(new Date());
        }
      } catch (error) {
        console.error('Failed to sync server time:', error);
        setCurrentTime(new Date());
      } finally {
        setIsLoading(false);
      }
    };

    syncServerTime();
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Calculate time difference
  const interviewTime = new Date(scheduledAt);
  const now = currentTime.getTime();
  const targetTime = interviewTime.getTime();
  const difference = targetTime - now;

  // Calculate DD:HH:MM:SS
  const days = Math.max(0, Math.floor(difference / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)));
  const seconds = Math.max(0, Math.floor((difference % (1000 * 60)) / 1000));

  const pad = (num: number) => String(num).padStart(2, '0');

  // Notify parent about join status
  useEffect(() => {
    if (onCanJoin) {
      const endTime = scheduledEndAt ? new Date(scheduledEndAt).getTime() : targetTime + (2 * 60 * 60 * 1000);
      // Can join ONLY AT or AFTER scheduled start time (exact millisecond check)
      const canJoin = difference <= 0 && now < endTime + (30 * 60 * 1000);
      onCanJoin(canJoin);
    }
  }, [difference, onCanJoin, scheduledEndAt, now, targetTime]);

  if (isLoading) {
    return (
      <div className="text-center p-3 bg-muted rounded-lg animate-pulse">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Check if interview is live
  const endTime = scheduledEndAt ? new Date(scheduledEndAt).getTime() : targetTime + (2 * 60 * 60 * 1000);
  const isLive = difference <= 0 && now < endTime;
  // Show "Interview Ended" immediately when scheduled end time is reached
  const hasEnded = now >= endTime;

  // Check if starting soon (within 10 minutes)
  const isStartingSoon = difference > 0 && difference <= (10 * 60 * 1000);

  if (hasEnded) {
    return (
      <div className="text-center p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-sm font-medium text-destructive">Interview Ended</p>
      </div>
    );
  }

  if (isLive) {
    // Calculate time remaining until interview ends
    const timeUntilEnd = endTime - now;
    const hoursRemaining = Math.max(0, Math.floor(timeUntilEnd / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((timeUntilEnd % (1000 * 60 * 60)) / (1000 * 60)));
    const secondsRemaining = Math.max(0, Math.floor((timeUntilEnd % (1000 * 60)) / 1000));

    return (
      <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p className="text-xs text-muted-foreground mb-2">🔴 Live Now</p>
        <p className="text-2xl font-mono font-bold text-red-600 dark:text-red-500">
          {pad(hoursRemaining)}:{pad(minutesRemaining)}:{pad(secondsRemaining)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Time Remaining</p>
      </div>
    );
  }

  if (isStartingSoon) {
    return (
      <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">Starting Soon</p>
        <p className="text-2xl font-mono font-bold text-orange-600 dark:text-orange-500">
          {pad(minutes)}:{pad(seconds)}
        </p>
      </div>
    );
  }

  // Full countdown
  if (variant === 'compact') {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">Starts in</p>
        <p className="text-lg font-mono font-semibold text-primary">
          {pad(days)}:{pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center p-3 bg-muted rounded-lg">
      <p className="text-sm text-muted-foreground mb-2">Starts in</p>
      <p className="text-3xl md:text-4xl font-mono font-bold text-primary">
        {pad(days)}:{pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        DD : HH : MM : SS
      </p>
    </div>
  );
};
