import LottieLocationIcon from "@/components/LottieLocationIcon";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useNavigate, useParams, useLocation } from "react-router-dom";
import { Search, Filter, TrendingUp, Clock, X, Sparkles, User, MapPin, Globe, RotateCcw, ChevronDown, Mic, Flame, Zap, Home as HomeIcon, Building2, Users2, GraduationCap } from "lucide-react";
import { AnimatedMicButton } from "@/components/AnimatedMicButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FilterBar from "@/components/FilterBar";
import JobCard from "@/components/JobCard";
import ExternalJobCard from "@/components/ExternalJobCard";
import JobCardSkeleton from "@/components/JobCardSkeleton";
import BottomNavigation from "@/components/BottomNavigation";
import SEO from "@/components/SEO";
import { JobSearchSchema } from "@/components/seo";
import LocationChip from "@/components/LocationChip";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import { useJobSearch, SearchFilters } from "@/hooks/useJobSearch";
import { useDebounce } from "@/hooks/useDebounce";
import { filterJobsBySearch, mergeSearchSuggestions } from '@/lib/jobSearchMatching';
import { usePlatformSuggestions } from "@/hooks/usePlatformSuggestions";
import { formatDateWithTime } from "@/utils/dateFormatUtils";
import { sanitizeSearchQuery, containsDevanagari } from "@/utils/transliterate";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/contexts/UserLocationContext";
import { useLocationJobCounts } from "@/hooks/useLocationJobCounts";
import { usePersonalizedJobs } from "@/hooks/usePersonalizedJobs";
import { useLatestJobs } from "@/hooks/useLatestJobs";
import { useJoobleJobs } from "@/hooks/useJoobleJobs";
import { useTrendingJobs } from "@/hooks/useTrendingJobs";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import SafeErrorBoundary from "@/components/SafeErrorBoundary";
import { useAnimatedPlaceholder, searchPlaceholders } from "@/hooks/useAnimatedPlaceholder";
import { UserLocationDialog } from "@/components/UserLocationDialog";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import LocationFilterDialog from "@/components/LocationFilterDialog";
import FloatingActionButton from "@/components/FloatingActionButton";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { VoiceSearchOverlay } from "@/components/VoiceSearchOverlay";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { CANONICAL_URL } from "@/services/DomainService";
import { ROUTE_SEO } from '@/lib/routeSeo';

