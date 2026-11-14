import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEmployerManagement } from "@/hooks/useEmployerManagement";
import AdminAccessButton from "@/components/AdminAccessButton";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppUnreadTotal } from "@/hooks/useWhatsAppUnreadTotal";
import { ROUTE_PERMISSIONS, isOwnerOnlyRoute, isPaymentEventsMenuVisible } from "@/utils/permissionMapping";
import { 
  Crown,
  Bell,
  Plus,
  ArrowLeft,
  MoreVertical,
  Menu,
  Eye,
  TrendingUp,
  Users,
  CreditCard,
  Settings,
  Package,
  Zap,
  ShieldCheck,
  Youtube,
  MessageSquare,
  Mail,
  Calendar,
  Phone,
  HelpCircle,
  FileText,
  Shield,
  Star,
  DollarSign,
  Building,
  Trophy,
  Palette,
  Lock,
  Activity,
  Search,
  Image,
  Bot,
  Send,
  BarChart3,
  Heart,
  HardDrive,
  Bug,
  Smartphone,

} from "lucide-react";

const OwnerPortal = () => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const { isAdmin, loading: adminLoading } = useAdminStatus();
  const { user, profile } = useAuth();
  const [adminRole, setAdminRole] = useState<string>('');
  const { checkPermission, isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const [menuPermissions, setMenuPermissions] = useState<Record<string, boolean>>({});
  const [isOwner, setIsOwner] = useState(false);
  
  // Get employer management data for stats
  const { employers, totalCount } = useEmployerManagement();

  // Preload critical owner-portal pages for better performance
  useEffect(() => {
    // Preload OwnerAnalyticsDashboard
    import("@/pages/owner-portal/OwnerAnalyticsDashboard");
  }, []);

  // Check admin status and role
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setAdminRole('');
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        // The signed-in user's database role is the source of truth.
        // Always clear stale roles when the account has no valid admin row.
        setAdminRole(data && ['admin', 'owner'].includes(data.role) ? data.role : '');
      } catch (error) {
        console.error('Error checking admin status:', error);
        setAdminRole('');
      }
    };
    
    checkAdminStatus();
  }, [user]);

  // Check permissions for all menu items
  useEffect(() => {
    const checkAllPermissions = async () => {
      if (!user) {
        setIsOwner(false);
        setMenuPermissions({});
        return;
      }

      try {
        // Use the same admin_users role already verified for the signed-in account.
        // This avoids a second, potentially racing owner check that can leave menu items locked.
        const ownerStatus = adminRole === 'owner';
        setIsOwner(ownerStatus);

        // If owner, grant all permissions (including routes not in ROUTE_PERMISSIONS)
        if (ownerStatus) {
          const allPermissions: Record<string, boolean> = {};
          // Grant permission for all known routes
          Object.keys(ROUTE_PERMISSIONS).forEach(route => {
            allPermissions[route] = true;
          });
          // Also grant permissions for any routes used in menuSections
          const menuRoutes = [
            '/owner-portal/invite-member',
            '/owner-portal/create-role',
            '/owner-portal/payment-recovery',
            '/owner-portal/autonomous-agent',
            '/owner-portal/whatsapp/chat',
            '/owner-portal/whatsapp/templates',
            '/owner-portal/whatsapp/settings',
            '/owner-portal/universal-lookup',
            '/owner-portal/donation-campaigns',
            '/owner-portal/payment-events',
          ];
          menuRoutes.forEach(route => {
            allPermissions[route] = true;
          });
          setMenuPermissions(allPermissions);
          return;
        }

        // Check each route permission
        const permissions: Record<string, boolean> = {};
        for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
          // Owner-only routes are not accessible to non-owners
          if (isOwnerOnlyRoute(route)) {
            permissions[route] = false;
          } else {
            const hasPermission = await checkPermission(permission);
            permissions[route] = hasPermission;
          }
        }
        setMenuPermissions(permissions);
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    };

    if (!permissionsLoading) {
      checkAllPermissions();
    }
  }, [user, adminRole, checkPermission, permissionsLoading]);

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
    return 'A';
  };

  // Menu sections data — grouped by category with short, clear names
  const waUnread = useWhatsAppUnreadTotal({ owner: true });
  const menuSections = [
    {
      title: "Dashboard & Reports",
      items: [
        { name: "Analytics Overview", icon: TrendingUp, path: "/owner-portal/analytics-dashboard" },
        { name: "Domain Sales", icon: BarChart3, path: "/owner-portal/domain-sales" },
        { name: "AI Access Logs", icon: Activity, path: "/owner-portal/ai-access-monitoring" }
      ]
    },
    {
      title: "Users",
      items: [
        { name: "Profile Lookup", icon: Search, path: "/owner-portal/universal-lookup" },
        { name: "Employers", icon: Building, path: "/owner-portal/employer-members" },
        { name: "Website Users", icon: Users, path: "/owner-portal/website-users" },
        { name: "Auth Users", icon: Shield, path: "/owner-portal/auth-users", badge: "Owner" }
      ]
    },
    {
      title: "App Monitoring",
      items: [
        { name: "App Error Details", icon: Bug, path: "/owner-portal/app-error-details", badge: "Owner" },
        { name: "App User Details", icon: Smartphone, path: "/owner-portal/app-user-details", badge: "Owner" }
      ]
    },
    {
      title: "Team & Access",
      items: [
        { name: "Team & Roles", icon: Users, path: "/owner-portal/team-management", badge: "Owner" },
        { name: "Invite Member", icon: Plus, path: "/owner-portal/invite-member" },
        { name: "Create Role", icon: ShieldCheck, path: "/owner-portal/create-role" }
      ]
    },
    {
      title: "Jobs & Interviews",
      items: [
        { name: "Job Posting Settings", icon: Settings, path: "/owner-portal/job-posting-settings" },
        { name: "Interview Pricing", icon: Calendar, path: "/owner-portal/interview-pricing" }
      ]
    },
    {
      title: "Payments & Revenue",
      items: [
        { name: "Revenue Tracking", icon: DollarSign, path: "/owner-portal/revenue-tracking" },
        { name: "User Payments", icon: CreditCard, path: "/owner-portal/user-payments" },
        { name: "Payment Recovery", icon: DollarSign, path: "/owner-portal/payment-recovery" },
        { name: "Referral Withdrawals", icon: DollarSign, path: "/owner-portal/referral-withdrawals" },
        { name: "Competition Prizes", icon: Trophy, path: "/owner-portal/competition-prizes" },
        { name: "Donations", icon: Heart, path: "/owner-portal/donation-campaigns" }
      ]
    },
    {
      title: "Packages & Pricing",
      items: [
        { name: "Boost Packages", icon: Zap, path: "/owner-portal/boost-packages" },
        { name: "Verified Badge Packages", icon: ShieldCheck, path: "/owner-portal/verification-packages" },
        { name: "AI Chat Plans", icon: CreditCard, path: "/owner-portal/ai-chat-plans" },
        { name: "Referral Settings", icon: Star, path: "/owner-portal/referral-settings" },
        { name: "AI Pricing", icon: Zap, path: "/owner-portal/ai-pricing", badge: "Owner" },
        { name: "API Subscription", icon: CreditCard, path: "/owner-portal/api-pricing" }
      ]
    },
    {
      title: "Notifications",
      items: [
{ name: "Push Templates", icon: Bell, path: "/owner-portal/push-templates" },
        { name: "Email Templates", icon: Mail, path: "/owner-portal/email-templates" },
        { name: "Verify OTP", icon: ShieldCheck, path: "/owner-portal/verify-otp" },
        { name: "TG Templates", icon: Send, path: "/owner-portal/telegram-templates" }
      ]
    },
    {
      title: "WhatsApp",
      items: [
        { name: "Workly Chat", icon: MessageSquare, path: "/owner-portal/whatsapp/chat", badge: waUnread > 0 ? (waUnread > 99 ? "99+" : String(waUnread)) : "Live" },
        { name: "WA Templates", icon: FileText, path: "/owner-portal/whatsapp/templates" },
        { name: "WA Settings", icon: Settings, path: "/owner-portal/whatsapp/settings" }
      ]
    },
    {
      title: "AI Tools",
      items: [
        { name: "AI Tricks", icon: Bot, path: "/owner-portal/ai-tricks" },
        { name: "AI Chat Settings", icon: MessageSquare, path: "/owner-portal/ai-chat-settings" },
        { name: "Autonomous Agent", icon: Bot, path: "/owner-portal/autonomous-agent" }
      ]
    },
    {
      title: "Website Content",
      items: [
        { name: "Hero Banners", icon: Image, path: "/owner-portal/hero-banners" },
        { name: "Trust Badges", icon: ShieldCheck, path: "/owner-portal/trust-badges" },
        { name: "Home Page Video", icon: Youtube, path: "/owner-portal/home-video" },
        { name: "Home Image", icon: Image, path: "/owner-portal/home-image" },
        { name: "Job Seekers Image", icon: Image, path: "/owner-portal/home-seekers-image" },
        { name: "Brand & Logo", icon: Palette, path: "/owner-portal/brand-management" },
        { name: "Contact Info", icon: Phone, path: "/owner-portal/contact-info" }
      ]
    },
    {
      title: "Domains",
      items: [
        { name: "Domain Settings", icon: Settings, path: "/owner-portal/domain-settings" },
        { name: "Pricing & Margin", icon: DollarSign, path: "/owner-portal/domain-pricing" }
      ]
    },
    {
      title: "Support",
      items: [
        { name: "Support Tickets", icon: HelpCircle, path: "/owner-portal/support-tickets" },
        { name: "Workly Email", icon: Mail, path: "/owner-portal/workly-email", badge: "Live" },
        { name: "Customer Service", icon: HelpCircle, path: "/owner-portal/customer-service" }
      ]
    },
    {
      title: "System & Logs",
      items: [
        { name: "Site Settings", icon: Settings, path: "/admin-settings" },
        { name: "Storage & Files", icon: HardDrive, path: "/owner-portal/storage" },
        { name: "Android App Updates", icon: Package, path: "/owner-portal/android-app-updates", badge: "Owner" },
        { name: "Cloudflare CDN Storage & Files", icon: HardDrive, path: "/owner-portal/cloudflare-storage" },
        { name: "Secrets", icon: Lock, path: "/owner-portal/secrets" },

        { name: "Function Logs", icon: FileText, path: "/owner-portal/function-logs" },
        { name: "Razorpay Payment Events", icon: Activity, path: "/owner-portal/payment-events" },
        { name: "PayPal Payment Events", icon: Activity, path: "/owner-portal/paypal-payment-events" }
      ]
    }
  ];

  // Mobile header component with conditional back button
  const MobileHeader = () => {
    const currentPath = window.location.pathname;
    const isHomePage = currentPath === '/owner-portal';
    
    return (
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/10 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo with conditional back button and menu */}
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full w-10 h-10 hover:bg-muted/80"
              onClick={() => setShowMenu(!showMenu)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            {!isHomePage && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-10 h-10 hover:bg-muted/80"
                onClick={() => navigate('/owner-portal')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
           <div 
            className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/owner-portal')}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold font-display text-primary">OwnerPortal</h1>
              <p className="text-xs text-muted-foreground">Platform Control</p>
            </div>
          </div>
        </div>
        
        {/* Action Icons */}
        <div className="flex items-center space-x-2">
          
          
          {/* Admin Profile Dropdown - Mobile */}
          {isAdmin && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full w-10 h-10 hover:bg-muted/80 relative"
                >
                  {profile?.profile_image_url ? (
                    <Avatar className="w-full h-full">
                      <AvatarImage 
                        src={profile.profile_image_url} 
                        alt="Admin Profile"
                        className="object-cover"
                      />
                       <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold text-xs">
                         {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                     <div className="w-full h-full bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                       <span className="text-primary-foreground font-semibold text-xs">{getUserInitials()}</span>
                    </div>
                  )}
                  <Crown className={`absolute -top-1 -right-1 w-4 h-4 ${adminRole === 'owner' ? 'text-yellow-500' : 'text-blue-500'}`} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Crown className={`h-4 w-4 ${adminRole === 'owner' ? 'text-yellow-600' : 'text-blue-600'}`} />
                    <span className="text-sm font-medium">
                      {adminRole === 'owner' ? 'Owner Access' : 'Admin Access'}
                    </span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Users className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/owner-portal/website-users')}>
                  <Users className="mr-2 h-4 w-4" />
                  Website Users
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/owner-portal/employer-members')}>
                  <Building className="mr-2 h-4 w-4" />
                  Employers
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/owner-portal')}>
                  <Shield className="mr-2 h-4 w-4" />
                  Owner Portal Home
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
    );
  };

  // Desktop header component with conditional back button
  const DesktopHeader = () => {
    const currentPath = window.location.pathname;
    const isHomePage = currentPath === '/owner-portal';
    
    return (
      <div className="hidden md:block sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Breadcrumbs */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted/80"
                onClick={() => setShowMenu(!showMenu)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              {!isHomePage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-muted/80"
                  onClick={() => navigate('/owner-portal')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display text-primary">Owner Portal</h1>
                <p className="text-sm text-muted-foreground">Complete Platform Control</p>
              </div>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Quick Action
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full hover:bg-muted/80"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </Button>
            
            {/* Admin Profile Dropdown - Desktop */}
            {isAdmin && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 hover:bg-muted/80 h-10 px-3 rounded-lg"
                  >
                    {profile?.profile_image_url ? (
                      <Avatar className="w-8 h-8">
                        <AvatarImage 
                          src={profile.profile_image_url} 
                          alt="Admin Profile"
                          className="object-cover"
                        />
                       <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold text-sm">
                           {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                        <span className="text-primary-foreground font-semibold text-sm">{getUserInitials()}</span>
                      </div>
                    )}
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1">
                        <Crown className={`h-4 w-4 ${adminRole === 'owner' ? 'text-yellow-600' : 'text-blue-600'}`} />
                        <span className="text-sm font-medium">
                          {adminRole === 'owner' ? 'Owner' : 'Admin'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {profile?.full_name || user?.email?.split('@')[0] || 'Administrator'}
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Crown className={`h-4 w-4 ${adminRole === 'owner' ? 'text-yellow-600' : 'text-blue-600'}`} />
                      <span className="text-sm font-medium">
                        {adminRole === 'owner' ? 'Owner Access' : 'Admin Access'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {profile?.full_name || user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <Users className="mr-2 h-4 w-4" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/owner-portal/website-users')}>
                    <Users className="mr-2 h-4 w-4" />
                    Website Users
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/owner-portal/employer-members')}>
                    <Building className="mr-2 h-4 w-4" />
                    Employers
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/owner-portal')}>
                    <Shield className="mr-2 h-4 w-4" />
                    Owner Portal Home
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-muted/30 via-background to-primary/5">
      <MobileHeader />
      <DesktopHeader />
      
      {/* Navigation Menu Sheet */}
      <Sheet open={showMenu} onOpenChange={setShowMenu}>
        <SheetContent
          side="left"
          className="w-screen max-w-none overflow-x-hidden overflow-y-auto px-4 sm:w-[85vw] sm:max-w-sm sm:px-6"
        >
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-base">Owner Portal</span>
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-4 w-full min-w-0 space-y-5">
            {menuSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {section.title}
                </h3>
                 <div className="space-y-1">
                  {section.items.map((item, itemIndex) => {
                    if (!isPaymentEventsMenuVisible(item.path, isOwner && adminRole === "owner")) return null;
                    // Owner-only entries must not be visible to admins or regular users.
                    if (item.badge === "Owner" && !(isOwner && adminRole === "owner")) return null;
                    // Platform owners receive access to every Owner Portal menu item,
                    // including newer routes that have not yet been added to ROUTE_PERMISSIONS.
                    const hasPermission = adminRole === 'owner' || menuPermissions[item.path] === true;
                    const isLocked = !hasPermission;
                    
                    return (
                      <TooltipProvider key={itemIndex}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <div className="relative min-w-0">
                              <Button
                                variant="ghost"
                                 className={`h-auto w-full min-w-0 justify-start gap-2 px-3 py-2.5 ${
                                  isLocked 
                                    ? 'opacity-50 cursor-not-allowed hover:bg-transparent' 
                                    : 'hover:bg-muted/80'
                                }`}
                                onClick={() => {
                                  if (!isLocked) {
                                    navigate(item.path);
                                    setShowMenu(false);
                                  }
                                }}
                                disabled={isLocked}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                                  <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm flex-1 text-left truncate">{item.name}</span>
                                </div>
                                {item.badge && hasPermission && (
                                  <span className="text-[10px] bg-yellow-500/20 text-yellow-700 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </Button>
                            </div>
                          </TooltipTrigger>
                          {isLocked && (
                            <TooltipContent side="right">
                              <p className="text-xs">Permission Required</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
                {sectionIndex < menuSections.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Main Dashboard Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Platform Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Total Employers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display text-primary">{totalCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Registered companies</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Verified Companies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display text-success">
                  {employers?.filter(emp => emp.is_verified).length || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">With verification badge</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Active (7 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display text-secondary">
                  {employers?.filter(emp => {
                    if (!emp.last_sign_in_at) return false;
                    const daysSince = Math.floor((new Date().getTime() - new Date(emp.last_sign_in_at).getTime()) / (1000 * 3600 * 24));
                    return daysSince <= 7;
                  }).length || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recently active</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Total Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display text-warning">
                  {employers?.reduce((sum, emp) => sum + (emp.total_jobs || 0), 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Posted on platform</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3 mt-8">
            {menuPermissions['/owner-portal/employer-members'] && (
              <Card className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-primary" 
                    onClick={() => navigate('/owner-portal/employer-members')}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Manage Employers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">View and manage all registered employers and their profiles</p>
                </CardContent>
              </Card>
            )}

            {menuPermissions['/owner-portal/website-users'] && (
              <Card className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-success"
                    onClick={() => navigate('/owner-portal/website-users')}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Website Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Manage job seekers and their applications</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default OwnerPortal;