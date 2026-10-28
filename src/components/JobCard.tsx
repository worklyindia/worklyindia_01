import { memo, useEffect, useMemo } from "react";
import { MapPin, Clock, DollarSign, Building, Heart, Flame, Sparkles, Navigation, Globe, Map, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import ShareDialog from "@/components/ShareDialog";
import { useJobInteractions } from "@/hooks/useJobInteractions";
import { useHybridFavorites } from "@/hooks/useHybridFavorites";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useUserLocation } from "@/contexts/UserLocationContext";
import { calculateHaversineDistance } from "@/utils/locationUtils";
import { isToday, formatDateWithTime } from "@/utils/dateFormatUtils";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { formatCount } from "@/utils/formatNumber";
import { useEngagementVisibility } from "@/hooks/useSiteSettings";
import { formatSalaryWithPeriod } from "@/utils/salaryToINR";

import VerificationBadge from "@/components/VerificationBadge";

const formatExperienceLevel = (level: string): string => {
  const levelMap: Record<string, string> = {
    'entry': 'Entry (0-2 years)',
    'junior': 'Junior (1-3 years)',
    'intermediate': 'Intermediate (3-5 years)',
    'mid': 'Mid (3-5 years)',
    'senior': 'Senior (5+ years)',
    'lead': 'Lead (7+ years)',
    'expert': 'Expert (10+ years)'
  };

  return levelMap[level?.toLowerCase()] || `${level}`;
};

const formatWorkMode = (mode?: string): string => {
  if (!mode) return '';
  const map: Record<string, string> = {
    'on-site': 'On-site',
    'remote': 'Remote',
    'hybrid': 'Hybrid',
  };
  return map[mode.toLowerCase()] || mode;
};

