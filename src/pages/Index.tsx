import { useState, useEffect, useRef, Suspense } from "react";
import { lazyRetry } from "@/lib/chunkErrorRecovery";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import SearchBar from "@/components/SearchBar";
import CategoryChips from "@/components/CategoryChips";
import { Building, Shield, AlertTriangle, ExternalLink } from "lucide-react";
import TrustMarquee from "@/components/auth/TrustMarquee";
import { useTrustCompanies } from "@/hooks/useTrustCompanies";
import { useTrustSeekers } from "@/hooks/useTrustSeekers";
import { useAuthImages } from "@/hooks/useAuthImages";
import { useHomeSeekersVideo } from "@/hooks/useHomeSeekersVideo";
import { YouTubeVideoCard } from "@/components/YouTubeVideoCard";
const HomeResumePreviewStrip = lazyRetry(() => import("@/components/HomeResumePreviewStrip"));
const HomeDomainSection = lazyRetry(() => import("@/components/HomeDomainSection"));
const HomeCareerCategories = lazyRetry(() => import("@/components/HomeCareerCategories"));
import homeHeroAsset from "@/assets/home-hero.png.asset.json";

const HomeTrustBadges = lazyRetry(() => import("@/components/HomeTrustBadges"));
const HomeTrustpilotCard = lazyRetry(() => import("@/components/review/HomeTrustpilotCard"));


import SEO from "@/components/SEO";
import ParallaxSection from "@/components/animations/ParallaxSection";
import ScrollReveal from "@/components/animations/ScrollReveal";
import { OrganizationStructuredData, WebSiteStructuredData } from "@/components/seo";
import LocalBusinessSchemaFull from "@/components/seo/LocalBusinessSchema";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import HeroBanner from "@/components/HeroBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Skeleton } from "@/components/ui/skeleton";
import Footer from "@/components/Footer";
import homeSeekersAsset from "@/assets/home-seekers.png.asset.json";
const MadeWithLoveSection = lazyRetry(() => import("@/components/MadeWithLoveSection"));
import JobCard from "@/components/JobCard";
const BrandSocialBar = lazyRetry(() => import("@/components/BrandSocialBar"));
import { useTrendingJobs } from "@/hooks/useTrendingJobs";
import { JobCardSkeleton } from "@/components/skeletons/JobCardSkeleton";
import { CANONICAL_URL } from '@/config/domainConfig';

// Lazy load below-the-fold components for faster initial load
const QuickStatsCards = lazyRetry(() => import("@/components/QuickStatsCards"));
const NotificationPermissionPrompt = lazyRetry(() => import("@/components/NotificationPermissionPrompt").then(m => ({ default: m.NotificationPermissionPrompt })));
const WelcomePromoModal = lazyRetry(() => import("@/components/WelcomePromoModal"));
const TrustIndicators = lazyRetry(() => import("@/components/TrustIndicators"));
const DonationSection = lazyRetry(() => import("@/components/donation/DonationSection"));

const SectionSkeleton = () => (
  <div className="py-4 px-4 space-y-3">
    <Skeleton className="h-6 w-48" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  </div>
);

