import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  MapPin, 
  Mail, 
  Phone, 
  Building2, 
  Calendar, 
  Edit, 
  Eye,
  Globe,
  Users,
  Briefcase,
  Clock,
  Play,
  Pause,
  Ban,
  UserCheck,
  Trash2,
  StopCircle,
  UserPlus,
  FileText
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import VerificationBadge from "@/components/VerificationBadge";
import { StreamlinedEmployerEditDialog } from "./StreamlinedEmployerEditDialog";
import VerificationAdminDialog from "./VerificationAdminDialog";
import CompanyProfileViewDialog from "./CompanyProfileViewDialog";
import ReferralManagementDialog from "./ReferralManagementDialog";
import JobPostingsManagementDialog from "./JobPostingsManagementDialog";
import { toast } from "sonner";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { getCompanyDisplayLocation } from "@/utils/locationUtils";
import { supabase } from "@/integrations/supabase/client";
import { notifyAccountStatus } from "@/lib/accountStatusNotify";

interface EnhancedEmployerCardProps {
  employer: {
    user_id: string;
    company_id: string;
    company_name: string;
    email: string;
    phone: string;
    location: string;
    industry: string;
    company_size: string;
    website: string;
    description: string;
    logo_url: string;
    is_verified: boolean;
    is_profile_complete: boolean;
    created_at: string;
    last_sign_in_at: string;
    total_jobs: number;
    active_jobs: number;
    badge_color?: string;
    account_status: string;
    account_status_reason?: string;
    job_posting_visibility: boolean;
    ban_type?: string | null;
    job_posting_ban_reason?: string;
    profile_ban_reason?: string;
    verified_plan_start?: string;
    verified_plan_end?: string;
    precise_address: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  };
  onEdit: (employer: any) => void;
  onView: (employer: any) => void;
  onJobPostingToggle: (userId: string, visible: boolean) => void;
  onAccountStatusChange: (userId: string, status: 'active' | 'banned' | 'deleted', reason?: string) => void;
  onVerificationUpdate: () => void;
  isAdminUser?: boolean;
}

