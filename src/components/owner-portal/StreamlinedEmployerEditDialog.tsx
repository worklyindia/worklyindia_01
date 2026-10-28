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

interface StreamlinedEmployerEditDialogProps {
  employer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: any) => Promise<void>;
}

export function StreamlinedEmployerEditDialog({ 
  employer, 
  open, 
  onOpenChange, 
  onSave 
}: StreamlinedEmployerEditDialogProps) {
  const [formData, setFormData] = useState(() => ({
    company_name: employer?.company_name || '',
    legal_name: employer?.legal_name || '',
    email: employer?.email || '',
    phone: employer?.phone || '',
    whatsapp_number: employer?.whatsapp_number || '',
    location: employer?.location || '',
    precise_address: employer?.precise_address || '',
    city: employer?.city || '',
    state: employer?.state || '',
    country: employer?.country || '',
    postal_code: employer?.postal_code || '',
    industry: employer?.industry || '',
    company_size: employer?.company_size || '',
    website: employer?.website || '',
    description: employer?.description || '',
    hr_contact_name: employer?.hr_contact_name || '',
    instagram_link: employer?.instagram_link || '',
    facebook_link: employer?.facebook_link || '',
    youtube_link: employer?.youtube_link || '',
    linkedin_link: employer?.linkedin_link || ''
  }));

  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();
  
  // WhatsApp OTP verification states
  const { isVerificationRequired, isLoading: isTriggerLoading } = useWhatsAppTriggerCheck('company_profile_whatsapp_verify');
  const [originalWhatsAppNumber, setOriginalWhatsAppNumber] = useState("");
  const [originalWhatsAppVerified, setOriginalWhatsAppVerified] = useState(false);
  const [isWhatsAppOTPVerified, setIsWhatsAppOTPVerified] = useState(false);

  useEffect(() => {
    if (employer) {
      const whatsappNum = employer.whatsapp_number || '';
      setFormData({
        company_name: employer.company_name || '',
        legal_name: employer.legal_name || '',
        email: employer.email || '',
        phone: employer.phone || '',
        whatsapp_number: whatsappNum,
        location: employer.location || '',
        precise_address: employer.precise_address || '',
        city: employer.city || '',
        state: employer.state || '',
        country: employer.country || '',
        postal_code: employer.postal_code || '',
        industry: employer.industry || '',
        company_size: employer.company_size || '',
        website: employer.website || '',
        description: employer.description || '',
        hr_contact_name: employer.hr_contact_name || '',
        instagram_link: employer.instagram_link || '',
        facebook_link: employer.facebook_link || '',
        youtube_link: employer.youtube_link || '',
        linkedin_link: employer.linkedin_link || ''
      });
      // Store original values for comparison
      setOriginalWhatsAppNumber(whatsappNum);
      setOriginalWhatsAppVerified(employer.whatsapp_verified || false);
      setIsWhatsAppOTPVerified(false);
    }
  }, [employer]);

  const [saving, setSaving] = useState(false);

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
      case 'company_name':
      case 'legal_name':
        const cleanedName = removeEmojis(value).replace(/[0-9]/g, '');
        return cleanedName.slice(0, 22);
      
      case 'hr_contact_name':
        const cleanedHRName = removeEmojis(value).replace(/[0-9]/g, '');
        return cleanedHRName.slice(0, 22);
      
      case 'phone':
      case 'whatsapp_number':
        return value.replace(/[^0-9+\s-]/g, '');
      
      case 'website':
        return removeEmojis(value).slice(0, 40);
      
      case 'description':
        return value.slice(0, 120);
      
      default:
        return value;
    }
  };

  const handleSave = async () => {
    if (saving) {
      console.log('Save already in progress, ignoring duplicate click');
      return;
    }

    // Check if verification is required
    if (needsVerificationToSave()) {
      toast.error("Please verify your WhatsApp number with OTP first");
      return;
    }

    tapFeedback();

    try {
      setSaving(true);
      console.log('Starting save operation for company:', formData.company_name);
      
      // Determine whatsapp_verified status
      let whatsappVerified = originalWhatsAppVerified;
      if (isWhatsAppOTPVerified) {
        whatsappVerified = true;
      } else if (isWhatsAppNumberChanged()) {
        whatsappVerified = false;
      }
      
      await onSave({
        ...formData,
        whatsapp_verified: whatsappVerified
      });
      
      console.log('Save operation completed successfully');
      successFeedback();
      toast.success("✅ SUCCESS! Company profile updated successfully", {
        duration: 4000,
        style: {
          background: '#10B981',
          color: 'white',
          border: '1px solid #059669',
          fontSize: '16px',
          fontWeight: 'bold'
        }
      });
      onOpenChange(false);
    } catch (error) {
      errorFeedback();
      console.error('Save operation failed:', error);
      toast.error("Failed to update company profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    const validatedValue = validateInput(field, value);
    setFormData(prev => ({ ...prev, [field]: validatedValue }));
  };

  const handleClose = () => {
    tapFeedback();
    onOpenChange(false);
  };

  if (!employer) return null;

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
              title="Edit Company Profile"
              onClose={handleClose}
            />
          </div>
          
          <div className="space-y-6 pb-6">
            {/* Essential Company Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="company_name" className="text-sm font-medium">
                  Company Name *
                </Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="Enter company name"
                  className="mt-1 h-12 text-base"
                />
                <p className="text-xs text-muted-foreground mt-1">Characters: {formData.company_name.length}/22, no numbers</p>
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address *
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
                    Mobile Number *
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
                  name={formData.hr_contact_name || formData.company_name || 'Company'}
                  purpose="company_profile_whatsapp_verify"
                  onVerified={() => setIsWhatsAppOTPVerified(true)}
                  isPhoneValid={formData.whatsapp_number.length >= 10}
                  className="mt-2"
                  autoSend={true}
                  key={`otp-${formatWhatsAppNumber(formData.whatsapp_number)}`}
                />
              )}

              <div>
                <Label htmlFor="precise_address" className="text-sm font-medium">
                  Complete Address
                </Label>
                <Textarea
                  id="precise_address"
                  rows={3}
                  value={formData.precise_address || ''}
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
                    value={formData.city || ''}
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
                    value={formData.state || ''}
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
                    value={formData.postal_code || ''}
                    onChange={(e) => handleChange('postal_code', e.target.value)}
                    placeholder="Enter postal code"
                    className="mt-1 h-12 text-base"
                  />
                </div>
                
                <div>
                  <Label htmlFor="country" className="text-sm font-medium">
                    Country
                  </Label>
                  <Input
                    id="country"
                    value={formData.country || ''}
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
                  placeholder="e.g., Mumbai, Delhi"
                  className="mt-1 h-12 text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="industry" className="text-sm font-medium">
                    Industry
                  </Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => handleChange('industry', e.target.value)}
                    placeholder="e.g., IT, Healthcare"
                    className="mt-1 h-12 text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="company_size" className="text-sm font-medium">
                    Organization Size
                  </Label>
                  <Input
                    id="company_size"
                    value={formData.company_size}
                    onChange={(e) => handleChange('company_size', e.target.value)}
                    placeholder="e.g., 1-10, 11-50"
                    className="mt-1 h-12 text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="website" className="text-sm font-medium">
                  Website
                </Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1 h-12 text-base"
                  maxLength={40}
                />
                <p className="text-xs text-muted-foreground mt-1">Characters: {formData.website.length}/40</p>
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">
                  Company Description
                </Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Brief description about the company"
                  className="mt-1 text-base"
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground mt-1">Max 120 characters ({formData.description.length}/120)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="legal_name" className="text-sm font-medium">
                    Legal Name *
                  </Label>
                  <Input
                    id="legal_name"
                    value={formData.legal_name}
                    onChange={(e) => handleChange('legal_name', e.target.value)}
                    placeholder="Legal company name"
                    className="mt-1 h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Characters: {formData.legal_name.length}/22, no numbers</p>
                </div>

                <div>
                  <Label htmlFor="hr_contact_name" className="text-sm font-medium">
                    HR Contact Name *
                  </Label>
                  <Input
                    id="hr_contact_name"
                    value={formData.hr_contact_name}
                    onChange={(e) => handleChange('hr_contact_name', e.target.value)}
                    placeholder="HR contact person name"
                    className="mt-1 h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Characters: {formData.hr_contact_name.length}/22, only name</p>
                </div>
              </div>

              {/* Social Media Links */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Social Media Links</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="instagram_link" className="text-sm">
                      Instagram
                    </Label>
                    <Input
                      id="instagram_link"
                      value={formData.instagram_link}
                      onChange={(e) => handleChange('instagram_link', e.target.value)}
                      placeholder="https://instagram.com/..."
                      className="mt-1 h-12 text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="facebook_link" className="text-sm">
                      Facebook
                    </Label>
                    <Input
                      id="facebook_link"
                      value={formData.facebook_link}
                      onChange={(e) => handleChange('facebook_link', e.target.value)}
                      placeholder="https://facebook.com/..."
                      className="mt-1 h-12 text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youtube_link" className="text-sm">
                      YouTube
                    </Label>
                    <Input
                      id="youtube_link"
                      value={formData.youtube_link}
                      onChange={(e) => handleChange('youtube_link', e.target.value)}
                      placeholder="https://youtube.com/..."
                      className="mt-1 h-12 text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="linkedin_link" className="text-sm">
                      LinkedIn
                    </Label>
                    <Input
                      id="linkedin_link"
                      value={formData.linkedin_link}
                      onChange={(e) => handleChange('linkedin_link', e.target.value)}
                      placeholder="https://linkedin.com/..."
                      className="mt-1 h-12 text-base"
                    />
                  </div>
                </div>
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
