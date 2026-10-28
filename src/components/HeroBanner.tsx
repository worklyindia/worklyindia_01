import { useEffect, useState, useRef, useCallback } from 'react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { supabase } from '@/integrations/supabase/client';
import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setCacheData, getCacheData } from '@/utils/offlineCache';
import { normalizeImageUrl } from '@/utils/imageUrl';
import bannerFallbackImage from '@/assets/built-with-love-hero.webp';
import { BANNER_CACHE_KEY, BANNER_UPDATED_EVENT, BANNER_STORAGE_KEY } from '@/lib/bannerUpdates';

const BANNER_FALLBACK_SRC = bannerFallbackImage;

interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  image_url?: string | null;
  youtube_url?: string | null;
  link_url?: string | null;
}


const extractYouTubeId = (url: string) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const HeroBanner = () => {
  const [emblaApi, setEmblaApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>(() => {
    return getCacheData<BannerSlide[]>(BANNER_CACHE_KEY) ?? [];
  });
  const [loading, setLoading] = useState(() => !getCacheData(BANNER_CACHE_KEY));
  const [playingVideoIndex, setPlayingVideoIndex] = useState<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [failedBannerIds, setFailedBannerIds] = useState<Record<string, true>>({});
  const [imageAspectRatio, setImageAspectRatio] = useState(2);
  const progressRef = useRef<HTMLSpanElement | null>(null);
  const [progressTimer, setProgressTimer] = useState<{ duration: number } | null>(null);
  
  const autoplayPlugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true, stopOnMouseEnter: false })
  );

  useEffect(() => {
    let disposed = false;
    let requestVersion = 0;
    const fetchBanners = async () => {
      const version = ++requestVersion;
      try {
        const { data, error } = await supabase.rpc('get_active_hero_banners');
        
        if (error) {
          console.warn('Error fetching banners:', error);
          return;
        }
        
        if (!disposed && version === requestVersion) {
          setBannerSlides(data ?? []);
          setFailedBannerIds({});
          setCacheData(BANNER_CACHE_KEY, data ?? [], Number.MAX_SAFE_INTEGER);
        }
      } catch (error) {
        console.warn('Error fetching banners:', error);
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    if (!getCacheData(BANNER_CACHE_KEY)) void fetchBanners();
    const refresh = () => { void fetchBanners(); };
    const storageRefresh = (event: StorageEvent) => {
      if (event.key === BANNER_STORAGE_KEY) refresh();
    };
    window.addEventListener(BANNER_UPDATED_EVENT, refresh);
    window.addEventListener('storage', storageRefresh);
    const channel = supabase.channel('website-hero-banner-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_banners' }, refresh)
      // Catch up once on connection/reconnection, not on a polling clock.
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    return () => {
      disposed = true;
      window.removeEventListener(BANNER_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', storageRefresh);
      void supabase.removeChannel(channel);
    };
  }, []);

  // Resume autoplay after 3 seconds of no interaction
  const scheduleAutoplayResume = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }
    
    // Don't resume if video is playing
    if (playingVideoIndex !== null) return;
    
    resumeTimeoutRef.current = setTimeout(() => {
      try {
        autoplayPlugin.current?.play();
      } catch (e) {
        console.log('Autoplay resume not ready');
      }
    }, 3000); // 3 seconds delay
  }, [playingVideoIndex]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const newIndex = emblaApi.selectedScrollSnap();
      setSelectedIndex(newIndex);
      // Stop video when scrolling to different slide
      if (playingVideoIndex !== null && newIndex !== playingVideoIndex) {
        setPlayingVideoIndex(null);
      }
    };

    // When user interacts (drags/scrolls), schedule autoplay resume
    const onPointerUp = () => {
      scheduleAutoplayResume();
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('pointerUp', onPointerUp);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('pointerUp', onPointerUp);
    };
  }, [emblaApi, playingVideoIndex, scheduleAutoplayResume]);

  // Follow the actual autoplay clock, including interaction and video pauses.
  useEffect(() => {
    if (!emblaApi) return;
    const onTimerSet = () => {
      const duration = autoplayPlugin.current.timeUntilNext();
      setProgressTimer(duration === null ? null : { duration: Math.max(0, duration) });
    };
    const onTimerStopped = () => setProgressTimer(null);
    emblaApi.on('autoplay:timerset', onTimerSet);
    emblaApi.on('autoplay:timerstopped', onTimerStopped);
    emblaApi.on('reInit', onTimerSet);
    onTimerSet();
    return () => {
      emblaApi.off('autoplay:timerset', onTimerSet);
      emblaApi.off('autoplay:timerstopped', onTimerStopped);
      emblaApi.off('reInit', onTimerSet);
    };
  }, [emblaApi]);

  useEffect(() => {
    const progress = progressRef.current;
    if (!progress || !progressTimer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = progress.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: progressTimer.duration, easing: 'linear', fill: 'forwards' },
    );
    return () => animation.cancel();
  }, [selectedIndex, progressTimer]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  // Handle autoplay pause/resume when video is playing
  useEffect(() => {
    const plugin = autoplayPlugin.current;
    if (!plugin) return;

    try {
      if (playingVideoIndex !== null) {
        plugin.stop();
      } else {
        plugin.play();
      }
    } catch (e) {
      // Silently handle if autoplay methods aren't available yet
      console.log('Autoplay control not ready');
    }
  }, [playingVideoIndex]);

  const handleVideoClick = (index: number) => {
    if (playingVideoIndex === index) {
      // Stop video
      setPlayingVideoIndex(null);
    } else {
      // Play video
      setPlayingVideoIndex(index);
    }
  };

  if (loading) {
    // CLS FIX: Return placeholder with fixed dimensions during loading
    return (
      <div className="w-full px-3 pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-muted animate-pulse aspect-[2/1]" />
      </div>
    );
  }

  if (bannerSlides.length === 0) {
    return null;
  }

  return (
    <div className="w-full px-3 pt-4">
      <div className="relative overflow-hidden rounded-2xl">
        <Carousel
          opts={{
            loop: true,
            duration: 30,
            dragFree: false,
            skipSnaps: false,
            watchDrag: true,
            dragThreshold: 5,
            align: 'center',
            containScroll: 'trimSnaps',
          }}
          plugins={[autoplayPlugin.current]}
          setApi={setEmblaApi}
          className="w-full cursor-grab active:cursor-grabbing"
          aria-label="Home banners"
        >
          {/* Override default CarouselContent -ml-4 and CarouselItem pl-4 to avoid visual left shift */}
          <CarouselContent className="touch-pan-y ml-0" containerClassName="touch-pan-y select-none">
          {bannerSlides.map((slide, index) => {
              const hasText = slide.title?.replace(/<[^>]*>/g, '').trim() || slide.subtitle?.replace(/<[^>]*>/g, '').trim();
              const hasGradient = slide.gradient && slide.gradient !== 'none';
              const youtubeId = slide.youtube_url ? extractYouTubeId(slide.youtube_url) : null;
              const isVideoPlaying = playingVideoIndex === index;
              const normalizedBannerUrl = normalizeImageUrl(slide.image_url);
              const bannerSrc = failedBannerIds[slide.id]
                ? BANNER_FALLBACK_SRC
                : (normalizedBannerUrl || BANNER_FALLBACK_SRC);
              
              // Video Banner
              if (youtubeId) {
                  return (
                    <CarouselItem key={slide.id} className="pl-0">
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-border bg-black">
                      {isVideoPlaying ? (
                        <>
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&fs=1&iv_load_policy=3`}
                            title={slide.title || "Video banner"}
                            className="absolute inset-0 w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                          {/* Close button - ACCESSIBILITY FIX: Added aria-label */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-20 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 h-8 w-8"
                            onClick={() => setPlayingVideoIndex(null)}
                            aria-label="Close video"
                          >
                            <X className="w-5 h-5" aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <div 
                          className="absolute inset-0 cursor-pointer group"
                          onClick={() => handleVideoClick(index)}
                        >
                          <img
                            src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                            alt={slide.title || "Video banner"}
                            className="w-full h-full object-cover select-none"
                            loading="eager"
                            draggable="false"
                            referrerPolicy="no-referrer"
                            width={320}
                            height={180}
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                            <div className="bg-primary/90 backdrop-blur-sm rounded-full p-4 group-hover:scale-110 transition-transform shadow-lg">
                              <Play className="w-8 h-8 text-primary-foreground fill-current ml-1" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CarouselItem>
                );
              }

              // Regular Image/Gradient Banner
              const BannerContent = (
                <div
                  className={`relative w-full rounded-2xl overflow-hidden touch-pan-y ${
                    slide.image_url ? '' : hasGradient ? `bg-gradient-to-br ${slide.gradient}` : 'bg-muted'
                  } ${
                    slide.image_url ? '' : 'h-[160px] sm:h-[200px]'
                  }`}
                  style={slide.image_url ? { aspectRatio: imageAspectRatio } : undefined}
                >
                  {/* Background Image (if uploaded) - eager load for LCP */}
                  {slide.image_url && (
                  <img
                      key={`${slide.id}-${failedBannerIds[slide.id] ? 'fallback' : 'primary'}`}
                      src={bannerSrc}
                      alt={slide.title || 'Banner'}
                      className="absolute inset-0 w-full h-full object-contain select-none touch-pan-y"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable="false"
                      referrerPolicy="no-referrer"
                      onLoad={(event) => {
                        if (index !== 0) return;
                        const image = event.currentTarget;
                        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                          setImageAspectRatio(image.naturalWidth / image.naturalHeight);
                        }
                      }}
                      onError={() => {
                        setFailedBannerIds((current) => ({ ...current, [slide.id]: true }));

                        try {
                          const cached = getCacheData<BannerSlide[]>(BANNER_CACHE_KEY) ?? [];
                          const sanitized = cached.map((item) =>
                            item.id === slide.id ? { ...item, image_url: null } : item,
                          );
                          setCacheData(BANNER_CACHE_KEY, sanitized, 5 * 60 * 1000);
                        } catch {
                          // Ignore cache cleanup failures
                        }
                      }}
                    />
                  )}
                  
                  {/* Text container - only render if text exists */}
                  {hasText && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-6 sm:py-8 z-10">
                      {/* Text with subtle background only when image is present - no blur to keep image clear */}
                      <div className={slide.image_url ? 'bg-background/70 rounded-xl px-4 sm:px-6 py-3 sm:py-4' : ''}>
                        {slide.title && slide.title.replace(/<[^>]*>/g, '').trim() && (
                          <h2 
                            className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2"
                            style={slide.image_url ? { textShadow: '0 1px 3px rgba(0,0,0,0.3)' } : {}}
                            dangerouslySetInnerHTML={{ __html: slide.title }}
                          />
                        )}
                        {slide.subtitle && slide.subtitle.replace(/<[^>]*>/g, '').trim() && (
                          <p 
                            className="text-xs sm:text-sm md:text-base text-muted-foreground max-w-md"
                            style={slide.image_url ? { textShadow: '0 1px 2px rgba(0,0,0,0.2)' } : {}}
                            dangerouslySetInnerHTML={{ __html: slide.subtitle }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Decorative circles - only when NO image uploaded AND gradient is set */}
                  {!slide.image_url && hasGradient && (
                    <>
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                    </>
                  )}
                </div>
              );

              return (
                <CarouselItem key={slide.id} className="pl-0">
                  {slide.link_url ? (
                    <a
                      href={slide.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block select-none touch-pan-y"
                      draggable={false}
                    >
                      {BannerContent}
                    </a>
                  ) : (
                    BannerContent
                  )}
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Short progress lines stay below the image, not over the artwork. */}
      {bannerSlides.length > 1 && (
        <div className="mt-1 flex flex-wrap items-center justify-center" role="group" aria-label="Banner slides">
          {bannerSlides.map((slide, index) => (
            <Button
              key={slide.id}
              type="button"
              variant="ghost"
              onClick={() => {
                autoplayPlugin.current.stop();
                if (playingVideoIndex !== null) {
                  setPlayingVideoIndex(null);
                }
                emblaApi?.scrollTo(index);
                scheduleAutoplayResume();
              }}
              className="h-6 w-6 shrink-0 rounded-none p-0 hover:bg-transparent"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selectedIndex ? 'true' : undefined}
            >
              <span className={`relative block h-[3px] overflow-hidden rounded-full bg-muted-foreground/20 ${index === selectedIndex ? 'w-5' : 'w-3'}`}>
                {index === selectedIndex && (
                  <span ref={progressRef} className="absolute inset-0 origin-left rounded-full bg-foreground" />
                )}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroBanner;