const FEATURED_MAX_AGE_DAYS = 30;
const HomeRankedJobs = () => {
  const { jobs: allJobs, loading } = useTrendingJobs({ limit: 10, enabled: true, showTopRanked: false });
  // Only fresh jobs on the home page: stale listings hurt trust.
  const jobs = allJobs.filter(j => Date.now() - new Date(j.created_at).getTime() <= FEATURED_MAX_AGE_DAYS * 86400000);
  const navigate = useNavigate();

  if (loading && jobs.length === 0) {
    return (
      <div className="px-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <div className="px-4 space-y-3">
      {jobs.slice(0, 10).map((job, index) => (
        <div key={job.job_id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
          <JobCard
            id={job.job_id}
            shortId={job.short_id}
            publicSlug={job.public_slug}
            title={job.title}
            company={job.company}
            location={job.location}
            salary={job.salary_range}
            type={job.job_type}
            experience={job.experience_level}
            description={job.description}
            posted={job.created_at}
            tags={job.skills?.slice(0, 3)}
            trendingScore={job.trending_score}
            organicScore={job.base_score}
            baseScore={job.base_score}
            trendingRank={job.trending_rank}
            organicRank={job.organic_rank}
            viewsCount={job.views_count}
            applicationsCount={job.applications_count}
            isBoosted={job.is_boosted}
            boostLevel={job.boost_level}
            isVerified={job.is_verified}
            badgeColor={job.badge_color}
            verifiedPlanEnd={job.verified_plan_end}
            city={job.city}
            state={job.state}
            country={job.country}
            apiCompanyName={job.apiCompanyName}
            logoUrl={job.logo_url}
            category={(job as any).category}
            workMode={(job as any).work_mode}
            shiftTiming={(job as any).shift_timing}
            education={(job as any).education_required}
            openings={(job as any).openings}
            latitude={job.latitude}
            longitude={job.longitude}
            showProminentDate={false}
          />
        </div>
      ))}
    </div>
  );
};


const Index = () => {
  const navigate = useNavigate();
  const { data: trustCompanies } = useTrustCompanies();
  const { data: trustSeekers } = useTrustSeekers();
  const homeSeekersVideos = useHomeSeekersVideo();
  const { data: authImages } = useAuthImages();
  const { user, isBanned } = useAuth();

  const { user: employerUser, loading: employerLoading, company, companyLoading } = useEmployerAuth();
  const isMobile = useIsMobile();
  const networkStatus = useNetworkStatus();
  const [showKYC, setShowKYC] = useState(false);
  
  // Handle employer OAuth redirect from public/employer-auth.html
  useEffect(() => {
    try {
      const isEmployerOAuth = sessionStorage.getItem('employer_oauth_pending') === 'true';
      if (isEmployerOAuth) {
        console.log('🏢 Detected employer OAuth pending on Index page - setting auto-redirect');
        localStorage.setItem('employerAutoRedirect', 'true');
      }
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  // Auto-redirect employer to dashboard if logged in (using localStorage flag)
  useEffect(() => {
    if (!employerLoading && !companyLoading && employerUser) {
      // Check localStorage flag for auto-redirect (set on employer login, removed on logout)
      // "Visit Website" from the employee portal: stay on the website for this tab session.
      let viewingWebsite = false;
      try { viewingWebsite = sessionStorage.getItem('employerViewWebsite') === '1'; } catch { /* ignore */ }
      const shouldAutoRedirect = !viewingWebsite && localStorage.getItem('employerAutoRedirect') === 'true';
      
      if (shouldAutoRedirect) {
        navigate('/employer-portal', { replace: true });
      }
    }
  }, [employerUser, employerLoading, companyLoading, navigate]);

  // Show location banner only 60s after user logs in
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    if (user) {
      timer = window.setTimeout(() => setShowLocationBanner(true), 60_000);
    } else {
      setShowLocationBanner(false);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [user]);


  const siteUrl = typeof window !== 'undefined' ? window.location.origin : CANONICAL_URL;
  
  const websiteStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": BRAND_CONFIG.name,
    "alternateName": "Workly India",
    "url": siteUrl,
    "description": "Find legitimate remote jobs in India. Browse remote opportunities across various industries.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteUrl}/jobs?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background page-enter pb-20 md:pb-0">
        <SEO 
          title="Workly India"
          description="India's #1 remote job portal. Find verified remote jobs in data entry, customer support, content writing, and more. 100% free for job seekers. Employers post jobs free. Start your remote career today!"
          keywords="remote jobs india, remote jobs india, Workly India jobs 2026, online jobs without investment, data entry jobs, customer support jobs, content writing jobs, part time jobs from home, genuine remote jobs india, legitimate online work india"
          canonical="/"
        />
        <h1 className="sr-only">Workly India – free verified remote jobs and hiring platform in India</h1>
        <OrganizationStructuredData />
        <LocalBusinessSchemaFull />
        
        <Header hideSearch={true} />
        
          {/* Hero Banner */}
          <HeroBanner />
        
        {/* Search Bar */}
        <ScrollReveal type="fade-up" delay={100}>
          <SearchBar />
        </ScrollReveal>
        
        {/* Category Chips */}
        <ScrollReveal type="fade-up" delay={200}>
          <CategoryChips />
        </ScrollReveal>

        {/* Quick Stats */}
        <ScrollReveal type="zoom-in" delay={100}>
          <Suspense fallback={<SectionSkeleton />}>
            <QuickStatsCards />
          </Suspense>
        </ScrollReveal>


        {/* Section divider */}
        <HomeCareerCategories />
        <div className="h-2 bg-muted/30" />

        {/* Top 10 Ranked Jobs - Vertical List */}
        <ScrollReveal type="fade-up">
          <div className="py-3">
            <HomeRankedJobs />
          </div>
        </ScrollReveal>

        {/* Owner-chosen videos above job seekers scroll — swipe left/right for more */}
        {homeSeekersVideos.length > 0 && (
          <ScrollReveal type="fade-up">
            <div className="py-3">
              {homeSeekersVideos.length === 1 ? (
                <div className="px-4 flex justify-center">
                  <div className="w-full max-w-xl">
                    <YouTubeVideoCard url={homeSeekersVideos[0]} showDetails={false} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-smooth">
                  {homeSeekersVideos.map((url) => (
                    <div key={url} className="flex-shrink-0 w-[85vw] max-w-[420px] snap-center">
                      <YouTubeVideoCard url={url} showDetails={false} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>
        )}

        {/* Silent promo video — same overview clip used on the job postings page */}
        <ScrollReveal type="fade-up">
          <section aria-label="Workly India overview video" className="border-t border-border py-3">
            <div className="mx-auto max-w-5xl px-4 py-6">
              <h2 className="text-center text-2xl font-bold">See Workly India in action</h2>
              <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">A quick look at how hiring and job search work on the platform.</p>
              <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
                <video
                  src="https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-india-promo-30s-silent.mp4"
                  poster={authImages?.home_hero_image || homeHeroAsset.url}
                  aria-label="Workly India platform overview"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  controls={false}
                  disablePictureInPicture
                  controlsList="nodownload nofullscreen noremoteplayback"
                  onContextMenu={(e) => e.preventDefault()}
                  onPause={(e) => { void e.currentTarget.play().catch(() => {}); }}
                  className="aspect-video w-full rounded-xl object-cover"
                />
              </div>
<a href="/watch/workly-india-promo" className="mt-3 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">Watch full video</a>
            </div>
          </section>
        </ScrollReveal>

        {/* Job seekers scroll */}
        <ScrollReveal type="fade-up" delay={100}>
          <TrustMarquee
            variant="seekers"
            title="Join 500,000+ job seekers on Workly India"
            items={trustSeekers ?? []}
            defaultImageUrl={authImages?.default_job_seeker_avatar}
          />
          <img
            src={authImages?.home_seekers_image || homeSeekersAsset.url}
            alt="Grow your business with WhatsApp on Workly India"
            className="mx-auto mt-4 w-full max-w-3xl bg-transparent px-2 object-contain"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </ScrollReveal>

        {/* Resume templates preview — one horizontal line, full-bleed, like YouTube thumbnails */}
        <ScrollReveal type="fade-up" delay={100}>
          <HomeResumePreviewStrip />
          <HomeDomainSection />
          <img
            src={authImages?.home_hero_image || homeHeroAsset.url}
            alt="Workly India"
            className="mx-auto w-full max-w-md object-contain"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </ScrollReveal>

        {/* Donation Section - Gau Mata Seva */}


        <ScrollReveal type="fade-up">
          <div>
            <Suspense fallback={<SectionSkeleton />}>
              <DonationSection />
            </Suspense>
          </div>
        </ScrollReveal>

        {/* Trust Features - Database-driven, owner-managed */}
        <HomeTrustBadges />

        <HomeTrustpilotCard />

        {/* Company profiles scroll - directly below the trust cards (UDYAM Registered is the last card) */}
        <ScrollReveal type="fade-up">
          <TrustMarquee
            variant="companies"
            title="Trusted by 5,000+ companies hiring on Workly India"
            items={trustCompanies ?? []}
            defaultImageUrl={authImages?.default_company_logo}
          />
        </ScrollReveal>







        {/* Important Safety Notice */}
        <ScrollReveal type="fade-up" distance={40}>
          <div className="px-4 py-6">
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-5 border border-amber-200 dark:border-amber-800">
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Important Safety Notice
              </h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>• This platform lists job opportunities from various companies. We do not provide jobs directly.</li>
                <li>• Always verify the company before applying for any job.</li>
                <li>• <strong className="text-amber-700 dark:text-amber-400">Legitimate jobs never require payment</strong>. Do not pay any registration or processing fees.</li>
                <li>• <strong>Never share your OTP</strong>, bank details, or passwords with anyone.</li>
                <li>• If asked to download an app, ensure it's from the official <strong className="text-amber-700 dark:text-amber-400">Play Store</strong>. Check app reviews before installing.</li>
                <li>• Verify any website is official before trusting it with your information.</li>
                <li>• Only verify documents through <strong className="text-amber-700 dark:text-amber-400">official government websites</strong>. Do not use manual document verification services.</li>
              </ul>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>• This platform charges employers for job posting services only. <strong className="text-amber-700 dark:text-amber-400">Job seekers are never charged</strong>.</p>
                <p>• For any concerns or to report suspicious activity, <Link to="/contact-us" className="text-primary underline">contact us</Link> immediately.</p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Quick Footer Links */}
        <ScrollReveal type="fade-up" delay={50}>
          <div className="px-4 pt-5 pb-2 text-center">
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-2.5 text-sm">
              {[
                { to: "/about-us", label: "About Us" },
                { to: "/mission", label: "Mission" },
                { to: "/vision", label: "Vision" },
                { to: "/why-choose-us", label: "Why Choose Workly India" },
                { to: "/blog", label: "Blog" },
                { to: "/trust-safety", label: "Trust & Safety" },
                { to: "/employer-guidelines", label: "Employer Guidelines" },
                { to: "/job-seeker-guidelines", label: "Job Seeker Guidelines" },
                { to: "/community-guidelines", label: "Community Guidelines" },
                { to: "/accessibility", label: "Accessibility Statement" },
                { to: "/privacy", label: "Privacy Policy" },
                { to: "/refund-policy", label: "Refund & Cancellation" },
                { to: "/terms-conditions", label: "Terms & Conditions" },
                { to: "/faq", label: "FAQ" },
                { to: "/disclaimer", label: "Disclaimer" },
                { to: "/dmca", label: "DMCA / Copyright Policy" },
                { to: "/cookie-policy", label: "Cookie Policy" },
                { to: "/contact-us", label: "Contact Us" },
                { to: "/sitemap", label: "Sitemap" },
                { to: "/careers", label: "Careers" },
                { to: "/press-kit", label: "Press / Media Kit" },
              ].map((link, i) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-primary font-medium underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all active:scale-95"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <BrandSocialBar
              className="mt-5"
              align="center"
              size="md"
              title="Follow us"
            />
            <p className="mt-5 text-xs text-muted-foreground">
              © {new Date().getFullYear()} Workly India. All Rights Reserved.
            </p>
          </div>
        </ScrollReveal>

        {/* Notification Permission */}
        <Suspense fallback={null}>
          <NotificationPermissionPrompt />
        </Suspense>

        {/* Welcome Promo Modal for non-logged-in users */}
        <Suspense fallback={null}>
          <WelcomePromoModal isLoggedIn={!!user || !!employerUser} />
        </Suspense>
      </div>

      <BottomNavigation />
    </>
  );
};

export default Index;

