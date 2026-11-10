import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { useWhatsAppTriggerCheck } from "@/hooks/useWhatsAppTriggerCheck";
import { formatWhatsAppNumber } from "@/hooks/useWhatsAppValidation";
import WhatsAppOTPVerification from "@/components/WhatsAppOTPVerification";
import { Check } from "lucide-react";

interface WebsiteUserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  onSave: (user: any) => Promise<void>;
  updateUserStatus?: (userId: string, status: string) => Promise<void>;
}

export function WebsiteUserEditDialog({ open, onOpenChange, user, onSave, updateUserStatus }: WebsiteUserEditDialogProps) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    whatsapp_number: "",
    location: "",
    precise_address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
  });
  
  const [saving, setSaving] = useState(false);
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();
  
  // WhatsApp OTP verification states
  const { isVerificationRequired, isLoading: isTriggerLoading } = useWhatsAppTriggerCheck('user_profile_whatsapp_verify');
  const [originalWhatsAppNumber, setOriginalWhatsAppNumber] = useState("");
  const [originalWhatsAppVerified, setOriginalWhatsAppVerified] = useState(false);
  const [isWhatsAppOTPVerified, setIsWhatsAppOTPVerified] = useState(false);

  useEffect(() => {
    if (open && user) {
      const whatsappNum = user.whatsapp_number || "";
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        whatsapp_number: whatsappNum,
        location: user.location || "",
        precise_address: user.precise_address || "",
        city: user.city || "",
        state: user.state || "",
        country: user.country || "",
        postal_code: user.postal_code || "",
      });
      // Store original values for comparison
      setOriginalWhatsAppNumber(whatsappNum);
      setOriginalWhatsAppVerified(user.whatsapp_verified || false);
      setIsWhatsAppOTPVerified(false);
    }
  }, [user, open]);

  // Check if WhatsApp number has changed
  const isWhatsAppNumberChanged = () => {
    const currentFormatted = formatWhatsAppNumber(formData.whatsapp_number);
    const originalFormatted = formatWhatsAppNumber(originalWhatsAppNumber);
    return currentFormatted !== originalFormatted && formData.whatsapp_number.length >= 10;
  };

  // Determine if verification is needed for save
  const needsVerificationToSave = () => {
    if (!isVerificationRequired) return false;
    if (!formData.whatsapp_number || formData.whatsapp_number.length < 10) return false;
    
    // If number changed, need verification
    if (isWhatsAppNumberChanged()) {
      return !isWhatsAppOTPVerified;
    }
    
    // If number same and was already verified, no need
    if (originalWhatsAppVerified) {
      return false;
    }
    
    // Number same but not verified - need verification
    return !isWhatsAppOTPVerified;
  };

  // Show verified badge when: number unchanged and was verified, or OTP just verified
  const showVerifiedBadge = () => {
    if (isWhatsAppOTPVerified) return true;
    if (!isWhatsAppNumberChanged() && originalWhatsAppVerified) return true;
    return false;
  };

  // Determine if OTP UI should show
  const shouldShowOTPVerification = () => {
    if (!isVerificationRequired || isTriggerLoading) return false;
    if (!formData.whatsapp_number || formData.whatsapp_number.length < 10) return false;
    if (showVerifiedBadge()) return false;
    return true;
  };

  // Reset OTP verification when number changes
  useEffect(() => {
    if (isWhatsAppNumberChanged()) {
      setIsWhatsAppOTPVerified(false);
    }
  }, [formData.whatsapp_number]);

  const validateInput = (field: string, value: string): string => {
    const removeEmojis = (str: string) => {
      return str.replace(/[\u{1F000}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');
    };

    switch (field) {
      case 'full_name':
        const cleanedName = removeEmojis(value).replace(/[0-9]/g, '');
        return cleanedName.slice(0, 40);
      
      case 'phone':
      case 'whatsapp_number':
        return value.replace(/[^0-9+\s-]/g, '');
      
      case 'postal_code':
        return value.replace(/[^0-9]/g, '').slice(0, 10);
      
      default:
        return removeEmojis(value);
    }
  };

  const handleChange = (field: string, value: string) => {
    const validatedValue = validateInput(field, value);
    setFormData(prev => ({ ...prev, [field]: validatedValue }));
  };

  const handleSave = async () => {
    if (saving) return;

    // Check if verification is required
    if (needsVerificationToSave()) {
      toast.error("Please verify your WhatsApp number with OTP first");
      return;
    }

    tapFeedback();

    try {
      setSaving(true);
      
      // Determine whatsapp_verified status
      let whatsappVerified = originalWhatsAppVerified;
      if (isWhatsAppOTPVerified) {
        whatsappVerified = true;
      } else if (isWhatsAppNumberChanged()) {
        whatsappVerified = false;
      }
      
      await onSave({
        ...user,
        ...formData,
        whatsapp_verified: whatsappVerified
      });
      
      successFeedback();
      onOpenChange(false);
    } catch (error: any) {
      errorFeedback();
      console.error('Save failed:', error);
      toast.error(`Failed to update profile: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    tapFeedback();
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl p-0 h-[95vh] [&>button]:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="native-scrolling overflow-y-auto h-full px-6">
          <div className="py-4 sticky top-0 bg-background z-10">
            <StandardSheetHeader 
              title="Edit User Profile"
              onClose={handleClose}
            />
          </div>
          
          <div className="space-y-6 pb-6">
            {/* User Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="full_name" className="text-sm font-medium">
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  placeholder="Enter full name"
                  className="mt-1 h-12 text-base"
                />
                <p className="text-xs text-muted-foreground mt-1">Characters: {formData.full_name.length}/40, no numbers</p>
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="Enter email address"
                  className="mt-1 h-12 text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Mobile Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+91 9876543210"
                    className="mt-1 h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Numbers only</p>
                </div>

                <div>
                  <Label htmlFor="whatsapp_number" className="text-sm font-medium flex items-center gap-2">
                    WhatsApp Number
                    {showVerifiedBadge() && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Check className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </Label>
                  <Input
                    id="whatsapp_number"
                    type="tel"
                    value={formData.whatsapp_number}
                    onChange={(e) => handleChange('whatsapp_number', e.target.value)}
                    placeholder="+91 9876543210"
                    className="mt-1 h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Format: +91XXXXXXXXXX</p>
                </div>
              </div>

              {/* WhatsApp OTP Verification */}
              {shouldShowOTPVerification() && (
                <WhatsAppOTPVerification
                  phone={formatWhatsAppNumber(formData.whatsapp_number)}
                  name={formData.full_name || 'User'}
                  purpose="user_profile_whatsapp_verify"
                  userId={user.id}
                  onVerified={() => setIsWhatsAppOTPVerified(true)}
                  isPhoneValid={formData.whatsapp_number.length >= 10}
                  className="mt-2"
                />
              )}

              <div>
                <Label htmlFor="precise_address" className="text-sm font-medium">
                  Complete Address
                </Label>
                <Textarea
                  id="precise_address"
                  rows={3}
                  value={formData.precise_address}
                  onChange={(e) => handleChange('precise_address', e.target.value)}
                  placeholder="Enter complete address"
                  className="mt-1 text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city" className="text-sm font-medium">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="Enter city"
                    className="mt-1 h-12 text-base"
                  />
                </div>
                
                <div>
                  <Label htmlFor="state" className="text-sm font-medium">
                    State
                  </Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="Enter state"
                    className="mt-1 h-12 text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postal_code" className="text-sm font-medium">
                    Postal Code
                  </Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => handleChange('postal_code', e.target.value)}
                    placeholder="Enter postal code"
                    className="mt-1 h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Numbers only</p>
                </div>
                
                <div>
                  <Label htmlFor="country" className="text-sm font-medium">
                    Country
                  </Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    placeholder="Enter country"
                    className="mt-1 h-12 text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="location" className="text-sm font-medium">
                  Location (City/Area)
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g., Ahmedabad, Gujarat"
                  className="mt-1 h-12 text-base"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons - sticky at bottom */}
          <div 
            className="sticky bottom-0 bg-background py-4 border-t space-y-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            <Button
              onClick={handleSave}
              disabled={saving || needsVerificationToSave()}
              className="w-full h-12 text-base font-semibold"
            >
              {saving ? "Saving..." : needsVerificationToSave() ? "Verify WhatsApp First" : "Save Changes"}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving}
              className="w-full h-12 text-base"
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}