import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, Smartphone, Settings, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { JOB_CATEGORIES, LOCATIONS, SALARY_RANGES, EXPERIENCE_LEVELS } from "@/constants/categories";
import { useJobAlerts } from "@/hooks/useJobAlerts";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";

const FreeJobAlerts = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: isLoadingProfile } = useUserProfile();
  const { createJobAlert } = useJobAlerts();
  
  const [preferences, setPreferences] = useState({
    emailAlerts: true,
    smsAlerts: false,
    pushNotifications: true,
    dailyDigest: true,
    instantAlerts: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.email) {
      toast.error("Please log in to setup job alerts");
      return;
    }

    if (!profile) {
      toast.error("Please complete your profile first");
      return;
    }

    try {
      await createJobAlert.mutateAsync({
        user_id: user?.id || null,
        email: user.email,
        phone: profile.phone || null,
        job_categories: profile.industry ? [profile.industry] : [],
        locations: profile.preferred_location ? [profile.preferred_location] : profile.location ? [profile.location] : [],
        experience_levels: profile.experience_level ? [profile.experience_level.toString()] : [],
        salary_ranges: [],
        email_alerts: preferences.emailAlerts,
        sms_alerts: preferences.smsAlerts,
        push_notifications: preferences.pushNotifications,
        instant_alerts: preferences.instantAlerts,
        daily_digest: preferences.dailyDigest,
        is_active: true,
      });

      toast.success("Job alerts setup successfully!", {
        description: "You'll start receiving notifications for matching jobs."
      });
    } catch (error) {
      console.error('Error setting up job alerts:', error);
      toast.error("Failed to setup job alerts", {
        description: "Please try again later."
      });
    }
  };

  const features = [
    {
      title: "Real-time Notifications",
      description: "Get notified instantly when new jobs matching your criteria are posted",
      icon: Bell
    },
    {
      title: "Smart Filtering", 
      description: "Advanced filters to get only the most relevant job opportunities",
      icon: Settings
    },
    {
      title: "Multiple Channels",
      description: "Receive alerts via email, SMS, and push notifications",
      icon: Smartphone
    },
    {
      title: "Personalized Recommendations",
      description: "AI-powered job suggestions based on your profile and preferences",
      icon: CheckCircle
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Job Alerts" />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Free Service</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Free Job Alerts
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Never miss your dream job opportunity. Get personalized job alerts 
            delivered straight to your inbox and phone.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Alert Setup Form */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                <Bell className="w-5 h-5 mr-2 text-primary" />
                Setup Your Job Alerts
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Profile Information Display */}
                {isLoadingProfile ? (
                  <div className="text-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Loading your profile...</p>
                  </div>
                ) : profile ? (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                    <p className="text-sm font-medium text-foreground mb-2">Your job alerts will be based on your profile:</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>📧 Email: {user?.email}</p>
                      {profile.phone && <p>📱 Phone: {profile.phone}</p>}
                      {profile.industry && <p>💼 Category: {profile.industry}</p>}
                      {(profile.city || profile.state || profile.country) && (
                        <p>📍 Location: {[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}</p>
                      )}
                      {profile.experience_level > 0 && <p>⭐ Experience: {profile.experience_level} years</p>}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/10">
                    <p className="text-sm text-destructive">Please complete your profile to setup job alerts.</p>
                  </div>
                )}

                {/* Alert Preferences */}
                <div>
                  <Label className="text-base font-medium">Alert Preferences</Label>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="email-alerts"
                        checked={preferences.emailAlerts}
                        onCheckedChange={(checked) => 
                          setPreferences(prev => ({ ...prev, emailAlerts: checked as boolean }))
                        }
                      />
                      <Label htmlFor="email-alerts" className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        Email Alerts
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="sms-alerts"
                        checked={preferences.smsAlerts}
                        onCheckedChange={(checked) => 
                          setPreferences(prev => ({ ...prev, smsAlerts: checked as boolean }))
                        }
                      />
                      <Label htmlFor="sms-alerts" className="flex items-center">
                        <Smartphone className="w-4 h-4 mr-2" />
                        SMS Alerts
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="push-notifications"
                        checked={preferences.pushNotifications}
                        onCheckedChange={(checked) => 
                          setPreferences(prev => ({ ...prev, pushNotifications: checked as boolean }))
                        }
                      />
                      <Label htmlFor="push-notifications" className="flex items-center">
                        <Bell className="w-4 h-4 mr-2" />
                        Push Notifications
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <Label className="text-base font-medium">Alert Frequency</Label>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="instant-alerts"
                        checked={preferences.instantAlerts}
                        onCheckedChange={(checked) => 
                          setPreferences(prev => ({ ...prev, instantAlerts: checked as boolean }))
                        }
                      />
                      <Label htmlFor="instant-alerts" className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Instant Alerts (as jobs are posted)
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="daily-digest"
                        checked={preferences.dailyDigest}
                        onCheckedChange={(checked) => 
                          setPreferences(prev => ({ ...prev, dailyDigest: checked as boolean }))
                        }
                      />
                      <Label htmlFor="daily-digest" className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Daily Digest (once per day)
                      </Label>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={createJobAlert.isPending}
                >
                  {createJobAlert.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Setup Job Alerts
                      <Bell className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </div>

          {/* Features Sidebar */}
          <div className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/50">
              <h3 className="font-semibold text-foreground mb-4">Why Use Job Alerts?</h3>
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{feature.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <h3 className="font-semibold text-foreground mb-3">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Active Alerts</span>
                  <span className="font-medium text-foreground">50K+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Jobs Posted Daily</span>
                  <span className="font-medium text-foreground">500+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="font-medium text-foreground">85%</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default FreeJobAlerts;