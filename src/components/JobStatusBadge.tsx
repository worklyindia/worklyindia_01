import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, EyeOff, Globe, Link, Check, Calendar, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { useState } from "react";

interface JobStatusBadgeProps {
  status: string;
  visibility: string;
  scheduledAt?: string | null;
  className?: string;
  jobId?: string;
  onRefresh?: () => Promise<void>;
  // New 4-stage indexing status props
  googleStatus?: 'queued' | 'scheduled' | 'submitted' | 'public' | 'failed' | null;
  googleQueuedAt?: string | null;
  googleScheduledAt?: string | null;
  googleSubmittedAt?: string | null;
  googlePublicAt?: string | null;
  googleLastCheckedAt?: string | null;
  googleError?: string | null;
  bingStatus?: 'queued' | 'scheduled' | 'submitted' | 'public' | 'failed' | null;
  bingQueuedAt?: string | null;
  bingScheduledAt?: string | null;
  bingSubmittedAt?: string | null;
  bingPublicAt?: string | null;
  bingLastCheckedAt?: string | null;
  bingError?: string | null;
  // Payment gate for Google/Bing indexing
  isPaidForIndexing?: boolean;
  // Legacy props for backward compatibility
  googleIndexStatus?: 'none' | 'pending' | 'scheduled' | 'completed' | 'failed';
  googleScheduledDate?: string | null;
  googleProcessedDate?: string | null;
  bingSubmitted?: boolean;
  bingSubmittedDate?: string | null;
  googleErrorMessage?: string | null;
}


// Format date as DD/MM/YYYY hh:mm AM/PM (no seconds for better mobile fit)
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'long' });
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
};

