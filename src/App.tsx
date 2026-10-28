import { ConfirmDialogHost } from '@/lib/confirmDialog';
import { useTrackWorklyChatReturn } from "@/lib/worklyChatReturn";

import React, { useEffect, Suspense } from "react";
import { lazyRetry } from "@/lib/chunkErrorRecovery";
import { Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { navigationMiddleware } from "@/utils/navigationMiddleware";
import { Capacitor } from "@capacitor/core";
import { HelmetProvider } from "react-helmet-async";
import RouteSEO from "@/components/seo/RouteSEO";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EmployerAuthProvider } from "@/contexts/EmployerAuthContext";
import { UserLocationProvider } from "@/contexts/UserLocationContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandMetaTags } from "@/components/brand/BrandMetaTags";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProtectedEmployerRoute from "@/components/ProtectedEmployerRoute";
import ProtectedAdminRoute from "@/components/ProtectedAdminRoute";
import { ProtectedPermissionRoute } from "@/components/ProtectedPermissionRoute";
import LocationPermissionManager from "@/components/LocationPermissionManager";
import RoutePreserver from "@/components/RoutePreserver";
import PendingReferralApplier from "@/components/referral/PendingReferralApplier";
import { ReferralOnboardingGuard } from '@/components/referral/ReferralOnboardingGuard';
import AIOnlyModeGuard from "@/components/AIOnlyModeGuard";
import OnboardingGuard from "@/components/OnboardingGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import SafeErrorBoundary from "@/components/SafeErrorBoundary";
import CookieConsent from "@/components/CookieConsent";
import AppLoadingSpinner from "@/components/AppLoadingSpinner";
import { usePushInit } from "@/hooks/usePushInit";
import { HomePageSkeleton } from "@/components/skeletons/HomePageSkeleton";
import { JobListSkeleton } from "@/components/skeletons/JobCardSkeleton";
import { useComprehensiveNotifications } from "@/hooks/useComprehensiveNotifications";
import { useJobRecommendationNotifications } from "@/hooks/useJobRecommendationNotifications";
import { JobStatusNotificationWrapper } from "@/components/JobStatusNotificationWrapper";
import { JobRecommendationNotifier } from "@/components/JobRecommendationNotifier";
import { useLiveSessionTracking } from "@/hooks/useLiveSessionTracking";
import { useNativeApp } from "@/hooks/useNativeApp";
import { InstallPromptBanner } from "@/components/InstallPromptBanner";

import { VPNGuard } from "@/components/VPNGuard";
import SocialTokenCapture from "@/components/social/SocialTokenCapture";
import { initPwaInstallListener } from "@/utils/pwaInstallTrigger";
import CursorFollower from "@/components/animations/CursorFollower";

import { useAppReady } from "@/hooks/useAppReady";

const isBandwidthSaverMode = import.meta.env.VITE_BANDWIDTH_SAVER !== 'false';

// Critical pages loaded immediately
import Auth from "./pages/Auth";
import EmployerAuth from "./pages/EmployerAuth";
import Welcome from "./pages/Welcome";
import Index from "./pages/Index";
import Jobs from "./pages/Jobs";
import Activity from "./pages/Activity";
import More from "./pages/More";
import AICareerAssistant from "./pages/AICareerAssistant";
const AIVoiceCall = lazyRetry(() => import("./pages/AIVoiceCall"));
import BannedUser from "./pages/BannedUser";
import PasswordResetForm from "./components/PasswordResetForm";
const VerifyEmailChange = lazyRetry(() => import("./pages/VerifyEmailChange"));

// Lazy load all non-critical pages to reduce initial bundle size
const ProfileSetup = lazyRetry(() => import("./pages/ProfileSetup"));
const JobSeekerOnboarding = lazyRetry(() => import("./pages/JobSeekerOnboarding"));
import DeveloperProfileGate from "@/components/developers/DeveloperProfileGate";
const DeveloperOnboarding = lazyRetry(() => import("./pages/developers/DeveloperOnboarding"));
const DeveloperProfile = lazyRetry(() => import("./pages/developers/DeveloperProfile"));
const DevelopersEntry = lazyRetry(() => import("./pages/developers/DevelopersEntry"));
const EmployerMetaProfile = lazyRetry(() => import("./pages/employer/EmployerMetaProfile"));
const CompanyOnboarding = lazyRetry(() => import("./pages/employer/CompanyOnboarding"));
const JobDetail = lazyRetry(() => import("./pages/JobDetail"));
const ExternalJobDetail = lazyRetry(() => import("./pages/ExternalJobDetail"));

const ShortUrlRedirect = lazyRetry(() => import("./pages/ShortUrlRedirect"));
const CompanyShortUrlRedirect = lazyRetry(() => import("./pages/CompanyShortUrlRedirect"));
const ProfileShortUrlRedirect = lazyRetry(() => import("./pages/ProfileShortUrlRedirect"));
const CallRedirect = lazyRetry(() => import("./pages/CallRedirect"));
const Profile = lazyRetry(() => import("./pages/Profile"));
const PaymentHistory = lazyRetry(() => import("./pages/PaymentHistory"));
const PaymentProfile = lazyRetry(() => import("./pages/PaymentProfile"));
const ShippingAddressPage = lazyRetry(() => import("./pages/ShippingAddress"));
const Rewards = lazyRetry(() => import("./pages/Rewards"));
const Notifications = lazyRetry(() => import("./pages/Notifications"));
const HowItWorks = lazyRetry(() => import("./pages/HowItWorks"));
const Favorites = lazyRetry(() => import("./pages/Favorites"));
const Festivals = lazyRetry(() => import("./pages/Festivals"));
const CompanyDashboard = lazyRetry(() => import("./pages/CompanyDashboard"));
const EmployerPortal = lazyRetry(() => import("./pages/EmployerPortal"));
const EmployeeEntry = lazyRetry(() => import("./pages/EmployeeEntry"));
const OwnerPortal = lazyRetry(() => import("./pages/OwnerPortal"));
const TeamManagement = lazyRetry(() => import("./pages/owner-portal/TeamManagement"));
const InviteMember = lazyRetry(() => import("./pages/owner-portal/InviteMember"));
const CreateRole = lazyRetry(() => import("./pages/owner-portal/CreateRole"));
const AuthUsersManagement = lazyRetry(() => import("./pages/owner-portal/AuthUsersManagement"));
const AIChatPlansManagement = lazyRetry(() => import("./pages/owner-portal/AIChatPlansManagement"));
const AIPublicPricing = lazyRetry(() => import("./pages/AIPublicPricing"));
const Pricing = lazyRetry(() => import("./pages/Pricing"));
const SupportTicketsManagement = lazyRetry(() => import("./pages/owner-portal/SupportTicketsManagement"));
const CustomerService = lazyRetry(() => import("./pages/owner-portal/CustomerService"));
const KeepQueryRedirect = ({ to }: { to: string }) => { const l = useLocation(); return <Navigate to={to + l.search} replace />; };
const EmailChat = lazyRetry(() => import("./pages/owner-portal/EmailChat"));
const DomainPricingSettings = lazyRetry(() => import("./pages/owner-portal/DomainPricingSettings"));
const DomainSettings = lazyRetry(() => import("./pages/owner-portal/DomainSettings"));
const DomainSalesDashboard = lazyRetry(() => import("./pages/owner-portal/DomainSalesDashboard"));
const PostJob = lazyRetry(() => import("./pages/PostJob"));
const PostJobEntry = lazyRetry(() => import("./pages/PostJobEntry"));
const CompanyProfileSetup = lazyRetry(() => import("./pages/employer/CompanyProfileSetup"));

