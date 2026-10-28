import { useState, useEffect } from "react";
import { goBack } from "@/lib/goBack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { NativeHeader } from "@/components/native/NativeHeader";
import { NativeBottomNav } from "@/components/native/NativeBottomNav";
import { NativeListItem } from "@/components/native/NativeListItem";
import { TelegramStatusBadge } from "@/components/TelegramNotificationSection";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Settings, 
  Edit, 
  Copy, 
  Calendar, 
  Building2, 
  Globe,
  Users,
  Award,
  ArrowLeft,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Crown,
  Send
} from "lucide-react";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLocationDetection } from "@/hooks/useLocationDetection";
import { useWakeRefetch } from "@/hooks/useWakeRefetch";
import { supabase } from "@/integrations/supabase/client";
import VerificationBadge from "@/components/VerificationBadge";
import { getBusinessTypeLabel } from "@/utils/businessTypeUtils";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { DEFAULT_COMPANY_LOGO } from "@/utils/defaultAvatars";

const EmployerProfile = () => {
  const { user, company, loading } = useEmployerAuth();
  const navigate = useNavigate();
  const [locationAddress, setLocationAddress] = useState<string>("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [fetchedOAuthAvatar, setFetchedOAuthAvatar] = useState<string | null>(null);
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalApplications: 0,
    totalViews: 0
  });

  const locationDetection = useLocationDetection({
    onLocationDetected: (location) => {
      console.log('Location detected in employer profile:', location);
      if (location.fullAddress) {
        setLocationAddress(location.fullAddress);
      } else {
        setLocationAddress(`${location.city}, ${location.state}, ${location.country}`);
      }
    }
  });


  useEffect(() => {
    if (company?.id) {
      fetchCompanyStats();
    }
  }, [company]);

  // Refetch stats when tab becomes visible again after mobile screen off/on
  useWakeRefetch(() => { if (company?.id) fetchCompanyStats(); }, !!company?.id);


  // Resolve a Google/LinkedIn OAuth avatar from the live session so the
  // company DP shows on production (custom domain) even when
  // `companies.logo_url` hasn't been backfilled yet. Best-effort persist to
  // companies.logo_url so it sticks for next visit.
  const meta: any = (user as any)?.user_metadata || {};
  const identities: any[] = (user as any)?.identities || [];
  const identityAvatar = identities
    .map((i: any) => i?.identity_data || {})
    .map((d: any) => d.avatar_url || d.picture || d.picture_url || d.avatar)
    .find(Boolean);
  const oauthAvatar =
    meta.avatar_url ||
    meta.picture ||
    meta.picture_url ||
    meta.avatar ||
    meta.profile_picture ||
    meta.profile_image_url ||
    identityAvatar ||
    fetchedOAuthAvatar ||
    null;
  const resolvedLogo =
    normalizeImageUrl((company as any)?.logo_url) ||
    normalizeImageUrl(oauthAvatar) ||
    DEFAULT_COMPANY_LOGO;

  useEffect(() => {
    if ((company as any)?.logo_url) return;
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        let found = oauthAvatar;
        if (!found) {
          const { data } = await supabase.auth.getUser();
          if (cancelled) return;
          const u: any = data?.user;
          if (!u) return;
          const m: any = u.user_metadata || {};
          const ids: any[] = u.identities || [];
          const fromIds = ids
            .map((i: any) => i?.identity_data || {})
            .map((d: any) => d.avatar_url || d.picture || d.picture_url || d.avatar)
            .find(Boolean);
          found =
            m.avatar_url ||
            m.picture ||
            m.picture_url ||
            m.avatar ||
            m.profile_picture ||
            m.profile_image_url ||
            fromIds ||
            null;
        }
        if (cancelled) return;
        if (!found) return;
        setFetchedOAuthAvatar(found);
        if (company?.id && !(company as any).logo_url) {
          await supabase
            .from("companies")
            .update({ logo_url: found })
            .eq("id", company.id);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, company?.id, (company as any)?.logo_url, oauthAvatar]);

  const fetchCompanyStats = async () => {
    if (!company?.id) return;
    
    try {
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', company.id);

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Calculate stats
      const activeJobs = (jobsData || []).filter((job: any) => job.status === 'active').length;
      const totalViews = (jobsData || []).reduce((sum: number, job: any) => sum + (job.views_count || 0), 0);

      // Fetch applications
      if (jobsData && jobsData.length > 0) {
        const jobIds = jobsData.map((job: any) => job.id);
        const { data: applicationsData, error: applicationsError } = await supabase
          .from('job_applications')
          .select('*')
          .in('job_id', jobIds);

        if (applicationsError) throw applicationsError;
        setApplications(applicationsData || []);

        setStats({
          activeJobs,
          totalApplications: (applicationsData || []).length,
          totalViews
        });
      } else {
        setStats({
          activeJobs,
          totalApplications: 0,
          totalViews
        });
      }
    } catch (error) {
      console.error('Error fetching company stats:', error);
    }
  };

  const copyCompanyId = () => {
    if (company?.id) {
      navigator.clipboard.writeText(company.id);
      toast.success("Company ID copied to clipboard!");
    }
  };

  const handleEditProfile = () => {
    console.log('Edit Profile button clicked');
    console.log('Current user:', user);
    console.log('Current company:', company);
    console.log('Loading state:', loading);
    
    try {
      navigate('/Employer/Profile/Edit/1');
      console.log('Navigation to Employer/Profile/Edit/1 initiated');
    } catch (error) {
      console.error('Error navigating to company-profile-setup:', error);
      toast.error('Navigation failed. Please try again.');
    }
  };

  const handleSettings = () => {
    console.log('Settings button clicked');
    console.log('Current user:', user);
    console.log('Current company:', company);
    console.log('Loading state:', loading);
    
    try {
      navigate('/employer-settings');
      console.log('Navigation to employer-settings initiated');
    } catch (error) {
      console.error('Error navigating to employer-settings:', error);
      toast.error('Navigation failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading company profile...</p>
        </div>
      </div>
    );
  }

  if (!user || !company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to view your company profile.</p>
          <Button onClick={() => navigate('/employer-auth')} className="mt-4">
            Login
          </Button>
        </div>
      </div>
    );
  }

  // Build location string from database fields
  const getDisplayLocation = () => {
    // First priority: precise_address (full address)
    if ((company as any).precise_address) {
      return (company as any).precise_address;
    }
    
    // Second priority: city, state, country, postal_code
    if (company.city || company.state || company.country || company.postal_code) {
      const locationParts = [
        company.city,
        company.state, 
        company.country,
        company.postal_code
      ].filter(Boolean);
      return locationParts.join(', ');
    }
    
    // Third priority: location field
    if (company.location) {
      return company.location;
    }
    
    return null;
  };

  const displayLocation = getDisplayLocation();

  // Check if company is currently verified
  const isVerified = company?.is_verified && 
    company?.verified_plan_end && 
    new Date(company.verified_plan_end) > new Date();

  // Check if this is the lifetime verified account  
  const isLifetimeVerified = company?.is_verified && 
    company?.verified_plan_end &&
    new Date(company.verified_plan_end).getFullYear() >= 2099;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Native Header */}
      <NativeHeader
        title="Company Profile"
        subtitle={company.company_name || ""}
        showBack={true}
        onBackClick={() => goBack(navigate, "/employer-portal")}
      />

      <main className="container mx-auto px-4 py-6 pb-20 max-w-4xl">
        <div className="space-y-6">
          {/* Profile Header - Native Style */}
          <div className="bg-card rounded-2xl p-6 shadow-soft">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24 ring-4 ring-primary/10">
                <SafeAvatarImage src={resolvedLogo} alt={company.company_name || "Company"} />
                <AvatarFallback className="text-2xl bg-primary/10">
                  <Building2 className="w-8 h-8 text-primary" />
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center w-full">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-foreground">{company.company_name || "Company Name"}</h1>
                  {isVerified && (
                    <VerificationBadge 
                      color={company.badge_color as 'gold' | 'blue'} 
                      size={24} 
                    />
                  )}
                </div>
                
                {company.business_type && (
                  <p className="text-lg text-muted-foreground mb-2">{getBusinessTypeLabel(company.business_type)}</p>
                )}
                
                <div className="flex items-center justify-center gap-2 mb-4">
                  {company.industry && (
                    <Badge variant="secondary" className="capitalize">{company.industry}</Badge>
                  )}
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
              </div>

              {/* Action Buttons - Native Style */}
              <div className="grid grid-cols-3 gap-2 w-full">
                <NativeFeedbackButton 
                  variant="outline" 
                  size="sm" 
                  onClick={handleEditProfile}
                  disabled={loading}
                  feedbackType="tap"
                  className="flex-col h-auto py-3"
                >
                  <Edit className="w-5 h-5 mb-1" />
                  <span className="text-xs">Edit</span>
                </NativeFeedbackButton>
                <NativeFeedbackButton 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSettings}
                  disabled={loading}
                  feedbackType="tap"
                  className="flex-col h-auto py-3"
                >
                  <Settings className="w-5 h-5 mb-1" />
                  <span className="text-xs">Settings</span>
                </NativeFeedbackButton>
                <NativeFeedbackButton 
                  variant="default"
                  size="sm" 
                  onClick={() => navigate("/post-job")}
                  disabled={loading}
                  feedbackType="tap"
                  className="flex-col h-auto py-3"
                >
                  <Briefcase className="w-5 h-5 mb-1" />
                  <span className="text-xs">Post Job</span>
                </NativeFeedbackButton>
              </div>
            </div>
          </div>

          {/* Company Stats - Native Style */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl p-4 text-center shadow-soft">
              <Briefcase className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold text-foreground">{stats.activeJobs}</h3>
              <p className="text-xs text-muted-foreground">Active Jobs</p>
            </div>
            <div className="bg-card rounded-xl p-4 text-center shadow-soft">
              <Users className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold text-foreground">{stats.totalApplications}</h3>
              <p className="text-xs text-muted-foreground">Applications</p>
            </div>
            <div className="bg-card rounded-xl p-4 text-center shadow-soft">
              <Award className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold text-foreground">{stats.totalViews}</h3>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
          </div>

          {/* Company Details - Native Section */}
          {company.company_details && (
            <div className="bg-card rounded-2xl p-5 shadow-soft">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                About Company
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{company.company_details}</p>
            </div>
          )}

          {/* Contact Information - Native List */}
          <div className="bg-card rounded-2xl overflow-hidden shadow-soft divide-y divide-border/50">
            <div className="px-5 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Contact Information
              </h3>
            </div>
            <NativeListItem
              icon={Mail}
              title="Email"
              value={company.email || user.email || "Not set"}
            />
            {company.phone && (
              <NativeListItem
                icon={Phone}
                title="Phone"
                value={company.phone}
              />
            )}
            {displayLocation && (
              <NativeListItem
                icon={MapPin}
                title="Location"
                value={displayLocation}
              />
            )}
            {company.website && (
              <NativeListItem
                icon={Globe}
                title="Website"
                value={company.website}
              />
            )}
          </div>

          {/* Company Information - Native List */}
          <div className="bg-card rounded-2xl overflow-hidden shadow-soft divide-y divide-border/50">
            <div className="px-5 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Company Details
              </h3>
            </div>
            {company.legal_name && (
              <NativeListItem
                title="Legal Name"
                value={company.legal_name}
              />
            )}
            {company.organisation_size && (
              <NativeListItem
                title="Organization Size"
                value={company.organisation_size}
              />
            )}
            {(company as any).registered_address && (
              <NativeListItem
                title="Registered Address"
                value={(company as any).registered_address}
              />
            )}
            {company.hr_contact_name && (
              <NativeListItem
                icon={User}
                title="HR Contact"
                value={company.hr_contact_name}
              />
            )}
            {company.whatsapp_number && (
              <NativeListItem
                title="WhatsApp"
                value={company.whatsapp_number}
              />
            )}
            <NativeListItem
              title="Company ID"
              value={company.id.slice(0, 8)}
              onPress={copyCompanyId}
            />
            
            {/* Telegram Status */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-[hsl(200,80%,50%)]" />
                <span className="font-medium text-foreground">Telegram</span>
              </div>
              <TelegramStatusBadge
                userType="company"
                userId={user?.id || null}
                companyId={company.id}
                settingsPath="/employer-settings"
              />
            </div>
          </div>

          {/* Social Media - Native Section */}
          {((company as any).instagram_link || (company as any).facebook_link || (company as any).youtube_link || (company as any).linkedin_link) && (
            <div className="bg-card rounded-2xl p-5 shadow-soft">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Social Media
              </h3>
              <div className="flex items-center gap-4">
                {(company as any).instagram_link && (
                  <a
                    href={(company as any).instagram_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-muted/50 text-muted-foreground hover:text-pink-500 transition-colors active:scale-95"
                    title="Instagram Profile"
                  >
                    <Instagram className="w-6 h-6" />
                  </a>
                )}
                {(company as any).facebook_link && (
                  <a
                    href={(company as any).facebook_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-muted/50 text-muted-foreground hover:text-blue-600 transition-colors active:scale-95"
                    title="Facebook Profile"
                  >
                    <Facebook className="w-6 h-6" />
                  </a>
                )}
                {(company as any).youtube_link && (
                  <a
                    href={(company as any).youtube_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-muted/50 text-muted-foreground hover:text-red-600 transition-colors active:scale-95"
                    title="YouTube Channel"
                  >
                    <Youtube className="w-6 h-6" />
                  </a>
                )}
                {(company as any).linkedin_link && (
                  <a
                    href={(company as any).linkedin_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-full bg-muted/50 text-muted-foreground hover:text-blue-700 transition-colors active:scale-95"
                    title="LinkedIn Profile"
                  >
                    <Linkedin className="w-6 h-6" />
                  </a>
                )}
              </div>
            </div>
          )}


          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Briefcase className="w-5 h-5 mr-2" />
                  Recent Job Postings
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/employer-portal")}>
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length > 0 ? (
                <div className="space-y-4">
                  {jobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="border-l-2 border-primary pl-4">
                      <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                      <p className="text-primary font-medium">{job.department || 'General'}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {job.location}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(job.created_at).toLocaleDateString('en-GB', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </span>
                        <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>
                          {job.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{job.applications_count || 0} applications</span>
                        <span>{job.views_count || 0} views</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground mb-4">No jobs posted yet. Start by creating your first job posting.</p>
                  <Button variant="outline" size="sm" onClick={() => navigate("/post-job")}>
                    <Briefcase className="w-4 h-4 mr-2" />
                    Post Your First Job
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Native Bottom Navigation */}
      <NativeBottomNav />
    </div>
  );
};

export default EmployerProfile;