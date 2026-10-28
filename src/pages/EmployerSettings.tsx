import { useState, useEffect } from 'react';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Download,
  Mail,
  Smartphone,
  Lock,
  CreditCard,
  LogOut,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import usePhoneVerifySetting from "@/hooks/usePhoneVerifySetting";
import { useEmployerSettings } from "@/hooks/useEmployerSettings";
import { NotificationChannelsCard } from "@/components/NotificationChannelsCard";
import { TelegramNotificationSection } from "@/components/TelegramNotificationSection";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { usePushInit } from "@/hooks/usePushInit";
import { TwoFactorAuthToggle } from "@/components/TwoFactorAuthToggle";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { DeleteAccountCountdown } from "@/components/DeleteAccountCountdown";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { format } from "date-fns";
import { LastLoginInfo } from "@/components/LastLoginInfo";
import PageHeader from "@/components/PageHeader";

const EmployerSettings = () => {
  const { phoneVerifyEnabled: phoneChangeUnlocked } = usePhoneVerifySetting('phone_verify_employer_profile');
  const { company, user, updateCompany, signOut, changeEmail } = useEmployerAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings, isLoading, toggleSetting, loadSettings } = useEmployerSettings();
  const { isInitialized, hasPermission } = usePushInit();
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);
  
  // Persist active tab across page refreshes
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('employer-settings-active-tab') || 'notifications';
  });

  useEffect(() => {
    sessionStorage.setItem('employer-settings-active-tab', activeTab);
  }, [activeTab]);

  // Fetch password changed date
  useEffect(() => {
    const fetchPasswordDate = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('employer_settings')
        .select('password_changed_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.password_changed_at) {
        setPasswordChangedAt(data.password_changed_at);
      }
    };
    
    fetchPasswordDate();
  }, [user?.id]);
  
  // Metrics state
  const [metrics, setMetrics] = useState({
    activeJobs: 0,
    totalApplications: 0
  });

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get employer metrics
      const { data: metricsData } = await supabase
        .from('employer_metrics')
        .select('active_jobs_count, total_applications')
        .eq('user_id', user.id)
        .maybeSingle();

      setMetrics({
        activeJobs: metricsData?.active_jobs_count || 0,
        totalApplications: metricsData?.total_applications || 0
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      // Remove employer auto-redirect flag before signing out
      localStorage.removeItem('employerAutoRedirect');
      
      await signOut();
      navigate('/employer-auth');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <PageHeader title="Employee Settings" backTo="/employer-portal" />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-4xl">
        {/* Deletion Warning Banner */}
        <DeleteAccountCountdown userId={user?.id} variant="banner" />

        <div className="flex items-center space-x-3 mb-8 mt-6">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <div>
            <p className="text-slate-600">Manage your company profile and preferences</p>
          </div>
        </div>

        {isInitialized && !hasPermission && (
          <div className="mb-6">
            <NotificationPermissionPrompt autoShow={true} />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="notifications" className="text-xs sm:text-sm">Notifications</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs sm:text-sm">Privacy</TabsTrigger>
            <TabsTrigger value="subscription" className="text-xs sm:text-sm">Subscription</TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm">Account</TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <NotificationChannelsCard
              audience="employer"
              userId={user?.id || null}
              companyId={company?.id || null}
              emailEnabled={settings?.email_notifications ?? true}
              loading={isLoading || !settings}
              onChanged={loadSettings}
            />

            <TelegramNotificationSection
              userType="company"
              userId={user?.id || null}
              companyId={company?.id || null}
            />

            {/* Push Notification Settings with Categories */}
            <PushNotificationSettings />
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span>Privacy & Visibility</span>
                </CardTitle>
                <CardDescription>
                  Control how your company information is displayed to job seekers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Company Visibility</h4>
                      <p className="text-sm text-slate-600">Allow job seekers to view your company profile</p>
                    </div>
                    <Switch 
                      checked={settings?.company_visibility ?? true}
                      onCheckedChange={() => toggleSetting('company_visibility')}
                      disabled={isLoading || !settings}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Contact Information Visibility</h4>
                      <p className="text-sm text-slate-600">Show contact details to potential applicants</p>
                    </div>
                    <Switch 
                      checked={settings?.contact_visibility ?? true}
                      onCheckedChange={() => toggleSetting('contact_visibility')}
                      disabled={isLoading || !settings}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Show in Company Directory</h4>
                      <p className="text-sm text-slate-600">Include your company in public listings</p>
                    </div>
                    <Switch 
                      checked={settings?.show_in_directory ?? true}
                      onCheckedChange={() => toggleSetting('show_in_directory')}
                      disabled={isLoading || !settings}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Allow Direct Contact</h4>
                      <p className="text-sm text-slate-600">Let job seekers contact you directly</p>
                    </div>
                    <Switch 
                      checked={settings?.allow_direct_contact ?? true}
                      onCheckedChange={() => toggleSetting('allow_direct_contact')}
                      disabled={isLoading || !settings}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Logo Visibility</h4>
                      <p className="text-sm text-slate-600">Display company logo in job listings</p>
                    </div>
                    <Switch 
                      checked={settings?.logo_visibility ?? true}
                      onCheckedChange={() => toggleSetting('logo_visibility')}
                      disabled={isLoading || !settings}
                    />
                  </div>

                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Download className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium">Download Company Data</h4>
                      <p className="text-sm text-slate-600">Export your company information and job data</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span>Subscription & Payments</span>
                </CardTitle>
                <CardDescription>
                  Manage your plan. Job posting, extensions and interviews are paid securely via Razorpay.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-6 border-2 border-blue-200 rounded-lg bg-blue-50">
                  <div>
                    <h4 className="font-medium text-blue-900">Current Plan: Free</h4>
                    <p className="text-sm text-blue-700">Basic job posting features</p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Upgrade Plan
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="text-center">
                      <h4 className="font-medium text-slate-900">Active Jobs</h4>
                      <p className="text-2xl font-bold text-green-600">{metrics.activeJobs}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => navigate("/post-job")}
                      >
                        Post Job
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <h4 className="font-medium text-slate-900">Applications</h4>
                      <p className="text-2xl font-bold text-purple-600">{metrics.totalApplications}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => navigate("/employer-portal?tab=jobs")}
                      >
                        View All
                      </Button>
                    </div>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <span>Account Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium">Email Address</h4>
                      <p className="text-sm text-slate-600 truncate">{user?.email || 'Not set'}</p>
                    </div>
                  </div>
                    <Button onClick={() => navigate('/employer-settings/account/email')} variant="outline" size="sm" className="w-full sm:w-auto flex-shrink-0">
                      Change
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium">Mobile Number</h4>
                      <p className="text-sm text-slate-600 truncate">
                        {user?.phone ? `+${String(user.phone).replace(/\D/g, '')}` : 'Not linked'}
                      </p>
                    </div>
                  </div>
                    <Button onClick={() => navigate('/employer-settings/account/mobile')} variant="outline" size="sm" className="w-full sm:w-auto flex-shrink-0" disabled={!phoneChangeUnlocked}>
                      {!phoneChangeUnlocked ? 'Locked' : user?.phone ? 'Change' : 'Add'}
                    </Button>
                </div>


                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                  <div className="flex items-center space-x-3 flex-1">
                    <Lock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium">Password</h4>
                      <p className="text-sm text-slate-600">
                        {passwordChangedAt 
                          ? `Last changed ${format(new Date(passwordChangedAt), 'dd MMMM yyyy hh:mm:ss a')}`
                          : 'Never changed'}
                      </p>
                    </div>
                  </div>
                    <Button onClick={() => navigate('/employer-settings/account/password')} variant="outline" size="sm" className="w-full sm:w-auto flex-shrink-0">
                      Change
                    </Button>
                </div>

                <TwoFactorAuthToggle
                  userType="employer"
                  userId={user?.id || null}
                  companyId={company?.id}
                  profileSetupPath="/employer-profile"
                  hideConnectTelegram={true}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                  <div className="flex items-center space-x-3 flex-1">
                    <Users className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium">Team Access</h4>
                      <p className="text-sm text-slate-600">Manage team member permissions</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0">Pro Feature</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Danger Zone</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <LogOut className="w-5 h-5 text-red-600" />
                      <div>
                        <h4 className="font-medium">Sign Out</h4>
                        <p className="text-sm text-slate-600">Sign out from your employer account</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </div>
                  <LastLoginInfo userId={user?.id} />
                </div>

                <DeleteAccountSection userId={user?.id} userType="employer" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EmployerSettings;
