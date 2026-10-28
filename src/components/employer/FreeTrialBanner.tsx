import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Gift, ArrowRight, X, Briefcase, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FreeTrialBannerProps {
  freeTrialUsed: boolean;
  companyName?: string;
  onDismiss?: () => void;
}

const FreeTrialBanner = ({ freeTrialUsed, companyName, onDismiss }: FreeTrialBannerProps) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (freeTrialUsed || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-primary via-primary/90 to-accent mb-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4xIiBjeD0iMjAiIGN5PSIyMCIgcj0iMiIvPjwvZz48L3N2Zz4=')] opacity-30" />
      
      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
      >
        <X className="w-4 h-4 text-white" />
      </button>

      <div className="relative p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            
            {/* Title */}
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Post Your First Job FREE!
            </h3>
            
            {/* Description */}
            <p className="text-white/90 text-sm md:text-base mb-3">
              Welcome{companyName ? `, ${companyName}` : ''}! As a new employer, you get 
              <span className="font-bold"> 1 FREE job posting</span> with full features:
            </p>

            {/* Features List */}
            <div className="flex flex-wrap gap-3 text-xs md:text-sm text-white/90">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Google Jobs Integration
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                30 Days Active
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Unlimited Applications
              </span>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => navigate('/post-job')}
            size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-lg group whitespace-nowrap"
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Post Free Job
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Expiry Note */}
        <p className="text-white/70 text-xs mt-4 text-center md:text-left">
          ⏰ This offer is available only for your first job posting. Don't miss out!
        </p>
      </div>
    </Card>
  );
};

export default FreeTrialBanner;