const formatShift = (s?: string): string => {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatEducation = (e?: string): string => {
  if (!e) return '';
  const map: Record<string, string> = {
    'any': 'Any',
    '10th': '10th',
    '12th': '12th',
    'diploma': 'Diploma',
    'graduate': 'Graduate',
    'post-graduate': 'Post Graduate',
    'phd': 'PhD',
  };
  return map[e.toLowerCase()] || e;
};

interface JobCardProps {
  id?: string;
  shortId?: string;
  publicSlug?: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  experience: string;
  description: string;
  posted: string;
  isNew?: boolean;
  tags?: string[];
  trendingScore?: number;
  organicScore?: number;
  baseScore?: number;
  trendingRank?: number | null;
  organicRank?: number | null;
  viewsCount?: number;
  applicationsCount?: number;
  callsCount?: number;
  sharesCount?: number;
  isBoosted?: boolean;
  boostLevel?: number;
  // Company verification
  isVerified?: boolean;
  badgeColor?: string;
  verifiedPlanEnd?: string;
  // Location match for personalized recommendations
  locationMatch?: 'city' | 'state' | 'country';
  locationMatchLevel?: 'city' | 'state' | 'country' | null;
  matchReason?: string;
  // Job location coordinates for distance calculation
  latitude?: number;
  longitude?: number;
  // Show prominent date/time for Latest Jobs view
  showProminentDate?: boolean;
  // Hide engagement stats (views, applications, score, boost stars) - for Latest Jobs tab
  hideEngagementStats?: boolean;
  // Detailed location fields
  city?: string;
  state?: string;
  country?: string;
  // API company name for API-posted jobs
  apiCompanyName?: string;
  // Company logo URL
  logoUrl?: string;
  // Additional job details
  category?: string;
  workMode?: string;
  shiftTiming?: string;
  education?: string;
  openings?: number;
}

const JobCard = ({ 
  id,
  shortId,
  publicSlug,
  title, 
  company, 
  location, 
  salary, 
  type, 
  experience, 
  description, 
  posted, 
  isNew = false,
  tags = [],
  trendingScore = 0,
  organicScore = 0,
  baseScore,
  trendingRank,
  organicRank,
  viewsCount = 0,
  applicationsCount = 0,
  callsCount = 0,
  sharesCount = 0,
  isBoosted = false,
  boostLevel = 0,
  isVerified = false,
  badgeColor = 'gold',
  verifiedPlanEnd,
  locationMatch,
  locationMatchLevel,
  matchReason,
  latitude,
  longitude,
  showProminentDate = false,
  hideEngagementStats = false,
  city,
  state,
  country,
  apiCompanyName,
  logoUrl,
  category,
  workMode,
  shiftTiming,
  education,
  openings
}: JobCardProps) => {
  const navigate = useNavigate();
  const { trackJobView, trackJobApply, trackJobCall, trackJobShare } = useJobInteractions();
  const { isFavorited, toggleFavorite } = useHybridFavorites();
  const { canApplyJobs, isJobBanned, isBanned } = useAccountStatus();
  const { user } = useAuth();
  const { location: userLocation, detectLocation, isDetecting } = useUserLocation();
  const { tapFeedback, successFeedback } = useNativeFeel();
  const { data: visibility } = useEngagementVisibility();
  
  const jobId = id || encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'));
  
  // Use trending_score (with boost) for display, fallback to base_score, then calculate
  const displayScore = trendingScore !== undefined 
    ? trendingScore 
    : baseScore !== undefined 
      ? baseScore 
      : (viewsCount * 0.10) + (applicationsCount * 1.0);
  
  // Check if job is trending (base score > 10 OR has trending rank)
  const isTrending = displayScore > 10 || (trendingRank !== undefined && trendingRank !== null);
  
  
  const isNewJob = isNew || isToday(posted);

  // Rank badge hidden for now (will be re-enabled later)
  const hasRankBadge = false;
  const hasTopLeftChip = hasRankBadge || isNewJob;

  const rankChipClass: Record<number, string> = {
    1: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 shadow-amber-500/40',
    2: 'bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500 shadow-slate-500/40',
    3: 'bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 shadow-orange-500/40',
    4: 'bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 shadow-purple-500/40',
    5: 'bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600 shadow-teal-500/40',
    6: 'bg-gradient-to-r from-green-400 via-green-500 to-green-600 shadow-green-500/40',
    7: 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 shadow-blue-500/40',
    8: 'bg-gradient-to-r from-indigo-400 via-indigo-500 to-indigo-600 shadow-indigo-500/40',
    9: 'bg-gradient-to-r from-pink-400 via-pink-500 to-pink-600 shadow-pink-500/40',
    10: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600 shadow-cyan-500/40',
  };

  const computedMatch = locationMatch ?? locationMatchLevel ?? undefined;

  // Calculate distance using saved profile location and job coordinates
  const distance = useMemo(() => {
    if (!userLocation.latitude || !userLocation.longitude || !latitude || !longitude) {
      return null;
    }
    const dist = calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      latitude,
      longitude
    );
    return dist;
  }, [userLocation.latitude, userLocation.longitude, latitude, longitude]);

  // Only track view when user clicks on job, not when component mounts
  
  const handleJobClick = async () => {
    tapFeedback();
    
    // Track view interaction when user clicks to view job details
    if (id) {
      try {
        await trackJobView(id, {
          category: tags?.[0] || '',
          location: location,
          salaryRange: salary,
          jobType: type
        });
      } catch (error) {
        console.warn('Failed to track job view:', error);
      }
    }
    
    // Store job data for the JobDetail page
    const jobData = {
      id: jobId,
      title,
      company,
      location,
      salary,
      type,
      experience,
      description,
      posted,
      isNew,
      tags,
      trendingScore,
      viewsCount,
      applicationsCount,
      callsCount,
      sharesCount,
      isBoosted,
      boostLevel,
      isVerified,
      badgeColor,
      verifiedPlanEnd
    };
    
    sessionStorage.setItem(`job_${jobId}`, JSON.stringify(jobData));
    navigate(`/job/${jobId}`);
  };

  const handleApplyClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    
    // Navigate to job detail page - login check will happen there
    if (id) {
      try {
        await trackJobView(id, {
          category: tags?.[0] || '',
          location: location,
          salaryRange: salary,
          jobType: type
        });
      } catch (error) {
        console.warn('Failed to track job view:', error);
      }
    }
    
    // Store job data for the JobDetail page
    const jobData = {
      id: jobId,
      title,
      company,
      location,
      salary,
      type,
      experience,
      description,
      posted,
      isNew,
      tags,
      trendingScore,
      viewsCount,
      applicationsCount,
      callsCount,
      sharesCount,
      isBoosted,
      boostLevel,
      isVerified,
      badgeColor,
      verifiedPlanEnd
    };
    
    sessionStorage.setItem(`job_${jobId}`, JSON.stringify(jobData));
    navigate(`/job/${jobId}`);
  };

  const handleShareClick = async () => {
    tapFeedback();
    if (id) {
      await trackJobShare(id);
    }
  };
  
  return (
    <div 
      className="job-card card-press group w-full max-w-full overflow-hidden p-3 sm:p-4 relative cursor-pointer hover-lift" 
      onClick={handleJobClick}
    >
      {/* Boost Priority Chip - top-right corner */}
      {isBoosted && (
        <Badge
          className="absolute top-2 right-2 z-10 text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white border-0 shadow-md shadow-orange-500/40 flex items-center gap-0.5"
          title={`Priority${boostLevel ? ` · Level ${boostLevel}` : ''}`}
        >
          <Zap className="w-2.5 h-2.5 fill-current" />
          Priority
        </Badge>
      )}

      {/* Top-left chips: Rank + New */}
      {hasTopLeftChip && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          {hasRankBadge && (
            <Badge className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 text-white border-0 shadow-md ${rankChipClass[organicRank as number]}`}>
              #{organicRank} Rank
            </Badge>
          )}
          {isNewJob && (
            <Badge variant="new" className="text-[9px] sm:text-[10px] px-1.5 py-0.5 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              New
            </Badge>
          )}
        </div>
      )}

      <div className={`flex items-start space-x-2 sm:space-x-3 mb-2 sm:mb-3 ${hasTopLeftChip || isBoosted ? 'mt-6' : ''}`}>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          {logoUrl ? (
            <img loading="lazy" decoding="async" src={logoUrl} alt={company} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <div className="w-full h-full bg-gradient-primary rounded-lg flex items-center justify-center">
              <Building className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-xs sm:text-sm text-card-foreground group-hover:text-primary transition-smooth leading-tight mb-1">
            {title}
          </h3>
          <div className="flex items-center flex-nowrap gap-x-1.5 min-w-0">
            <p className="text-muted-foreground text-xs truncate leading-tight min-w-0">
              {apiCompanyName || company}
            </p>
            {!apiCompanyName && isVerified && verifiedPlanEnd && new Date(verifiedPlanEnd) > new Date() && (
              <VerificationBadge color={badgeColor as 'gold' | 'blue' | 'green' | 'silver'} size={14} />
            )}
            {posted && (() => {
              const d = new Date(posted);
              if (isNaN(d.getTime())) return null;
              const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long' });
              const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              return (
                <span className="text-muted-foreground text-[11px] leading-tight whitespace-nowrap shrink-0">
                  • {day} • {time}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Location - plain text line */}
      {(city || state || country) && (
        <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground min-w-0">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {[city, state, country].filter(Boolean).join(', ')}
          </span>
        </div>
      )}

      <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
        <div className="flex flex-col space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3 h-3 shrink-0" />
            <span>
              {formatExperienceLevel(experience)} Year Experience
            </span>
            {typeof openings === 'number' && openings > 0 && (
              <span className="flex items-center space-x-1 ml-1">
                <span>-</span>
                <Users className="w-3 h-3 shrink-0" />
                <span>{openings} {openings > 1 ? 'Vacancies' : 'Vacancy'}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <DollarSign className="w-3 h-3 text-success shrink-0" />
          {(() => {
            const raw = (salary || '').trim();
            const isMissing = !raw || /not\s*disclosed|not\s*specified|n\/?a/i.test(raw);
            if (isMissing) {
              return <span className="font-medium text-muted-foreground text-sm">Salary: As per company standards</span>;
            }
            return <span className="font-semibold text-success text-sm">{formatSalaryWithPeriod(raw)}</span>;
          })()}
        </div>
      </div>

      <div className="flex flex-col space-y-2">
        <div className="flex flex-nowrap items-center mb-2 gap-1 min-w-0 overflow-hidden">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0 whitespace-nowrap">
            {type}
          </Badge>
          {category && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 min-w-0 max-w-full truncate inline-block whitespace-nowrap"
              title={category}
            >
              {category}
            </Badge>
          )}
          {education && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 shrink-0 whitespace-nowrap"
              title={formatEducation(education)}
            >
              🎓 {formatEducation(education)}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs"
            onClick={handleApplyClick}
            title="View job details"
          >
            View Details
          </Button>
          {/* Like and Share Icons */}
          <Button 
            variant="ghost" 
            size="icon" 
            className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${
              isFavorited(jobId) 
                ? 'text-red-500 hover:text-red-600' 
                : 'text-muted-foreground hover:text-primary'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              successFeedback();
              toggleFavorite(jobId);
            }}
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${isFavorited(jobId) ? 'fill-current heart-pop' : ''}`} />
          </Button>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <ShareDialog 
              jobTitle={title}
              company={company}
              jobId={id || jobId}
              shortId={shortId}
              publicSlug={publicSlug}
              city={city}
              state={state}
              location={location}
              job_type={type}
              experience_level={experience}
              onShare={handleShareClick}
            />
          </div>
        </div>
      </div>

      {!hideEngagementStats && (visibility?.showViews || visibility?.showApplies) && (
        <div className="mt-2 pt-1.5 border-t border-border">
          <div className="flex items-center space-x-2 text-[10px] text-muted-foreground">
            {visibility?.showViews && <span>{formatCount(viewsCount)} views</span>}
            {visibility?.showViews && visibility?.showApplies && <span>•</span>}
            {visibility?.showApplies && <span>{formatCount(applicationsCount)} applies</span>}
            {isBoosted && boostLevel > 0 && (
              <>
                <span>•</span>
                <Badge className="text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 text-white border-0 shadow-sm shadow-purple-500/30">
                  ⚡ {boostLevel}X Boosted
                </Badge>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize JobCard for performance
export default memo(JobCard);
