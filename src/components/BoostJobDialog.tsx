import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { PaymentPageHeader } from "@/components/PaymentPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBoostPackages } from "@/hooks/useBoostPackages";
import { useUnifiedPayment } from "@/hooks/useUnifiedPayment";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, TrendingUp, Eye, Users, Star } from "lucide-react";
import { toast } from "sonner";

interface BoostJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  onSuccess?: () => void;
}

const BoostJobDialog: React.FC<BoostJobDialogProps> = ({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  onSuccess
}) => {
  const { user } = useAuth();
  const { packages, loading } = useBoostPackages();
  const { processPayment, loading: paymentLoading } = useUnifiedPayment();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const selectedPackageData = packages.find(pkg => pkg.id === selectedPackage);

  const handleRazorpayPayment = async () => {
    const packageData = packages.find(pkg => pkg.id === selectedPackage);
    if (!packageData) {
      toast.error("Please select a boost package");
      return;
    }

    const success = await processPayment('boost', {
      id: packageData.id,
      name: packageData.name,
      price_inr: packageData.price_inr,
      boost_days: packageData.boost_days,
      boost_level: packageData.boost_level
    }, jobId, jobTitle);

    if (success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const isProcessing = paymentLoading;

  const getBoostIcon = (level: number) => {
    switch (level) {
      case 1: return <Zap className="w-4 h-4 text-yellow-500" />;
      case 2: return <TrendingUp className="w-4 h-4 text-orange-500" />;
      case 3: return <Star className="w-4 h-4 text-red-500" />;
      default: return <Zap className="w-4 h-4 text-primary" />;
    }
  };

  const getBoostBenefits = (level: number) => {
    const baseBenefits = [
      "Appears at top of job listings",
      "⭐ Boosted badge on job posting",
      "Higher visibility to job seekers"
    ];

    if (level >= 2) {
      baseBenefits.push("Featured in trending section");
      baseBenefits.push("Priority in search results");
    }

    if (level >= 3) {
      baseBenefits.push("Homepage featuring");
      baseBenefits.push("Push notifications to relevant candidates");
    }

    return baseBenefits;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent fullPage className="[&>button]:hidden">
        <PaymentPageHeader onBack={() => onOpenChange(false)} subtitle="Boost your job" />

        <div className="space-y-4">
          {/* Benefits Overview */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium text-primary mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Why Boost Your Job?
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-green-600" />
                <span>5x More Views</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>3x More Applications</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-600" />
                <span>Premium Positioning</span>
              </div>
            </div>
          </div>

          {/* Package Selection */}
          <div className="space-y-3">
            <h4 className="font-medium">Choose Your Boost Package:</h4>
            
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {packages
                  .filter(pkg => pkg.is_active)
                  .map((pkg) => (
                  <Card 
                    key={pkg.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedPackage === pkg.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border'
                    }`}
                    onClick={() => setSelectedPackage(pkg.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getBoostIcon(pkg.boost_level)}
                            <h5 className="font-medium">{pkg.name}</h5>
                            {pkg.most_popular && (
                              <Badge variant="secondary" className="text-xs">
                                Most Popular
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm space-y-1 mb-3">
                            <p className="text-muted-foreground">
                              Boost Duration: <span className="font-medium text-foreground">{pkg.boost_days} days</span>
                            </p>
                            <p className="text-muted-foreground">
                              Boost Level: <span className="font-medium text-foreground">Level {pkg.boost_level}</span>
                            </p>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            <p className="font-medium mb-1">Benefits:</p>
                            <ul className="space-y-0.5">
                              {getBoostBenefits(pkg.boost_level).map((benefit, index) => (
                                <li key={index}>• {benefit}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            ₹{pkg.price_inr.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            for {pkg.boost_days} days
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRazorpayPayment}
              disabled={!selectedPackage || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                "Processing..."
              ) : (
                `Pay ₹${selectedPackageData?.price_inr}`
              )}
            </Button>
          </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };
  
  export default BoostJobDialog;
