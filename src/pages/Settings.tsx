import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 

  Download,
  Mail,
  Lock,
  CreditCard,
  LogOut,
  Smartphone,
  ArrowLeft

} from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";
import { NotificationChannelsCard } from "@/components/NotificationChannelsCard";
import { TelegramNotificationSection } from "@/components/TelegramNotificationSection";
import usePhoneVerifySetting from "@/hooks/usePhoneVerifySetting";

import { downloadUserData } from "@/utils/downloadUserData";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { TwoFactorAuthToggle } from "@/components/TwoFactorAuthToggle";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { DeleteAccountCountdown } from "@/components/DeleteAccountCountdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { LastLoginInfo } from "@/components/LastLoginInfo";

const Settings = () => {
  const { phoneVerifyEnabled: phoneChangeUnlocked } = usePhoneVerifySetting('phone_verify_jobseeker_profile');
  const { settings, loading, updateSetting, refetchSettings } = useUserSettings();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);
  const [dataSaverEnabled, setDataSaverEnabled] = useState(() => {
    try {
      return localStorage.getItem('workly-data-saver') === 'true';
    } catch {
      return false;
    }
  });

  const handleDataSaverChange = (enabled: boolean) => {
    setDataSaverEnabled(enabled);
    try {
      localStorage.setItem('workly-data-saver', String(enabled));
    } catch {
      // Keep the current session setting even when browser storage is unavailable.
    }
    window.dispatchEvent(new Event('workly-data-saver-change'));
  };
  
  // Persist active tab across page refreshes
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('settings-active-tab') || 'notifications';
  });

  useEffect(() => {
    sessionStorage.setItem('settings-active-tab', activeTab);
  }, [activeTab]);

  // Fetch password changed date
  useEffect(() => {
    const fetchPasswordDate = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('user_settings')
        .select('password_changed_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.password_changed_at) {
        setPasswordChangedAt(data.password_changed_at);
      }
    };
    
    fetchPasswordDate();
  }, [user?.id]);

  const notificationSettings = [
    {
      title: "Email Notifications",
      description: "Receive updates via email",
      enabled: settings?.email_notifications ?? true,
      key: 'email_notifications' as const
    },
    {
      title: "Push Notifications",
      description: "Get notifications on your device",
      enabled: settings?.push_notifications ?? true,
      key: 'push_notifications' as const
    },
    {
      title: "Job Alerts",
      description: "Get notified about matching jobs",
      enabled: settings?.job_alerts ?? true,
      key: 'job_alerts' as const
    },
    {
      title: "Marketing Communications",
      description: "Receive tips and product updates",
      enabled: settings?.marketing_communications ?? false,
      key: 'marketing_communications' as const
    }
  ];

  const privacySettings = [
    {
      title: "Profile Visibility",
      description: "Allow recruiters to find your profile",
      enabled: settings?.profile_visibility ?? true,
      key: 'profile_visibility' as const
    },
    {
      title: "Activity Status",
      description: "Show when you're actively job searching",
      enabled: settings?.activity_status ?? true,
      key: 'activity_status' as const
    },
    {
      title: "Contact Information",
      description: "Allow companies to contact you directly",
      enabled: settings?.contact_information ?? false,
      key: 'contact_information' as const
    }
  ];

  const handleDownloadData = async () => {
    try {
      await downloadUserData();
      toast({
        title: "Success",
        description: "Your data has been downloaded",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download data",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const pageHeader = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 hover:bg-muted">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold leading-tight">Settings</h1>
        <p className="truncate text-xs text-muted-foreground">
          Notifications, privacy & account
        </p>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-background">
      {pageHeader}
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-8 max-w-4xl">
        {/* Deletion Warning Banner */}
        <DeleteAccountCountdown userId={user?.id} variant="banner" />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="notifications" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Notifications</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Privacy</TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationChannelsCard
              audience="job_seeker"
              userId={user?.id || null}
              emailEnabled={settings?.email_notifications ?? true}
              loading={loading}
              onChanged={refetchSettings}
            />

            <TelegramNotificationSection userType="profile" userId={user?.id || null} />

            <PushNotificationSettings />
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Privacy Controls</h2>
              
              <div className="space-y-6">
                {privacySettings.map((setting, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-medium text-foreground">{setting.title}</h3>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <Switch 
                      checked={setting.enabled} 
                      onCheckedChange={(checked) => updateSetting(setting.key, checked)}
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Data Management</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-xl">
                  <div className="flex items-center space-x-3">
                    <Download className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-medium text-foreground">Download My Data</h4>
                      <p className="text-sm text-muted-foreground">Get a copy of your personal data</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={handleDownloadData}>
                    Download
                  </Button>
                </div>

                <DeleteAccountSection userId={user?.id} userType="employee" />
              </div>
            </Card>
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">Data Saver</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reduce mobile data use by stopping automatic background page preloading.
                  </p>
                </div>
                <Switch
                  checked={dataSaverEnabled}
                  onCheckedChange={handleDataSaverChange}
                  aria-label="Enable Data Saver"
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground" role="status">
                {dataSaverEnabled ? 'Data Saver is on. Pages load when you open them.' : 'Data Saver is off. Frequently used pages may preload in the background.'}
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Account Security</h2>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-xl">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-foreground">Email Address</h4>
                      <p className="text-sm text-muted-foreground truncate">{user?.email || 'Not set'}</p>
                    </div>
                  </div>
                    <Button onClick={() => navigate('/settings/account/email')} variant="outline" size="sm" className="rounded-xl w-full sm:w-auto flex-shrink-0">
                      Change
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-xl">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <Smartphone className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-foreground">Mobile Number</h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {user?.phone ? `+${String(user.phone).replace(/\D/g, '')}` : 'Not linked'}
                      </p>
                    </div>
                  </div>
                    <Button
                      onClick={() => navigate('/settings/account/mobile')}
                      variant="outline"
                      size="sm"
                      className="rounded-xl w-full sm:w-auto flex-shrink-0"
                      disabled={!phoneChangeUnlocked}
                    >
                      {!phoneChangeUnlocked ? 'Locked' : user?.phone ? 'Change' : 'Add'}
                    </Button>
                </div>


                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-xl">
                  <div className="flex items-center space-x-3 flex-1">
                    <Lock className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">Password</h4>
                      <p className="text-sm text-muted-foreground">
                        {passwordChangedAt 
                          ? `Last changed ${format(new Date(passwordChangedAt), 'dd MMMM yyyy hh:mm:ss a')}`
                          : 'Never changed'}
                      </p>
                    </div>
                  </div>
                    <Button onClick={() => navigate('/settings/account/password')} variant="outline" size="sm" className="rounded-xl w-full sm:w-auto flex-shrink-0">
                      Change
                    </Button>
                </div>

                <TwoFactorAuthToggle
                  userType="job_seeker"
                  userId={user?.id || null}
                  profileSetupPath="/JobSeeker/Profile/Edit/1"
                  hideConnectTelegram={true}
                />
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Subscription</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-xl">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-medium text-foreground">Current Plan</h4>
                      <p className="text-sm text-muted-foreground">Free Plan - Basic features</p>
                    </div>
                  </div>
                  <Button className="rounded-xl">
                    Upgrade
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 border-red-200">
              <h3 className="text-lg font-semibold text-foreground mb-4">Danger Zone</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <LogOut className="w-5 h-5 text-red-600" />
                      <div>
                        <h4 className="font-medium text-foreground">Sign Out</h4>
                        <p className="text-sm text-muted-foreground">Sign out from all devices</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </div>
                  <LastLoginInfo userId={user?.id} />
                </div>

                <DeleteAccountSection userId={user?.id} userType="employee" />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