const ViewApplicants = lazyRetry(() => import("./pages/employer/ViewApplicants"));
const AllApplicants = lazyRetry(() => import("./pages/AllApplicants"));
const EditJob = lazyRetry(() => import("./pages/employer/EditJob"));
const EmailManagement = lazyRetry(() => import("./pages/EmailManagement"));

const JobAnalytics = lazyRetry(() => import("./pages/employer/JobAnalytics"));
const EmployerAnalytics = lazyRetry(() => import("./pages/employer/EmployerAnalytics"));
const Interviews = lazyRetry(() => import("./pages/employer/Interviews"));
const ScheduleInterview = lazyRetry(() => import("./pages/employer/ScheduleInterview"));
const InterviewRoom = lazyRetry(() => import("./pages/InterviewRoom"));
const InterviewDetails = lazyRetry(() => import("./pages/InterviewDetails"));
const EmployerProfile = lazyRetry(() => import("./pages/EmployerProfile"));
const EmployerWhatsAppPage = lazyRetry(() => import("./pages/employer/EmployerWhatsApp"));
const EmployerWhatsAppBusinessProfilePage = lazyRetry(() => import("./pages/employer/EmployerWhatsAppBusinessProfile"));
const EmployerTemplatePickerPage = lazyRetry(() => import("./pages/employer/EmployerTemplatePickerPage"));
const EmployerSettings = lazyRetry(() => import("./pages/EmployerSettings"));
const CompanyProfile = lazyRetry(() => import("./pages/CompanyProfile"));
const ResumeBuilderEntry = lazyRetry(() => import("./pages/ResumeBuilderEntry"));
const DomainsEntry = lazyRetry(() => import("./pages/DomainsEntry"));
const ResumeCreate = lazyRetry(() => import("./pages/ResumeCreate"));
const CoverLetterCreate = lazyRetry(() => import("./pages/CoverLetterCreate"));
const InterviewTips = lazyRetry(() => import("./pages/InterviewTips"));
const CareerGuidance = lazyRetry(() => import("./pages/CareerGuidance"));
const SkillAssessment = lazyRetry(() => import("./pages/SkillAssessment"));
const TakeAssessment = lazyRetry(() => import("./pages/TakeAssessment"));
const PracticeMode = lazyRetry(() => import("./pages/PracticeMode"));
const AssessmentResults = lazyRetry(() => import("./pages/AssessmentResults"));
const VerifyCertificate = lazyRetry(() => import("./pages/VerifyCertificate"));
const CompanyDirectory = lazyRetry(() => import("./pages/CompanyDirectory"));
const RecruitmentSolutions = lazyRetry(() => import("./pages/RecruitmentSolutions"));
const CaseStudies = lazyRetry(() => import("./pages/CaseStudies"));