const EnhancedEmployerCard: React.FC<EnhancedEmployerCardProps> = ({ 
  employer, 
  onEdit, 
  onView,
  onJobPostingToggle,
  onAccountStatusChange,
  onVerificationUpdate,
  isAdminUser
}) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showJobPostingsDialog, setShowJobPostingsDialog] = useState(false);
  const [banLoading, setBanLoading] = useState(false);

  // Use prop-based admin status (from parent component verification)
  const isAdmin = isAdminUser ?? false;
  
  console.log('🎯 EnhancedEmployerCard: Admin Status:', { 
    isAdmin, 
    isAdminUser,
    companyName: employer.company_name 
  });

  const getStatusBadge = () => {
    // Enhanced logging for debugging badge display
    console.log('🏷️ BADGE CHECK:', employer.company_name, {
      account_status: employer.account_status,
      job_posting_visibility: employer.job_posting_visibility,
      visibility_type: typeof employer.job_posting_visibility,
      last_sign_in: employer.last_sign_in_at
    });
    
    // Priority 1: Profile Ban (highest priority - complete account ban)
    if (employer.account_status === 'banned') {
      console.log('✅ BADGE: Profile Banned');
      return (
        <Badge variant="destructive" className="text-xs px-1 py-0 bg-red-600 border-red-600">
          <Ban className="w-2 h-2 mr-0.5" />
          Profile Banned
        </Badge>
      );
    }
    
    // Priority 2: Job Posting Ban (can't post jobs but account is active)
    if (employer.job_posting_visibility === false) {
      console.log('✅ BADGE: Job Banned (visibility=false)');
      return (
        <Badge variant="destructive" className="text-xs px-1 py-0 bg-orange-600 hover:bg-orange-700 border-orange-600">
          <StopCircle className="w-2 h-2 mr-0.5" />
          Job Banned
        </Badge>
      );
    }
    
    // Priority 3: Activity-based status (for active accounts)
    if (employer.last_sign_in_at) {
      const daysSinceLastLogin = Math.floor(
        (new Date().getTime() - new Date(employer.last_sign_in_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastLogin <= 7) {
        console.log('✅ BADGE: Active (logged in within 7 days)');
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs px-1 py-0 font-semibold">
            Active
          </Badge>
        );
      } else if (daysSinceLastLogin <= 30) {
        console.log('✅ BADGE: Recent (logged in within 30 days)');
        return (
          <Badge variant="secondary" className="text-xs px-1 py-0">
            Recent
          </Badge>
        );
      } else {
        console.log('✅ BADGE: Inactive (last login > 30 days)');
        return (
          <Badge variant="outline" className="text-xs px-1 py-0 text-gray-500">
            Inactive
          </Badge>
        );
      }
    }
    
    console.log('✅ BADGE: New (no login history)');
    return (
      <Badge variant="outline" className="text-xs px-1 py-0 text-blue-600">
        New
      </Badge>
    );
  };

  const handleJobPostingToggle = () => {
    onJobPostingToggle(employer.user_id, !employer.job_posting_visibility);
    toast.success(`Job postings ${!employer.job_posting_visibility ? 'enabled' : 'paused'} for ${employer.company_name}. ${!employer.job_posting_visibility ? 'Company can now post new jobs.' : 'Company cannot post new jobs, but existing jobs remain visible.'}`);
  };

  const handleJobPostingBan = async () => {
    setBanLoading(true);
    
    // Determine current state and the target visibility correctly
    const isCurrentlyBanned = employer.job_posting_visibility === false;
    const newVisibility = !employer.job_posting_visibility; // flip actual visibility
    
    console.log('🔄 JOB POSTING TOGGLE:', {
      company: employer.company_name,
      user_id: employer.user_id,
      currentVisibility: employer.job_posting_visibility,
      isCurrentlyBanned,
      newVisibility,
      action: newVisibility ? 'ENABLE' : 'DISABLE'
    });
    
    try {
      await onJobPostingToggle(employer.user_id, newVisibility);

      // Notify the employer on Push + Email + Telegram
      void notifyAccountStatus({
        userId: employer.user_id,
        event: newVisibility ? 'job_posting_unbanned' : 'job_posting_banned',
        name: employer.company_name,
        company: employer.company_name,
        email: employer.email,
      });


      
      const actionText = isCurrentlyBanned ? 'unbanned' : 'banned';
      const statusEmoji = isCurrentlyBanned ? '✅' : '🚫';
      const detailText = isCurrentlyBanned 
        ? 'Company can now post new jobs.' 
        : 'Company cannot post new jobs. Existing jobs remain visible.';
      
      toast.success(`${statusEmoji} ${employer.company_name} job posting ${actionText} successfully`, {
        description: detailText,
        duration: 5000
      });
      
      console.log('✅ SUCCESS: Job posting toggle completed', {
        newVisibility,
        action: actionText
      });
    } catch (error: any) {
      console.error('❌ ERROR in handleJobPostingBan:', error);
      toast.error(`Failed to update job posting status: ${error.message || 'Unknown error'}`);
    } finally {
      setBanLoading(false);
    }
  };

  const handleProfileBan = async () => {
    setBanLoading(true);
    try {
      const isCurrentlyBanned = employer.account_status === 'banned';
      const newStatus = isCurrentlyBanned ? 'active' : 'banned';
      
      await onAccountStatusChange(employer.user_id, newStatus, 'Admin action');

      // Notify the employer on Push + Email + Telegram
      void notifyAccountStatus({
        userId: employer.user_id,
        event: isCurrentlyBanned ? 'account_unbanned_employer' : 'account_banned_employer',
        name: employer.company_name,
        company: employer.company_name,
        email: employer.email,
      });


      const actionText = isCurrentlyBanned ? 'unbanned' : 'banned';
      const detailText = isCurrentlyBanned 
        ? 'Company profile is now active and can access all features.' 
        : 'Company profile is now banned and cannot access the platform.';
      
      toast.success(`${employer.company_name} profile ${actionText} successfully`, {
        description: detailText,
        duration: 5000
      });
    } catch (error: any) {
      console.error('❌ ERROR in handleProfileBan:', error);
      toast.error(error.message || "Failed to update profile status");
    } finally {
      setBanLoading(false);
    }
  };

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      // This calls admin_delete_company_complete - deletes company only, keeps user account
      await onAccountStatusChange(employer.user_id, 'deleted', deleteReason || 'Company profile deleted by admin');
      toast.success(`${employer.company_name} company data deleted successfully. User account remains active.`);
    } catch (error: any) {
      console.error('Failed to delete company:', error);
      toast.error(error.message || `Failed to delete ${employer.company_name}. Please try again.`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const fullAddress = getCompanyDisplayLocation(employer);

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 w-full">
      <CardContent className="p-1 sm:p-2">
        <div className="flex items-start space-x-1 sm:space-x-1.5">
          <Avatar className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 border border-white shadow-sm flex-shrink-0">
            <AvatarImage src={employer.logo_url} alt={employer.company_name} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-xs">
              {employer.company_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-0.5">
              <div className="flex items-start gap-0.5 min-w-0 flex-1 max-w-[75%]">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-xs text-gray-900 truncate" title={employer.company_name}>
                    {employer.company_name}
                  </h3>
                  <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                    {employer.is_verified && employer.verified_plan_end && (
                      <>
                        <VerificationBadge 
                          color={employer.badge_color as 'gold' | 'blue' | 'green' | 'silver'} 
                          size={8} 
                          className="flex-shrink-0"
                        />
                        {new Date(employer.verified_plan_end).getFullYear() >= 2099 && (
                          <span className="text-[10px] bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-1 py-0.5 rounded font-bold flex-shrink-0">
                            LIFETIME
                          </span>
                        )}
                        {new Date(employer.verified_plan_end).getFullYear() < 2099 && (
                          <span className="text-[10px] text-gray-500 truncate">
                            {new Date(employer.verified_plan_end) < new Date() ? 'Expired' : `Until ${new Date(employer.verified_plan_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`}
                          </span>
                        )}
                      </>
                    )}
                    
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                {getStatusBadge()}
              </div>
            </div>

            <div className="space-y-0.5">
              {/* Address with multi-line support */}
              <div className="flex items-start text-xs text-gray-600">
                <MapPin className="w-2 h-2 mr-0.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="flex-1 text-xs leading-tight line-clamp-2 break-words" title={fullAddress}>
                  {fullAddress || 'Location not set'}
                </span>
              </div>

              <div className="flex items-center text-xs text-gray-600 min-w-0">
                <Mail className="w-2 h-2 mr-0.5 text-gray-400 flex-shrink-0" />
                <span className="truncate text-xs min-w-0">{employer.email}</span>
              </div>

              {employer.phone && (
                <div className="flex items-center text-xs text-gray-600 min-w-0">
                  <Phone className="w-2 h-2 mr-0.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate text-xs min-w-0">{employer.phone}</span>
                </div>
              )}

              {/* Website display */}
              {employer.website && (
                <div className="flex items-center text-xs text-gray-600 min-w-0">
                  <Globe className="w-2 h-2 mr-0.5 text-gray-400 flex-shrink-0" />
                  <a 
                    href={employer.website.startsWith('http') ? employer.website : `https://${employer.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate min-w-0 flex-1"
                    title={employer.website}
                  >
                    {employer.website}
                  </a>
                </div>
              )}

              <div className="flex items-center text-xs text-gray-600">
                <Building2 className="w-2 h-2 mr-0.5 text-gray-400 flex-shrink-0" />
                <span className="truncate text-xs">{employer.industry || 'Not specified'}</span>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center space-x-1 text-xs">
                <div className="flex items-center">
                  <Briefcase className="w-2 h-2 mr-0.5 text-blue-500 flex-shrink-0" />
                  <span className="font-medium text-blue-600 text-xs">{employer.total_jobs}</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-2 h-2 mr-0.5 text-green-500 flex-shrink-0" />
                  <span className="font-medium text-green-600 text-xs">{employer.active_jobs}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-0.5 pt-1 flex-wrap relative z-10">
              <NativeFeedbackButton 
                variant="outline" 
                size="sm" 
                onClick={() => setShowEditDialog(true)}
                className="flex-none text-xs h-6 px-1.5 touch-manipulation"
                feedbackType="tap"
              >
                <Edit className="w-3 h-3" />
              </NativeFeedbackButton>
              
              <div className="flex-shrink-0">
                <VerificationAdminDialog
                  employer={employer}
                  onSuccess={onVerificationUpdate}
                />
              </div>
              
              <NativeFeedbackButton 
                variant="outline" 
                size="sm" 
                onClick={() => setShowViewDialog(true)}
                className="flex-none text-xs h-6 px-1.5 touch-manipulation"
                feedbackType="tap"
              >
                <Eye className="w-3 h-3" />
              </NativeFeedbackButton>

              {/* Admin Action Buttons */}
              {isAdmin && (
                <>
                  
                  <NativeFeedbackButton 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowReferralDialog(true)}
                    className="flex-none text-xs h-6 px-1.5 touch-manipulation"
                    feedbackType="tap"
                  >
                    <UserPlus className="w-3 h-3" />
                  </NativeFeedbackButton>
                  
                  <NativeFeedbackButton 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowJobPostingsDialog(true)}
                    className="flex-none text-xs h-6 px-1.5 touch-manipulation"
                    feedbackType="tap"
                  >
                    <FileText className="w-3 h-3" />
                  </NativeFeedbackButton>
                </>
              )}
              
              <NativeFeedbackButton 
                variant="outline" 
                size="sm" 
                type="button"
                onClick={handleJobPostingBan}
                disabled={banLoading}
                className={`flex-none text-xs h-6 px-1.5 touch-manipulation cursor-pointer relative z-20 ${!employer.job_posting_visibility ? 'bg-orange-50 border-orange-300' : ''}`}
                feedbackType={!employer.job_posting_visibility ? "success" : "error"}
              >
                {banLoading ? (
                  <Clock className="w-3 h-3 animate-spin" />
                ) : !employer.job_posting_visibility ? (
                  <Play className="w-3 h-3 text-green-600" />
                ) : (
                  <StopCircle className="w-3 h-3 text-orange-600" />
                )}
              </NativeFeedbackButton>
              
              <NativeFeedbackButton 
                variant="outline" 
                size="sm" 
                type="button"
                onClick={handleProfileBan}
                disabled={banLoading}
                className={`flex-none text-xs h-6 px-1.5 touch-manipulation cursor-pointer relative z-20 ${employer.account_status === 'banned' ? 'bg-red-50 border-red-300' : ''}`}
                feedbackType={employer.account_status === 'banned' ? "success" : "error"}
              >
                {banLoading ? (
                  <Clock className="w-3 h-3 animate-spin" />
                ) : employer.account_status === 'banned' ? (
                  <UserCheck className="w-3 h-3 text-green-600" />
                ) : (
                  <Ban className="w-3 h-3 text-red-600" />
                )}
              </NativeFeedbackButton>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-none text-xs h-6 px-1.5 touch-manipulation"
                    title="Delete Company"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Company Data</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>Are you sure you want to delete <strong>{employer.company_name}</strong>'s company data? This will:</p>
                      <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        <li>Delete the company profile permanently</li>
                        <li>Delete all job posts ({employer.total_jobs} jobs)</li>
                        <li>Delete all job applications received</li>
                        <li>Delete employer settings and notifications</li>
                      </ul>
                      <p className="font-semibold text-green-600">Note: User account and personal profile will remain active.</p>
                      <p className="font-semibold text-destructive">This action cannot be undone.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete} 
                      disabled={deleteLoading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete Company'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {showEditDialog && (
          <StreamlinedEmployerEditDialog
            employer={employer}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            onSave={async (updates) => {
              console.log('EnhancedEmployerCard: Save triggered for updates:', updates);
              await onEdit({ ...employer, ...updates });
              console.log('EnhancedEmployerCard: Save completed');
            }}
          />
        )}

        {showViewDialog && (
          <CompanyProfileViewDialog
            employer={employer}
            open={showViewDialog}
            onOpenChange={setShowViewDialog}
          />
        )}

        {showReferralDialog && (
          <ReferralManagementDialog
            open={showReferralDialog}
            onOpenChange={setShowReferralDialog}
            employer={employer}
          />
        )}

        {showJobPostingsDialog && (
          <JobPostingsManagementDialog
            open={showJobPostingsDialog}
            onOpenChange={setShowJobPostingsDialog}
            employer={employer}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedEmployerCard;