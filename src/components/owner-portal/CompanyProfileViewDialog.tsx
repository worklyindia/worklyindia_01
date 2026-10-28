import React, { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Calendar,
  Users,
  Briefcase,
  Copy,
  MessageCircle,
  Linkedin,
  Facebook,
  Instagram,
  Youtube
} from "lucide-react";
import VerificationBadge from "@/components/VerificationBadge";
import { getCompanyDisplayLocation } from "@/utils/locationUtils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import AdminDeviceInfoSection from "@/components/admin/AdminDeviceInfoSection";

interface CompanyProfileViewDialogProps {
  employer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CompanyProfileViewDialog: React.FC<CompanyProfileViewDialogProps> = ({ 
  employer, 
  open, 
  onOpenChange 
}) => {
  const [details, setDetails] = useState<any>(employer);
  const { tapFeedback } = useNativeFeel();

  useEffect(() => {
    const fetchCompleteData = async () => {
      if (!employer || !open) return;

      try {
        let data = null;
        let error = null;

        if (employer.user_id) {
          const result = await supabase
            .from('companies')
            .select('*')
            .eq('user_id', employer.user_id)
            .maybeSingle();
          
          data = result.data;
          error = result.error;
        }

        if (!data && !error && employer.company_id && employer.company_id !== employer.user_id) {
          const result = await supabase
            .from('companies')
            .select('*')
            .eq('id', employer.company_id)
            .maybeSingle();
          
          data = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching company details:', error);
          setDetails(employer);
          return;
        }
        
        if (data) {
          setDetails({
            ...employer,
            ...data,
            phone: data.phone || employer.phone || '',
            company_id: employer.company_id || data.id || employer.user_id,
            total_jobs: employer.total_jobs || 0,
            active_jobs: employer.active_jobs || 0
          });
        } else {
          setDetails(employer);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setDetails(employer);
      }
    };

    if (open) {
      fetchCompleteData();
    } else {
      setDetails(employer);
    }
  }, [employer?.user_id, employer?.company_id, open]);

  if (!details) return null;

  const fullAddress = getCompanyDisplayLocation(details);
  
  const copyToClipboard = (text: string, label: string) => {
    tapFeedback();
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard!`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const openUrl = (url: string) => {
    if (!url) return;
    tapFeedback();
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(normalized, '_blank');
  };

  const formatDateWithTime = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    const formattedDate = date.toLocaleDateString('en-GB', dateOptions);
    const formattedTime = date.toLocaleTimeString('en-US', timeOptions);
    
    return `${formattedDate} ${formattedTime}`;
  };
  
  const getVerificationStatus = () => {
    if (!details.is_verified) {
      return { type: 'not_verified', text: 'Not Verified' };
    }
    
    if (!details.verified_plan_end) {
      return { type: 'active', text: 'Verified (No End Date)' };
    }
    
    const endDate = new Date(details.verified_plan_end);
    if (isNaN(endDate.getTime())) {
      return { type: 'active', text: 'Verified' };
    }
    
    const currentDate = new Date();
    
    if (endDate.getFullYear() >= 2099) {
      return { type: 'lifetime', text: 'Lifetime Verified' };
    }
    
    if (endDate > currentDate) {
      return { type: 'active', text: `Verified until ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}` };
    }
    
    return { type: 'expired', text: 'Verification Expired' };
  };
  
  const verificationStatus = getVerificationStatus();

  const handleClose = () => {
    tapFeedback();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl p-0 h-[95vh] [&>button]:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="native-scrolling overflow-y-auto h-full">
          <div className="px-6 py-4 sticky top-0 bg-background z-10 border-b">
            <StandardSheetHeader 
              title="Company Profile Details"
              onClose={handleClose}
            />
          </div>
          
          <div className="space-y-4 p-6 pt-0">
            {/* Company Header */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
              <div className="flex items-start gap-4">
                {details.logo_url && (
                  <img referrerPolicy="no-referrer" loading="lazy" decoding="async" 
                    src={details.logo_url} 
                    alt={`${details.company_name} logo`}
                    className="w-16 h-16 object-cover rounded-lg border shadow-sm"
                  />
                )}
                <div className="flex-1 min-w-0">
                  {/* User ID Display */}
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border flex-1 break-all">
                        {details.user_id}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 flex-shrink-0 active:scale-95"
                        onClick={() => copyToClipboard(details.user_id, 'User ID')}
                        title="Copy User ID"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 mb-2 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900 flex-1" title={details.company_name}>
                      {details.company_name}
                    </h2>
                     <div className="flex items-center gap-2 flex-shrink-0">
                       {details.is_verified && (
                         <VerificationBadge 
                           color={details.badge_color as 'gold' | 'blue' | 'green' | 'silver'} 
                           size={20}
                         />
                       )}
                     </div>
                  </div>
                  {details.legal_name && details.legal_name !== details.company_name && (
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
                      <p className="text-sm text-gray-900 break-words leading-relaxed">{details.legal_name}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                    <Badge variant={details.account_status === 'banned' ? 'destructive' : 'outline'}>
                      {details.account_status?.toUpperCase() || 'ACTIVE'}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {details.total_jobs} Total Jobs
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {details.active_jobs} Active Jobs
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Contact Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-900 flex-1">{details.email || 'Not provided'}</p>
                    {details.email && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 active:scale-95"
                          onClick={() => copyToClipboard(details.email, 'Email')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 active:scale-95"
                          onClick={() => { tapFeedback(); window.open(`mailto:${details.email}`); }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-900 flex-1">{details.phone || 'Not provided'}</p>
                    {details.phone && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 active:scale-95"
                          onClick={() => copyToClipboard(details.phone, 'Phone')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 active:scale-95"
                          onClick={() => { tapFeedback(); window.open(`tel:${details.phone}`); }}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-900 flex-1">{details.whatsapp_number || 'Not provided'}</p>
                    {details.whatsapp_number && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 active:scale-95"
                          onClick={() => copyToClipboard(details.whatsapp_number, 'WhatsApp')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 active:scale-95"
                          onClick={() => { tapFeedback(); window.open(`https://wa.me/${details.whatsapp_number.replace(/[^0-9]/g, '')}`); }}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <p className="text-sm text-gray-900">
                    {details.website ? (
                      <button 
                        onClick={() => openUrl(details.website)} 
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Globe className="h-4 w-4" />
                        {details.website}
                      </button>
                    ) : 'Not provided'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HR Contact</label>
                  <p className="text-sm text-gray-900">{details.hr_contact_name || 'Not provided'}</p>
                </div>
                
                {/* Social Media Accounts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Social Media</label>
                  <div className="flex gap-2 flex-wrap">
                    {details.linkedin_link && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 w-10 p-0 active:scale-95"
                        onClick={() => openUrl(details.linkedin_link)}
                      >
                        <Linkedin className="h-5 w-5 text-blue-600" />
                      </Button>
                    )}
                    {details.facebook_link && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 w-10 p-0 active:scale-95"
                        onClick={() => openUrl(details.facebook_link)}
                      >
                        <Facebook className="h-5 w-5 text-blue-800" />
                      </Button>
                    )}
                    {details.instagram_link && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 w-10 p-0 active:scale-95"
                        onClick={() => openUrl(details.instagram_link)}
                      >
                        <Instagram className="h-5 w-5 text-pink-600" />
                      </Button>
                    )}
                    {details.youtube_link && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-10 w-10 p-0 active:scale-95"
                        onClick={() => openUrl(details.youtube_link)}
                      >
                        <Youtube className="h-5 w-5 text-red-600" />
                      </Button>
                    )}
                    {!(details.linkedin_link || details.facebook_link || details.instagram_link || details.youtube_link) && (
                      <span className="text-sm text-gray-500">Not provided</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                Location Details
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                  <p className="text-sm text-gray-900">{fullAddress || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precise Address</label>
                  <p className="text-sm text-gray-900">{details.precise_address || 'Not provided'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <p className="text-sm text-gray-900">{details.city || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <p className="text-sm text-gray-900">{details.state || 'Not provided'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <p className="text-sm text-gray-900">{details.country || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <p className="text-sm text-gray-900">{details.postal_code || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Company Details */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Company Details
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                    <p className="text-sm text-gray-900">{details.industry || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
                    <p className="text-sm text-gray-900">{details.company_size || details.organisation_size || 'Not provided'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <p className="text-sm text-gray-900">{details.description || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Verification Details */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                Verification & Activity
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Status</label>
                  <Badge 
                    variant={verificationStatus.type === 'not_verified' ? 'secondary' : 
                            verificationStatus.type === 'expired' ? 'destructive' : 'default'}
                  >
                    {verificationStatus.text}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                    <p className="text-sm text-gray-900">{formatDateWithTime(details.created_at)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                    <p className="text-sm text-gray-900">{formatDateWithTime(details.updated_at)}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Interaction</label>
                  <p className="text-sm text-gray-900">{formatDateWithTime(details.last_interaction_at)}</p>
                </div>
              </div>
            </div>

            {/* Device Information */}
            {details.user_id && <AdminDeviceInfoSection userId={details.user_id} />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CompanyProfileViewDialog;
