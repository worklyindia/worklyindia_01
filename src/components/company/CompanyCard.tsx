import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, MapPin, Users, Star, ArrowUpRight, Briefcase, TrendingUp, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Company } from "@/hooks/useCompaniesData";
import { getCompanyUrl } from "@/utils/seoUrlHelpers";

interface CompanyCardProps {
  company: Company;
  index: number;
}

const CompanyCard = ({ company, index }: CompanyCardProps) => {
  const navigate = useNavigate();

  const getCompanyLogoColor = (index: number) => {
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
      "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-red-500"
    ];
    return colors[index % colors.length];
  };

  const getCompanyInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const formatLocation = () => {
    if (company.city && company.state) {
      return `${company.city}, ${company.state}`;
    }
    return company.state || company.country || 'Location not specified';
  };

  const foundedYear = company.incorporation_date 
    ? new Date(company.incorporation_date).getFullYear()
    : null;

  return (
    <Card 
      className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-border/50 hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={() => navigate(getCompanyUrl({ slug: (company as any).slug, id: company.id }))}
    >
      {/* Company Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {company.logo_url ? (
            <img referrerPolicy="no-referrer" loading="lazy" decoding="async" 
              src={company.logo_url} 
              alt={company.company_name}
              className="w-12 h-12 rounded-xl object-cover"
            />
          ) : (
            <div className={`w-12 h-12 ${getCompanyLogoColor(index)} rounded-xl flex items-center justify-center text-white font-bold text-lg`}>
              {getCompanyInitial(company.company_name)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {company.company_name}
              </h3>
              {company.is_verified && (
                <Award className="w-4 h-4 text-yellow-500" />
              )}
              {(company.trending_score || 0) > 50 && (
                <TrendingUp className="w-4 h-4 text-green-500" />
              )}
            </div>
            {company.industry && (
              <p className="text-sm text-muted-foreground">{company.industry}</p>
            )}
          </div>
        </div>
        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>

      {/* Company Info */}
      {company.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {company.description}
        </p>
      )}

      {/* Company Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-muted-foreground">
            <MapPin className="w-3 h-3 mr-1" />
            <span>{formatLocation()}</span>
          </div>
          {company.company_size && (
            <div className="flex items-center text-muted-foreground">
              <Users className="w-3 h-3 mr-1" />
              <span>{company.company_size}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center">
            <Star className="w-3 h-3 text-yellow-500 mr-1" />
            <span className="text-foreground">4.5</span>
            <span className="text-muted-foreground ml-1">rating</span>
          </div>
          {foundedYear && (
            <div className="flex items-center text-muted-foreground">
              <span>Founded {foundedYear}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Badge variant="default" className="text-xs">
          <Briefcase className="w-3 h-3 mr-1" />
          {company.jobs_count} open jobs
        </Badge>
        <Button variant="ghost" size="sm" className="text-xs">
          View Profile
          <ArrowUpRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </Card>
  );
};

export default CompanyCard;
