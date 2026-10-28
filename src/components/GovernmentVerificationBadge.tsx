import { Shield, ExternalLink, CheckCircle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BRAND_CONFIG } from "@/config/brandConfig";

interface GovernmentVerificationBadgeProps {
  compact?: boolean;
}

const GovernmentVerificationBadge = ({ compact = false }: GovernmentVerificationBadgeProps) => {
  const verificationUrl = `https://udyamregistration.gov.in/Udyam_Verify.aspx`;

  const handleVerify = () => {
    window.open(verificationUrl, '_blank', 'noopener,noreferrer');
  };

  if (compact) {
    return (
      <button
        onClick={handleVerify}
        className="inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-full transition-colors group"
        title="Click to verify on government portal"
      >
        <Shield className="w-4 h-4 text-green-600" />
        <span className="text-xs font-medium text-green-700">
          UDYAM Verified
        </span>
        <ExternalLink className="w-3 h-3 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <section className="py-6 bg-gradient-to-br from-green-50 to-emerald-50 border-y border-green-100">
      <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Verification Info */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-green-800">
                  Government Registered Platform
                </h3>
                <Badge className="bg-green-600 text-white text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              </div>
              <p className="text-sm text-green-700">
                UDYAM Registration: <strong>{BRAND_CONFIG.udyamNumber}</strong>
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Ministry of Micro, Small & Medium Enterprises, Govt. of India
              </p>
            </div>
          </div>

          {/* Right: Verification Button */}
          <div className="flex flex-col items-center md:items-end gap-2">
            <Button
              onClick={handleVerify}
              variant="outline"
              className="border-green-300 hover:bg-green-100 text-green-700 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Verify on UDYAM Portal
            </Button>
            <span className="text-xs text-green-600">
              Click to verify at udyamregistration.gov.in
            </span>
          </div>
        </div>

        {/* Additional Trust Indicators */}
        <div className="mt-4 pt-4 border-t border-green-200">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-green-700">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>MSME Registered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>100% Free for Job Seekers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>All Employers Verified</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GovernmentVerificationBadge;
