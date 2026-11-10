import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building, 
  MapPin, 
  Users, 
  Star,
  Award,
  TrendingUp,
  Globe,
  Heart,
  Share2
} from "lucide-react";
import { useCompanyFavorites } from "@/hooks/useCompanyFavorites";
import { Company } from "@/hooks/useCompanies";
import CompanyLogo from "@/components/company/CompanyLogo";

interface CompanyDirectoryCardProps {
  company: Company;
  onViewProfile: () => void;
  onViewJobs: () => void;
  onShare: () => void;
}

const CompanyDirectoryCard = ({ 
  company, 
  onViewProfile, 
  onViewJobs, 
  onShare 
}: CompanyDirectoryCardProps) => {
  const { isFavorited, loading, toggleFavorite } = useCompanyFavorites(company.id);
  
  return (
    <Card className="p-4 sm:p-6 hover:shadow-soft transition-shadow">
      <div className="space-y-3 sm:space-y-4">
        {/* Mobile Layout */}
        <div className="block sm:hidden">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                <CompanyLogo
                  src={company.logo_url}
                  alt={`${company.name} logo`}
                  size={96}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1 mb-1">
                  <h3 className="font-semibold text-foreground text-sm truncate">{company.name}</h3>
                  {company.verified && (
                    <Award className={`w-3 h-3 flex-shrink-0 ${company.badge_color === 'gold' ? 'text-yellow-500' : 'text-blue-600'}`} />
                  )}
                  {company.trending && (
                    <TrendingUp className="w-3 h-3 text-green-600 flex-shrink-0" />
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {company.industry}
                </Badge>
              </div>
            </div>
            <div className="flex space-x-1">
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-xl w-8 h-8 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite();
                }}
                disabled={loading}
              >
                <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-xl w-8 h-8 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {company.description}
          </p>

          <div className="space-y-1 mb-3">
            <div className="flex items-center text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 mr-2 flex-shrink-0" />
              <span className="truncate">{company.location}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center">
                <Users className="w-3 h-3 mr-1" />
                <span>{company.employees} emp</span>
              </div>
              <div className="flex items-center">
                <Globe className="w-3 h-3 mr-1" />
                <span>Est. {company.founded}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                <span className="text-xs font-medium">{Number(company.rating).toFixed(1)}</span>
              </div>
              <span className="text-xs font-semibold text-primary">
                {company.openJobs} Jobs
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="rounded-xl flex-1 text-xs py-1 h-8"
              onClick={onViewProfile}
            >
              View Profile
            </Button>
            <Button 
              size="sm" 
              className="rounded-xl flex-1 text-xs py-1 h-8"
              onClick={onViewJobs}
            >
              View Jobs
            </Button>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:block">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                <CompanyLogo
                  src={company.logo_url}
                  alt={`${company.name} logo`}
                  size={96}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-foreground">{company.name}</h3>
                  {company.verified && (
                    <Award className={`w-4 h-4 ${company.badge_color === 'gold' ? 'text-yellow-500' : 'text-blue-600'}`} />
                  )}
                  {company.trending && (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <Badge variant="secondary" className="text-xs mt-1">
                  {company.industry}
                </Badge>
              </div>
            </div>
            <div className="flex space-x-1">
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite();
                }}
                disabled={loading}
              >
                <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mt-3">
            {company.description}
          </p>

          <div className="space-y-2 mt-3">
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mr-2" />
              {company.location}
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                {company.employees} employees
              </div>
              <div className="flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                Est. {company.founded}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 mt-3">
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="text-sm font-medium">{Number(company.rating).toFixed(1)}</span>
            </div>
            <span className="text-sm font-semibold text-primary">
              {company.openJobs} Open Jobs
            </span>
          </div>

          <div className="flex space-x-2 mt-4">
            <Button 
              size="sm" 
              variant="outline" 
              className="rounded-xl flex-1"
              onClick={onViewProfile}
            >
              View Profile
            </Button>
            <Button 
              size="sm" 
              className="rounded-xl flex-1"
              onClick={onViewJobs}
            >
              View Jobs
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CompanyDirectoryCard;