const JobStatusBadge = ({ 
  status, 
  visibility, 
  scheduledAt,
  className,
  jobId,
  onRefresh,
  // New 4-stage props
  googleStatus,
  googleQueuedAt,
  googleScheduledAt,
  googleSubmittedAt,
  googlePublicAt,
  googleLastCheckedAt,
  googleError,
  bingStatus,
  bingQueuedAt,
  bingScheduledAt,
  bingSubmittedAt,
  bingPublicAt,
  bingLastCheckedAt,
  bingError,
  isPaidForIndexing,
  // Legacy props
  googleIndexStatus,
  googleScheduledDate,
  googleProcessedDate,
  bingSubmitted,
  bingSubmittedDate,
  googleErrorMessage
}: JobStatusBadgeProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);


  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Normalize status - prefer new 4-stage props, fallback to legacy
  const normalizedGoogleStatus = googleStatus || 
    (googleIndexStatus === 'completed' ? 'submitted' : 
     googleIndexStatus === 'pending' ? (googleProcessedDate ? 'submitted' : 'queued') :
     googleIndexStatus === 'scheduled' ? 'scheduled' :
     googleIndexStatus === 'failed' ? 'failed' : null);
  
  const normalizedBingStatus = bingStatus || 
    (bingSubmitted ? 'submitted' : null);
  
  const normalizedGoogleQueuedAt = googleQueuedAt;
  const normalizedGoogleScheduledAt = googleScheduledAt || googleScheduledDate;
  const normalizedGoogleSubmittedAt = googleSubmittedAt || googleProcessedDate;
  const normalizedGooglePublicAt = googlePublicAt;
  const normalizedGoogleError = googleError || googleErrorMessage;
  
  const normalizedBingQueuedAt = bingQueuedAt;
  const normalizedBingScheduledAt = bingScheduledAt;
  const normalizedBingSubmittedAt = bingSubmittedAt || bingSubmittedDate;
  const normalizedBingPublicAt = bingPublicAt;

  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          variant: 'default' as const,
          icon: Globe,
          label: 'Active',
          description: 'Job is live and accepting applications',
          className: 'bg-blue-600 hover:bg-blue-700 text-white'
        };
      case 'scheduled':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          label: 'Scheduled',
          description: `Will publish on ${scheduledAt ? formatDateTime(scheduledAt) : 'scheduled date'}`,
          className: 'bg-orange-100 text-orange-700 border-orange-200'
        };
      case 'draft':
        return {
          variant: 'outline' as const,
          icon: EyeOff,
          label: 'Draft',
          description: 'Job is saved but not published',
          className: 'bg-gray-100 text-gray-600 border-gray-200'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: Globe,
          label: status,
          description: '',
          className: ''
        };
    }
  };

  const getVisibilityConfig = () => {
    switch (visibility) {
      case 'public':
        return {
          variant: 'default' as const,
          icon: Globe,
          label: 'Public',
          description: 'Visible in search results',
          className: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'unlisted':
        return {
          variant: 'secondary' as const,
          icon: Link,
          label: 'Unlisted',
          description: 'Only accessible via link',
          className: 'bg-yellow-100 text-yellow-700 border-yellow-200'
        };
      case 'private':
        return {
          variant: 'outline' as const,
          icon: EyeOff,
          label: 'Private',
          description: 'Only visible to you',
          className: 'bg-gray-100 text-gray-600 border-gray-200'
        };
      default:
        return {
          variant: 'default' as const,
          icon: Globe,
          label: visibility,
          description: '',
          className: ''
        };
    }
  };

  // Calculate estimated time to public (average 3-7 days for Google, 1-2 days for Bing)
  const getEstimatedTimeToPublic = (submittedAt: string | null | undefined, isGoogle: boolean): string => {
    if (!submittedAt) return '';
    try {
      const submitted = new Date(submittedAt);
      const daysSinceSubmit = differenceInDays(new Date(), submitted);
      const avgDays = isGoogle ? 5 : 2; // Google: 3-7 days avg 5, Bing: 1-2 days avg 2
      const remainingDays = Math.max(0, avgDays - daysSinceSubmit);
      
      if (remainingDays <= 0) {
        return 'Any time now';
      }
      return `~${remainingDays} day${remainingDays !== 1 ? 's' : ''} remaining`;
    } catch {
      return '';
    }
  };

  // Format last checked time
  const getLastCheckedText = (lastCheckedAt: string | null | undefined): string => {
    if (!lastCheckedAt) return '';
    try {
      return `Last checked: ${formatDistanceToNow(new Date(lastCheckedAt), { addSuffix: true })}`;
    } catch {
      return '';
    }
  };

  // Get Google status badges - shows current stage and completed stages
  const getGoogleBadges = () => {
    const badges: Array<{
      variant: 'default' | 'secondary' | 'outline' | 'destructive';
      icon: any;
      label: string;
      description: string;
      className: string;
      subText?: string;
    }> = [];

    if (!normalizedGoogleStatus && visibility !== 'public') return badges;

    const isQuotaExceeded = normalizedGoogleError?.toLowerCase().includes('429') || 
                            normalizedGoogleError?.toLowerCase().includes('quota');

    const lastCheckedText = getLastCheckedText(googleLastCheckedAt);
    const estimatedTime = getEstimatedTimeToPublic(normalizedGoogleSubmittedAt, true);

    switch (normalizedGoogleStatus) {
      case 'public':
        badges.push({
          variant: 'default',
          icon: Check,
          label: `Google - Public ${formatDateTime(normalizedGooglePublicAt)}`,
          description: 'URL is live and appearing in Google Search!',
          className: 'bg-green-600 hover:bg-green-700 text-white'
        });
        break;
      
      case 'submitted':
        badges.push({
          variant: 'default',
          icon: Check,
          label: `Google - Submitted ${formatDateTime(normalizedGoogleSubmittedAt)}`,
          description: `Submitted to Google. ${estimatedTime}${lastCheckedText ? ` • ${lastCheckedText}` : ''}`,
          className: 'bg-blue-600 hover:bg-blue-700 text-white',
          subText: estimatedTime || undefined
        });
        break;
      
      case 'scheduled':
        badges.push({
          variant: 'outline',
          icon: Calendar,
          label: `Google - Schedule ${formatDateTime(normalizedGoogleScheduledAt)}`,
          description: isQuotaExceeded 
            ? `Quota exceeded (429). Will retry at ${formatDateTime(normalizedGoogleScheduledAt)}`
            : `Scheduled for Google indexing`,
          className: 'bg-amber-50 text-amber-700 border-amber-200'
        });
        break;
      
      case 'queued':
        badges.push({
          variant: 'secondary',
          icon: Clock,
          label: normalizedGoogleQueuedAt 
            ? `Google - Queued ${formatDateTime(normalizedGoogleQueuedAt)}`
            : 'Google - Queued',
          description: 'Waiting in Google indexing queue',
          className: 'bg-orange-100 text-orange-700 border-orange-200'
        });
        break;
      
      case 'failed':
        badges.push({
          variant: 'destructive',
          icon: AlertTriangle,
          label: normalizedGoogleScheduledAt 
            ? `Google - Failed (Retry ${formatDateTime(normalizedGoogleScheduledAt)})`
            : 'Google - Failed',
          description: normalizedGoogleError || 'Google indexing failed, will retry automatically',
          className: 'bg-red-100 text-red-700 border-red-200'
        });
        break;
      
      default:
        // Show queued for public jobs with no indexing entry yet
        if (visibility === 'public') {
          badges.push({
            variant: 'outline',
            icon: Loader2,
            label: 'Google - Queued',
            description: 'Awaiting Google indexing queue',
            className: 'bg-gray-50 text-gray-600 border-gray-200'
          });
        }
    }

    return badges;
  };

  // Get Bing status badges
  const getBingBadges = () => {
    const badges: Array<{
      variant: 'default' | 'secondary' | 'outline' | 'destructive';
      icon: any;
      label: string;
      description: string;
      className: string;
      subText?: string;
    }> = [];

    if (!normalizedBingStatus && visibility !== 'public') return badges;

    const lastCheckedText = getLastCheckedText(bingLastCheckedAt);
    const estimatedTime = getEstimatedTimeToPublic(normalizedBingSubmittedAt, false);

    switch (normalizedBingStatus) {
      case 'public':
        badges.push({
          variant: 'default',
          icon: Check,
          label: `Bing - Public ${formatDateTime(normalizedBingPublicAt)}`,
          description: 'URL is live and appearing in Bing Search!',
          className: 'bg-green-600 hover:bg-green-700 text-white'
        });
        break;
      
      case 'submitted':
        badges.push({
          variant: 'default',
          icon: Check,
          label: `Bing - Submitted ${formatDateTime(normalizedBingSubmittedAt)}`,
          description: `Submitted to Bing. ${estimatedTime}${lastCheckedText ? ` • ${lastCheckedText}` : ''}`,
          className: 'bg-teal-600 hover:bg-teal-700 text-white',
          subText: estimatedTime || undefined
        });
        break;
      
      case 'scheduled':
        badges.push({
          variant: 'outline',
          icon: Calendar,
          label: `Bing - Schedule ${formatDateTime(normalizedBingScheduledAt)}`,
          description: 'Scheduled for Bing/IndexNow submission',
          className: 'bg-amber-50 text-amber-700 border-amber-200'
        });
        break;
      
      case 'queued':
        badges.push({
          variant: 'secondary',
          icon: Clock,
          label: normalizedBingQueuedAt 
            ? `Bing - Queued ${formatDateTime(normalizedBingQueuedAt)}`
            : 'Bing - Queued',
          description: 'Waiting in Bing/IndexNow submission queue',
          className: 'bg-orange-100 text-orange-700 border-orange-200'
        });
        break;
      
      case 'failed':
        badges.push({
          variant: 'destructive',
          icon: AlertTriangle,
          label: 'Bing - Failed',
          description: bingError || 'Bing indexing failed',
          className: 'bg-red-100 text-red-700 border-red-200'
        });
        break;
      
      default:
        // Show queued for public jobs with no Bing submission yet
        if (visibility === 'public') {
          badges.push({
            variant: 'outline',
            icon: Loader2,
            label: 'Bing - Queued',
            description: 'Awaiting Bing/IndexNow submission',
            className: 'bg-gray-50 text-gray-600 border-gray-200'
          });
        }
    }

    return badges;
  };

  const statusConfig = getStatusConfig();
  const visibilityConfig = getVisibilityConfig();
  // Only show Google/Bing indexing badges if the employer has paid for search indexing.
  // Public "Public" badges (final state) still show so history stays visible.
  const showSearchBadges = isPaidForIndexing === true
    || normalizedGoogleStatus === 'public'
    || normalizedBingStatus === 'public';
  const googleBadges = showSearchBadges ? getGoogleBadges() : [];
  const bingBadges = showSearchBadges ? getBingBadges() : [];
  const StatusIcon = statusConfig.icon;
  const VisibilityIcon = visibilityConfig.icon;


  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Row 1: Job Status and Visibility */}
      <div className="flex flex-wrap gap-2">
        <Badge 
          variant={statusConfig.variant} 
          className={`flex items-center gap-1 ${statusConfig.className}`}
          title={statusConfig.description}
        >
          <StatusIcon className="w-3 h-3" />
          {statusConfig.label}
        </Badge>

        <Badge 
          variant={visibilityConfig.variant} 
          className={`flex items-center gap-1 ${visibilityConfig.className}`}
          title={visibilityConfig.description}
        >
          <VisibilityIcon className="w-3 h-3" />
          {visibilityConfig.label}
        </Badge>
      </div>

      {/* Row 2: Google Indexing Status */}
      {googleBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {googleBadges.map((badge, idx) => (
            <Badge 
              key={`google-${idx}`}
              variant={badge.variant} 
              className={`flex items-center gap-1 text-xs whitespace-nowrap ${badge.className}`}
              title={badge.description}
            >
              <badge.icon className="w-3 h-3" />
              {badge.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Row 3: Bing Indexing Status */}
      {bingBadges.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {bingBadges.map((badge, idx) => (
            <Badge 
              key={`bing-${idx}`}
              variant={badge.variant}
              className={`flex items-center gap-1 text-xs whitespace-nowrap ${badge.className}`}
              title={badge.description}
            >
              <badge.icon className="w-3 h-3" />
              {badge.label}
            </Badge>
          ))}
          
          {/* Refresh Button - Pull to Refresh */}
          {onRefresh && !normalizedGoogleStatus?.includes('public') && !normalizedBingStatus?.includes('public') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-6 px-2 text-xs gap-1"
              title="Refresh indexing status"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Checking...' : 'Refresh'}
            </Button>
          )}
        </div>
      )}

      {/* Refresh button if no Bing badges but indexing in progress */}
      {bingBadges.length === 0 && googleBadges.length > 0 && onRefresh && (
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-6 px-2 text-xs gap-1"
            title="Refresh indexing status"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Checking...' : 'Refresh'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default JobStatusBadge;