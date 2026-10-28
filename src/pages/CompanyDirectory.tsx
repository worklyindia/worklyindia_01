import PageHeader from "@/components/PageHeader";


import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Building } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useAnimatedPlaceholder, companySearchPlaceholders } from "@/hooks/useAnimatedPlaceholder";
import CompanyDirectoryCard from "@/components/company/CompanyDirectoryCard";
import { getCompanyUrl } from "@/utils/seoUrlHelpers";
import { SITE_CONFIG } from "@/config/siteConfig";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const PAGE_SIZE = 9;

const CompanyDirectory = () => {
  const navigate = useNavigate();
  const { isBanned } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const animatedPlaceholder = useAnimatedPlaceholder(companySearchPlaceholders, 100);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Redirect banned users or show restricted message
  if (isBanned()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="p-2 bg-gradient-primary rounded-lg mb-4 mx-auto w-fit">
            <Building className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Company Directory Restricted</h1>
          <div className="text-muted-foreground mb-4">
            Company profiles are not available due to account restrictions.
          </div>
        </div>
      </div>
    );
  }

  const { data: companies = [], isLoading, error } = useCompanies(searchTerm, "All");

  // Only show companies that have active job postings
  const companiesWithJobs = useMemo(
    () => companies.filter((company) => company.openJobs > 0),
    [companies]
  );

  const visibleCompanies = companiesWithJobs.slice(0, visibleCount);
  const hasMore = visibleCount < companiesWithJobs.length;

  // Reset pagination when the search term changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm]);

  // Infinite scroll: reveal more profiles as the user scrolls down
  const loadMore = useCallback(() => {
    setVisibleCount((count) => Math.min(count + PAGE_SIZE, companiesWithJobs.length));
  }, [companiesWithJobs.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleCount]);

  const logCompanyInteraction = async (companyId: string, type: 'view' | 'job_click' | 'contact') => {
    try {
      await supabase.from('company_interactions').insert({ company_id: companyId, interaction_type: type });
    } catch (e) {
      console.warn('Failed to log company interaction', e);
    }
  };

  const handleShare = async (company: any) => {
    // Use production domain for share URLs
    const shareUrl = SITE_CONFIG.getCompanyShareUrl({ 
      short_id: company.short_id, 
      slug: company.slug, 
      id: company.id 
    });
      
    const shareData = {
      title: company.name,
      text: `Check out ${company.name} - ${company.description}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(shareData.url);
    }
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Companies" />
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-8 max-w-7xl">

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={20} /></div>
            <Input
              placeholder={animatedPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="text-center py-12">
            <Building className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Error loading companies</h2>
            <p className="text-muted-foreground">Please try again later</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {visibleCompanies.map((company) => (
                <CompanyDirectoryCard
                  key={company.id}
                  company={company}
                  onViewProfile={async () => {
                    await logCompanyInteraction(company.id, 'view');
                    navigate(getCompanyUrl({ slug: company.slug, id: company.id }));
                  }}
                  onViewJobs={async () => {
                    await logCompanyInteraction(company.id, 'job_click');
                    navigate(`${getCompanyUrl({ slug: company.slug, id: company.id })}?tab=jobs`);
                  }}
                  onShare={() => handleShare(company)}
                />
              ))}
            </div>

            {companiesWithJobs.length === 0 && (
              <div className="text-center py-12">
                <Building className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">No companies found</h2>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            )}

            {/* Infinite scroll sentinel — more profiles load automatically while scrolling */}
            {hasMore && (
              <div ref={sentinelRef} className="py-8">
                <LoadingSkeleton />
              </div>
            )}
          </>
        )}
      </main>


    </div>
  );
};

export default CompanyDirectory;
