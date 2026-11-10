import { useEffect, useState } from 'react';
import { useLeaderboardTimer } from '@/hooks/useLeaderboard';
import { Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export const LeaderboardTimer = () => {
  const { data: cycleData } = useLeaderboardTimer();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    if (!cycleData?.end) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const endTime = cycleData.end.getTime();
      const difference = endTime - now;

      if (difference <= 0) {
        setHasEnded(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setHasEnded(false);
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [cycleData]);

  if (!cycleData) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Loading...</span>
      </div>
    );
  }

  if (hasEnded) {
    return (
      <div className="flex items-center gap-2 text-destructive font-semibold">
        <Clock className="w-4 h-4" />
        <span>Competition Ended</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 justify-center">
        <Clock className="w-3 h-3 md:w-4 md:h-4" />
        <span className="font-mono text-sm md:text-lg font-bold">
          {String(timeLeft.days).padStart(2, '0')}:
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
      
      {cycleData.start && cycleData.end && (
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-xs md:text-sm text-primary-foreground/80">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Start: {format(cycleData.start, 'dd MMMM yyyy, hh:mm a')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>End: {format(cycleData.end, 'dd MMMM yyyy, hh:mm a')}</span>
          </div>
        </div>
      )}
    </div>
  );
};