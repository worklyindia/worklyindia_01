import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  optional?: boolean;
}

const StepHeader: React.FC<Props> = ({ icon: Icon, title, description, optional }) => (
  <div className="flex items-start gap-3 mb-6">
    <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primary shrink-0">
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">{title}</h2>
        {optional && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Optional
          </span>
        )}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
  </div>
);

export default StepHeader;