const Jobs = () => {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { category: urlCategory, location: urlLocation } = useParams<{ category?: string; location?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const networkStatus = useNetworkStatus();
  const { scrollDirection, scrollY } = useScrollDirection();
  const isMobile = useIsMobile();
  
  // Determine initial tab from URL path, search params, or sessionStorage
  const getInitialTab = () => {
    // Check clean URL routes first: /jobs/trending, /jobs/latest, /jobs/featured
    const pathname = routeLocation.pathname;
    if (pathname === '/jobs/trending') return 'trending';
    if (pathname === '/jobs/latest') return 'latest';
    if (pathname === '/jobs/featured') return 'featured';
    
    // Then check query param: ?tab=trending
    const tabParam = searchParams.get('tab');
    if (tabParam) return tabParam;
    
    // Then check sessionStorage
    const savedTab = sessionStorage.getItem('jobs_active_tab');
    if (savedTab) return savedTab;
    
    // Default to "for-you"
    return "for-you";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [forYouMatchLevel, setForYouMatchLevel] = useState<'city' | 'state' | 'country'>(() => {
    // Initialize match level from sessionStorage or default to 'city'
    const savedMatchLevel = sessionStorage.getItem('jobs_match_level');
    return (savedMatchLevel as 'city' | 'state' | 'country') || 'city';
  });
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showUserLocationDialog, setShowUserLocationDialog] = useState(false);
  const [showLocationFilterDialog, setShowLocationFilterDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      const urlQ = new URLSearchParams(window.location.search).get("q");
      if (urlQ) return urlQ;
      return sessionStorage.getItem("jobs_search_query") || "";
    } catch {
      return "";
    }
  });
  const [filters, setFilters] = useState<SearchFilters>(() => {
    try {
      const raw = sessionStorage.getItem("jobs_search_filters");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as SearchFilters;
      }
    } catch {}
    return {};
  });
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'listening' | 'processing' | 'complete'>('listening');
  const [transcribedText, setTranscribedText] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const jobsHeaderRef = useRef<HTMLDivElement>(null);
  const [jobsHeaderHeight, setJobsHeaderHeight] = useState(120);

  // The job list must sit one line under the sticky header. The header grows
  // and shrinks (tabs row hides while searching), so its real height is
  // measured instead of trusting a fixed pt-[120px] offset.
  useEffect(() => {
    const el = jobsHeaderRef.current;
    if (!el) return;
    const measure = () => setJobsHeaderHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const isTypingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const { tapFeedback, successFeedback } = useNativeFeel();
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { jobs, suggestions, loading, hasMore, searchJobs, getSuggestions, loadMore } = useJobSearch();
  const { platformSuggestions, getPlatformSuggestions, clearPlatformSuggestions } = usePlatformSuggestions();

  // Persist search query & filters across page refresh until the user clears them.
  useEffect(() => {
    try {
      if (searchQuery) sessionStorage.setItem("jobs_search_query", searchQuery);
      else sessionStorage.removeItem("jobs_search_query");
    } catch {}
  }, [searchQuery]);

  useEffect(() => {
    try {
      if (filters && Object.keys(filters).length > 0) {
        sessionStorage.setItem("jobs_search_filters", JSON.stringify(filters));
      } else {
        sessionStorage.removeItem("jobs_search_filters");
      }
    } catch {}
  }, [filters]);


  // Get user location and job counts for "For You" tab
  const { location } = useUserLocation();
  // Use profile location as primary source (matches header dialog), fallback to detected location
  const derivedCity = (profile as any)?.city || location.city;
  const derivedState = (profile as any)?.state || location.state;
  const derivedCountry = (profile as any)?.country || location.country;
  const { cityCount, stateCount, countryCount, loading: countsLoading } = useLocationJobCounts({
    city: derivedCity,
    state: derivedState,
    country: derivedCountry
  });

  console.log('📍 [Jobs Page] Location & Counts (derived):', {
    city: derivedCity,
    state: derivedState,
    country: derivedCountry,
    cityCount,
    stateCount,
    countryCount,
    countsLoading
  });


  // Get personalized jobs for "For You" tab
  const { 
    jobs: personalizedJobs, 
    loading: personalizedLoading,
    hasMore: personalizedHasMore,
    loadMore: loadMorePersonalized,
    shouldShowTab: shouldShowForYouTab
  } = usePersonalizedJobs({
    limit: 20,
    enabled: activeTab === 'for-you' && !countsLoading,
    matchLevel: forYouMatchLevel, // Pass explicit match level
    locationFilter: {
      city: derivedCity,
      state: derivedState,
      country: derivedCountry,
      cityCount,
      stateCount,
      countryCount
    }
  });

  console.log('🎯 [Jobs Page] shouldShowForYouTab:', shouldShowForYouTab, { cityCount, stateCount });
  console.log('🔧 [Jobs Page] forYouMatchLevel state:', forYouMatchLevel);

  console.log('🎯 [Jobs Page] shouldShowForYouTab:', shouldShowForYouTab, { cityCount, stateCount });

  // Save active tab and match level to sessionStorage whenever they change (only after user interaction)
  useEffect(() => {
    if (!countsLoading) {
      console.log('💾 Saving active tab to sessionStorage:', activeTab);
      sessionStorage.setItem('jobs_active_tab', activeTab);
    }
  }, [activeTab, countsLoading]);

  // Save match level separately
  useEffect(() => {
    if (!countsLoading) {
      console.log('💾 Saving match level to sessionStorage:', forYouMatchLevel);
      sessionStorage.setItem('jobs_match_level', forYouMatchLevel);
    }
  }, [forYouMatchLevel, countsLoading]);

  // "For You" tab is always shown; no auto-switch needed.

  // Get latest jobs for "Latest" tab
  const {
    jobs: latestJobs,
    loading: latestLoading,
    loadingMore: latestLoadingMore,
    hasMore: latestHasMore,
    loadMore: loadMoreLatest
  } = useLatestJobs({
    limit: 20,
    enabled: activeTab === 'latest' || activeTab === 'featured' || activeTab === 'urgent' || activeTab === 'remote' || activeTab === 'onsite' || activeTab === 'hybrid' || activeTab === 'freshers'
  });

  // External Indian jobs from Jooble to enrich the feed (shown alongside website jobs)
  const isSearchView = !!(searchQuery || Object.keys(filters).length > 0);
  const joobleKeywords =
    debouncedSearchQuery ||
    (typeof filters.category === 'string' ? filters.category : '') ||
    urlCategory ||
    '';
  const joobleLocation =
    (typeof filters.location === 'string' ? filters.location : '') ||
    derivedCity ||
    derivedState ||
    '';
  const joobleSort: 'latest' | 'trending' | 'relevance' =
    activeTab === 'latest' ? 'latest' : activeTab === 'trending' ? 'trending' : 'relevance';
  const {
    jobs: externalJobs,
    loading: externalLoading,
    hasMore: externalHasMore,
    loadMore: loadMoreExternal,
  } = useJoobleJobs({
    keywords: joobleKeywords,
    location: joobleLocation,
    enabled: isSearchView || activeTab === 'latest' || activeTab === 'trending' || activeTab === 'for-you' || activeTab === 'featured',
    limit: 20,
    sort: joobleSort,
  });

  // Debug latest jobs tab
  console.log('🎨 Latest Jobs Tab State:', { 
    latestLoading, 
    latestJobsCount: latestJobs?.length || 0,
    hasLatestJobs: latestJobs && latestJobs.length > 0,
    activeTab
  });
  
  // Debug latest jobs order before rendering
  if (activeTab === 'latest' && latestJobs && latestJobs.length > 0) {
    console.log('📋 Latest Jobs Before Render (first 5):');
    latestJobs.slice(0, 5).forEach((job, idx) => {
      console.log(`  ${idx + 1}. ${job.title}
    - Created (UTC): ${job.created_at}
    - IST: ${formatDateWithTime(job.created_at)}
    - Boosted: ${job.is_boosted}
    - Trending Score: ${job.trending_score || 0}`);
    });
  }

  // Get trending jobs for "Trending" tab
  const {
    jobs: trendingJobs,
    loading: trendingLoading,
    hasMore: trendingHasMore,
    loadMore: loadMoreTrending,
    refresh: refreshTrending
  } = useTrendingJobs({
    limit: 20,
    enabled: activeTab === 'trending'
  });

  // Ensure trending fetches when tab becomes active
  useEffect(() => {
    if (activeTab === 'trending' && !trendingLoading && trendingJobs.length === 0) {
      console.log('🔁 Forcing trending refresh on tab switch');
      refreshTrending();
    }
  }, [activeTab, trendingLoading, trendingJobs.length, refreshTrending]);

  // Infinite scroll for each tab - only active when tab is visible and no search/filters
  const isSearching = debouncedSearchQuery || Object.keys(filters).length > 0 || searchParams.get('category');
  
  useInfiniteScroll({
    callback: loadMorePersonalized,
    loading: personalizedLoading,
    hasMore: personalizedHasMore,
    enabled: activeTab === 'for-you' && !isSearching && !countsLoading && !!user,
    contentKey: personalizedJobs.length
  });

  useInfiniteScroll({
    callback: loadMoreLatest,
    loading: latestLoading || latestLoadingMore,
    hasMore: latestHasMore,
    enabled: ['latest', 'featured', 'urgent', 'remote', 'onsite', 'hybrid', 'freshers'].includes(activeTab) && !isSearching,
    contentKey: latestJobs.length
  });

  useInfiniteScroll({
    callback: loadMoreTrending,
    loading: trendingLoading,
    hasMore: trendingHasMore,
    enabled: activeTab === 'trending' && !isSearching,
    contentKey: trendingJobs.length
  });

  // Infinite scroll for external Jooble jobs — active on any tab that shows them.
  useInfiniteScroll({
    callback: loadMoreExternal,
    loading: externalLoading,
    hasMore: externalHasMore,
    enabled: (isSearchView || ['latest', 'trending', 'for-you', 'featured'].includes(activeTab)) && externalJobs.length > 0 && searchQuery === debouncedSearchQuery,
    contentKey: `${joobleKeywords}|${joobleLocation}|${externalJobs.length}`,
  });

  // Animated placeholder for search
  const animatedPlaceholder = useAnimatedPlaceholder(searchPlaceholders);

  // Handle URL search parameters on component mount
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    const urlLocationParam = searchParams.get('location');
    const urlType = searchParams.get('type');
    const urlCompany = searchParams.get('company');
    const urlCategoryParam = searchParams.get('category');
    
    if (urlQuery) {
      setSearchQuery(urlQuery);
    }
    
    const newFilters: SearchFilters = {};
    
    // Handle clean URL params from /jobs/category/:category or /jobs/location/:location
    if (urlCategory) {
      newFilters.category = urlCategory.replace(/-/g, ' ');
    } else if (urlCategoryParam) {
      newFilters.category = urlCategoryParam.replace(/-/g, ' ');
    }
    
    if (urlLocation) {
      newFilters.location = urlLocation.replace(/-/g, ' ');
    } else if (urlLocationParam) {
      newFilters.location = urlLocationParam;
    }
    
    if (urlType) {
      newFilters.jobType = urlType;
    }
    if (urlCompany) {
      newFilters.company = urlCompany;
    }
    
    if (Object.keys(newFilters).length > 0) {
      setFilters(newFilters);
    }
    
  }, [searchParams, searchJobs, urlCategory, urlLocation]);

  // Search when query or filters change (regular fuzzy search)
  useEffect(() => {
    if (debouncedSearchQuery !== undefined) {
      searchJobs(debouncedSearchQuery, filters, 0, true);
    }
  }, [debouncedSearchQuery, filters, searchJobs]);

  // Start website and partner suggestions together; no wait for job-list loading.
  useEffect(() => {
    if (!isTypingRef.current || searchQuery.trim().length < 2) {
      setShowSuggestions(false);
      getSuggestions('');
      clearPlatformSuggestions();
      return;
    }
    setShowSuggestions(true);
    getSuggestions(searchQuery);
    getPlatformSuggestions(searchQuery);
  }, [searchQuery, getSuggestions, getPlatformSuggestions, clearPlatformSuggestions]);

  const visibleSuggestions = mergeSearchSuggestions(suggestions, searchQuery, 10);
  const visiblePlatformSuggestions = mergeSearchSuggestions(platformSuggestions, searchQuery)
    .filter(item => !visibleSuggestions.some(own => own.suggestion.toLowerCase() === item.suggestion.toLowerCase()));

  // Handle search input - block Devanagari (transliterate to Roman)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isTypingRef.current = true;
    const raw = e.target.value;
    if (containsDevanagari(raw)) {
      const cleaned = sanitizeSearchQuery(raw);
      setSearchQuery(cleaned);
      toast({
        title: "Only English / Hinglish allowed",
        description: "Please type in English letters (Hinglish is fine).",
      });
      return;
    }
    setSearchQuery(raw);
  };

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
    console.log('📄 Jobs page received filter change:', newFilters);
    // Remove undefined values and properly replace filters
    const cleanedFilters = Object.entries(newFilters).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as SearchFilters);
    setFilters(cleanedFilters);
  }, []);

  // Handle clear all filters
  const handleClearAllFilters = useCallback(() => {
    console.log('🔄 Clearing all filters');
    setFilters({});
  }, []);

  // Handle suggestion click
  // Commit a search (keyboard Search/Enter or suggestion tap): run it now,
  // hide suggestions and close the mobile keyboard.
  const commitSearch = (query: string) => {
    isTypingRef.current = false;
    setShowSuggestions(false);
    clearPlatformSuggestions();
    setSearchQuery(query);
    searchInputRef.current?.blur();
    if (query.trim()) searchJobs(query, filters, 0, true);
  };

  const handleSuggestionClick = (suggestion: string) => commitSearch(suggestion);

  // Voice search handlers using Web Speech API (100% FREE)
  const handleVoiceSearch = async () => {
    if (isRecordingVoice) {
      // Stop recording
      stopVoiceRecording();
    } else {
      // Start recording
      startVoiceRecording();
    }
  };

  // Auto-trigger voice search when ?voice=1 is present (from Home page mic)
  useEffect(() => {
    if (searchParams.get('voice') === '1') {
      const t = setTimeout(() => { startVoiceRecording(); }, 400);
      searchParams.delete('voice');
      setSearchParams(searchParams, { replace: true });
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const startVoiceRecording = async () => {
    try {
      tapFeedback();
      console.log('🎤 Starting voice recording (FREE - No login required)...');
      setIsRecordingVoice(true);
      setShowVoiceOverlay(true);
      setVoiceStatus('listening');
      setTranscribedText('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream); // Store stream for audio visualization
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null); // Clear stream after stopping

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          try {
            setVoiceStatus('processing');
            const base64Audio = (reader.result as string).split(',')[1];
            
            console.log('📤 Sending audio to voice-to-text (FREE endpoint)...');
            
            // Using voice-to-text function (FREE, no authentication required)
            const { data, error } = await supabase.functions.invoke('unified-voice', {
              body: { action: 'speech-to-text', audio: base64Audio }
            });

            console.log('📥 Response received:', { data, error });

            if (error) {
              console.error('❌ Function invocation error:', error);
              throw new Error(error.message || 'Transcription failed');
            }

            if (data?.error) {
              console.error('❌ API error:', data.error);
              throw new Error(data.error);
            }

            if (data?.text) {
              const rawTranscript = data.text;
              const hadDevanagari = containsDevanagari(rawTranscript);
              const transcript = sanitizeSearchQuery(rawTranscript);
              const detectedLang = data.detected_language === 'hi' ? 'Hindi' : 'English';

              console.log('✅ Transcription:', rawTranscript, '→', transcript, '| Lang:', detectedLang);

              successFeedback();
              setTranscribedText(transcript);
              setVoiceStatus('complete');

              if (hadDevanagari) {
                toast({
                  title: "Voice search",
                  description: "Please speak in English or Hinglish (Roman letters) for best results.",
                });
              }

              setTimeout(() => {
                if (transcript && transcript.trim().length > 0) {
                  setSearchQuery(transcript);
                  searchJobs(transcript, filters, 0, true);
                }
                setShowVoiceOverlay(false);
                setVoiceStatus('listening');
              }, 1000);
            } else {
              throw new Error('No transcription text received');
            }
          } catch (error) {
            console.error('❌ Transcription error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Could not transcribe';
            toast({
              title: "Voice Search Error",
              description: errorMessage + ". Please try again.",
              variant: "destructive"
            });
            setShowVoiceOverlay(false);
          } finally {
            setIsRecordingVoice(false);
          }
        };

        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      recognitionRef.current = mediaRecorder as any;
      
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);

    } catch (error) {
      console.error('❌ Voice recording error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to access microphone';
      toast({
        title: "Microphone Error",
        description: errorMessage + ". Please allow microphone access.",
        variant: "destructive"
      });
      setIsRecordingVoice(false);
      setShowVoiceOverlay(false);
    }
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      console.log('⏹️ Stopping recording...');
      const mediaRecorder = recognitionRef.current as any;
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      recognitionRef.current = null;
    }
    setIsRecordingVoice(false);
    setShowVoiceOverlay(false);
  };

  const loadMoreSearch = useCallback(() => {
    const nextPage = loadMore();
    if (nextPage !== null) {
      void searchJobs(debouncedSearchQuery, filters, nextPage, false);
    }
  }, [loadMore, searchJobs, debouncedSearchQuery, filters]);

  useInfiniteScroll({
    callback: loadMoreSearch,
    loading,
    hasMore,
    enabled: isSearchView && searchQuery === debouncedSearchQuery,
    contentKey: `${debouncedSearchQuery}|${JSON.stringify(filters)}|${jobs.length}`,
  });

  // Sort jobs based on active tab — smart search already ranks by relevance
  const currentJobs = useMemo(() => {
    if (activeTab === "trending" && !searchQuery) {
      return [...jobs].sort((a, b) => (b.trending_score || 0) - (a.trending_score || 0));
    }
    // Keep only jobs that actually match the search (title, company,
    // category…), best matches first. If nothing matches, the original
    // list is kept so the page never goes blank.
    if (searchQuery) {
      return filterJobsBySearch(jobs, searchQuery);
    }
    return jobs;
  }, [jobs, activeTab, searchQuery]);
  
  const productionUrl = CANONICAL_URL;
  
  const jobListingStructuredData = {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    "name": "Remote Jobs in India",
    "url": `${productionUrl}/jobs`,
    "description": "Latest remote job opportunities and Workly India positions across India",
    "numberOfItems": currentJobs.length,
    "itemListElement": currentJobs.slice(0, 10).map((job: any, index) => {
      const parts = String(job.location || '').split(',').map((p: string) => p.trim()).filter(Boolean);
      const city = job.city || parts[0] || 'India';
      const state = job.state || parts[1] || job.companies?.state || 'Gujarat';
      const street = job.precise_address || job.companies?.precise_address || `${city}, ${state}`;
      const pin = job.postal_code || job.companies?.postal_code || String(street).match(/\b\d{6}\b/)?.[0] || '110001';
      const min = Number(job.salary_min) || 0;
      const max = Number(job.salary_max) || min;
      const posted = job.created_at ? new Date(job.created_at) : new Date();
      const validThrough = job.expires_at || job.application_deadline || new Date(posted.getTime() + 90 * 864e5).toISOString();
      return {
        "@type": "JobPosting",
        "position": index + 1,
        "title": job.title,
        "description": String(job.description || job.title || '').replace(/WFH India/g, 'Workly India'),
        "employmentType": String(job.job_type || 'FULL_TIME').toUpperCase().replace(/[-\s]+/g, '_'),
        "hiringOrganization": { "@type": "Organization", "name": job.company_name || job.companies?.company_name || 'Workly India' },
        "jobLocation": {
          "@type": "Place",
          "address": { "@type": "PostalAddress", "streetAddress": street, "addressLocality": city, "addressRegion": state, "postalCode": pin, "addressCountry": "IN" }
        },
        "baseSalary": {
          "@type": "MonetaryAmount",
          "currency": "INR",
          "value": min
            ? { "@type": "QuantitativeValue", "value": Math.round((min + max) / 2), "minValue": min, "maxValue": max, "unitText": "MONTH" }
            : { "@type": "QuantitativeValue", "value": 20000, "minValue": 15000, "maxValue": 25000, "unitText": "MONTH" }
        },
        "datePosted": posted.toISOString(),
        "validThrough": new Date(validThrough).toISOString(),
        "url": `${CANONICAL_URL}/job/${job.public_slug || job.short_id || job.id}`
      };
    })
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={ROUTE_SEO['/jobs'].title}
        description={ROUTE_SEO['/jobs'].description}
        keywords={ROUTE_SEO['/jobs'].keywords}
        canonical="/jobs"
        structured={jobListingStructuredData}
      />
      <JobSearchSchema />
      
      {/* Unified Fixed Header with Search and Tabs */}
      <div 
        ref={jobsHeaderRef}
        className={`fixed top-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-xl border border-border/40 rounded-b-2xl shadow-lg shadow-primary/5 transition-transform duration-300 ease-in-out ${
          scrollDirection === 'down' && scrollY > 100 ? '-translate-y-full' : 'translate-y-0'
        }`}
        style={{ willChange: 'transform' }}
      >
        <div className="container mx-auto px-3 sm:px-4 pt-2 pb-2 max-w-7xl">
          <div className="flex items-center space-x-2 mb-3">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
                <LottieSearchIcon size={22} />
              </div>
              <Input
                ref={searchInputRef}
                type="search"
                enterKeyHint="search"
                placeholder={animatedPlaceholder}
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitSearch(searchQuery);
                  }
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-11 pr-11 h-9 rounded-3xl border-2 border-primary/30 focus:border-primary/60 bg-background/80 backdrop-blur-sm shadow-soft hover:shadow-medium focus:shadow-medium transition-all duration-300 text-sm font-medium placeholder:text-muted-foreground/60"
                style={{
                  animation: 'shimmer 3s linear infinite, fade-in 0.5s ease-out'
                }}
              />
              
              {/* Voice Search Button */}
              <button
                onClick={() => {
                  console.log('🎤 Mic button clicked!');
                  startVoiceRecording();
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center justify-center bg-transparent hover:bg-transparent transition-colors p-0 border-0"
                aria-label="Voice search"
              >
                <Mic className="w-[22px] h-[22px] bg-transparent" />
              </button>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 animate-shimmer pointer-events-none rounded-2xl"></div>
              
              {/* Search Suggestions — website jobs first, partner platforms as fallback */}
              {showSuggestions && (visibleSuggestions.length > 0 || visiblePlatformSuggestions.length > 0) && (
                <div className="fixed left-3 right-3 sm:left-auto sm:right-auto sm:max-w-[calc(100vw-2rem)] md:max-w-3xl bg-white dark:bg-gray-900 border-2 border-primary/20 rounded-lg shadow-2xl shadow-primary/10 z-[100] max-h-[60vh] md:max-h-80 overflow-y-auto"
                  style={{
                    top: '3.5rem', // Position directly below search input
                  }}
                >
                  {visibleSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full px-4 py-3 text-left hover:bg-muted/70 flex items-center justify-between border-b border-border/50 last:border-0 transition-colors duration-200 min-h-[44px]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionClick(suggestion.suggestion)}
                    >
                      <span className="text-sm font-medium">{suggestion.suggestion}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {suggestion.type === 'job_title' && '📋'}
                        {suggestion.type === 'company' && '🏢'}
                        {suggestion.type === 'skill' && '🎯'}
                        {suggestion.type === 'category' && '📂'}
                        <span className="bg-primary/10 px-2 py-0.5 rounded-full">{suggestion.count}</span>
                      </span>
                    </button>
                  ))}
                  {visiblePlatformSuggestions.map((item, index) => (
                    <button
                      key={`platform-${index}`}
                      className="w-full px-4 py-3 text-left hover:bg-muted/70 flex items-center border-b border-border/50 last:border-0 transition-colors duration-200 min-h-[44px]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionClick(item.suggestion)}
                    >
                      <span className="text-sm font-medium">{item.suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Location Chip */}
            <LocationChip className="flex items-center space-x-1 bg-background/80 backdrop-blur-sm rounded-2xl px-2.5 py-2 border-2 border-success/30 hover:border-success/50 shadow-soft hover:shadow-glow transition-all duration-300 group cursor-pointer relative min-w-0 hover:scale-105 active:scale-95" />
            
            {/* User Location Icon */}
            {user && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowUserLocationDialog(true)}
                className="h-8 w-8 rounded-2xl border-2 border-primary/30 hover:border-primary/60 bg-background/80 backdrop-blur-sm shadow-soft hover:shadow-medium transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <LottieLocationIcon size={20} />
              </Button>
            )}
            
            <Sheet open={showFilterDialog} onOpenChange={setShowFilterDialog}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-2xl border-2 border-primary/30 hover:border-primary/60 bg-background/80 backdrop-blur-sm shadow-soft hover:shadow-medium transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="bottom" 
                className="h-[85vh] overflow-y-auto rounded-t-3xl p-6 [&>button]:hidden"
              >
                <StandardSheetHeader 
                  title="Filter Jobs"
                  onClose={() => setShowFilterDialog(false)}
                />
                <div>
                  <FilterBar 
                    onFiltersChange={handleFilterChange}
                    initialFilters={filters}
                  />
                </div>
              </SheetContent>
            </Sheet>
            
            {/* User Location Dialog */}
            <UserLocationDialog 
              open={showUserLocationDialog} 
              onOpenChange={setShowUserLocationDialog}
            />
          </div>



          {/* Tabs Section - Hide when search or filters are active */}
          {!searchQuery && Object.keys(filters).length === 0 && (
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value);
              sessionStorage.setItem('jobs_active_tab', value);
              setSearchParams({ tab: value });
            }} className="w-full mt-2">
              <TabsList className="flex w-full gap-1.5 bg-transparent p-0 h-auto justify-between">
                <TabsTrigger
                  value="for-you"
                   className="flex-1 min-w-0 flex items-center justify-center gap-1 rounded-lg h-7 px-1.5 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-background/60 data-[state=inactive]:backdrop-blur-sm data-[state=inactive]:border data-[state=inactive]:border-border/40 transition-all duration-300 active:scale-95 data-[state=active]:shadow-medium font-medium text-[11px] whitespace-nowrap"
                  >
                    <Sparkles className="w-3 h-3" />
                    For You
                  </TabsTrigger>
                <TabsTrigger
                  value="latest"
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 rounded-lg h-7 px-1.5 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-background/60 data-[state=inactive]:backdrop-blur-sm data-[state=inactive]:border data-[state=inactive]:border-border/40 transition-all duration-300 active:scale-95 data-[state=active]:shadow-medium font-medium text-[11px] whitespace-nowrap"
                >
                  <Clock className="w-3 h-3" />
                  Latest
                </TabsTrigger>
                <TabsTrigger
                  value="trending"
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 rounded-lg h-7 px-1.5 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-background/60 data-[state=inactive]:backdrop-blur-sm data-[state=inactive]:border data-[state=inactive]:border-border/40 transition-all duration-300 active:scale-95 data-[state=active]:shadow-medium font-medium text-[11px] whitespace-nowrap"
                >
                  <TrendingUp className="w-3 h-3" />
                  Trending
                </TabsTrigger>
                <TabsTrigger
                  value="featured"
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 rounded-lg h-7 px-1.5 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-background/60 data-[state=inactive]:backdrop-blur-sm data-[state=inactive]:border data-[state=inactive]:border-border/40 transition-all duration-300 active:scale-95 data-[state=active]:shadow-medium font-medium text-[11px] whitespace-nowrap"
                >
                  <Flame className="w-3 h-3" />
                  Featured
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Active Filters Display - Only show filter chips, no header */}
          {(Object.keys(filters).length > 0 || searchQuery) && (
            <div className="mt-2 mb-1">
              <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                {filters.location && (
                  <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs border border-blue-200">
                    <span>Location: {
                      typeof filters.location === 'string' 
                        ? filters.location 
                        : [filters.location.city, filters.location.state, filters.location.country].filter(Boolean).join(', ')
                    }</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-blue-100"
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.location;
                        setFilters(newFilters);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {filters.jobType && (
                  <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-lg text-xs border border-green-200">
                    <span>Type: {filters.jobType}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-green-100"
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.jobType;
                        setFilters(newFilters);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {filters.experience && (
                  <div className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-xs border border-purple-200">
                    <span>Experience: {filters.experience}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-purple-100"
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.experience;
                        setFilters(newFilters);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {filters.salaryMin && (
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg text-xs border border-amber-200">
                    <span>Min Salary: ₹{filters.salaryMin?.toLocaleString()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-amber-100"
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.salaryMin;
                        setFilters(newFilters);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {filters.salaryMax && (
                  <div className="flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-1 rounded-lg text-xs border border-teal-200">
                    <span>Max Salary: ₹{filters.salaryMax?.toLocaleString()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-teal-100"
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.salaryMax;
                        setFilters(newFilters);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {(['category','skills','companySize','sortBy','postedDate','company','languages'] as const).map((key) => {
                  const value = (filters as any)[key];
                  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
                  const label = ({
                    category: 'Category',
                    skills: 'Skills',
                    companySize: 'Company Size',
                    sortBy: 'Sort',
                    postedDate: 'Posted',
                    company: 'Company',
                    languages: 'Languages',
                  } as Record<string,string>)[key];
                  const display = Array.isArray(value) ? value.join(', ') : String(value);
                  return (
                    <div key={key} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs border border-indigo-200">
                      <span>{label}: {display}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-indigo-100"
                        onClick={() => {
                          const newFilters = { ...filters };
                          delete (newFilters as any)[key];
                          setFilters(newFilters);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
                {searchQuery && (
                  <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-lg text-xs border border-primary/20">
                    <span>Search: "{searchQuery}"</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-primary/20"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Voice Search Overlay */}
        <VoiceSearchOverlay
          isOpen={showVoiceOverlay}
          onClose={() => {
            stopVoiceRecording();
            setShowVoiceOverlay(false);
          }}
          onTranscript={(text) => setSearchQuery(text)}
          isRecording={isRecordingVoice}
          transcribedText={transcribedText}
          status={voiceStatus}
          onTapToSearch={stopVoiceRecording}
          stream={audioStream}
        />
      </div>


        <main className="container mx-auto px-3 sm:px-4 py-3 pb-24 md:pb-8 max-w-7xl transition-all duration-300"
        style={{ paddingTop: (scrollDirection === 'down' && scrollY > 100) ? 80 : jobsHeaderHeight + 8 }}>
        <div className="flex gap-4">
          {/* Main Content Area */}
          <div className="flex-1">
            {/* Search Results View - Show when there's search query or filters */}
            {(searchQuery || Object.keys(filters).length > 0) ? (
              <div className="w-full">
                {(() => {
                  // Keep only partner jobs that actually match the search,
                  // best matches first — the provider's loose matches should
                  // not push unrelated jobs into the results.
                  const visibleExternalJobs = filterJobsBySearch(externalJobs, searchQuery);
                  const hasExternal = visibleExternalJobs.length > 0;
                  const visibleInternalJobs = currentJobs;
                  const nothingAtAll =
                    !loading && !externalLoading && visibleInternalJobs.length === 0 && !hasExternal;

                  return (
                    <>
                      {(visibleInternalJobs.length > 0 || hasExternal || loading) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          {loading && visibleInternalJobs.length === 0 && !hasExternal ? (
                            // Skeleton cards make the search feel instant while
                            // results stream in.
                            <>
                              {[0, 1, 2, 3].map((i) => (
                                <JobCardSkeleton key={`search-skeleton-${i}`} />
                              ))}
                            </>
                          ) : (
                            <>
                              {visibleInternalJobs.map((job, index) => (
                                <div key={job.id || index} className="animate-fade-in" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
                                  <JobCard
                                    id={job.id}
                                    shortId={job.short_id}
                                    publicSlug={(job as any).public_slug}
                                    title={job.title}
                                    company={job.company_name}
                                    location={job.location}
                                    salary={job.salary_range}
                                    type={job.job_type}
                                    experience={job.experience_level}
                                    description={job.description}
                                    posted={job.created_at}
                                    tags={job.skills}
                                    trendingScore={job.trending_score}
                                    organicScore={job.organic_score}
                                    organicRank={job.organic_rank}
                                    trendingRank={(job as any).trending_rank}
                                    isNew={job.created_at ? (new Date().getTime() - new Date(job.created_at).getTime()) < 24 * 60 * 60 * 1000 : false}
                                    viewsCount={job.views_count}
                                    applicationsCount={job.applications_count}
                                    callsCount={job.calls_count}
                                    sharesCount={job.shares_count}
                                    isBoosted={job.is_boosted}
                                    boostLevel={job.boost_level}
                                    isVerified={job.is_verified}
                                    badgeColor={job.badge_color}
                                    verifiedPlanEnd={job.verified_plan_end}
                                    latitude={job.latitude}
                                    longitude={job.longitude}
                                    city={job.city}
                                    state={job.state}
                                    country={job.country}
                                    apiCompanyName={(job as any).apiCompanyName}
                                    logoUrl={job.logo_url}
                                    category={(job as any).category}
                                    workMode={(job as any).work_mode}
                                    shiftTiming={(job as any).shift_timing}
                                    education={(job as any).education_required}
                                    openings={(job as any).openings}
                                  />
                                </div>
                              ))}
                              {hasExternal && visibleExternalJobs.map((job, index) => (
                                <div
                                  key={job.external_id}
                                  className="animate-fade-in"
                                  style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                                >
                                  <ExternalJobCard job={job} />
                                </div>
                              ))}
                              {/* Skeletons while the next page streams in */}
                              {loading && visibleInternalJobs.length > 0 && (
                                [0, 1].map((i) => <JobCardSkeleton key={`more-skeleton-${i}`} />)
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {nothingAtAll && (
                        <div className="text-center py-12">
                          <span className="mx-auto mb-4 inline-flex"><LottieSearchIcon size={48} /></span>
                          <p className="text-muted-foreground">
                            No jobs found matching your search criteria
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Try adjusting your search or filters
                          </p>
                        </div>
                      )}

                      {externalLoading && hasExternal && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3">
                          {[0, 1].map((i) => <JobCardSkeleton key={`ext-skeleton-${i}`} />)}
                        </div>
                      )}
                      {hasMore && !loading && visibleInternalJobs.length > 0 && (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground text-sm">Scroll for more results</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => {
                setActiveTab(value);
                setSearchParams({ tab: value });
              }} className="w-full">
                {/* For You Tab - Personalized Jobs */}
                <TabsContent value="for-you">
                <SafeErrorBoundary 
                  context="PersonalizedJobs"
                  fallback={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {currentJobs.map((job, index) => (
                        <div key={job.id || index} className="animate-fade-in">
                        <JobCard 
                            id={job.id}
                            shortId={job.short_id}
                            publicSlug={(job as any).public_slug}
                            title={job.title}
                            company={job.company_name}
                            location={job.location}
                            salary={job.salary_range}
                            type={job.job_type}
                            experience={job.experience_level}
                            description={job.description}
                            posted={job.created_at}
                            tags={job.skills}
                            trendingScore={job.trending_score}
                            viewsCount={job.views_count}
                            applicationsCount={job.applications_count}
                            callsCount={job.calls_count}
                            sharesCount={job.shares_count}
                            isBoosted={job.is_boosted}
                            locationMatchLevel={(job as any).location_match_level}
                            city={job.city}
                            state={job.state}
                            country={job.country}
                            apiCompanyName={(job as any).apiCompanyName}
                            logoUrl={job.logo_url}
                            category={(job as any).category}
                            workMode={(job as any).work_mode}
                            shiftTiming={(job as any).shift_timing}
                            education={(job as any).education_required}
                            openings={(job as any).openings}
                          />
                        </div>
                      ))}
                    </div>
                  }
                >
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {personalizedLoading && personalizedJobs.length === 0 ? (
                      <div className="col-span-full text-center py-8">
                        <p className="text-muted-foreground animate-pulse">Loading personalized jobs...</p>
                      </div>
                    ) : personalizedJobs.length > 0 ? (
                      personalizedJobs.map((job, index) => (
                         <div key={job.job_id} className="animate-fade-in">
                           <JobCard 
                            id={job.job_id}
                            shortId={(job as any).short_id}
                            publicSlug={(job as any).public_slug}
                            title={job.title}
                            company={job.company}
                            location={job.location}
                            salary={job.salary_range}
                            type={job.job_type}
                            experience={job.experience_level}
                            description={job.description}
                            posted={job.created_at}
                            tags={job.skills}
                            trendingScore={job.trending_score || 0}
                            baseScore={(job as any).base_score}
                            trendingRank={(job as any).trending_rank}
                            organicRank={(job as any).organic_rank}
                            viewsCount={job.views_count}
                            applicationsCount={job.applications_count}
                            isBoosted={job.is_boosted}
                            boostLevel={job.boost_level}
                            isVerified={job.is_verified}
                            badgeColor={job.badge_color}
                            verifiedPlanEnd={job.verified_plan_end}
                            locationMatchLevel={job.location_match_level}
                            locationMatch={job.location_match_level as 'city' | 'state' | 'country' | undefined}
                            latitude={job.company_latitude}
                            longitude={job.company_longitude}
                            city={job.city || derivedCity}
                            state={job.state || derivedState}
                            country={job.country || derivedCountry}
                             apiCompanyName={job.apiCompanyName}
                             logoUrl={job.logo_url}
                             category={(job as any).category}
                             workMode={(job as any).work_mode}
                             shiftTiming={(job as any).shift_timing}
                             education={(job as any).education_required}
                             openings={(job as any).openings}
                           />
                        </div>
                      ))
                    ) : currentJobs.length > 0 ? (
                      <>
                        {currentJobs.map((job, index) => (
                          <div key={job.id || index} className="animate-fade-in">
                            <JobCard 
                              id={job.id}
                              shortId={job.short_id}
                              publicSlug={(job as any).public_slug}
                              title={job.title}
                              company={job.company_name}
                              location={job.location}
                              salary={job.salary_range}
                              type={job.job_type}
                              experience={job.experience_level}
                              description={job.description}
                              posted={job.created_at}
                              tags={job.skills}
                              trendingScore={job.trending_score}
                              viewsCount={job.views_count}
                              applicationsCount={job.applications_count}
                              callsCount={job.calls_count}
                              sharesCount={job.shares_count}
                              isBoosted={job.is_boosted}
                              locationMatchLevel={(job as any).location_match_level}
                              city={job.city}
                              state={job.state}
                              country={job.country}
                              apiCompanyName={(job as any).apiCompanyName}
                              logoUrl={job.logo_url}
                              category={(job as any).category}
                              workMode={(job as any).work_mode}
                              shiftTiming={(job as any).shift_timing}
                              education={(job as any).education_required}
                              openings={(job as any).openings}
                            />
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="col-span-full text-center py-12">
                        <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          No new personalized jobs right now. Check back soon!
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Browse jobs to help us learn your preferences
                        </p>
                      </div>
                    )}
                    
                    {/* Loading more indicator */}
                    {personalizedLoading && personalizedJobs.length > 0 && (
                      <div className="col-span-full text-center py-6">
                        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                          Loading more jobs...
                        </div>
                      </div>
                    )}
                    
                    {/* External Jooble jobs appended for infinite scroll */}
                    {externalJobs.map((job, index) => (
                      <div key={job.external_id} className="animate-fade-in">
                        <ExternalJobCard job={job} />
                      </div>
                    ))}
                    {externalLoading && externalJobs.length > 0 && (
                      <div className="col-span-full text-center py-4">
                        <p className="text-muted-foreground text-sm animate-pulse">Loading more jobs...</p>
                      </div>
                    )}
                  </div>
                </SafeErrorBoundary>
              </TabsContent>
              
              <TabsContent value="latest">
                <SafeErrorBoundary 
                  context="LatestJobs"
                  fallback={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {currentJobs.map((job, index) => (
                        <div key={job.id || index} className="animate-fade-in">
                          <JobCard 
                            id={job.id}
                            shortId={job.short_id}
                            publicSlug={(job as any).public_slug}
                            title={job.title}
                            company={job.company_name}
                            location={job.location}
                            salary={job.salary_range}
                            type={job.job_type}
                            experience={job.experience_level}
                            description={job.description}
                            posted={job.created_at}
                            tags={job.skills}
                            trendingScore={job.trending_score}
                            viewsCount={job.views_count}
                            applicationsCount={job.applications_count}
                            callsCount={job.calls_count}
                            sharesCount={job.shares_count}
                            isBoosted={job.is_boosted}
                            city={job.city}
                            state={job.state}
                            country={job.country}
                            apiCompanyName={(job as any).apiCompanyName}
                            logoUrl={job.logo_url}
                            category={(job as any).category}
                            workMode={(job as any).work_mode}
                            shiftTiming={(job as any).shift_timing}
                            education={(job as any).education_required}
                            openings={(job as any).openings}
                          />
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {latestLoading ? (
                      <div className="col-span-full text-center py-8">
                        <p className="text-muted-foreground animate-pulse">Loading latest jobs...</p>
                      </div>
                    ) : !latestLoading && latestJobs && latestJobs.length > 0 ? (
                      latestJobs.map((job, index) => (
                         <div key={job.job_id} className="animate-fade-in">
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
                             tags={job.skills}
                             viewsCount={job.views_count}
                             applicationsCount={job.applications_count}
                             isBoosted={job.is_boosted}
                             boostLevel={job.boost_level}
                             isVerified={job.is_verified}
                             badgeColor={job.badge_color}
                             verifiedPlanEnd={job.verified_plan_end}
                             locationMatch={job.location_match as 'city' | 'state' | 'country' | undefined}
                             showProminentDate={false}
                             hideEngagementStats={false}
                             trendingScore={Number(job.trending_score || 0)}
                             baseScore={job.base_score || 0}
                             trendingRank={job.trending_rank || 0}
                             organicRank={job.organic_rank}
                             latitude={job.latitude}
                             longitude={job.longitude}
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
                            />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          No new jobs right now. Check back soon!
                        </p>
                      </div>
                    )}
                    
                    {/* Additional Indian jobs merged inline into the same grid so they fill empty cells */}
                    {externalJobs.map((job, index) => (
                      <div
                        key={job.external_id}
                        className="animate-fade-in"
                      >
                        <ExternalJobCard job={job} />
                      </div>
                    ))}

                    {/* Loading more indicator */}
                    {latestLoading && latestJobs.length > 0 && (
                      <div className="col-span-full text-center py-6">
                        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                          Loading more jobs...
                        </div>
                      </div>
                    )}
                    
                  </div>
                </SafeErrorBoundary>
                {externalLoading && externalJobs.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm animate-pulse">Loading more jobs...</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trending">
                <SafeErrorBoundary 
                  context="TrendingJobs"
                  fallback={
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {currentJobs.map((job, index) => (
                        <div key={job.id || index} className="animate-fade-in">
                          <JobCard 
                            id={job.id}
                            shortId={job.short_id}
                            publicSlug={(job as any).public_slug}
                            title={job.title}
                            company={job.company_name}
                            location={job.location}
                            salary={job.salary_range}
                            type={job.job_type}
                            experience={job.experience_level}
                            description={job.description}
                            posted={job.created_at}
                            tags={job.skills}
                            trendingScore={job.trending_score}
                            viewsCount={job.views_count}
                            applicationsCount={job.applications_count}
                            callsCount={job.calls_count}
                            sharesCount={job.shares_count}
                            isBoosted={job.is_boosted}
                            city={job.city}
                            state={job.state}
                            country={job.country}
                            apiCompanyName={(job as any).apiCompanyName}
                            logoUrl={job.logo_url}
                            category={(job as any).category}
                            workMode={(job as any).work_mode}
                            shiftTiming={(job as any).shift_timing}
                            education={(job as any).education_required}
                            openings={(job as any).openings}
                          />
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {trendingLoading && trendingJobs.length === 0 ? (
                      <div className="col-span-full text-center py-8">
                        <p className="text-muted-foreground animate-pulse">Loading trending jobs...</p>
                      </div>
                    ) : trendingJobs.length > 0 ? (
                       trendingJobs.map((job, index) => (
                         <div key={job.job_id} className="animate-fade-in">
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
                             tags={job.skills}
                             trendingScore={job.trending_score}
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
                             locationMatch={job.location_match as 'city' | 'state' | 'country' | undefined}
                             latitude={job.company_latitude}
                             longitude={job.company_longitude}
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
                            />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12">
                        <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          No trending jobs right now. Check back soon!
                        </p>
                      </div>
                    )}
                    
                    {/* Additional Indian jobs merged inline into the same grid so they fill empty cells */}
                    {externalJobs.map((job, index) => (
                      <div
                        key={job.external_id}
                        className="animate-fade-in"
                      >
                        <ExternalJobCard job={job} />
                      </div>
                    ))}

                    {/* Loading more indicator */}
                    {trendingLoading && trendingJobs.length > 0 && (
                      <div className="col-span-full text-center py-6">
                        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                          Loading more jobs...
                        </div>
                      </div>
                    )}
                    
                  </div>
                </SafeErrorBoundary>
                {externalLoading && externalJobs.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm animate-pulse">Loading more jobs...</p>
                  </div>
                )}
              </TabsContent>

              {/* Additional filter tabs — reuse latestJobs data with client-side filters */}
              {(['featured','urgent','remote','onsite','hybrid','freshers'] as const).map((tabKey) => {
                const filterFn = (job: any) => {
                  const wm = String(job.work_mode || '').toLowerCase().replace(/[-_\s]/g, '');
                  const exp = String(job.experience_level || '').toLowerCase();
                  switch (tabKey) {
                    case 'featured':
                      return !!(job.is_boosted || job.is_featured || (job.boost_level && job.boost_level > 0));
                    case 'urgent':
                      return String(job.hiring_urgency || '').toLowerCase() === 'urgent';
                    case 'remote':
                      return wm === 'remote' || wm === 'workfromhome' || wm === 'Workly India';
                    case 'onsite':
                      return wm === 'onsite' || wm === 'office' || wm === 'inoffice';
                    case 'hybrid':
                      return wm === 'hybrid';
                    case 'freshers':
                      return exp.includes('fresher') || exp.includes('0-1') || exp.includes('0 -1') || exp.includes('entry') || exp === '0' || exp.startsWith('0-');
                    default:
                      return true;
                  }
                };
                const filtered = (latestJobs || []).filter(filterFn);
                const emptyLabel: Record<string, string> = {
                  featured: 'No featured jobs right now.',
                  urgent: 'No urgent hiring jobs right now.',
                  remote: 'No remote jobs right now.',
                  onsite: 'No on-site jobs right now.',
                  hybrid: 'No hybrid jobs right now.',
                  freshers: 'No fresher jobs right now.',
                };
                return (
                  <TabsContent key={tabKey} value={tabKey}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {latestLoading && filtered.length === 0 ? (
                        <div className="col-span-full text-center py-8">
                          <p className="text-muted-foreground animate-pulse">Loading jobs...</p>
                        </div>
                      ) : filtered.length > 0 ? (
                        filtered.map((job: any, index: number) => (
                          <div key={job.job_id} className="animate-fade-in">
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
                              tags={job.skills}
                              viewsCount={job.views_count}
                              applicationsCount={job.applications_count}
                              isBoosted={job.is_boosted}
                              boostLevel={job.boost_level}
                              isVerified={job.is_verified}
                              badgeColor={job.badge_color}
                              verifiedPlanEnd={job.verified_plan_end}
                              trendingScore={Number(job.trending_score || 0)}
                              baseScore={job.base_score || 0}
                              trendingRank={job.trending_rank || 0}
                              organicRank={job.organic_rank}
                              city={job.city}
                              state={job.state}
                              country={job.country}
                              apiCompanyName={job.apiCompanyName}
                              logoUrl={job.logo_url}
                              category={job.category}
                              workMode={job.work_mode}
                              shiftTiming={job.shift_timing}
                              education={job.education_required}
                              openings={job.openings}
                            />
                          </div>
                        ))
                      ) : tabKey === 'featured' && externalJobs.length > 0 ? null : (
                        <div className="col-span-full text-center py-12">
                          <p className="text-muted-foreground">{emptyLabel[tabKey]}</p>
                        </div>
                      )}
                      {tabKey === 'featured' && externalJobs.map((job, index) => (
                        <div key={job.external_id} className="animate-fade-in">
                          <ExternalJobCard job={job} />
                        </div>
                      ))}
                      {tabKey === 'featured' && externalLoading && externalJobs.length > 0 && (
                        <div className="col-span-full text-center py-4">
                          <p className="text-muted-foreground text-sm animate-pulse">Loading more jobs...</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
            )}
          </div>
        </div>
      </main>

      <LocationFilterDialog
        open={showLocationFilterDialog}
        onOpenChange={setShowLocationFilterDialog}
        onLocationSelect={setForYouMatchLevel}
        currentLevel={forYouMatchLevel}
      />

      {/* Show FAB on all tabs - Quick Actions with location filter on For You tab */}
      <FloatingActionButton 
        onLocationFilterClick={() => setShowLocationFilterDialog(true)}
        onAIChatClick={() => navigate('/ai-assistant?audience=job_seeker')}
      />

      <BottomNavigation />
    </div>
  );
};

export default Jobs;
