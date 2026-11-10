import React, { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, MapPin, Mail, Phone, Star, Calendar, FileText, User, MessageCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import { formatDateWithTime } from "@/utils/dateFormatUtils";
import SocialMediaIcons from "@/components/SocialMediaIcons";
import { useProfileTracking } from "@/hooks/useProfileTracking";
import AdminDeviceInfoSection from "@/components/admin/AdminDeviceInfoSection";

interface WebsiteUserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export function WebsiteUserProfileDialog({ open, onOpenChange, user }: WebsiteUserProfileDialogProps) {
  const [copying, setCopying] = useState(false);
  const { trackProfileView } = useProfileTracking();

  // Track profile view when dialog opens
  useEffect(() => {
    if (open && user?.user_id) {
      trackProfileView(user.user_id);
    }
  }, [open, user?.user_id, trackProfileView]);

  const copyToClipboard = async (text: string, label: string) => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    } finally {
      setCopying(false);
    }
  };

  const handleWhatsAppClick = (whatsappNumber: string) => {
    const cleanNumber = whatsappNumber.replace(/[^\d]/g, '');
    window.open(`https://wa.me/${cleanNumber}`, '_blank');
  };

  const handlePhoneClick = (phoneNumber: string) => {
    window.open(`tel:${phoneNumber}`, '_self');
  };

  const handleEmailClick = (email: string) => {
    window.open(`mailto:${email}`, '_self');
  };

  const getStatusBadge = () => {
    if (!user?.account_status || user.account_status === 'active') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
    }
    if (user.account_status === 'banned') {
      return <Badge variant="destructive">Website Banned</Badge>;
    }
    if (user.account_status === 'job_banned') {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Job Apply Banned</Badge>;
    }
    if (user.account_status === 'fully_banned') {
      return <Badge variant="destructive">Fully Banned (Profile + Job)</Badge>;
    }
    return <Badge variant="outline">{user.account_status}</Badge>;
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl max-h-[90vh] overflow-hidden p-0 [&>button]:hidden"
      >
        <div className="p-6 pb-4">
          <StandardSheetHeader 
            title="User Profile Details" 
            onClose={() => onOpenChange(false)}
          />
        </div>
        
        <ScrollArea className="h-[calc(90vh-120px)] px-6 pb-6">
          <div className="space-y-6">
          {/* Header Section */}
          <div className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={user.profile_image_url} alt={user.full_name} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-lg">
                {user.full_name?.slice(0, 2)?.toUpperCase() || "WU"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{user.full_name || "No Name"}</h2>
                {getStatusBadge()}
              </div>
              
              {/* User ID with Copy */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{user.user_id}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(user.user_id, 'User ID')}
                  disabled={copying}
                  className="h-6 w-6 p-0"
                  title="Copy User ID"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>

              {user.current_position && (
                <p className="text-sm text-muted-foreground">{user.current_position}</p>
              )}
              
              {user.company && (
                <p className="text-sm text-muted-foreground">at {user.company}</p>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">Contact Information</h3>
              
              <div className="space-y-3">
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{user.email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEmailClick(user.email)}
                      className="h-6 w-6 p-0"
                      title="Send Email"
                    >
                      <Mail className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(user.email, 'Email')}
                      className="h-6 w-6 p-0"
                      title="Copy Email"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{user.phone}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePhoneClick(user.phone)}
                      className="h-6 w-6 p-0"
                      title="Make Call"
                    >
                      <Phone className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(user.phone, 'Phone')}
                      className="h-6 w-6 p-0"
                      title="Copy Phone"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                
                {user.whatsapp_number && (
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">WhatsApp: {user.whatsapp_number}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleWhatsAppClick(user.whatsapp_number)}
                      className="h-6 w-6 p-0"
                      title="Open WhatsApp"
                    >
                      <MessageCircle className="w-3 h-3 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(user.whatsapp_number, 'WhatsApp')}
                      className="h-6 w-6 p-0"
                      title="Copy WhatsApp"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">Location</h3>
              
              <div className="space-y-3">
                {(user.location || user.precise_address || user.city || user.state || user.country) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      {user.location ? (
                        <div>{user.location}</div>
                      ) : (
                        <>
                          {user.precise_address && <div>{user.precise_address}</div>}
                          <div>
                            {[user.city, user.state, user.country, user.postal_code].filter(Boolean).join(', ')}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">Professional Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Experience</label>
                <p className="text-sm text-muted-foreground">
                  {user.experience_years ? `${user.experience_years} years` : 'Not specified'}
                </p>
              </div>
            </div>

            {user.skills && user.skills.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Skills</label>
                <div className="flex flex-wrap gap-1">
                  {user.skills.map((skill: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {user.bio && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Bio</label>
                <p className="text-sm text-muted-foreground">{user.bio}</p>
              </div>
            )}
          </div>

          {/* Account Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Applications</p>
                <p className="text-lg font-semibold text-primary">{user.total_applications || 0}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Star className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Profile Status</p>
                <p className="text-sm">{user.is_profile_complete ? 'Complete' : 'Incomplete'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Member Since</p>
                <p className="text-sm">{formatDateWithTime(user.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Social Media Links */}
          {(user.instagram_link || user.facebook_link || user.youtube_link || user.linkedin_link) && (
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Social Media
              </h3>
              <SocialMediaIcons
                instagram={user.instagram_link}
                facebook={user.facebook_link}
                youtube={user.youtube_link}
                linkedin={user.linkedin_link}
                size="md"
                className="justify-start"
              />
            </div>
          )}

          {/* Last Activity */}
          {user.last_sign_in_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Last active: {formatDateWithTime(user.last_sign_in_at)}</span>
            </div>
          )}

          {/* Device Information */}
          {user.user_id && <AdminDeviceInfoSection userId={user.user_id} />}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}