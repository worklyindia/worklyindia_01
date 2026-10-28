import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MapPin, 
  Mail, 
  Phone, 
  Edit, 
  Eye,
  Clock,
  FileText,
  Star,
  Trash2,
  Ban,
  UserX
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface WebsiteUserCardProps {
  user: {
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    whatsapp_number: string;
    location: string;
    precise_address: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    profile_image_url: string;
    is_profile_complete: boolean;
    created_at: string;
    last_sign_in_at: string;
    total_applications: number;
    account_status: string;
  };
  onEdit: (user: any) => void;
  onView: (user: any) => void;
  onStatusUpdate: () => void;
  onDelete?: () => void;
  updateUserStatus?: (userId: string, status: string) => Promise<void>;
}

const WebsiteUserCard: React.FC<WebsiteUserCardProps> = ({ 
  user, 
  onEdit, 
  onView,
  onStatusUpdate,
  onDelete,
  updateUserStatus
}) => {
  const getStatusBadge = () => {
    if (user.last_sign_in_at) {
      const daysSinceLastLogin = Math.floor(
        (new Date().getTime() - new Date(user.last_sign_in_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastLogin <= 7) {
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-1 py-0">Active</Badge>;
      } else if (daysSinceLastLogin <= 30) {
        return <Badge variant="secondary" className="text-xs px-1 py-0">Recent</Badge>;
      } else {
        return <Badge variant="outline" className="text-xs px-1 py-0">Inactive</Badge>;
      }
    }
    return <Badge variant="outline" className="text-xs px-1 py-0">New</Badge>;
  };

  const getCompletionBadge = () => {
    if (user.is_profile_complete) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1 py-0">
        <Star className="w-2 h-2 mr-0.5" />Complete
      </Badge>;
    }
    return <Badge variant="secondary" className="text-xs px-1 py-0">Incomplete</Badge>;
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-green-50 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <CardContent className="p-2 sm:p-3">
        <div className="flex items-start space-x-2">
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border border-white shadow-sm flex-shrink-0">
            <AvatarImage src={user.profile_image_url} alt={user.full_name} />
            <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-600 text-white font-semibold text-xs">
              {user.full_name?.slice(0, 2)?.toUpperCase() || "WU"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-start gap-1 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 truncate" title={user.full_name}>
                    {user.full_name || "No Name"}
                  </h3>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {getCompletionBadge()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {getStatusBadge()}
              </div>
            </div>

            <div className="space-y-1">
              {/* Email */}
              <div className="flex items-center min-h-0">
                <Mail className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                <a 
                  href={`mailto:${user.email}`}
                  className="truncate text-sm text-blue-600 hover:text-blue-800 hover:underline max-w-full" 
                  title={user.email}
                >
                  {user.email}
                </a>
              </div>

              {/* Phone */}
              {user.phone && (
                <div className="flex items-center min-h-0">
                  <Phone className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                  <a 
                    href={`tel:${user.phone}`}
                    className="truncate text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {user.phone}
                  </a>
                </div>
              )}

              {/* WhatsApp Number */}
              {user.whatsapp_number && (
                <div className="flex items-center min-h-0">
                  <Phone className="w-3 h-3 mr-1 text-green-500 flex-shrink-0" />
                  <a 
                    href={`https://wa.me/${user.whatsapp_number.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-green-600 hover:text-green-800 hover:underline" 
                    title={`WhatsApp: ${user.whatsapp_number}`}
                  >
                    {user.whatsapp_number}
                  </a>
                </div>
              )}

              {/* Address - Using location field first for consistency */}
              {(user.location || user.precise_address || user.city || user.state || user.country) && (
                <div className="flex items-center text-sm text-gray-600 min-h-0">
                  <MapPin className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                  <span className="truncate text-sm max-w-full">
                    {user.location || [user.precise_address, user.city, user.state, user.country].filter(Boolean).join(', ') || 'Address not set'}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex items-center">
                  <FileText className="w-3 h-3 mr-1 text-blue-500 flex-shrink-0" />
                  <span className="font-medium text-blue-600 text-sm">{user.total_applications || 0}</span>
                </div>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex gap-1 pt-1 flex-wrap">
              {user.account_status === 'banned' && (
                <Badge variant="destructive" className="text-xs px-1 py-0">Website Banned</Badge>
              )}
              {user.account_status === 'job_banned' && (
                <Badge variant="secondary" className="text-xs px-1 py-0 bg-orange-100 text-orange-800">Job Banned</Badge>
              )}
            </div>

            {/* Action Icons */}
            <div className="flex gap-1 pt-2 justify-center">
              <NativeFeedbackButton 
                variant="ghost" 
                size="sm" 
                onClick={() => onEdit(user)}
                className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                feedbackType="tap"
              >
                <Edit className="w-4 h-4 text-gray-600" />
              </NativeFeedbackButton>
              
              <NativeFeedbackButton 
                variant="ghost" 
                size="sm" 
                onClick={() => onView(user)}
                className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                feedbackType="tap"
              >
                <Eye className="w-4 h-4 text-gray-600" />
              </NativeFeedbackButton>
              
              {updateUserStatus && (
                <NativeFeedbackButton 
                  variant="ghost" 
                  size="sm" 
                  onClick={async () => {
                    try {
                      // Preserve the other ban (profile/website ban) when toggling job ban.
                      // States: active | banned (profile) | job_banned | fully_banned (both)
                      const current = user.account_status;
                      let action: string;
                      if (current === 'job_banned') action = 'active';
                      else if (current === 'fully_banned') action = 'banned';
                      else if (current === 'banned') action = 'fully_banned';
                      else action = 'job_banned';
                      const isAdding = action === 'job_banned' || action === 'fully_banned';
                      await updateUserStatus(user.user_id, action);
                      toast.success(`User ${isAdding ? 'banned from applying to jobs' : 'job ban removed'}`);
                      onStatusUpdate();
                    } catch (error) {
                      console.error('Failed to update job ban status:', error);
                      toast.error('Failed to update job ban status');
                    }
                  }}
                  className={`h-8 w-8 p-0 rounded-full ${
                    (user.account_status === 'job_banned' || user.account_status === 'fully_banned')
                      ? 'hover:bg-green-100' 
                      : 'hover:bg-orange-100'
                  }`}
                  feedbackType={(user.account_status === 'job_banned' || user.account_status === 'fully_banned') ? "success" : "error"}
                >
                  <UserX className={`w-4 h-4 ${
                    (user.account_status === 'job_banned' || user.account_status === 'fully_banned')
                      ? 'text-green-600' 
                      : 'text-orange-600'
                  }`} />
                </NativeFeedbackButton>
              )}
              
              {updateUserStatus && (
                <NativeFeedbackButton 
                  variant="ghost" 
                  size="sm" 
                  onClick={async () => {
                    try {
                      // Preserve the other ban (job ban) when toggling profile/website ban.
                      const current = user.account_status;
                      let action: string;
                      if (current === 'banned') action = 'active';
                      else if (current === 'fully_banned') action = 'job_banned';
                      else if (current === 'job_banned') action = 'fully_banned';
                      else action = 'banned';
                      const isAdding = action === 'banned' || action === 'fully_banned';
                      await updateUserStatus(user.user_id, action);
                      toast.success(`User ${isAdding ? 'banned from website' : 'website ban removed'}`);
                      onStatusUpdate();
                    } catch (error) {
                      console.error('Failed to update website ban status:', error);
                      toast.error('Failed to update website ban status');
                    }
                  }}
                  className={`h-8 w-8 p-0 rounded-full ${
                    (user.account_status === 'banned' || user.account_status === 'fully_banned')
                      ? 'hover:bg-green-100' 
                      : 'hover:bg-red-100'
                  }`}
                  feedbackType={(user.account_status === 'banned' || user.account_status === 'fully_banned') ? "success" : "error"}
                >
                  <Ban className={`w-4 h-4 ${
                    (user.account_status === 'banned' || user.account_status === 'fully_banned')
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`} />
                </NativeFeedbackButton>
              )}
              
              {onDelete && (
                <NativeFeedbackButton 
                  variant="ghost" 
                  size="sm" 
                  onClick={onDelete}
                  className="h-8 w-8 p-0 rounded-full hover:bg-red-100"
                  feedbackType="error"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </NativeFeedbackButton>
              )}
            </div>

            {/* Last Sign In */}
            {user.last_sign_in_at && (
              <div className="mt-2 text-xs text-gray-500 truncate">
                Last seen {formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebsiteUserCard;