import { memo } from "react";
import { MapPin, Mail, Phone, Building, Shield, ShieldCheck, Edit, Eye, MoreVertical, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface EmployerCardProps {
  employer: {
    user_id: string;
    company_name: string;
    email: string;
    phone?: string;
    location?: string;
    industry?: string;
    company_size?: string;
    website?: string;
    description?: string;
    logo_url?: string;
    is_verified: boolean;
    badge_color?: string;
    last_sign_in_at?: string;
    created_at: string;
    total_jobs: number;
    active_jobs: number;
    is_profile_complete?: boolean;
  };
  onView: (employer: any) => void;
  onEdit: (employer: any) => void;
  onVerificationToggle: (companyId: string, isVerified: boolean) => void;
}

const EmployerCard = ({ employer, onView, onEdit, onVerificationToggle }: EmployerCardProps) => {
  const getStatusBadge = (lastSignIn: string | null) => {
    if (!lastSignIn) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Never Signed In</Badge>;
    
    const daysSinceSignIn = Math.floor(
      (new Date().getTime() - new Date(lastSignIn).getTime()) / (1000 * 3600 * 24)
    );
    
    if (daysSinceSignIn <= 7) return <Badge variant="default" className="text-[10px] px-1.5 py-0.5">Active</Badge>;
    if (daysSinceSignIn <= 30) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Recent</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Inactive</Badge>;
  };

  const getVerificationBadge = (isVerified: boolean, badgeColor?: string) => {
    if (!isVerified) {
      return (
        <Badge variant="outline" className="text-gray-600 text-[10px] px-1.5 py-0.5">
          <Shield className="w-2.5 h-2.5 mr-1" />
          Not Verified
        </Badge>
      );
    }

    const colorClass = badgeColor === 'gold' ? 'text-yellow-600 border-yellow-600' : 
                      badgeColor === 'blue' ? 'text-blue-600 border-blue-600' :
                      'text-green-600 border-green-600';

    return (
      <Badge variant="outline" className={`${colorClass} text-[10px] px-1.5 py-0.5`}>
        <ShieldCheck className="w-2.5 h-2.5 mr-1" />
        Verified
      </Badge>
    );
  };

  return (
    <div className="employer-card group w-full max-w-full overflow-hidden p-3 sm:p-4">
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
            <AvatarImage src={employer.logo_url} />
            <AvatarFallback className="bg-gradient-primary text-white">
              {employer.company_name?.slice(0, 2)?.toUpperCase() || "CO"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 max-w-[70%]">
            <h3 className="font-semibold text-sm sm:text-base text-card-foreground group-hover:text-primary transition-smooth leading-tight truncate" title={employer.company_name}>
              {employer.company_name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-muted-foreground text-xs truncate leading-tight">{employer.company_size}</p>
              <div className="flex-shrink-0">
                {getVerificationBadge(employer.is_verified, employer.badge_color)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end space-y-1 shrink-0 ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-6 h-6 sm:w-7 sm:h-7">
                <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(employer)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(employer)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Company
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onVerificationToggle(employer.user_id, employer.is_verified)}
              >
                {employer.is_verified ? (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Unverify Company
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verify Company
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
        <div className="flex flex-col space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1.5 min-w-0">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{employer.email}</span>
          </div>
          {employer.phone && (
            <div className="flex items-center space-x-1.5">
              <Phone className="w-3 h-3 shrink-0" />
              <span className="truncate">{employer.phone}</span>
            </div>
          )}
          {employer.location && (
            <div className="flex items-center space-x-1.5 min-w-0">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{employer.location}</span>
            </div>
          )}
          {employer.website && (
            <div className="flex items-center space-x-1.5 min-w-0">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate text-blue-600">{employer.website}</span>
            </div>
          )}
        </div>

        {employer.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {employer.description}
          </p>
        )}
      </div>

      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1 flex-wrap gap-1">
            {employer.industry && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {employer.industry}
              </Badge>
            )}
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-purple-600">
                {employer.total_jobs} jobs
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-green-600">
                {employer.active_jobs} active
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 min-w-0">
          <NativeFeedbackButton 
            variant="outline" 
            size="sm" 
            className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-xs min-w-0"
            onClick={() => onView(employer)}
            feedbackType="tap"
          >
            <Eye className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">View Details</span>
          </NativeFeedbackButton>
          <NativeFeedbackButton 
            variant="secondary" 
            size="sm" 
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs flex-shrink-0"
            onClick={() => onEdit(employer)}
            feedbackType="tap"
          >
            <Edit className="w-3 h-3" />
          </NativeFeedbackButton>
        </div>
      </div>

      <div className="mt-2 pt-1.5 border-t border-border space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Joined {format(new Date(employer.created_at), "MMMM dd, yyyy")}
          </p>
          <div className="flex items-center space-x-1">
            {getStatusBadge(employer.last_sign_in_at)}
            {employer.is_profile_complete && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Complete</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(EmployerCard);