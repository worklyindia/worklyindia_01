import { useEffect, useState } from 'react';
import { differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from 'date-fns';
import { Clock } from 'lucide-react';

interface BirthDetailsDisplayProps {
  dateOfBirth: string;
}

function calcAge(birthDate: Date, now: Date) {
  const years = differenceInYears(now, birthDate);
  const afterYears = addYears(birthDate, years);
  const months = differenceInMonths(now, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInDays(now, afterMonths);
  return { years, months, days };
}

function calcLived(birthDate: Date, now: Date) {
  const diffMs = now.getTime() - birthDate.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor(totalSeconds / 60);
  return { hours: totalHours, minutes: totalMinutes, seconds: totalSeconds };
}

export const BirthDetailsDisplay = ({ dateOfBirth }: BirthDetailsDisplayProps) => {
  const birthDate = new Date(dateOfBirth + 'T00:00:00');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { years, months, days } = calcAge(birthDate, now);
  const { hours, minutes, seconds } = calcLived(birthDate, now);

  return (
    <div className="mt-2">
      {/* Live counter - all total values */}
      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Time Since Birth
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Hours</span>
            <span className="text-sm font-bold text-primary font-mono tabular-nums">
              {hours.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Minutes</span>
            <span className="text-sm font-bold text-primary font-mono tabular-nums">
              {minutes.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Seconds</span>
            <span className="text-sm font-bold text-primary font-mono tabular-nums">
              {seconds.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
