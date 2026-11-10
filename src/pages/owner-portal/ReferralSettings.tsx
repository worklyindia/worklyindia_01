import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Percent, DollarSign, TrendingUp } from "lucide-react";
import { useReferralSettings } from "@/hooks/useReferralSettings";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function ReferralSettings() {
  const { settings, isLoading, updateSettings, isUpdating } = useReferralSettings();
  
  const [formData, setFormData] = useState({
    commission_percentage: 50,
    is_active: true,
    minimum_commission_amount: 1,
    maximum_commission_amount: 1000,
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        commission_percentage: settings.commission_percentage,
        is_active: settings.is_active,
        minimum_commission_amount: settings.minimum_commission_amount,
        maximum_commission_amount: settings.maximum_commission_amount,
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings(formData);
  };

  const calculateCommission = (amount: number) => {
    let commission = amount * formData.commission_percentage / 100;
    
    // Apply maximum limit
    if (formData.maximum_commission_amount > 0 && commission > formData.maximum_commission_amount) {
      commission = formData.maximum_commission_amount;
    }
    
    // Apply minimum limit
    if (formData.minimum_commission_amount > 0 && commission < formData.minimum_commission_amount) {
      commission = formData.minimum_commission_amount;
    }
    
    return commission.toFixed(2);
  };

  const isCommissionCapped = (amount: number) => {
    const rawCommission = amount * formData.commission_percentage / 100;
    if (formData.maximum_commission_amount > 0 && rawCommission > formData.maximum_commission_amount) {
      return 'max';
    }
    if (formData.minimum_commission_amount > 0 && rawCommission < formData.minimum_commission_amount) {
      return 'min';
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Referral Settings</h1>
          <p className="text-muted-foreground">
            Manage commission rates and referral program settings
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Commission Settings
            </CardTitle>
            <CardDescription>
              Configure referral commission rates and limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="commission-percentage" className="text-base font-medium">
                Commission Percentage
              </Label>
              <div className="space-y-3">
                <Slider
                  value={[formData.commission_percentage]}
                  onValueChange={([value]) => 
                    setFormData(prev => ({ ...prev, commission_percentage: value }))
                  }
                  max={100}
                  min={0}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={formData.commission_percentage}
                    onChange={(e) => 
                      setFormData(prev => ({ 
                        ...prev, 
                        commission_percentage: parseFloat(e.target.value) || 0 
                      }))
                    }
                    max={100}
                    min={0}
                    step={0.5}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-commission">Minimum Commission (₹)</Label>
                <Input
                  id="min-commission"
                  type="number"
                  value={formData.minimum_commission_amount}
                  onChange={(e) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      minimum_commission_amount: parseFloat(e.target.value) || 0 
                    }))
                  }
                  min={0}
                  step={0.01}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="max-commission">Maximum Commission (₹)</Label>
                <Input
                  id="max-commission"
                  type="number"
                  value={formData.maximum_commission_amount}
                  onChange={(e) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      maximum_commission_amount: parseFloat(e.target.value) || 0 
                    }))
                  }
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="active-toggle" className="text-base font-medium">
                  Referral Program Active
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable the entire referral system
                </p>
              </div>
              <Switch
                id="active-toggle"
                checked={formData.is_active}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_active: checked }))
                }
              />
            </div>

            <Button 
              onClick={handleSave} 
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Preview & Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Commission Preview
              </CardTitle>
              <CardDescription>
                See how commission rates apply to different payment amounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[100, 500, 1000, 2000, 5000].map((amount) => {
                const cappedStatus = isCommissionCapped(amount);
                return (
                  <div key={amount} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">₹{amount}</span>
                    <div className="text-right flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        ₹{calculateCommission(amount)}
                      </Badge>
                      {cappedStatus === 'max' && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          capped
                        </Badge>
                      )}
                      {cappedStatus === 'min' && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          min
                        </Badge>
                      )}
                      {!cappedStatus && (
                        <p className="text-xs text-muted-foreground">
                          ({formData.commission_percentage}%)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Current Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission Rate:</span>
                <Badge variant="default">
                  {formData.commission_percentage}%
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={formData.is_active ? "default" : "secondary"}>
                  {formData.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Commission:</span>
                <span>₹{formData.minimum_commission_amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Commission:</span>
                <span>₹{formData.maximum_commission_amount}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}