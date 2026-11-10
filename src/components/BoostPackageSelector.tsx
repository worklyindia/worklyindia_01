import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Crown, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BoostPackage {
  id: string;
  name: string;
  price_inr: number;
  boost_days: number;
  boost_level: number;
  is_active: boolean;
  sort_order: number;
  most_popular?: boolean;
}

interface BoostPackageSelectorProps {
  onSelectPackage: (packageData: BoostPackage) => void;
  selectedPackageId?: string;
}

const BoostPackageSelector: React.FC<BoostPackageSelectorProps> = ({
  onSelectPackage,
  selectedPackageId
}) => {
  const [packages, setPackages] = useState<BoostPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoostPackages();
  }, []);

  const fetchBoostPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('boost_packages')
        .select('id, name, price_inr, boost_days, boost_level, is_active, sort_order, most_popular')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching boost packages:', error);
      toast.error('Failed to load boost packages');
    } finally {
      setLoading(false);
    }
  };

  const getPackageIcon = (level: number) => {
    switch (level) {
      case 1: return <Zap className="w-5 h-5" />;
      case 2: return <Crown className="w-5 h-5" />;
      case 3: return <Rocket className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getPackageColor = (level: number) => {
    switch (level) {
      case 1: return "from-primary to-primary-glow";
      case 2: return "from-secondary to-secondary";
      case 3: return "from-warning to-warning";
      default: return "from-primary to-primary-glow";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Boost Your Job</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-20 bg-muted rounded"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto">
      <div className="text-center">
        <h3 className="text-xl font-bold gradient-text mb-2">🚀 Boost Your Job</h3>
        <p className="text-sm text-muted-foreground">
          Get more visibility and appear at the top of trending jobs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <Card
            key={pkg.id}
            className={`relative overflow-hidden cursor-pointer transition-smooth hover:scale-[1.02] hover:shadow-large group ${
              selectedPackageId === pkg.id 
                ? 'ring-2 ring-primary border-primary shadow-glow' 
                : 'border-border hover:border-primary/50 shadow-soft'
            } ${pkg.most_popular ? 'transform scale-105 shadow-large' : ''}`}
            onClick={() => onSelectPackage(pkg)}
          >
            {/* Most Popular Badge */}
            {pkg.most_popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                <Badge className="bg-gradient-secondary text-secondary-foreground px-4 py-1 font-semibold text-xs rounded-full shadow-medium animate-pulse-glow">
                  ⭐ MOST POPULAR
                </Badge>
              </div>
            )}

            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${getPackageColor(pkg.boost_level)} opacity-5 group-hover:opacity-10 transition-smooth`} />
            
            <div className="relative p-6 text-center">
              {/* Icon */}
              <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-br ${getPackageColor(pkg.boost_level)} flex items-center justify-center text-white mb-4 shadow-soft group-hover:shadow-glow transition-smooth`}>
                {getPackageIcon(pkg.boost_level)}
              </div>

              {/* Package name */}
              <h4 className="text-lg font-bold text-foreground mb-3">{pkg.name}</h4>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">₹{pkg.price_inr.toLocaleString()}</span>
                <div className="text-xs text-muted-foreground mt-1">One-time payment</div>
              </div>

              {/* Features */}
              <div className="space-y-3 text-sm mb-6">
                <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                  <div className="w-5 h-5 bg-gradient-warning rounded-full flex items-center justify-center text-white text-xs">
                    🔥
                  </div>
                  <span className="font-medium">{pkg.boost_days} days boost</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                  <div className="w-5 h-5 bg-gradient-success rounded-full flex items-center justify-center text-white text-xs">
                    ⭐
                  </div>
                  <span className="font-medium">+{pkg.boost_level * 100} trending points</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                  <div className="w-5 h-5 bg-gradient-primary rounded-full flex items-center justify-center text-white text-xs">
                    🎯
                  </div>
                  <span className="font-medium">Top of trending list</span>
                </div>
              </div>

              {/* Level badge */}
              <Badge 
                className={`text-xs font-semibold px-3 py-1 mb-2 bg-gradient-to-r ${getPackageColor(pkg.boost_level)} text-white border-0 shadow-soft`}
              >
                Level {pkg.boost_level} Boost
              </Badge>

              {/* Selection indicator */}
              {selectedPackageId === pkg.id && (
                <div className="absolute top-3 right-3">
                  <div className="w-8 h-8 bg-gradient-success rounded-full flex items-center justify-center shadow-soft animate-bounce-in">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Boost benefits */}
      <div className="bg-muted/30 rounded-lg p-4 mt-6">
        <h4 className="font-medium text-foreground mb-2">✨ Boost Benefits:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Your job appears at the top of trending jobs</li>
          <li>• Massive boost to your trending score</li>
          <li>• Higher visibility to job seekers</li>
          <li>• More applications and engagement</li>
          <li>• ⭐ Boosted badge on your job posting</li>
        </ul>
      </div>
    </div>
  );
};

export default BoostPackageSelector;