import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Shield, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import VerificationBadge from "@/components/VerificationBadge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface VerificationAdminDialogProps {
  employer: {
    user_id: string;
    company_id: string;
    company_name: string;
    is_verified: boolean;
    badge_color?: string;
    verified_plan_start?: string;
    verified_plan_end?: string;
  };
  onSuccess: () => void;
}

const VerificationAdminDialog: React.FC<VerificationAdminDialogProps> = ({
  employer,
  onSuccess
}) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(employer.is_verified);
  const [badgeColor, setBadgeColor] = useState(employer.badge_color || 'gold');
  const [isLifetime, setIsLifetime] = useState(
    employer.verified_plan_end ? new Date(employer.verified_plan_end).getFullYear() >= 2099 : false
  );
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    employer.verified_plan_end && new Date(employer.verified_plan_end).getFullYear() < 2099
      ? new Date(employer.verified_plan_end)
      : undefined
  );
  const [loading, setLoading] = useState(false);
  const [adminVerified, setAdminVerified] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setAdminVerified(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('check_admin_role', {
          target_user_id: user.id,
          required_role: 'admin'
        });

        if (error) {
          console.error('Admin check error:', error);
          setAdminVerified(false);
        } else {
          setAdminVerified(data || false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setAdminVerified(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const badgeColors = [
    { value: 'gold', label: 'Gold' },
    { value: 'blue', label: 'Blue' },
    { value: 'green', label: 'Green' },
    { value: 'silver', label: 'Silver' }
  ];

  const handleSave = async () => {
    tapFeedback();
    
    if (!user) {
      errorFeedback();
      toast({
        title: "Authentication Required",
        description: "Please sign in to update verification settings",
        variant: "destructive"
      });
      return;
    }

    if (adminVerified !== true) {
      errorFeedback();
      toast({
        title: "Access Denied",
        description: "Admin permissions required to update verification settings",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const startDate = new Date();
      const endDate = isLifetime 
        ? new Date('2099-12-31T23:59:59Z')
        : expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const { error } = await supabase.rpc('admin_update_company_verification_details', {
        target_user_id: employer.user_id,
        is_verified: isVerified,
        badge_color: isVerified ? badgeColor : null,
        verified_plan_start: isVerified ? startDate.toISOString() : null,
        verified_plan_end: isVerified ? endDate.toISOString() : null
      });

      if (error) {
        console.error('Database function error:', error);
        
        if (error.message?.includes('Admin role required') || error.message?.includes('Access denied')) {
          toast({
            title: "Access Denied",
            description: "Admin permissions required. Please sign in as admin.",
            variant: "destructive"
          });
        } else if (error.message?.includes('Company not found')) {
          toast({
            title: "Company Not Found",
            description: "Company profile not found for this user.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Database Error",
            description: error.message || "Failed to update verification settings",
            variant: "destructive"
          });
        }
        errorFeedback();
        return;
      }

      successFeedback();
      setOpen(false);
      setTimeout(() => {
        onSuccess();
      }, 500);
      
    } catch (error: any) {
      errorFeedback();
      console.error('Error updating verification:', error);
      toast({
        title: "एरर",
        description: error.message || "Verification settings update करने में विफल",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 sm:h-7 px-2">
          <Shield className="w-3 h-3" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto [&>button]:hidden"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="pb-4">
          <StandardSheetHeader 
            title="Manage Verification"
            onClose={() => { tapFeedback(); setOpen(false); }}
          />
        </div>

        {/* Authentication and admin status warnings */}
        {!user && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              आपको verification settings manage करने के लिए पहले sign in करना होगा।
              <Button 
                variant="link" 
                className="p-0 h-auto text-destructive underline ml-1"
                onClick={() => window.open('/auth', '_blank')}
              >
                Sign In करें
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {user && adminVerified === false && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Admin permissions की जरूरत है verification settings manage करने के लिए।
            </AlertDescription>
          </Alert>
        )}

        {user && adminVerified === null && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Admin permissions check हो रही है...
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="verified">Verified Status</Label>
            <Switch
              id="verified"
              checked={isVerified}
              onCheckedChange={setIsVerified}
            />
          </div>

          {isVerified && (
            <>
              <div className="space-y-2">
                <Label>Badge Color</Label>
                <div className="flex items-center gap-3">
                  <Select value={badgeColor} onValueChange={setBadgeColor}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {badgeColors.map(color => (
                        <SelectItem key={color.value} value={color.value}>
                          {color.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <VerificationBadge 
                    color={badgeColor as 'gold' | 'blue' | 'green' | 'silver'} 
                    size={24} 
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="lifetime">Lifetime Verification</Label>
                <Switch
                  id="lifetime"
                  checked={isLifetime}
                  onCheckedChange={setIsLifetime}
                />
              </div>

              {!isLifetime && (
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-12",
                          !expiryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiryDate ? format(expiryDate, "PPP") : "Pick expiry date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expiryDate}
                        onSelect={setExpiryDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 pt-6">
          <Button 
            variant="outline" 
            onClick={() => { tapFeedback(); setOpen(false); }}
            className="flex-1 h-12 active:scale-95 transition-transform"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !user || adminVerified !== true}
            className="flex-1 h-12 active:scale-95 transition-transform"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VerificationAdminDialog;
