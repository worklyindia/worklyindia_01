import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Cookie, X, Settings, Check, Shield, BarChart3, Target, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const CookieConsent = () => {
  const [showConsent, setShowConsent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: true,
    advertising: true,
    functional: true
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Show consent banner after a slight delay for better UX
      const timer = setTimeout(() => setShowConsent(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    const consentData = {
      timestamp: new Date().toISOString(),
      preferences: {
        necessary: true,
        analytics: true,
        advertising: true,  
        functional: true
      }
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
    setShowConsent(false);
    
    // Initialize Google Analytics/AdSense if user accepts
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': 'granted'
      });
    }
  };

  const acceptSelected = () => {
    const consentData = {
      timestamp: new Date().toISOString(),
      preferences
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
    setShowConsent(false);
    setShowSettings(false);
    
    // Update Google consent based on user preferences
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': preferences.analytics ? 'granted' : 'denied',
        'ad_storage': preferences.advertising ? 'granted' : 'denied'
      });
    }
  };

  const rejectNonEssential = () => {
    const consentData = {
      timestamp: new Date().toISOString(),
      preferences: {
        necessary: true,
        analytics: false,
        advertising: false,
        functional: false
      }
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
    setShowConsent(false);
    
    // Deny all non-essential cookies
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'denied',
        'ad_storage': 'denied'
      });
    }
  };

  if (!showConsent) return null;

  return (
    <>
      {/* Cookie Consent Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
        <div className="max-w-5xl mx-auto">
          <Card className="glass backdrop-blur-xl bg-gradient-to-br from-white/95 via-white/90 to-white/95 border border-white/30 shadow-large hover:shadow-glow transition-smooth overflow-hidden">
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-gradient-primary opacity-5 animate-pulse-glow"></div>
            
            <div className="relative p-6 lg:p-8">
              <div className="flex items-start gap-4 lg:gap-6">
                {/* Enhanced Cookie Icon */}
                <div className="relative shrink-0 group">
                  <div className="absolute inset-0 bg-gradient-primary rounded-xl opacity-20 group-hover:opacity-30 transition-smooth animate-pulse"></div>
                  <div className="relative p-3 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl shadow-soft">
                    <Cookie className="w-7 h-7 text-primary animate-bounce-in" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* Enhanced Title */}
                  <h3 className="text-xl lg:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-3 animate-fade-in">
                    🍪 We value your privacy
                  </h3>
                  
                  {/* Enhanced Description */}
                  <p className="text-sm lg:text-base text-muted-foreground mb-6 leading-relaxed animate-fade-in">
                    We use <span className="font-semibold text-primary">essential cookies</span> to make our site work perfectly for you. 
                    We'd also love to use <span className="font-semibold text-secondary">analytics</span> and 
                    <span className="font-semibold text-accent-pink"> personalization cookies</span> to improve your experience and show you relevant job opportunities. 
                    <br />
                    <a href="/privacy" className="inline-flex items-center text-primary hover:text-secondary transition-smooth hover:underline decoration-2 underline-offset-2 mt-2">
                      Learn more in our Privacy Policy 
                      <Settings className="w-3 h-3 ml-1" />
                    </a>
                  </p>
                  
                  {/* Enhanced Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
                    <Button
                      onClick={acceptAll}
                      className="btn-payment group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                      <Check className="w-4 h-4 mr-2 animate-bounce-in" />
                      <span className="font-semibold">Accept All Cookies</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => setShowSettings(true)}
                      className="border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-smooth group"
                    >
                      <Settings className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                      <span className="font-medium">Customize Preferences</span>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      onClick={rejectNonEssential}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-smooth"
                    >
                      Only Essential
                    </Button>
                  </div>
                </div>
                
                {/* Enhanced Close Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowConsent(false)}
                  className="shrink-0 hover:bg-destructive/10 hover:text-destructive transition-smooth group"
                >
                  <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Enhanced Cookie Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-3xl glass backdrop-blur-xl bg-gradient-to-br from-white/95 to-white/90 border border-white/30 shadow-large animate-scale-in">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-soft">
                <Cookie className="w-6 h-6 text-white" />
              </div>
              <span className="bg-gradient-primary bg-clip-text text-transparent">Cookie Preferences</span>
            </DialogTitle>
            <p className="text-muted-foreground mt-2">
              Take control of your privacy. Choose which cookies you'd like us to use to enhance your experience.
            </p>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Necessary Cookies - Always enabled */}
            <div className="group p-5 bg-gradient-to-r from-success/5 to-success/10 border border-success/20 rounded-xl transition-smooth hover:shadow-soft">
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="p-2 bg-success/10 rounded-lg shrink-0">
                    <Shield className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      Necessary Cookies
                      <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full font-medium">Always On</span>
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Essential for basic website functionality, security, and your login sessions. These keep everything running smoothly.
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={true} 
                  disabled={true}
                  className="opacity-50 pointer-events-none"
                />
              </div>
            </div>
            
            {/* Analytics Cookies */}
            <div className={`group p-5 border rounded-xl transition-smooth hover:shadow-soft ${
              preferences.analytics 
                ? 'bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20' 
                : 'bg-muted/20 border-border'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    preferences.analytics ? 'bg-primary/10' : 'bg-muted/30'
                  }`}>
                    <BarChart3 className={`w-5 h-5 ${
                      preferences.analytics ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">Analytics Cookies</h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Help us understand how you use our site so we can make it better. We use Google Analytics to see which features you love most.
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={preferences.analytics}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, analytics: checked }))
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>
            
            {/* Advertising Cookies */}
            <div className={`group p-5 border rounded-xl transition-smooth hover:shadow-soft ${
              preferences.advertising 
                ? 'bg-gradient-to-r from-secondary/5 to-secondary/10 border-secondary/20' 
                : 'bg-muted/20 border-border'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    preferences.advertising ? 'bg-secondary/10' : 'bg-muted/30'
                  }`}>
                    <Target className={`w-5 h-5 ${
                      preferences.advertising ? 'text-secondary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">Advertising Cookies</h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Used by Google AdSense to show you relevant job ads and opportunities. These help us keep the site free for everyone.
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={preferences.advertising}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, advertising: checked }))
                  }
                  className="data-[state=checked]:bg-secondary"
                />
              </div>
            </div>
            
            {/* Functional Cookies */}
            <div className={`group p-5 border rounded-xl transition-smooth hover:shadow-soft ${
              preferences.functional 
                ? 'bg-gradient-to-r from-accent-pink/5 to-accent-pink/10 border-accent-pink/20' 
                : 'bg-muted/20 border-border'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    preferences.functional ? 'bg-accent-pink/10' : 'bg-muted/30'
                  }`}>
                    <Zap className={`w-5 h-5 ${
                      preferences.functional ? 'text-accent-pink' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">Functional Cookies</h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Enable cool features like location-based job recommendations, personalized content, and remembering your preferences.
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={preferences.functional}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, functional: checked }))
                  }
                  className="data-[state=checked]:bg-accent-pink"
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-6 border-t border-border/50">
              <Button 
                onClick={acceptSelected} 
                className="btn-payment flex-1 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <Check className="w-4 h-4 mr-2" />
                Save My Preferences
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowSettings(false)}
                className="hover:bg-muted/50 transition-smooth"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsent;