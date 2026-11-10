import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Shield, Star, Users, CheckCircle } from "lucide-react";
import { CANONICAL_DOMAIN } from '@/config/domainConfig';

interface TrustpilotWidgetProps {
  className?: string;
}

const TrustpilotWidget = ({ className = "" }: TrustpilotWidgetProps) => {

  const trustFeatures = [
    { icon: Shield, text: "Independent Review Platform" },
    { icon: Users, text: "Trusted by Millions Worldwide" },
    { icon: CheckCircle, text: "Verified Customer Reviews" },
  ];

  return (
    <Card className={`p-6 bg-gradient-to-br from-[#00b67a]/10 to-[#00b67a]/5 border-[#00b67a]/30 ${className}`}>
      <div className="flex flex-col items-center text-center space-y-5">
        {/* Trustpilot Logo with Stars */}
        <div className="flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-6 h-6 bg-[#00b67a] flex items-center justify-center">
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">
            Rate Us on Trustpilot
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your feedback helps other job seekers make informed decisions
          </p>
        </div>

        {/* Custom dark-mode Trustpilot link (replaces white TrustBox iframe) */}
        <a
          href={`https://www.trustpilot.com/review/${CANONICAL_DOMAIN}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full max-w-xs flex items-center justify-center gap-2 rounded-md border border-[#00b67a]/50 bg-[#00b67a]/10 px-6 py-3 text-lg font-medium text-foreground transition-colors hover:bg-[#00b67a]/20"
        >
          Review us on
          <Star className="w-5 h-5 fill-[#00b67a] text-[#00b67a]" />
          <span className="font-bold">Trustpilot</span>
        </a>

        {/* CTA Button */}
        <Button 
          asChild
          className="bg-[#00b67a] hover:bg-[#00a06a] text-white font-semibold px-8 py-5 rounded-xl text-base"
        >
          <a 
            href={`https://www.trustpilot.com/evaluate/${CANONICAL_DOMAIN}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <Star className="w-5 h-5 fill-white" />
            Review us on Trustpilot
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>

        {/* Trust Features */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {trustFeatures.map((feature, index) => (
            <div key={index} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <feature.icon className="w-4 h-4 text-[#00b67a]" />
              <span>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default TrustpilotWidget;
