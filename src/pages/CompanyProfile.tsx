

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building, 
  MapPin, 
  Users, 
  Globe, 
  Mail, 
  Phone,
  Briefcase,
  Target,
  Calendar,
  Crown,
  MessageCircle,
  ArrowLeft
} from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { goBack } from "@/lib/goBack";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/utils/sanitize";
import VerificationBadge from "@/components/VerificationBadge";
import SocialMediaIcons from "@/components/SocialMediaIcons";
import { useCompanyStatistics } from "@/hooks/useCompanyStatistics";
import { useWakeRefetch } from "@/hooks/useWakeRefetch";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

const CompanyProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [companyData, setCompanyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [companyJobs, setCompanyJobs] = useState<any[]>([]);
  const defaultTab = searchParams.get('tab') === 'jobs' ? 'jobs' : 'about';
  
  // New hooks for real data - use companyData.id for proper UUID lookups
  const companyUUID = companyData?.id;
  const { statistics, loading: statsLoading } = useCompanyStatistics(companyUUID);
  useEffect(() => {
    if (id) {
      fetchCompanyData();
    }
  }, [id]);

  // Refetch on tab wake + safety timeout so the page doesn't stay stuck
  // on skeleton after mobile screen off/on.
  useWakeRefetch(() => { if (id) fetchCompanyData(); }, !!id);
  useLoadingTimeout(loading, setLoading, 8000);
  
  // Fetch jobs when companyData is loaded
  useEffect(() => {
    if (companyData?.id) {
      fetchCompanyJobs(companyData.id);
    }
  }, [companyData?.id]);

  const fetchCompanyData = async () => {
    try {
      setLoading(true);
      
      // Check if ID is a UUID or a slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
      
      let query = supabase.from('companies').select('*');
      
      if (isUUID) {
        query = query.eq('id', id);
      } else {
        // Try slug first, then short_id
        query = query.or(`slug.eq.${id},short_id.eq.${id}`);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error fetching company:', error);
        toast({
          title: "Error",
          description: "Company not found",
          variant: "destructive"
        });
        navigate('/company-directory');
        return;
      }

      if (!data) {
        toast({
          title: "Error",
          description: "Company not found",
          variant: "destructive"
        });
        navigate('/company-directory');
        return;
      }

      setCompanyData(data);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error", 
        description: "Failed to load company details",
        variant: "destructive"
      });
      navigate('/company-directory');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyJobs = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanyJobs(data || []);
    } catch (error) {
      console.error('Error fetching company jobs:', error);
    }
  };

  // Check if company is currently verified
  const isVerified = companyData?.is_verified && 
    companyData?.verified_plan_end && 
    new Date(companyData.verified_plan_end) > new Date();

  // Check if this is the lifetime verified account  
  const isLifetimeVerified = companyData?.is_verified && 
    companyData?.verified_plan_end &&
    new Date(companyData.verified_plan_end).getFullYear() >= 2099;
  const defaultCompanyData = {
    name: companyData?.company_name || "Company Name",
    tagline: companyData?.description || "Building the future with technology",
    industry: companyData?.industry || "Technology",
    founded: companyData?.incorporation_date ? new Date(companyData.incorporation_date).getFullYear().toString() : "2020",
    size: companyData?.organisation_size || companyData?.organization_size || companyData?.company_size || "50-100 employees",
    location: (() => {
      // Try to get the most complete address
      if (companyData?.precise_address) {
        return companyData.precise_address;
      }
      
      // Build from components
      const addressParts = [
        companyData?.city,
        companyData?.state, 
        companyData?.country
      ].filter(part => part && part.trim() && part.toLowerCase() !== 'mu');
      
      if (addressParts.length > 0) {
        return addressParts.join(', ');
      }
      
      // Fallback to location if it's meaningful
      if (companyData?.location && companyData.location.trim() && companyData.location.toLowerCase() !== 'mu') {
        return companyData.location;
      }
      
      return "India";
    })(),
    website: companyData?.website || "www.company.com",
    email: companyData?.email || "careers@company.com",
    phone: companyData?.phone || "+91 XXX XXX XXXX",
    whatsapp_number: companyData?.whatsapp_number || null,
    rating: statistics?.average_rating || 0,
    description: companyData?.company_details || companyData?.description || "We are a technology company focused on innovation and growth.",
    benefits: [
      "Health Insurance",
      "Workly India Options", 
      "Professional Development",
      "Competitive Salary",
      "Flexible Hours",
      "Stock Options"
    ],
    culture: [
      "Innovation-driven",
      "Work-life balance", 
      "Learning culture",
      "Diversity & Inclusion",
      "Team collaboration"
    ]
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading company profile...</h2>
          <p className="text-muted-foreground">Please wait while we fetch the company information.</p>
        </div>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Company not found</h2>
          <p className="text-muted-foreground">The company you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      {/* Mobile-style top header with back icon and page name */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
          <div className="flex items-center gap-2 h-14">
            <Button 
              size="icon" 
              variant="ghost" 
              className="rounded-xl h-9 w-9" 
              aria-label="Back"
              onClick={() => goBack(navigate, '/company-directory')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base sm:text-lg font-semibold text-foreground">Company Profile</h1>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-6xl">
        {/* Company Header */}
        <Card className="p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            
            {/* Company logo and name */}
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center overflow-hidden">
                {companyData?.logo_url ? (
                  <img
                    src={companyData.logo_url}
                    alt={`${defaultCompanyData.name} logo`}
                    className="w-full h-full object-contain bg-white"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Building className="w-8 h-8 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2 flex-wrap">
                  <span className="truncate">{defaultCompanyData.name}</span>
                  {isVerified && (
                    <VerificationBadge 
                      color={companyData.badge_color as 'gold' | 'blue'} 
                      size={20} 
                    />
                  )}
                </h1>
              </div>
            </div>
            
            <p className="text-base text-muted-foreground mb-3">{defaultCompanyData.tagline}</p>
            
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="secondary" className="text-xs capitalize">{defaultCompanyData.industry}</Badge>
              {isVerified && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  {isLifetimeVerified ? (
                    <><Crown className="h-3 w-3" /> Lifetime Verified</>
                  ) : (
                    <>Verified Company</>
                  )}
                </Badge>
              )}
            </div>
            
            
            <div className="space-y-2 text-sm text-muted-foreground mb-4">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="break-words">{defaultCompanyData.location}</span>
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{defaultCompanyData.size}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>Founded in {defaultCompanyData.founded}</span>
              </div>
            </div>
            
            {/* Social Media Icons - Mobile */}
            {(companyData?.instagram_link || companyData?.facebook_link || companyData?.youtube_link || companyData?.linkedin_link) && (
              <div className="mt-4">
                <SocialMediaIcons
                  instagram={companyData.instagram_link}
                  facebook={companyData.facebook_link}
                  youtube={companyData.youtube_link}
                  linkedin={companyData.linkedin_link}
                  size="sm"
                />
              </div>
            )}
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-start space-x-6">
            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-primary/20 rounded-2xl flex items-center justify-center overflow-hidden">
              {companyData?.logo_url ? (
                <img
                  src={companyData.logo_url}
                  alt={`${defaultCompanyData.name} logo`}
                  className="w-full h-full object-contain bg-white"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building className="w-10 h-10 lg:w-12 lg:h-12 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
                {defaultCompanyData.name}
                {/* Verification Badge */}
                {isVerified && (
                  <VerificationBadge 
                    color={companyData.badge_color as 'gold' | 'blue'} 
                    size={24} 
                  />
                )}
              </h1>
              <p className="text-base lg:text-lg text-muted-foreground mb-3">{defaultCompanyData.tagline}</p>
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <Badge variant="secondary" className="capitalize">{defaultCompanyData.industry}</Badge>
                {isVerified && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {isLifetimeVerified ? (
                      <><Crown className="h-3 w-3" /> Lifetime Verified</>
                    ) : (
                      <>Verified Company</>
                    )}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span className="break-words">{defaultCompanyData.location}</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  {defaultCompanyData.size}
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Founded in {defaultCompanyData.founded}
                </div>
              </div>
              
              {/* Social Media Icons - Desktop */}
              {(companyData?.instagram_link || companyData?.facebook_link || companyData?.youtube_link || companyData?.linkedin_link) && (
                <div className="mt-4">
                  <SocialMediaIcons
                    instagram={companyData.instagram_link}
                    facebook={companyData.facebook_link}
                    youtube={companyData.youtube_link}
                    linkedin={companyData.linkedin_link}
                    size="md"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>


        {/* Main Content */}
        <Tabs defaultValue={defaultTab} className="w-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 h-auto p-1">
            <TabsTrigger value="about" className="text-sm px-4 py-2">About</TabsTrigger>
            <TabsTrigger value="jobs" className="text-sm px-4 py-2">Jobs ({companyJobs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">About the Company</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">{defaultCompanyData.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Contact Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">{defaultCompanyData.email}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">{defaultCompanyData.phone}</span>
                    </div>
                    {defaultCompanyData.whatsapp_number && (
                      <div className="flex items-center">
                        <MessageCircle className="w-4 h-4 text-primary mr-2" />
                        <span className="text-sm text-muted-foreground">{defaultCompanyData.whatsapp_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {companyData?.website && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Website</h3>
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 text-primary mr-2" />
                      <a 
                        href={companyData.website.startsWith('http') ? companyData.website : `https://${companyData.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {defaultCompanyData.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Open Positions</h2>
            </div>
            
            {companyJobs.length > 0 ? (
              <div className="grid gap-4 w-full">
                {companyJobs.map((job) => (
                  <Card key={job.id} className="p-4 sm:p-5 hover:shadow-md transition-shadow cursor-pointer w-full overflow-hidden" 
                        onClick={() => navigate(`/job/${job.id}`)}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground leading-snug pr-0 sm:pr-2">{job.title}</h3>
                      <Badge variant="secondary" className="text-xs w-fit">{job.job_type}</Badge>
                    </div>
                    <div className="space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span className="break-words">{job.location}</span>
                      </div>
                      <div className="flex items-center">
                        <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span>{job.experience_level}</span>
                      </div>
                      {job.salary_range && (
                        <div className="flex items-center">
                          <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                          <span>{job.salary_range}</span>
                        </div>
                      )}
                    </div>
                    <div 
                      className="text-xs sm:text-sm text-muted-foreground mt-4 line-clamp-2 prose prose-sm max-w-none prose-p:m-0 prose-strong:font-semibold"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        Posted {new Date(job.created_at).toLocaleDateString('en-GB', { 
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      <Button size="sm" variant="outline" className="w-full sm:w-auto text-xs">
                        View Details
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 sm:p-10 text-center">
                <Briefcase className="w-12 h-12 sm:w-14 sm:h-14 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">No Open Positions</h3>
                <p className="text-sm text-muted-foreground">This company doesn't have any open positions at the moment.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

    </div>
  );
};

export default CompanyProfile;
