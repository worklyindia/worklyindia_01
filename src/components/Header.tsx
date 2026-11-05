
import { useState, useEffect } from "react";
import { Search, MapPin, Heart, User, X, Building2, UserCheck, Shield, Crown, Briefcase, Star, Menu, Gift, Bot, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import QuickSearch from "@/components/QuickSearch";
import LazyImage from "@/components/LazyImage";
import { r2DisplayUrl } from "@/utils/imageUrl";
import LocationChip from "@/components/LocationChip";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import LottieGiftIcon from "@/components/LottieGiftIcon";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { useAnimatedPlaceholder, searchPlaceholders } from "@/hooks/useAnimatedPlaceholder";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { supabase } from "@/integrations/supabase/client";
import Lottie from "lottie-react";
import cuteTigerAnimation from "@/assets/cute-tiger.json";
import chatbotAnimation from "@/assets/chatbot.json";
import { useBrandAssets } from "@/hooks/useBrandAssets";
import { BRAND_CONFIG } from "@/config/brandConfig";
import WelcomePromoModal from "@/components/WelcomePromoModal";
import userLoginAnimation from "@/assets/lottie/user.json";
import signupPinAnimation from "@/assets/lottie/signup-pin.json";
import likeIconAnimation from "@/assets/lottie/like_icon.json";

interface HeaderProps {
  hideSearch?: boolean;
}

const Header = ({ hideSearch = false }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string>('');
  const [showWelcomePromo, setShowWelcomePromo] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { user: employerUser, company } = useEmployerAuth();
  const { favorites } = useFavorites();
  
  
  const animatedPlaceholder = useAnimatedPlaceholder(searchPlaceholders);
  const { scrollY } = useScrollDirection();
  const brandAssets = useBrandAssets();

  // Check if any user is logged in (job seeker or employer)
  const isAnyUserLoggedIn = user || employerUser;
  
  const logoUrl = brandAssets.logo_url;

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        console.log('Header: No user, setting admin to false');
        setIsAdmin(false);
        setAdminRole('');
        return;
      }
      
      console.log('Header: Checking admin status for user:', user.id);
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        console.log('Header: Admin check result:', { data, error });
        
        if (error && error.code !== 'PGRST116') {
          console.error('Header: Error checking admin status:', error);
        }
        
        const isAdminUser = !!data && ['admin', 'owner'].includes(data.role);
        console.log('Header: Setting admin status:', { isAdminUser, role: data?.role });
        setIsAdmin(isAdminUser);
        setAdminRole(data?.role || '');
      } catch (error) {
        console.error('Header: Error checking admin status:', error);
        setIsAdmin(false);
        setAdminRole('');
      }
    };
    
    checkAdminStatus();
  }, [user]);

  // Helper function to get user initials
  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 w-full transition-all duration-300 overflow-hidden glass-header ${
      isScrolled 
        ? 'shadow-md border-b border-border' 
        : 'shadow-sm'
    }`}>
      {/* Gradient top accent bar */}
      <div className="gradient-header-bar" />
      <div className={`container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 transition-all duration-300 max-w-full ${
        isScrolled 
          ? 'py-2' 
          : 'py-3 xs:py-4'
      }`}>
        <div className="flex items-center justify-between">
          {/* Logo - Clickable with Animation */}
          <div 
            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer active:scale-95 transition-transform duration-100 flex-shrink-0 min-w-0 group"
            onClick={() => navigate('/')}
          >
            <div className="flex items-center justify-center flex-shrink-0 relative rounded-full overflow-hidden">
              {!logoUrl ? (
                <div className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-muted animate-pulse" />
              ) : (
                <LazyImage
                  src={r2DisplayUrl(logoUrl, 128, 75) || logoUrl}
                  sizes="(max-width: 480px) 32px, (max-width: 640px) 40px, (max-width: 768px) 48px, 56px"
                  alt={`${brandAssets?.brand_name || BRAND_CONFIG.name} Logo`} 
                  className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover relative z-10"
                  priority={true}
                  width={32}
                  height={32}
                  showSkeleton={true}
                />
              )}
            </div>
            <div className="min-w-0 overflow-hidden">
              <div className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold truncate">
                {(() => {
                  const brandName = brandAssets?.brand_name || BRAND_CONFIG.name;
                  const [first, ...rest] = brandName.split(' ');
                  const second = rest.join(' ');
                   return (
                    <span className="inline-flex items-center gap-1.5 align-middle">
                      <span style={{ color: BRAND_CONFIG.firstWordColor }}>{first}</span>{' '}
                      <span className="text-green-800 dark:text-green-300">{second}</span>
                      <Lottie
                        animationData={cuteTigerAnimation}
                        loop
                        autoplay
                        className="h-7 w-7 xs:h-8 xs:w-8 sm:h-9 sm:w-9 shrink-0"
                      />
                    </span>
                  );
                })()}
              </div>
              {brandAssets.isLoading ? (
                <div className="h-3 xs:h-4 w-24 xs:w-32 rounded bg-muted animate-pulse mt-0.5" />
              ) : (
                <p className="text-xs xs:text-sm sm:text-sm text-foreground leading-tight truncate animate-fade-in animation-delay-300">{brandAssets?.brand_tagline || BRAND_CONFIG.tagline}</p>
              )}
            </div>
          </div>

          {/* Search Bar - Desktop with Glass Effect - Only visible when at top */}
          {!hideSearch && scrollY < 50 && (
            <div 
              className={`hidden md:flex items-center space-x-2 rounded-2xl px-4 max-w-md lg:max-w-lg xl:max-w-xl w-full mx-4 transition-all duration-100 cursor-pointer group bg-muted/50 border border-border active:scale-98 ${
                isScrolled ? 'py-2' : 'py-3'
              }`}
              onClick={() => navigate('/search')}
            >
              <LottieSearchIcon size={20} />
              <div className="flex-1 py-2 text-muted-foreground text-sm">
                {animatedPlaceholder}
              </div>
            </div>
          )}

          {/* Desktop Navigation - Jobs, Activity, More */}
          {isAnyUserLoggedIn && (
            <div className="hidden md:flex items-center space-x-2 mr-4">
              <Button
                variant={location.pathname === '/jobs' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-lg px-3 py-2 border border-border active:scale-95 transition-transform duration-100"
                onClick={() => navigate('/jobs')}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Jobs
              </Button>
              <Button
                variant={location.pathname === '/activity' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-lg px-3 py-2 border border-border active:scale-95 transition-transform duration-100"
                onClick={() => navigate('/activity')}
              >
                <Star className="w-4 h-4 mr-2" />
                Activity
              </Button>
              <Button
                variant={location.pathname === '/more' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-lg px-3 py-2 border border-border active:scale-95 transition-transform duration-100"
                onClick={() => navigate('/more')}
              >
                <Menu className="w-4 h-4 mr-2" />
                More
              </Button>
            </div>
          )}

          {/* Conditional Action Buttons */}
          <div className="flex items-center space-x-1.5 xs:space-x-2 flex-shrink-0">
            {isAnyUserLoggedIn ? (
              // Authenticated User Icons
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="AI Career Chat"
                  className="icon-btn relative text-primary rounded-full w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 border border-border transition-all duration-100 group active:bg-primary active:text-white"
                  onClick={() => navigate('/ai-assistant?audience=job_seeker')}
                >
                  <LottieSearchIcon size={22} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="icon-btn relative text-primary rounded-full w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 border border-border transition-all duration-100 group active:bg-primary active:text-white"
                  onClick={() => navigate('/favorites')}
                >
                  <Lottie animationData={likeIconAnimation} loop autoplay style={{ width: 22, height: 22 }} />
                  {user && favorites.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-secondary rounded-full text-[10px] text-white flex items-center justify-center animate-pulse-glow font-bold shadow-neon">{favorites.length}</span>
                  )}
                </Button>

                {/* Refer Icon - Only show when NOT admin */}
                {!isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="icon-btn relative rounded-full w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 border border-border transition-all duration-100 group active:bg-green-500/20"
                    onClick={() => {
                      if (user) {
                        navigate('/referral');
                      } else if (employerUser) {
                        navigate('/employer/referral');
                      } else {
                        setShowWelcomePromo(true);
                      }
                    }}
                  >
                    <LottieGiftIcon size={22} className="relative z-10" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="icon-btn text-secondary rounded-full w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 border border-border transition-all duration-100 group p-0 active:bg-secondary active:text-white"
                  onClick={() => {
                    if (user) {
                      navigate('/profile');
                    } else if (employerUser) {
                      navigate('/employer-portal');
                    }
                  }}
                >
                  {user && profile?.profile_image_url ? (
                    <Avatar className="w-full h-full">
                      <SafeAvatarImage
                        src={profile.profile_image_url}
                        alt="Profile"
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-secondary/20 text-secondary font-semibold text-xs xs:text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (user || employerUser) ? (
                    <Avatar className="w-full h-full">
                      <AvatarFallback className="bg-secondary/20 text-secondary font-semibold text-xs xs:text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="w-5 h-5 xs:w-5.5 xs:h-5.5 relative z-10 transition-transform group-hover:scale-110" />
                  )}
                </Button>

                {/* Admin Crown Icon - Only show for admin users */}
                {isAdmin && user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="icon-btn text-yellow-600 rounded-full w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 border border-border transition-all duration-100 group relative active:bg-yellow-500/20"
                      >
                        <Crown className={`w-5 h-5 xs:w-5.5 xs:h-5.5 relative z-10 ${adminRole === 'owner' ? 'text-yellow-600' : 'text-blue-600'}`} />
                        {adminRole === 'owner' && (
                          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-yellow-600/20 rounded-full animate-pulse"></div>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 glass" align="end" forceMount>
                      <div className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Crown className={`h-4 w-4 ${adminRole === 'owner' ? 'text-yellow-600' : 'text-blue-600'}`} />
                          <span className="text-sm font-medium">
                            {adminRole === 'owner' ? 'Owner Access' : 'Admin Access'}
                          </span>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/owner-portal')}>
                        <Shield className="mr-2 h-4 w-4" />
                        Owner Portal
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/owner-portal/website-users')}>
                        <User className="mr-2 h-4 w-4" />
                        Website Users
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/owner-portal/employer-members')}>
                        <Building2 className="mr-2 h-4 w-4" />
                        Employers
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
              </>
            ) : (
               // Unauthenticated Login Button - Opens Welcome Promo Modal
               <>
                   <Button
                    variant="primary"
                    size="sm"
                    className="rounded-full h-[40px] sm:h-[44px] pl-[16px] pr-[20px] sm:px-6 text-[length:14px] sm:text-[length:15px] font-semibold tracking-wide active:scale-95 transition-all duration-200 animate-fade-in gap-2 shadow-glow mr-[10px] sm:mr-3 [&_svg]:size-[18px]"
                    onClick={() => setShowWelcomePromo(true)}
                  >
                    <LogIn />
                    Log in
                  </Button>
               </>
            )}
          </div>
        </div>

        {/* Mobile Search with Glass Effect - Only visible when at top */}
        {!hideSearch && scrollY < 50 && (
          <div className={`md:hidden transition-all duration-500 ${isScrolled ? 'mt-2' : 'mt-4'}`}>
            <div 
              className="flex items-center space-x-2 glass rounded-2xl px-4 py-3 border border-primary/30 cursor-pointer hover:border-primary hover:shadow-glow transition-all duration-300 group"
              onClick={() => navigate('/search')}
            >
              <LottieSearchIcon size={20} />
              <div className="flex-1 py-1 text-muted-foreground text-sm group-hover:text-foreground transition-colors">
                {animatedPlaceholder}
              </div>
              <div className="absolute inset-0 bg-gradient-primary rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            </div>
          </div>
        )}
      </div>
      
      <QuickSearch
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
      
      {/* Welcome Promo Modal - shown when Login/Signup clicked */}
      <WelcomePromoModal 
        isLoggedIn={!!isAnyUserLoggedIn}
        isOpen={showWelcomePromo}
        onClose={() => setShowWelcomePromo(false)}
      />
      </header>
  );
};

export default Header;
