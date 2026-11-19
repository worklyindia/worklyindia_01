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
import { useNavigate, useSearchParams } from "react-router-dom";
import { isWorklyAndroidApp, getWorklyAndroidBridge } from "@/lib/nativeAppBridge";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { LastLoginInfo } from "@/components/LastLoginInfo";

const Settings = () => {
  const { phoneVerifyEnabled: phoneChangeUnlocked } = usePhoneVerifySetting('phone_verify_jobseeker_profile');
  const { settings, loading, updateSetting, refetchSettings } = useUserSettings();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [chargingAlertSettings, setChargingAlertSettings] = useState({ chargingStart: true, chargerDisconnect: true, batteryFull: true, silentMode: false, monitorEnabled: true });
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  
  useEffect(() => {
    if (!isWorklyAndroidApp()) return;
    setBiometricLockEnabled(getWorklyAndroidBridge()?.isBiometricLockEnabled?.() ?? false);
  }, []);

  useEffect(() => {
    if (!isWorklyAndroidApp()) return;
    const raw = getWorklyAndroidBridge()?.getChargingAlertSettings?.();
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      setChargingAlertSettings({
        chargingStart: saved.chargingStart !== false,
        chargerDisconnect: saved.chargerDisconnect !== false,
        batteryFull: saved.batteryFull !== false,
        silentMode: saved.silentMode === true,
        monitorEnabled: saved.monitorEnabled !== false,
      });
    } catch {
      console.warn("Could not parse saved native charging alert settings");
    }
  }, []);

  const updateChargingAlertSetting = (key: keyof typeof chargingAlertSettings, enabled: boolean) => {
    const next = { ...chargingAlertSettings, [key]: enabled };
    setChargingAlertSettings(next);
    const bridge = getWorklyAndroidBridge();
    if (!bridge?.saveChargingAlertSettings?.(next.chargingStart, next.chargerDisconnect, next.batteryFull, next.silentMode, next.monitorEnabled)) {
      toast({ title: "Settings could not be saved", description: "Please reopen the app and try again.", variant: "destructive" });
      const raw = bridge?.getChargingAlertSettings?.();
      if (raw) {
        try { setChargingAlertSettings(JSON.parse(raw)); } catch { /* Keep the last visible state. */ }
      }
    }
  };

  const handleBiometricLockChange = (enabled: boolean) => {
    const bridge = getWorklyAndroidBridge();
    if (!bridge?.setBiometricLockEnabled || !bridge.setBiometricLockEnabled(enabled)) {
      toast({ title: "Biometric lock unavailable", description: "Set up a screen lock, fingerprint or face unlock on your Android device first.", variant: "destructive" });
      return;
    }
    setBiometricLockEnabled(enabled);
  };

  // Persist active tab across page refreshes
  const [activeTab, setActiveTab] = useState(() => {
    if (isWorklyAndroidApp() && searchParams.get('tab') === 'app') return 'app';
    const savedTab = sessionStorage.getItem('settings-active-tab') || 'notifications';
    return !isWorklyAndroidApp() && savedTab === 'app' ? 'notifications' : savedTab;
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
          <TabsList className={`grid w-full ${isWorklyAndroidApp() ? 'grid-cols-4' : 'grid-cols-3'} h-auto p-1`}>
            {isWorklyAndroidApp() && <TabsTrigger value="app" className="text-xs sm:text-sm px-1 sm:px-3 py-2">App Settings</TabsTrigger>}
            <TabsTrigger value="notifications" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Notifications</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Privacy</TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Account</TabsTrigger>
          </TabsList>

          {isWorklyAndroidApp() && <TabsContent value="app" className="space-y-6">
            <Card className="p-4 sm:p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-foreground">Battery Protection Alerts</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose which sounds play when your charger is connected, disconnected, or the battery reaches 100%.</p>
              </div>
              {isWorklyAndroidApp() && (
                <div className="space-y-5">
                  {([
                    { key: "chargingStart", title: "Charging Start Alert", description: "Play an audio alert when charging starts." },
                    { key: "chargerDisconnect", title: "Charger Disconnect Alert", description: "Play an audio alert when the charger is unplugged." },
                    { key: "batteryFull", title: "100% Battery Alert", description: "Play the repeating alarm and voice when the battery is fully charged." },
                  ] as const).map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground">{setting.title}</h3>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                      <Switch
                        checked={chargingAlertSettings.monitorEnabled && !chargingAlertSettings.silentMode ? chargingAlertSettings[setting.key] : false}
                        disabled={!chargingAlertSettings.monitorEnabled || chargingAlertSettings.silentMode}
                        onCheckedChange={(enabled) => updateChargingAlertSetting(setting.key, enabled)}
                        aria-label={setting.title}
                      />
                    </div>
                  ))}
                  <div className="border-t border-border pt-5">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground">Charging Monitor and Hide Notification</h3>
                        <p className="text-sm text-muted-foreground">Turn monitoring on or off. When off, battery monitoring stops and its notification is removed from the notification panel.</p>
                      </div>
                      <Switch
                        checked={chargingAlertSettings.monitorEnabled}
                        onCheckedChange={(enabled) => updateChargingAlertSetting("monitorEnabled", enabled)}
                        aria-label="Charging Monitor and Hide Notification"
                      />
                    </div>
                    {!chargingAlertSettings.monitorEnabled && <p className="mb-5 text-sm text-muted-foreground" role="status">Charging Monitor is off. Battery monitoring and charging alerts are stopped, and its notification has been removed.</p>}
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground">Silent Charging Mode</h3>
                        <p className="text-sm text-muted-foreground">Disable all charging sounds while keeping battery monitoring active.</p>
                      </div>
                      <Switch
                        checked={chargingAlertSettings.silentMode}
                        onCheckedChange={(enabled) => updateChargingAlertSetting("silentMode", enabled)}
                        aria-label="Silent Charging Mode"
                      />
                    </div>
                    {chargingAlertSettings.monitorEnabled && chargingAlertSettings.silentMode && (
                      <p className="mt-3 text-sm text-muted-foreground" role="status">Silent Mode is on. Charging sounds are muted while battery monitoring continues.</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>}

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

            {isWorklyAndroidApp() && <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">Biometric App Lock</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Protect Workly India with fingerprint, face unlock or your Android screen lock whenever you reopen the app.</p>
                </div>
                <Switch checked={biometricLockEnabled} onCheckedChange={handleBiometricLockChange} aria-label="Enable biometric app lock" />
              </div>
            </Card>}

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
