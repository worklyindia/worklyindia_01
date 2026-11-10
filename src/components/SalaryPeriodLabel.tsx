import type { SalaryPeriod } from '@/utils/salaryToINR';
import { cn } from '@/lib/utils';

interface Props {
  period: SalaryPeriod;
  value: string;
  approx?: boolean;
  className?: string;
}

/**
 * Renders a salary line prefixed with its period (Hourly/Daily/Monthly/Yearly)
 * where the first character of the period is emphasized larger, e.g.
 *   [M]onthly ₹5,25,000
 * so users can spot the pay cadence at a glance.
 */
const SalaryPeriodLabel = ({ period, value, approx, className }: Props) => {
  const first = period[0];
  const rest = period.slice(1);
  return (
    <span className={cn('inline-flex items-baseline gap-1 flex-wrap', className)}>
      <span className="font-semibold text-primary">
        <span className="text-lg sm:text-xl leading-none">{first}</span>
        <span className="text-xs">{rest}</span>
      </span>
      {approx && <span className="text-[10px] text-muted-foreground">(Approx INR)</span>}
      <span className="break-words">{value}</span>
    </span>
  );
};

export default SalaryPeriodLabel;
