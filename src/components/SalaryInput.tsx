import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AIFieldButton from "@/components/AIFieldButton";

interface SalaryInputProps {
  minSalary: string;
  maxSalary: string;
  period: string;
  onMinSalaryChange: (value: string) => void;
  onMaxSalaryChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onAIGenerate?: () => Promise<void>;
  aiDisabled?: boolean;
  aiDisabledReason?: string;
  aiRemainingCredits?: number;
  aiIsLimitReached?: boolean;
}

const formatCurrency = (value: string) => {
  const numbers = value.replace(/[^\d]/g, '');
  if (!numbers) return '';
  
  // Limit to 7 digits
  const limitedNumbers = numbers.slice(0, 7);
  
  // Indian numbering system - first comma after 3 digits, then every 2 digits
  const numStr = limitedNumbers.toString();
  const lastThreeDigits = numStr.substring(numStr.length - 3);
  const otherNumbers = numStr.substring(0, numStr.length - 3);
  
  if (otherNumbers !== '') {
    return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThreeDigits;
  } else {
    return lastThreeDigits;
  }
};

// Commission formatter: keep 0-100 only
const formatCommission = (value: string) => {
  const numbers = value.replace(/[^\d]/g, '');
  if (!numbers) return '';
  const limited = numbers.slice(0, 3);
  const num = Math.min(100, parseInt(limited, 10));
  return isNaN(num) ? '' : String(num);
};

const SalaryInput = ({ 
  minSalary, 
  maxSalary, 
  period, 
  onMinSalaryChange, 
  onMaxSalaryChange, 
  onPeriodChange,
  onAIGenerate,
  aiDisabled = false,
  aiDisabledReason,
  aiRemainingCredits,
  aiIsLimitReached = false
}: SalaryInputProps) => {
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = period === 'commission'
      ? formatCommission(e.target.value)
      : formatCurrency(e.target.value);
    onMinSalaryChange(formatted);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = period === 'commission'
      ? formatCommission(e.target.value)
      : formatCurrency(e.target.value);
    onMaxSalaryChange(formatted);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Salary Range *</Label>
        {onAIGenerate && (
          <AIFieldButton 
            onClick={onAIGenerate} 
            tooltip="Suggest salary with AI"
            disabled={aiDisabled}
            disabledReason={aiDisabledReason}
            remainingCredits={aiRemainingCredits}
            isLimitReached={aiIsLimitReached}
          />
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            {period !== 'commission' && (
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">₹</span>
            )}
            <Input
              placeholder={period === 'commission' ? '30' : '10,00,000'}
              value={minSalary}
              onChange={handleMinChange}
              className={`rounded-xl ${period === 'commission' ? 'pr-8' : 'pl-8'}`}
              inputMode="numeric"
            />
            {period === 'commission' && (
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
            )}
          </div>
          <span className="flex items-center text-muted-foreground px-2">-</span>
          <div className="relative flex-1">
            {period !== 'commission' && (
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">₹</span>
            )}
            <Input
              placeholder={period === 'commission' ? '50' : '20,00,000'}
              value={maxSalary}
              onChange={handleMaxChange}
              className={`rounded-xl ${period === 'commission' ? 'pr-8' : 'pl-8'}`}
              inputMode="numeric"
            />
            {period === 'commission' && (
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
            )}
          </div>
        </div>
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="rounded-xl w-full sm:w-40">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="commission">Commission</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SalaryInput;