const HelpCenter = lazyRetry(() => import("./pages/HelpCenter"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const AccountChangePage = lazyRetry(() => import("./pages/AccountChangePage"));
const RateApp = lazyRetry(() => import("./pages/RateApp"));
const AllReviews = lazyRetry(() => import("./pages/AllReviews"));
const ResumeEditor = lazyRetry(() => import("./pages/ResumeEditor"));
const AboutUs = lazyRetry(() => import("./pages/AboutUs"));
const MissionVision = lazyRetry(() => import("./pages/MissionVision"));
const Mission = lazyRetry(() => import("./pages/Mission"));
const Vision = lazyRetry(() => import("./pages/Vision"));
const WhyChooseUs = lazyRetry(() => import("./pages/WhyChooseUs"));
const WereHiring = lazyRetry(() => import("./pages/WereHiring"));
const HireInterns = lazyRetry(() => import("./pages/HireInterns"));
const TeamDiary = lazyRetry(() => import("./pages/TeamDiary"));
const Blog = lazyRetry(() => import("./pages/Blog"));
const BlogPost = lazyRetry(() => import("./pages/BlogPost"));
const OurServices = lazyRetry(() => import("./pages/OurServices"));
const FreeJobAlerts = lazyRetry(() => import("./pages/FreeJobAlerts"));
const TermsAndConditions = lazyRetry(() => import("./pages/TermsAndConditions"));
const Privacy = lazyRetry(() => import("./pages/Privacy"));
const RefundPolicy = lazyRetry(() => import("./pages/RefundPolicy"));
const ContactUs = lazyRetry(() => import("./pages/ContactUs"));
const AdminSettings = lazyRetry(() => import("./pages/AdminSettings"));
const Sitemap = lazyRetry(() => import("./pages/Sitemap"));
const CollegeTPO = lazyRetry(() => import("./pages/CollegeTPO"));

const JobsForWomen = lazyRetry(() => import("./pages/JobsForWomen"));

const LeadManagement = lazyRetry(() => import("./pages/LeadManagement"));
const AllLeads = lazyRetry(() => import("./pages/AllLeads"));
const PurchasedLeads = lazyRetry(() => import("./pages/PurchasedLeads"));
const LeadNotificationSettings = lazyRetry(() => import("./pages/LeadNotificationSettings"));
const LeadSettings = lazyRetry(() => import("./pages/LeadSettings"));
const ReportJobScam = lazyRetry(() => import("./pages/ReportJobScam"));
const Disclaimer = lazyRetry(() => import("./pages/Disclaimer"));
const CookiePolicy = lazyRetry(() => import("./pages/CookiePolicy"));
const DMCA = lazyRetry(() => import("./pages/DMCA"));
const JobPolicy = lazyRetry(() => import("./pages/JobPolicy"));
const FAQ = lazyRetry(() => import("./pages/FAQ"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

const TrustSafety = lazyRetry(() => import("./pages/TrustSafety"));
const EmployerGuidelines = lazyRetry(() => import("./pages/EmployerGuidelines"));
const JobSeekerGuidelines = lazyRetry(() => import("./pages/JobSeekerGuidelines"));
const CommunityGuidelines = lazyRetry(() => import("./pages/CommunityGuidelines"));
const AccessibilityStatement = lazyRetry(() => import("./pages/AccessibilityStatement"));
const PressKit = lazyRetry(() => import("./pages/PressKit"));
const Careers = lazyRetry(() => import("./pages/Careers"));
const FunctionLogs = lazyRetry(() => import("./pages/owner-portal/FunctionLogs"));
const PaymentEvents = lazyRetry(() => import("./pages/owner-portal/PaymentEvents"));
const PayPalPaymentEvents = lazyRetry(() => import("./pages/owner-portal/PayPalPaymentEvents"));
const APIDocumentation = lazyRetry(() => import("./pages/owner-portal/APIDocumentation"));
const DeveloperSubscription = lazyRetry(() => import("./pages/developers/DeveloperSubscription"));
const DeveloperApiLogs = lazyRetry(() => import("./pages/developers/DeveloperApiLogs"));
const DeveloperWorkbookLogs = lazyRetry(() => import("./pages/developers/DeveloperWorkbookLogs"));
const DeveloperSubAccounts = lazyRetry(() => import("./pages/developers/DeveloperSubAccounts"));
const DeveloperChatWidget = lazyRetry(() => import("./pages/developers/DeveloperChatWidget"));
const WidgetPinUnlock = lazyRetry(() => import("./pages/developers/WidgetPinUnlock"));
const WidgetDocs = lazyRetry(() => import("./pages/owner-portal/WidgetDocs"));
const DeveloperWhatsAppLimits = lazyRetry(() => import("./pages/developers/DeveloperWhatsAppLimits"));
const DeveloperWhatsAppLimitsGuide = lazyRetry(() => import("./pages/developers/DeveloperWhatsAppLimitsGuide"));
const ConnectWhatsAppSubAccount = lazyRetry(() => import("./pages/ConnectWhatsAppSubAccount"));
const ConnectChannelSubAccount = lazyRetry(() => import("./pages/ConnectChannelSubAccount"));
const WhatsAppDocs = lazyRetry(() => import("./pages/owner-portal/WhatsAppDocs"));
const EmailDocs = lazyRetry(() => import("./pages/owner-portal/EmailDocs"));
const JobsDocs = lazyRetry(() => import("./pages/owner-portal/JobsDocs"));
const SocialInboxDocs = lazyRetry(() => import("./pages/owner-portal/SocialInboxDocs"));
const OAuthDocs = lazyRetry(() => import("./pages/owner-portal/OAuthDocs"));
const PartnerSolutionsDocs = lazyRetry(() => import("./pages/owner-portal/PartnerSolutionsDocs"));
const DeveloperFAQ = lazyRetry(() => import("./pages/developers/DeveloperFAQ"));
const OAuthConsent = lazyRetry(() => import("./pages/OAuthConsent"));
const JavaScriptSDK = lazyRetry(() => import("./pages/api-docs/JavaScriptSDK"));
const PythonSDK = lazyRetry(() => import("./pages/api-docs/PythonSDK"));
const CurlDocs = lazyRetry(() => import("./pages/api-docs/CurlDocs"));
const PostmanDocs = lazyRetry(() => import("./pages/api-docs/PostmanDocs"));
const APIFAQ = lazyRetry(() => import("./pages/api-docs/FAQ"));
const APIQuickStart = lazyRetry(() => import("./pages/api-docs/QuickStart"));
const APITroubleshooting = lazyRetry(() => import("./pages/api-docs/Troubleshooting"));
const APIExamples = lazyRetry(() => import("./pages/api-docs/Examples"));
const APIProductionGuide = lazyRetry(() => import("./pages/api-docs/ProductionGuide"));
const APIHowItWorks = lazyRetry(() => import("./pages/api-docs/APIHowItWorks"));
const APIBenefits = lazyRetry(() => import("./pages/api-docs/Benefits"));
const AIPricingManager = lazyRetry(() => import("./pages/owner-portal/AIPricingManager"));
const PaymentRecoveryPage = lazyRetry(() => import("./pages/owner-portal/PaymentRecoveryPage"));
const BoostPackagesManagement = lazyRetry(() => import("./pages/owner-portal/BoostPackagesManagement"));
const VerificationPackagesManagement = lazyRetry(() => import("./pages/owner-portal/VerificationPackagesManagement"));
const DonationCampaignsManagement = lazyRetry(() => import("./pages/owner-portal/DonationCampaignsManagement"));
const DonationCampaignDonations = lazyRetry(() => import("./pages/owner-portal/DonationCampaignDonations"));
const ReferralSettings = lazyRetry(() => import("./pages/owner-portal/ReferralSettings"));
const ReferralWithdrawals = lazyRetry(() => import("./pages/owner-portal/ReferralWithdrawals"));
const UserPayments = lazyRetry(() => import("./pages/owner-portal/UserPayments"));
// const JobSeekerMembersManagement = lazyRetry(() => import("./pages/owner-portal/JobSeekerMembersManagement"));
const WebsiteUsersManagement = lazyRetry(() => import("./pages/owner-portal/WebsiteUsersManagement"));
const EmployerMembersManagement = lazyRetry(() => import("./pages/owner-portal/EmployerMembersManagement"));
// GmailManagement removed
const JobPostingSettings = lazyRetry(() => import("./pages/owner-portal/JobPostingSettings"));
const InterviewPricingSettings = lazyRetry(() => import("./pages/owner-portal/InterviewPricingSettings"));
const ApiSubscriptionSettings = lazyRetry(() => import("./pages/owner-portal/ApiSubscriptionSettings"));

const EmployerDisabled = lazyRetry(() => import("./pages/employer/EmployerDisabled"));
const ReferralPage = lazyRetry(() => import("./pages/employer/ReferralPage"));
const EmployerReferralActivity = lazyRetry(() => import("./pages/employer/ReferralActivity"));
const EmployerReferralCodePage = lazyRetry(() => import("./pages/employer/ReferralCodePage"));
const EmployerMonthlyCompetition = lazyRetry(() => import("./pages/employer/MonthlyCompetition"));
const ReferralEntry = lazyRetry(() => import("./pages/ReferralEntry"));
const ReferralProfile = lazyRetry(() => import("./pages/ReferralProfile"));
const ReferOnboarding = lazyRetry(() => import("./pages/ReferOnboarding"));
const ReferralCodePage = lazyRetry(() => import("./pages/ReferralCodePage"));
const ReferralActivity = lazyRetry(() => import("./pages/ReferralActivity"));
const MonthlyCompetition = lazyRetry(() => import("./pages/MonthlyCompetition"));
const ReferralPaymentSettings = lazyRetry(() => import("./pages/ReferralPaymentSettings"));
const CompetitionHistory = lazyRetry(() => import("./pages/CompetitionHistory"));
const RevenueTracking = lazyRetry(() => import("./pages/owner-portal/RevenueTracking"));
const OwnerAnalyticsDashboard = lazyRetry(() => import("./pages/owner-portal/OwnerAnalyticsDashboard"));
const CompetitionPrizesManagement = lazyRetry(() => import("./pages/owner-portal/CompetitionPrizesManagement"));
const ContactInfoManagement = lazyRetry(() => import("./pages/owner-portal/ContactInfoManagement"));
const BrandManagement = lazyRetry(() => import("./pages/owner-portal/BrandManagement"));
const HeroBannerManagement = lazyRetry(() => import("./pages/owner-portal/HeroBannerManagement"));
const AddEditHeroBanner = lazyRetry(() => import("./pages/owner-portal/AddEditHeroBanner"));
const HomeVideoManagement = lazyRetry(() => import("./pages/owner-portal/HomeVideoManagement"));
const HomeImageManagement = lazyRetry(() => import("./pages/owner-portal/HomeImageManagement"));
const TrustBadgesManagement = lazyRetry(() => import("./pages/owner-portal/TrustBadgesManagement"));
const PushTemplatesManagement = lazyRetry(() => import("./pages/owner-portal/PushTemplatesManagement"));
const TelegramTemplatesManagement = lazyRetry(() => import("./pages/owner-portal/TelegramTemplatesManagement"));
const TelegramBotSettings = lazyRetry(() => import("./pages/owner-portal/TelegramBotSettings"));
const EmailTemplatesManagement = lazyRetry(() => import("./pages/owner-portal/EmailTemplatesManagement"));
const SignupOtpSettings = lazyRetry(() => import("./pages/owner-portal/SignupOtpSettings"));


const InterviewAnalytics = lazyRetry(() => import("./pages/owner-portal/InterviewAnalytics"));
const SupabaseUsageMonitor = lazyRetry(() => import("./pages/owner-portal/SupabaseUsageMonitor"));
const StorageManager = lazyRetry(() => import("./pages/owner-portal/StorageManager"));
const SecretsManager = lazyRetry(() => import("./pages/owner-portal/SecretsManager"));

const GoogleIntegrations = lazyRetry(() => import("./pages/owner-portal/GoogleIntegrations"));
// RealtimeAnalytics removed
const QuickAccess = lazyRetry(() => import("./pages/QuickAccess"));
const AITricksManagement = lazyRetry(() => import("./pages/owner-portal/AITricksManagement"));
const AutonomousAgent = lazyRetry(() => import("./pages/owner-portal/AutonomousAgent"));
// TestGoogleSearch removed
const AIChatSettings = lazyRetry(() => import("./pages/owner-portal/AIChatSettings"));
const AIAccessMonitoringDashboard = lazyRetry(() => import("./pages/owner-portal/AIAccessMonitoringDashboard"));
const UserDataAccessLogs = lazyRetry(() => import("./pages/owner-portal/UserDataAccessLogs"));
// MSG91WhatsAppDashboard removed
const MSG91Templates = lazyRetry(() => import("./pages/owner-portal/whatsapp/Templates"));
const MSG91Settings = lazyRetry(() => import("./pages/owner-portal/whatsapp/Settings"));
const WhatsAppBusinessProfilePage = lazyRetry(() => import("./pages/owner-portal/whatsapp/BusinessProfile"));
const MSG91Chat = lazyRetry(() => import("./pages/owner-portal/whatsapp/Chat"));
const MSG91TemplatePickerPage = lazyRetry(() => import("./pages/owner-portal/whatsapp/TemplatePickerPage"));
const MSG91JobSharePage = lazyRetry(() => import("./pages/owner-portal/whatsapp/JobSharePage"));
const MSG91NewChat = lazyRetry(() => import("./pages/owner-portal/whatsapp/NewChat"));
const MSG91ContactInfo = lazyRetry(() => import("./pages/owner-portal/whatsapp/ContactInfo"));
const UniversalLookup = lazyRetry(() => import("./pages/owner-portal/UniversalLookup"));
const ChatTemplatesManagerPage = lazyRetry(() => import("./pages/owner-portal/whatsapp/ChatTemplatesManagerPage"));
const EmployerWhatsAppTemplatesPage = lazyRetry(() => import("./pages/employer/EmployerWhatsAppTemplatesPage"));
const SupportTemplatesPage = lazyRetry(() => import("./pages/owner-portal/whatsapp/SupportTemplatesPage"));

const EmailAutoTriggers = lazyRetry(() => import("./pages/owner-portal/email/AutoTriggers"));

const CareerTricks = lazyRetry(() => import("./pages/CareerTricks"));
const InstallApp = lazyRetry(() => import("./pages/InstallApp"));

const AppContent = () => {
  const navigate = useNavigate();
  const { loading: authLoading, profileLoading, user } = useAuth();
  const isAppReady = useAppReady(authLoading, profileLoading, user);
  useTrackWorklyChatReturn();
  
  // Initialize navigation middleware
  useEffect(() => {
    navigationMiddleware.setNavigate(navigate);
    navigationMiddleware.handlePageRefresh();
  }, [navigate]);
  
  // Hide the loading screen once ALL critical data is loaded for premium native feel
  // Keep splash visible for a minimum duration so it doesn't flash away too quickly
  useEffect(() => {
    if (isAppReady) {
      // Keep the premium splash visible for a minimum duration so users get
      // a proper VIP intro instead of a sub-second flash. Capped by the
      // 5s hard safety timeout in index.html.
      const MIN_SPLASH_MS = 4000;
      const shownAt = (window as any).__splashShownAt || 0;
      const elapsed = shownAt ? performance.now() - shownAt : MIN_SPLASH_MS;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      const timer = setTimeout(() => {
        if ((window as any).__hideLoadingScreen) {
          (window as any).__hideLoadingScreen();
        }
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [isAppReady]);
  
  // Initialize PWA install prompt listener
  useEffect(() => {
    initPwaInstallListener();
  }, []);

  // Clean up expired jobs cache entries (older than 24h) on app start so old
  // jobs don't linger in the browser after their TTL.
  useEffect(() => {
    import('@/lib/jobsPersistentCache').then(({ cleanupExpiredJobsCache }) => {
      try { cleanupExpiredJobsCache(); } catch { /* ignore */ }
    });
  }, []);

  // Inject dynamic PWA manifest + favicon for every visitor (not just owner-portal)
  // so brand uploads reflect in browser tab + install prompt without needing redeploy.
  useEffect(() => {
    (async () => {
      try {
        const [{ injectDynamicManifest, getSquareIconUrl }, { supabase }] = await Promise.all([
          import('@/utils/dynamicManifest'),
          import('@/integrations/supabase/client'),
        ]);
        await injectDynamicManifest();
        const { data } = await supabase.rpc('get_brand_assets');
        const assets = (data && typeof data === 'object') ? (data as any) : null;

        // Browser tab icon — only the real favicon links, never apple-touch-icon.
        const { resolveBrandLogo } = await import('@/lib/brandLogo');
        const faviconUrl = resolveBrandLogo(assets?.favicon_url, true);
        if (faviconUrl) {
          document
            .querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='shortcut icon']")
            .forEach((l) => { l.href = faviconUrl; });
        }

        // Home-screen / install icon — prefer the dedicated square app icon.
        const { data: pwaRows } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .eq('setting_key', 'pwa_app_icon');
        const appIcon = pwaRows?.[0]?.setting_value || '/icons/icon-512x512.png?v=20261022';
        if (appIcon) {
          document
            .querySelectorAll<HTMLLinkElement>("link[rel='apple-touch-icon']")
            .forEach((l) => {
              const size = Number(l.getAttribute('sizes')?.split('x')[0]) || 192;
              l.href = getSquareIconUrl(appIcon, size);
            });
        }
      } catch (e) {
        console.warn('[brand] dynamic manifest/favicon injection failed', e);
      }
    })();
  }, []);

  // Initialize cache manager to clear stale caches and ensure fresh code
  useEffect(() => {
    import('@/lib/cacheManager').then(({ initCacheManager }) => {
      initCacheManager();
    });
  }, []);
  
  // Push notifications are disabled in bandwidth saver mode to protect free-plan egress.
  usePushInit(false, !isBandwidthSaverMode);
  
  // Realtime notification listeners are guarded by egress protection.
  useComprehensiveNotifications();
  useJobRecommendationNotifications();
  
  // DISABLED: Live session tracking removed to reduce Supabase egress
  // useLiveSessionTracking();
  
  // Initialize all native app features (splash, status bar, keyboard, back button, network)
  useNativeApp();
  

  useEffect(() => {
    const handleAppInit = async () => {
      if (Capacitor.isNativePlatform()) {
        console.log('Workly India App initialized on native platform');
        
        try {
          const { App: CapacitorApp } = await import('@capacitor/app');
          
          CapacitorApp.addListener('appUrlOpen', (event) => {
            console.log('App opened via URL:', event.url);
            const url = new URL(event.url);
            const path = url.pathname;
            
            if (path && path !== '/') {
              // Use React Router navigate instead of window.location.href
              navigate(path);
            }
          });
          
          CapacitorApp.addListener('appStateChange', (state) => {
            console.log('App state changed:', state);
          });
          
        } catch (error) {
          console.log('App plugin not available:', error);
        }
      }
    };
    
    handleAppInit();
  }, [navigate]);

  return (
    <JobStatusNotificationWrapper>
      <BrandMetaTags />
      {!isBandwidthSaverMode && <JobRecommendationNotifier />}
      {!isBandwidthSaverMode && <InstallPromptBanner />}
      
      <RoutePreserver />
      <PendingReferralApplier />
      <Suspense fallback={null}>
        <AIOnlyModeGuard>
        <OnboardingGuard>
        <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/ai-assistant" element={<AICareerAssistant />} />
        <Route path="/ai-assistant/pricing" element={<AIPublicPricing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/oauth/gmail/return" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/oauth/GmailReturn')))}
          </Suspense>
        } />
        <Route path="/oauth/outlook/return" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/oauth/OutlookReturn')))}
          </Suspense>
        } />
        <Route path="/oauth/vercel/return" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/oauth/VercelReturn')))}
          </Suspense>
        } />
        <Route path="/oauth/supabase/return" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/oauth/SupabaseReturn')))}
          </Suspense>
        } />
        <Route path="/oauth/meta/return" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/oauth/MetaReturn')))}
          </Suspense>
        } />
        <Route path="/oauth/google/return" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/oauth/GoogleReturn')))}
          </Suspense>
        } />

        <Route path="/ai-assistant/connect" element={
          <ProtectedRoute>
            <Suspense fallback={<HomePageSkeleton />}>
              {React.createElement(lazyRetry(() => import('./pages/AIConnect')))}
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/ai-assistant/subscription" element={
          <ProtectedRoute>
            <Suspense fallback={<HomePageSkeleton />}>
              {React.createElement(lazyRetry(() => import('./pages/AIChatSubscription')))}
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/ai-assistant/connect/:platform/settings" element={
          <ProtectedRoute>
            <Suspense fallback={<HomePageSkeleton />}>
              {React.createElement(lazyRetry(() => import('./pages/AIConnectSettings')))}
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/ai-assistant/search" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/chat/SearchMessagesPage')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/media" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/chat/MediaGalleryPage')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/starred" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/chat/StarredMessagesPage')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/wallpaper" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/chat/WallpaperPage')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/profile" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/AIProfile')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/info" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/chat/ChatInfoPage')))}
          </Suspense>
        } />

        <Route path="/ai-assistant/youtube/settings" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/YouTubeChannelSettings')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/youtube/replies" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/YouTubeAutoReplyToday')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/connect/:platform/replies" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/AIConnectRepliesToday')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/youtube/seo" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/YouTubeSeoAudit')))}
          </Suspense>
        } />



        <Route path="/ai-assistant/youtube/video/:videoId" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/YouTubeVideoAnalytics')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/youtube/video/:videoId/edit" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/YouTubeVideoEdit')))}
          </Suspense>
        } />
        <Route path="/ai-assistant/youtube/upload" element={
          <Suspense fallback={<HomePageSkeleton />}>
            {React.createElement(lazyRetry(() => import('./pages/YouTubeUpload')))}
          </Suspense>
        } />


        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/home" element={<Index />} />
        <Route path="/festivals" element={<Festivals />} />
        <Route path="/search" element={<QuickAccess />} />
        <Route path="/quick-access" element={<QuickAccess />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/forgot-password" element={<Auth forgotPasswordPage />} />
        <Route path="/.lovable/oauth/consent" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/OAuthConsent')))}
          </Suspense>
        } />
        <Route path="/oauth/consent" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/OAuthConsent')))}
          </Suspense>
        } />
        <Route path="/social-callback" element={
          <Suspense fallback={null}>
            {React.createElement(lazyRetry(() => import('./pages/SocialCallback')))}
          </Suspense>
        } />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/signup" element={<Auth signupPage />} />
        <Route path="/register" element={<Navigate to="/signup" replace />} />
        <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
        <Route path="/payment-history" element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />
        <Route path="/payment-profile" element={<ProtectedRoute><PaymentProfile /></ProtectedRoute>} />
        <Route path="/payment-profile/shipping-address" element={<ProtectedRoute><ShippingAddressPage /></ProtectedRoute>} />
        <Route path="/reset-password" element={<PasswordResetForm isEmployer={false} />} />
        <Route path="/verify-email-change" element={<VerifyEmailChange />} />
        <Route path="/employer-auth" element={<EmployerAuth />} />
        <Route path="/employer-signup" element={<EmployerAuth signupPage />} />
        <Route path="/employer-forgot-password" element={<EmployerAuth forgotPasswordPage />} />
        <Route path="/employer-disabled" element={<EmployerDisabled />} />
        <Route path="/banned" element={<BannedUser />} />
        
        {/* SEO Redirect Routes - Fix for Google Search Console issues */}
        <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
        <Route path="/contact" element={<Navigate to="/contact-us" replace />} />
        
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/mission-vision" element={<MissionVision />} />
        <Route path="/mission" element={<Mission />} />
        <Route path="/vision" element={<Vision />} />
        <Route path="/why-choose-us" element={<WhyChooseUs />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/admin-settings" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit">
            <AdminSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/terms-conditions" element={<TermsAndConditions />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/cookies" element={<Navigate to="/cookie-policy" replace />} />
        <Route path="/dmca" element={<DMCA />} />
        <Route path="/copyright" element={<Navigate to="/dmca" replace />} />
        <Route path="/copyright-policy" element={<Navigate to="/dmca" replace />} />
        <Route path="/job-policy" element={<JobPolicy />} />
        <Route path="/trust-safety" element={<TrustSafety />} />
        <Route path="/employer-guidelines" element={<EmployerGuidelines />} />
        <Route path="/job-seeker-guidelines" element={<JobSeekerGuidelines />} />
        <Route path="/community-guidelines" element={<CommunityGuidelines />} />
        <Route path="/accessibility" element={<AccessibilityStatement />} />
        <Route path="/email-management" element={<EmailManagement />} />
        
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/domains" element={
          <Suspense fallback={<HomePageSkeleton />}>
            <DomainsEntry />
          </Suspense>
        } />
        <Route path="/install" element={<InstallApp />} />
        <Route path="/press-kit" element={<PressKit />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/hiring-companies" element={<CompanyDirectory />} />
        <Route path="/company-directory" element={<CompanyDirectory />} />
        {/* SEO-friendly company routes */}
        <Route path="/company/:id" element={<CompanyProfile />} />
        <Route path="/company-profile/:id" element={<Navigate to={`/company/${window.location.pathname.split('/').pop()}`} replace />} />
        {/* Short URL redirects */}
        <Route path="/c/:shortId" element={<CompanyShortUrlRedirect />} />
        <Route path="/u/:shortId" element={<ProfileShortUrlRedirect />} />
        <Route path="/call" element={<CallRedirect />} />
        
        <Route path="/recruitment-solutions" element={<RecruitmentSolutions />} />
        <Route path="/case-studies" element={<CaseStudies />} />
        <Route path="/hire-interns" element={<HireInterns />} />
        <Route path="/college-tpo" element={<CollegeTPO />} />
        <Route path="/jobs-for-women" element={<JobsForWomen />} />
        <Route path="/our-services" element={<OurServices />} />
        <Route path="/career-guidance" element={<CareerGuidance />} />
        <Route path="/interview-tips" element={<InterviewTips />} />
        <Route path="/free-job-alerts" element={<FreeJobAlerts />} />
        <Route path="/were-hiring" element={<WereHiring />} />
        <Route path="/team-diary" element={<TeamDiary />} />
        <Route path="/rate-app" element={<RateApp />} />
        <Route path="/reviews" element={<AllReviews />} />

        <Route path="/profile-setup" element={<Navigate to="/JobSeeker/Setup" replace />} />
        <Route path="/JobSeeker/Setup" element={
          <ProtectedRoute>
            <JobSeekerOnboarding />
          </ProtectedRoute>
        } />
        <Route path="/JobSeeker/Profile/Edit/:step" element={
          <ProtectedRoute>
            <ProfileSetup />
          </ProtectedRoute>
        } />
        
        <Route path="/jobs" element={<Jobs />} />
        {/* SEO-friendly category and location routes for Google Search Console */}
        <Route path="/jobs/category/:category" element={<Jobs />} />
        <Route path="/jobs/location/:location" element={<Jobs />} />
        <Route path="/jobs/category/:category/location/:location" element={<Jobs />} />
        {/* SEO-friendly tab routes - fixes Google Search Console 404 for ?tab=trending etc */}
        <Route path="/jobs/trending" element={<Jobs />} />
        <Route path="/jobs/latest" element={<Jobs />} />
        <Route path="/jobs/featured" element={<Jobs />} />
        <Route path="/job/:id" element={<JobDetail />} />
        <Route path="/external-job/:id" element={<ExternalJobDetail />} />
        {/* Shareable external-job link. Payload rides in `?d=` so recipients
            without sessionStorage can still render the full job details. */}
        <Route path="/ej/s/:shortId" element={<ExternalJobDetail />} />
        <Route path="/ej/:source/:extId" element={<ExternalJobDetail />} />
        
        <Route path="/j/:shortId" element={<ShortUrlRedirect />} />

        <Route path="/activity" element={<Activity />} />
        <Route path="/profile" element={
          <ProtectedRoute requireCompleteProfile>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/rewards" element={
          <ProtectedRoute requireCompleteProfile>
            <Rewards />
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute requireCompleteProfile>
            <Notifications />
          </ProtectedRoute>
        } />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/referral" element={
          <ReferralEntry />
        } />
        <Route path="/referral-profile" element={
          <ProtectedRoute>
            <ReferralOnboardingGuard><ReferralProfile /></ReferralOnboardingGuard>
          </ProtectedRoute>
        } />
        <Route path="/referral-onboarding" element={
          <ProtectedRoute>
            <ReferOnboarding />
          </ProtectedRoute>
        } />
        <Route path="/referral-code" element={
          <ProtectedRoute>
            <ReferralOnboardingGuard><ReferralCodePage /></ReferralOnboardingGuard>
          </ProtectedRoute>
        } />
        <Route path="/referral-activity" element={
          <ProtectedRoute>
            <ReferralOnboardingGuard><ReferralActivity /></ReferralOnboardingGuard>
          </ProtectedRoute>
        } />
        <Route path="/monthly-competition" element={
          <ProtectedRoute>
            <MonthlyCompetition />
          </ProtectedRoute>
        } />
        <Route path="/referral/payment-settings" element={
          <ProtectedRoute>
            <ReferralOnboardingGuard><ReferralPaymentSettings /></ReferralOnboardingGuard>
          </ProtectedRoute>
        } />
        <Route path="/monthly-competition/history" element={
          <ProtectedRoute>
            <ReferralOnboardingGuard><CompetitionHistory /></ReferralOnboardingGuard>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute requireCompleteProfile>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/settings/two-factor-auth" element={
          <ProtectedRoute requireCompleteProfile>
            <Suspense fallback={<AppLoadingSpinner />}>
              {React.createElement(lazyRetry(() => import('./pages/TwoFactorAuthSettings')))}
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/settings/account/:field" element={<ProtectedRoute requireCompleteProfile><AccountChangePage /></ProtectedRoute>} />
        <Route path="/more" element={<More />} />
        <Route path="/ai-voice-call" element={
          <Suspense fallback={<AppLoadingSpinner />}>
            <AIVoiceCall />
          </Suspense>
        } />
        <Route path="/career-tricks" element={<CareerTricks />} />
        
        {/* Add guest payment demo to main navigation */}
        
        <Route path="/company-dashboard" element={
          <ProtectedRoute requireCompleteProfile>
            <CompanyDashboard />
          </ProtectedRoute>
        } />
        <Route path="/employer-portal" element={
          <EmployeeEntry />
        } />
        <Route path="/post-job" element={
          <PostJobEntry />
        } />
        <Route path="/employer/email" element={<Navigate to="/employer/workly-email" replace />} />
        <Route path="/employer/email-chat" element={<KeepQueryRedirect to="/employer/workly-email" />} />
        <Route path="/owner-portal/email-chat" element={<KeepQueryRedirect to="/owner-portal/workly-email" />} />
        <Route path="/employer/whatsapp/*" element={<Navigate to="/employer/workly-chat" replace />} />
        <Route path="/employer/workly-email" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <Suspense fallback={<HomePageSkeleton />}>
              {React.createElement(lazyRetry(() => import('./pages/employer/EmployerEmailChat')))}
            </Suspense>
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/workly-chat" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerWhatsAppPage />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/workly-chat/templates" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerWhatsAppTemplatesPage />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/instagram/profile" element={<ProtectedEmployerRoute requireCompleteProfile><EmployerMetaProfile platform="instagram" /></ProtectedEmployerRoute>} />
        <Route path="/employer/facebook/profile" element={<ProtectedEmployerRoute requireCompleteProfile><EmployerMetaProfile platform="facebook" /></ProtectedEmployerRoute>} />
        <Route path="/employer/workly-chat/business-profile/:section" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerWhatsAppBusinessProfilePage />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/workly-chat/business-profile" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerWhatsAppBusinessProfilePage />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/workly-chat/chat/:phoneNumber/templates" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerTemplatePickerPage />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/workly-chat/chat/:phoneNumber" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerWhatsAppPage />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer-profile" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerProfile />
          </ProtectedEmployerRoute>
        } />
        <Route path="/company-profile-setup" element={<Navigate to="/Employer/Setup" replace />} />
        <Route path="/Employer/Setup" element={
          <ProtectedEmployerRoute>
            <CompanyOnboarding />
          </ProtectedEmployerRoute>
        } />
        <Route path="/Employer/Profile/Edit/:step" element={
          <ProtectedEmployerRoute>
            <CompanyProfileSetup />
          </ProtectedEmployerRoute>
        } />
        
        <Route path="/job/:jobId/applicants" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <ViewApplicants />
          </ProtectedEmployerRoute>
        } />
        <Route path="/all-applicants" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <AllApplicants />
          </ProtectedEmployerRoute>
        } />
        <Route path="/job/:jobId/edit" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EditJob />
          </ProtectedEmployerRoute>
        } />
        <Route path="/job/:jobId/analytics" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <JobAnalytics />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/analytics" element={
          <ProtectedEmployerRoute>
            <EmployerAnalytics />
          </ProtectedEmployerRoute>
        } />
        <Route path="/interview-details/:interviewId" element={
          <ProtectedRoute requireCompleteProfile>
            <InterviewDetails />
          </ProtectedRoute>
        } />
        <Route path="/employer/interviews" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <Interviews />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/schedule-interview" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <ScheduleInterview />
          </ProtectedEmployerRoute>
        } />
        <Route path="/interview/:interviewId" element={
          <ProtectedRoute>
            <InterviewRoom />
          </ProtectedRoute>
        } />
        <Route path="/employer-settings" element={
          <ProtectedEmployerRoute>
            <EmployerSettings />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer-settings/two-factor-auth" element={
          <ProtectedEmployerRoute>
            <Suspense fallback={<AppLoadingSpinner />}>
              {React.createElement(lazyRetry(() => import('./pages/TwoFactorAuthSettings')))}
            </Suspense>
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer-settings/account/:field" element={<ProtectedEmployerRoute><AccountChangePage /></ProtectedEmployerRoute>} />
        <Route path="/employer/referral" element={
          <ProtectedEmployerRoute>
            <ReferralOnboardingGuard><ReferralPage /></ReferralOnboardingGuard>
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/referral-activity" element={
          <ProtectedEmployerRoute>
            <ReferralOnboardingGuard><EmployerReferralActivity /></ReferralOnboardingGuard>
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/referral-code" element={
          <ProtectedEmployerRoute>
            <ReferralOnboardingGuard><EmployerReferralCodePage /></ReferralOnboardingGuard>
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/monthly-competition" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <EmployerMonthlyCompetition />
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/referral/payment-settings" element={
          <ProtectedEmployerRoute>
            <ReferralOnboardingGuard><ReferralPaymentSettings /></ReferralOnboardingGuard>
          </ProtectedEmployerRoute>
        } />
        <Route path="/employer/monthly-competition/history" element={
          <ProtectedEmployerRoute requireCompleteProfile>
            <CompetitionHistory />
          </ProtectedEmployerRoute>
        } />
        
        <Route path="/owner-portal" element={
          <ProtectedPermissionRoute requiredPermission="analytics.view">
            <OwnerPortal />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/domain-settings" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit">
            <DomainSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/domain-pricing" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit">
            <DomainPricingSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/domain-sales" element={
          <ProtectedPermissionRoute requiredPermission="financial.view">
            <DomainSalesDashboard />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/team-management" element={
          <ProtectedPermissionRoute requiredPermission="team_management.view" ownerOnly>
            <TeamManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/invite-member" element={
          <ProtectedPermissionRoute requiredPermission="team_management.invite" ownerOnly>
            <InviteMember />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/create-role" element={
          <ProtectedPermissionRoute requiredPermission="team_management.edit_roles" ownerOnly>
            <CreateRole />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/auth-users" element={
          <ProtectedPermissionRoute requiredPermission="manage_users" ownerOnly>
            <AuthUsersManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/analytics-dashboard" element={
          <ProtectedPermissionRoute requiredPermission="analytics.view">
            <OwnerAnalyticsDashboard />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/supabase-usage" element={
          <ProtectedPermissionRoute requiredPermission="analytics.view">
            <SupabaseUsageMonitor />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/storage" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit" ownerOnly>
            <StorageManager />
          </ProtectedPermissionRoute>
        } />

        <Route path="/owner-portal/cloudflare-storage" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit" ownerOnly>
            <StorageManager provider="r2" />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/secrets" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit" ownerOnly>
            <SecretsManager />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/google-integrations" element={
          <ProtectedPermissionRoute requiredPermission="analytics.view">
            <GoogleIntegrations />
          </ProtectedPermissionRoute>
        } />
        {/* RealtimeAnalytics route removed */}
        <Route path="/owner-portal/contact-info" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <ContactInfoManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/brand-management" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <BrandManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/push-templates" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <PushTemplatesManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/telegram-templates" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <TelegramTemplatesManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/telegram-bot-settings" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <TelegramBotSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/verify-otp" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <SignupOtpSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/email-templates" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <EmailTemplatesManagement />
          </ProtectedPermissionRoute>
        } />

        <Route path="/owner-portal/hero-banners" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <HeroBannerManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/hero-banners/add" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <AddEditHeroBanner />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/hero-banners/edit/:id" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <AddEditHeroBanner />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/home-video" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <HomeVideoManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/home-image" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <HomeImageManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/home-seekers-image" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <HomeImageManagement settingKey="home_seekers_image" />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/trust-badges" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <TrustBadgesManagement />
          </ProtectedPermissionRoute>
        } />

        <Route path="/owner-portal/ai-tricks" element={
          <ProtectedPermissionRoute requiredPermission="content.edit">
            <AITricksManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/autonomous-agent" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <AutonomousAgent />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/support-tickets" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <SupportTicketsManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/customer-service" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <CustomerService />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/workly-email" element={
          <ProtectedPermissionRoute requiredPermission="support.view">
            <EmailChat />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/function-logs" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <FunctionLogs />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/payment-events" element={
          <ProtectedPermissionRoute requiredPermission="settings.view" ownerOnly>
            <PaymentEvents />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/paypal-payment-events" element={
          <ProtectedPermissionRoute requiredPermission="settings.view" ownerOnly>
            <PayPalPaymentEvents />
          </ProtectedPermissionRoute>
        } />
        <Route path="/developers/setup" element={
          <ProtectedEmployerRoute>
            <DeveloperOnboarding mode="setup" />
          </ProtectedEmployerRoute>
        } />
        <Route path="/developers/profile" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperProfile /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/developers" element={<DevelopersEntry />} />
        <Route path="/developers/subscription" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperSubscription /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/developers/logs" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperApiLogs /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/developers/workbook-logs" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperWorkbookLogs /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/developers/sub-accounts" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperSubAccounts /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/developers/whatsapp-limits" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperWhatsAppLimits /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/developers/whatsapp-limits/guide" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperWhatsAppLimitsGuide /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/connect/whatsapp" element={<ConnectWhatsAppSubAccount />} />
        <Route path="/connect/:channel" element={<ConnectChannelSubAccount />} />
        {/* Public developer docs (readable by anyone, incl. AI assistants) */}
        <Route path="/developers/oauth" element={<OAuthDocs />} />
        <Route path="/developers/partner-solutions" element={<PartnerSolutionsDocs />} />
        <Route path="/developers/faq" element={<DeveloperFAQ />} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />
        {/* Public developer docs (readable by anyone, incl. AI assistants) */}
        <Route path="/developers/email-docs" element={<EmailDocs />} />
        {/* Public developer docs (readable by anyone, incl. AI assistants) */}
        <Route path="/developers/job-docs" element={<JobsDocs />} />
        {/* Public developer docs (readable by anyone, incl. AI assistants) */}
        <Route path="/developers/instagram-docs" element={<SocialInboxDocs platform="instagram" />} />
        {/* Public developer docs (readable by anyone, incl. AI assistants) */}
        <Route path="/developers/facebook-docs" element={<SocialInboxDocs platform="facebook" />} />
        {/* Public developer docs (readable by anyone, incl. AI assistants) */}
        <Route path="/developers/whatsapp-docs" element={<WhatsAppDocs />} />
        <Route path="/developers/widget-docs" element={<WidgetDocs />} />
        <Route path="/widget-chat/:widgetId" element={<WidgetPinUnlock />} />
        <Route path="/developers/chat-widget" element={
          <ProtectedEmployerRoute>
            <DeveloperProfileGate><DeveloperChatWidget /></DeveloperProfileGate>
          </ProtectedEmployerRoute>
        } />
        <Route path="/owner-portal/api-docs" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <APIDocumentation />
          </ProtectedPermissionRoute>
        } />
        <Route path="/api-docs/javascript-sdk" element={<JavaScriptSDK />} />
        <Route path="/api-docs/python-sdk" element={<PythonSDK />} />
        <Route path="/api-docs/curl-docs" element={<CurlDocs />} />
        <Route path="/api-docs/postman-docs" element={<PostmanDocs />} />
        <Route path="/api-docs/how-it-works" element={<APIHowItWorks />} />
        <Route path="/api-docs/benefits" element={<APIBenefits />} />
        <Route path="/api-docs/faq" element={<APIFAQ />} />
        <Route path="/api-docs/quick-start" element={<APIQuickStart />} />
        <Route path="/api-docs/troubleshooting" element={<APITroubleshooting />} />
        <Route path="/api-docs/examples" element={<APIExamples />} />
        <Route path="/api-docs/production-guide" element={<APIProductionGuide />} />
        <Route path="/owner-portal/referral-settings" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit">
            <ReferralSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/ai-pricing" element={
          <ProtectedPermissionRoute requiredPermission="settings.edit" ownerOnly>
            <AIPricingManager />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/donation-campaigns" element={
          <ProtectedPermissionRoute requiredPermission="packages.view">
            <DonationCampaignsManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/donation-campaigns/:id/donations" element={
          <ProtectedPermissionRoute requiredPermission="packages.view">
            <DonationCampaignDonations />
          </ProtectedPermissionRoute>
        } />

        <Route path="/owner-portal/payment-recovery" element={
          <ProtectedPermissionRoute requiredPermission="packages.view">
            <PaymentRecoveryPage />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/boost-packages" element={
          <ProtectedPermissionRoute requiredPermission="packages.view">
            <BoostPackagesManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/verification-packages" element={
          <ProtectedPermissionRoute requiredPermission="packages.view">
            <VerificationPackagesManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/website-users" element={
          <ProtectedPermissionRoute requiredPermission="users_management.view">
            <WebsiteUsersManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/employer-members" element={
          <ProtectedPermissionRoute requiredPermission="employers_management.view">
            <EmployerMembersManagement />
          </ProtectedPermissionRoute>
        } />
        {/* GmailManagement route removed */}
        <Route path="/owner-portal/job-posting-settings" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <JobPostingSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/interview-pricing" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <InterviewPricingSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/api-pricing" element={
          <ProtectedPermissionRoute requiredPermission="settings.view">
            <ApiSubscriptionSettings />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/competition-prizes" element={
          <ProtectedPermissionRoute requiredPermission="financial.edit">
            <CompetitionPrizesManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/revenue-tracking" element={
          <ProtectedPermissionRoute requiredPermission="financial.view">
            <RevenueTracking />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/referral-withdrawals" element={
          <ProtectedPermissionRoute requiredPermission="financial.approve_withdrawals">
            <ReferralWithdrawals />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/user-payments" element={
          <ProtectedPermissionRoute requiredPermission="financial.view">
            <UserPayments />
          </ProtectedPermissionRoute>
        } />
        
        <Route path="/lead-management" element={
          <ProtectedRoute requireCompleteProfile>
            <AllLeads />
          </ProtectedRoute>
        } />
        <Route path="/all-leads" element={
          <ProtectedRoute requireCompleteProfile>
            <AllLeads />
          </ProtectedRoute>
        } />
        <Route path="/purchased-leads" element={
          <ProtectedRoute requireCompleteProfile>
            <PurchasedLeads />
          </ProtectedRoute>
        } />
        <Route path="/lead-notification-settings" element={
          <ProtectedRoute requireCompleteProfile>
            <LeadNotificationSettings />
          </ProtectedRoute>
        } />
        <Route path="/lead-settings" element={
          <ProtectedRoute requireCompleteProfile>
            <LeadSettings />
          </ProtectedRoute>
        } />
        
        <Route path="/resume-builder" element={
          <Suspense fallback={<HomePageSkeleton />}>
            <ResumeBuilderEntry />
          </Suspense>
        } />
        <Route path="/resume-builder/create" element={
          <ProtectedRoute>
            <Navigate to="/resume-builder/create/1" replace />
          </ProtectedRoute>
        } />
        <Route path="/resume-builder/create/:step" element={
          <ProtectedRoute>
            <ResumeCreate />
          </ProtectedRoute>
        } />
        <Route path="/cover-letter-builder/create" element={
          <ProtectedRoute>
            <Navigate to="/cover-letter-builder/create/1" replace />
          </ProtectedRoute>
        } />
        <Route path="/cover-letter-builder/create/:step" element={
          <ProtectedRoute>
            <CoverLetterCreate />
          </ProtectedRoute>
        } />
        <Route path="/resume-editor" element={
          <ProtectedRoute>
            <ResumeEditor />
          </ProtectedRoute>
        } />
        <Route path="/skill-assessment" element={
          <ProtectedRoute>
            <SkillAssessment />
          </ProtectedRoute>
        } />
        <Route path="/take-assessment/:assessmentId" element={
          <ProtectedRoute requireCompleteProfile>
            <TakeAssessment />
          </ProtectedRoute>
        } />
        <Route path="/practice-mode/:assessmentId" element={
          <ProtectedRoute>
            <PracticeMode />
          </ProtectedRoute>
        } />
        <Route path="/assessment-results/:attemptId" element={
          <ProtectedRoute requireCompleteProfile>
            <AssessmentResults />
          </ProtectedRoute>
        } />
        <Route path="/verify-certificate/:certificateNumber" element={<VerifyCertificate />} />
        <Route path="/owner-portal/ai-chat-settings" element={
          <ProtectedAdminRoute>
            <AIChatSettings />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/ai-chat-plans" element={
          <ProtectedPermissionRoute requiredPermission="packages.view">
            <AIChatPlansManagement />
          </ProtectedPermissionRoute>
        } />
        <Route path="/owner-portal/ai-access-monitoring" element={
          <ProtectedAdminRoute>
            <AIAccessMonitoringDashboard />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/user-data-access-logs" element={
          <ProtectedAdminRoute>
            <UserDataAccessLogs />
          </ProtectedAdminRoute>
        } />
        {/* MSG91WhatsAppDashboard route removed */}
        <Route path="/owner-portal/whatsapp/templates" element={
          <ProtectedAdminRoute>
            <MSG91Templates />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/settings" element={
          <ProtectedAdminRoute>
            <MSG91Settings />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/business-profile/:section" element={
          <ProtectedAdminRoute>
            <WhatsAppBusinessProfilePage />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/business-profile" element={
          <ProtectedAdminRoute>
            <WhatsAppBusinessProfilePage />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/instagram/profile" element={<ProtectedAdminRoute><EmployerMetaProfile platform="instagram" audience="support" /></ProtectedAdminRoute>} />
        <Route path="/owner-portal/facebook/profile" element={<ProtectedAdminRoute><EmployerMetaProfile platform="facebook" audience="support" /></ProtectedAdminRoute>} />
        <Route path="/owner-portal/whatsapp/chat" element={
          <ProtectedAdminRoute>
            <MSG91Chat />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/chat/:phoneNumber" element={
          <ProtectedAdminRoute>
            <MSG91Chat />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/chat/:phoneNumber/templates" element={
          <ProtectedAdminRoute>
            <MSG91TemplatePickerPage />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/chat/:phoneNumber/jobs" element={
          <ProtectedAdminRoute>
            <MSG91JobSharePage />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/chat-templates" element={
          <ProtectedAdminRoute>
            <ChatTemplatesManagerPage />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/support-templates" element={
          <ProtectedAdminRoute>
            <SupportTemplatesPage />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/whatsapp/contact-info/:phoneNumber" element={
          <ProtectedAdminRoute>
            <MSG91ContactInfo />
          </ProtectedAdminRoute>
        } />
        <Route path="/owner-portal/universal-lookup" element={
          <ProtectedAdminRoute>
            <UniversalLookup />
          </ProtectedAdminRoute>
        } />
        <Route path="/report-job-scam" element={
          <ProtectedRoute>
            <ReportJobScam />
          </ProtectedRoute>
        } />
        
        <Route path="/owner-portal/email/auto-triggers" element={
          <ProtectedAdminRoute>
            <EmailAutoTriggers />
          </ProtectedAdminRoute>
        } />
        
        {/* Internal editor tool check screen */}


        
        {/* Guest Payment Routes - No authentication required */}
        
        <Route path="*" element={<NotFound />} />
        </Routes>
        <RouteSEO />
        </OnboardingGuard>
        </AIOnlyModeGuard>
      </Suspense>
    </JobStatusNotificationWrapper>
  );
};

const App = () => {
  return (
    <HelmetProvider>
      <TooltipProvider delayDuration={300}>
        <ErrorBoundary context="Application Root">
          <SafeErrorBoundary context="Authentication System">
            <AuthProvider>
              <EmployerAuthProvider>
                <SocialTokenCapture />
                <UserLocationProvider>
                    <VPNGuard>
                      <SafeErrorBoundary context="Main Application Content">
                        <AppContent />
                      </SafeErrorBoundary>
                    </VPNGuard>
                </UserLocationProvider>
              </EmployerAuthProvider>
            </AuthProvider>
          </SafeErrorBoundary>
          {/* <CookieConsent /> */}
          <SafeErrorBoundary context="Toast Notifications">
            <Toaster />
            <ConfirmDialogHost />
          </SafeErrorBoundary>
          <SpeedInsights />
          <Analytics />
          <CursorFollower />
        </ErrorBoundary>
      </TooltipProvider>
    </HelmetProvider>
  );
};

export default App;
