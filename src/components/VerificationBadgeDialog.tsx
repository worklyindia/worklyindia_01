import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { PaymentPageHeader } from "@/components/PaymentPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUnifiedPayment } from "@/hooks/useUnifiedPayment";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { Shield, Star, Crown, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import VerificationBadge from "./VerificationBadge";

interface VerificationPackage {
  id: string;
  name: string;
  price_inr: number;
  validity_days: number;
  badge_color: string;
  is_active: boolean;
  sort_order: number;
  most_popular: boolean;
}

interface VerificationBadgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const VerificationBadgeDialog: React.FC<VerificationBadgeDialogProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const { user } = useAuth();
  const { company } = useEmployerAuth();
  const { processPayment, loading: paymentLoading } = useUnifiedPayment();
  const [packages, setPackages] = useState<VerificationPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedBadgeColor, setSelectedBadgeColor] = useState<'gold' | 'silver' | 'blue' | 'green'>('gold');

  const selectedPackageData = packages.find(pkg => pkg.id === selectedPackage);

  // Helper function to find package by badge color
  const findPackageByBadgeColor = (color: string) => {
    return packages.find(pkg => pkg.badge_color === color) || packages[0];
  };

  // Helper function to handle badge color selection and sync with package
  const handleBadgeColorSelection = (color: 'gold' | 'silver' | 'blue' | 'green') => {
    setSelectedBadgeColor(color);
    // Find and select matching package
    const matchingPackage = findPackageByBadgeColor(color);
    if (matchingPackage) {
      setSelectedPackage(matchingPackage.id);
    }
  };

  // Helper function to handle package selection and sync with badge color
  const handlePackageSelection = (packageId: string) => {
    setSelectedPackage(packageId);
    // Find package and update badge color
    const packageData = packages.find(pkg => pkg.id === packageId);
    if (packageData) {
      setSelectedBadgeColor(packageData.badge_color as 'gold' | 'silver' | 'blue' | 'green');
    }
  };

  useEffect(() => {
    if (open) {
      fetchVerificationPackages();
    }
  }, [open]);

  // Sync initial selections when packages load
  useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      const defaultPackage = packages.find(pkg => pkg.most_popular) || packages[0];
      if (defaultPackage) {
        setSelectedPackage(defaultPackage.id);
        setSelectedBadgeColor(defaultPackage.badge_color as 'gold' | 'silver' | 'blue' | 'green');
      }
    }
  }, [packages, selectedPackage]);

  const fetchVerificationPackages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('verification_packages')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching verification packages:', error);
      toast.error('Failed to load verification packages');
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    const packageData = packages.find(pkg => pkg.id === selectedPackage);
    if (!packageData) {
      toast.error("Please select a verification package");
      return;
    }

    const success = await processPayment('verification', {
      id: packageData.id,
      name: packageData.name,
      price_inr: packageData.price_inr,
      validity_days: packageData.validity_days,
      badge_color: selectedBadgeColor
    });

    if (success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const isProcessing = paymentLoading;

  const getBadgeFeatures = (badgeColor: string) => {
    const baseFeatures = [
      "Verified company badge",
      "Trust indicator for candidates",
      "Higher visibility in search results"
    ];

    if (badgeColor === 'gold') {
      baseFeatures.push("Premium placement in company directory");
      baseFeatures.push("Featured in verified companies section");
    }

    if (badgeColor === 'silver' || badgeColor === 'gold') {
      baseFeatures.push("Priority support");
    }

    return baseFeatures;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent fullPage className="[&>button]:hidden">
        <PaymentPageHeader onBack={() => onOpenChange(false)} subtitle="Get verified badge" />

        <div className="space-y-6">
          {/* Badge Preview Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-lg">Choose Your Badge Color:</h4>
            <p className="text-sm text-muted-foreground">
              Select a badge color for your verification
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['gold', 'silver', 'blue', 'green'].map((color) => (
                <Card 
                  key={color}
                  className={`cursor-pointer transition-all hover:shadow-md relative ${
                    selectedBadgeColor === color 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleBadgeColorSelection(color as 'gold' | 'silver' | 'blue' | 'green')}
                >
                  <CardContent className="p-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <VerificationBadge 
                        color={color as 'gold' | 'silver' | 'blue' | 'green'}
                        size={32}
                      />
                      <p className="font-medium text-sm capitalize">{color}</p>
                      {selectedBadgeColor === color && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Benefits Overview */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium text-primary mb-2 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Why Get Verified?
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600" />
                <span>Build Trust & Credibility</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-blue-600" />
                <span>Higher Application Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-600" />
                <span>Premium Company Status</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600" />
                <span>Verified Company Badge</span>
              </div>
            </div>
          </div>

          {/* Package Selection */}
          <div className="space-y-3">
            <h4 className="font-medium">Choose Your Verification Package:</h4>
            
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {packages.map((pkg) => (
                  <Card 
                    key={pkg.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedPackage === pkg.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border'
                    }`}
                    onClick={() => handlePackageSelection(pkg.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="font-medium">{pkg.name}</h5>
                            {pkg.most_popular && (
                              <Badge variant="secondary" className="text-xs">
                                Most Popular
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm space-y-1 mb-3">
                            <p className="text-muted-foreground">
                              Validity: <span className="font-medium text-foreground">{pkg.validity_days} days</span>
                            </p>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            <p className="font-medium mb-1">Features:</p>
                            <ul className="space-y-0.5">
                              {getBadgeFeatures(pkg.badge_color).map((feature, index) => (
                                <li key={index}>• {feature}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            ₹{pkg.price_inr.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            for {pkg.validity_days} days
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

export default VerificationBadgeDialog;
