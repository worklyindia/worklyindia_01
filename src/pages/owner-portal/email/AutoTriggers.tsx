import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformStyle } from "@/hooks/usePlatformStyle";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Zap, Plus, Briefcase, Calendar, CreditCard, Megaphone,
  Clock, Trash2, RefreshCw, Edit2, Send, Sparkles, Loader2,
  User, Building2, UserPlus, Play, Mail, Power, PowerOff
} from "lucide-react";

interface AutoTrigger {
  id: string;
  name: string;
  description?: string;
  trigger_event: string;
  template_id: string;
  delay_minutes: number;
  is_active: boolean;
  trigger_conditions: any;
  variable_mapping: any;
  created_at: string;
  created_by: string;
  target_user_type?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string;
  html_content: string;
  text_content?: string;
  variables: any;
  is_active: boolean;
}

// Same trigger categories as Telegram
const websiteUserTriggerCategories = [
  {
    id: "user_onboarding", name: "User Onboarding Events", icon: UserPlus,
    color: "from-teal-500 to-teal-600", bgColor: "bg-teal-100",
    triggers: [
      { event: "user_signup_otp_sent", name: "Signup OTP Verify", description: "Send OTP when user signs up", templateMatch: "signup" },
      { event: "user_telegram_connected", name: "Telegram Connected", description: "Welcome when Telegram connected", templateMatch: "telegram verify" },
      { event: "user_profile_completed", name: "Profile Completed", description: "Welcome message on first profile completion", templateMatch: "profile complete" },
    ]
  },
  {
    id: "job_application", name: "Job Application Events", icon: Briefcase,
    color: "from-blue-500 to-blue-600", bgColor: "bg-blue-100",
    triggers: [
      { event: "application_submitted", name: "Application Submitted", description: "Send confirmation when user applies", templateMatch: "application submitted" },
      { event: "application_viewed", name: "Application Viewed", description: "Notify when employer views application", templateMatch: "application viewed" },
      { event: "application_shortlisted", name: "Application Shortlisted", description: "Congratulations message to shortlisted candidates", templateMatch: "shortlisted" },
      { event: "application_rejected", name: "Application Rejected", description: "Polite rejection notification", templateMatch: "rejected" },
    ]
  },
  {
    id: "interview", name: "Interview Events", icon: Calendar,
    color: "from-purple-500 to-purple-600", bgColor: "bg-purple-100",
    triggers: [
      { event: "interview_scheduled", name: "Interview Scheduled", description: "Send interview details to candidate", templateMatch: "interview scheduled" },
      { event: "interview_reminder", name: "Interview Reminder", description: "Reminder 1 hour before interview", templateMatch: "interview reminder" },
      { event: "interview_completed", name: "Interview Completed", description: "Request feedback after interview", templateMatch: "interview completed" },
      { event: "interview_cancelled", name: "Interview Cancelled", description: "Notify about cancellation", templateMatch: "interview cancelled" },
    ]
  },
  {
    id: "marketing_user", name: "Marketing Triggers", icon: Megaphone,
    color: "from-orange-500 to-orange-600", bgColor: "bg-orange-100",
    triggers: [
      { event: "job_recommendation", name: "New Job Match", description: "Alert when matching job is posted", templateMatch: "job match" },
      { event: "weekly_digest", name: "Weekly Job Digest", description: "Weekly summary of new jobs", templateMatch: "weekly" },
      { event: "profile_incomplete", name: "Profile Incomplete", description: "Remind to complete profile", templateMatch: "profile incomplete" },
      { event: "inactive_user", name: "Inactive User", description: "Re-engage inactive users", templateMatch: "inactive" },
    ]
  },
  {
    id: "referral_user", name: "Referral Events", icon: Sparkles,
    color: "from-pink-500 to-pink-600", bgColor: "bg-pink-100",
    triggers: [
      { event: "user_referral_invite", name: "Referral Invite", description: "Send referral code to users", templateMatch: "referral invite" },
      { event: "user_referral_reward", name: "Referral Reward", description: "Notify when referral reward earned", templateMatch: "referral reward" },
    ]
  }
];

const employerTriggerCategories = [
  {
    id: "employer_onboarding", name: "Employer Onboarding Events", icon: Building2,
    color: "from-indigo-500 to-indigo-600", bgColor: "bg-indigo-100",
    triggers: [
      { event: "employer_signup_otp_sent", name: "Company Signup OTP", description: "Send OTP when company registers", templateMatch: "company signup" },
      { event: "employer_profile_completed", name: "Company Profile Completed", description: "Welcome message on first company profile completion", templateMatch: "company profile complete" },
    ]
  },
  {
    id: "job_posting", name: "Job Posting Events", icon: Briefcase,
    color: "from-blue-500 to-blue-600", bgColor: "bg-blue-100",
    triggers: [
      { event: "job_posted", name: "Job Posted", description: "Confirm when job is posted successfully", templateMatch: "job posted" },
      { event: "job_expiring", name: "Job Expiring Soon", description: "Alert before job expires", templateMatch: "job expiring" },
      { event: "new_application_received", name: "New Application", description: "Notify when someone applies", templateMatch: "new application" },
    ]
  },
  {
    id: "interview_employer", name: "Interview Events", icon: Calendar,
    color: "from-purple-500 to-purple-600", bgColor: "bg-purple-100",
    triggers: [
      { event: "employer_interview_scheduled", name: "Interview Scheduled", description: "Confirm interview scheduling", templateMatch: "interview scheduled" },
      { event: "employer_interview_reminder", name: "Interview Reminder", description: "Reminder before interview", templateMatch: "interview reminder" },
    ]
  },
  {
    id: "payment_employer", name: "Payment Events", icon: CreditCard,
    color: "from-green-500 to-green-600", bgColor: "bg-green-100",
    triggers: [
      { event: "employer_payment_success", name: "Payment Success", description: "Sent when any website payment succeeds", templateMatch: "payment success" },
      { event: "employer_payment_failed", name: "Payment Failed", description: "Sent when any website payment fails", templateMatch: "payment failed" },
      { event: "employer_payment_refund", name: "Payment Refund", description: "Sent when a payment is refunded", templateMatch: "refund" },
      { event: "employer_low_balance", name: "Low Balance Alert", description: "Alert when balance is low", templateMatch: "low balance" },
      { event: "employer_withdrawal_approved", name: "Withdrawal Approved", description: "Notify when withdrawal approved", templateMatch: "withdrawal" },
      { event: "subscription_expiring", name: "Subscription Expiring", description: "Alert before subscription ends", templateMatch: "subscription" },
    ]
  },
  {
    id: "marketing_employer", name: "Marketing Triggers", icon: Megaphone,
    color: "from-orange-500 to-orange-600", bgColor: "bg-orange-100",
    triggers: [
      { event: "employer_profile_incomplete", name: "Profile Incomplete", description: "Remind to complete company profile", templateMatch: "profile incomplete" },
      { event: "employer_inactive", name: "Inactive Employer", description: "Re-engage inactive employers", templateMatch: "inactive" },
    ]
  },
  {
    id: "referral_employer", name: "Referral Events", icon: Sparkles,
    color: "from-pink-500 to-pink-600", bgColor: "bg-pink-100",
    triggers: [
      { event: "employer_referral_invite", name: "Referral Invite", description: "Send referral code to employers", templateMatch: "referral invite" },
      { event: "employer_referral_reward", name: "Referral Reward", description: "Notify when referral reward earned", templateMatch: "referral reward" },
    ]
  }
];

const EmailAutoTriggers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isIOS, isAndroid, cardClass } = usePlatformStyle();
  const { tapFeedback, successFeedback } = useNativeFeel();
  
  const [loading, setLoading] = useState(true);
  const [triggers, setTriggers] = useState<AutoTrigger[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("website_user");
  
  const [templateDialog, setTemplateDialog] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<{event: string; name: string; triggerId?: string; targetUserType?: string; templateMatch?: string} | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedDelay, setSelectedDelay] = useState<number>(0);
  const [savingTrigger, setSavingTrigger] = useState(false);
  
  const [creatingAllTriggers, setCreatingAllTriggers] = useState(false);
  const [bulkActivating, setBulkActivating] = useState(false);
  
  // Create template dialog
  const [createTemplateDialog, setCreateTemplateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', category: 'general', html_content: '', text_content: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  
  // Test trigger
  const [testTriggerDialog, setTestTriggerDialog] = useState(false);
  const [testTriggerEvent, setTestTriggerEvent] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testName, setTestName] = useState("Test User");
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  useEffect(() => {
    fetchTriggers();
    fetchTemplates();
  }, []);

  const fetchTriggers = async () => {
    try {
      const { data, error } = await supabase
        .from('email_automation_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTriggers((data || []) as unknown as AutoTrigger[]);
    } catch (error) {
      console.error('Error fetching email triggers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      setTemplates((data || []) as EmailTemplate[]);
    } catch (error) {
      console.error('Error fetching email templates:', error);
    }
  };

  const findMatchingTemplate = (triggerName: string, templateMatch?: string): EmailTemplate | null => {
    if (!templates.length) return null;
    const searchTerms = [templateMatch?.toLowerCase(), triggerName.toLowerCase()].filter(Boolean);
    for (const term of searchTerms) {
      const match = templates.find(t => t.name.toLowerCase().includes(term!) || t.category.toLowerCase().includes(term!));
      if (match) return match;
    }
    return templates[0] || null;
  };

  const generateVariableMappingForEvent = (eventType: string): Record<string, string> => {
    const baseMapping: Record<string, string> = { name: 'name' };
    if (eventType.includes('otp') || eventType.includes('2fa')) return { ...baseMapping, otp: 'otp' };
    if (eventType.includes('application')) return { ...baseMapping, job_title: 'job_title', company_name: 'company_name' };
    if (eventType.includes('interview')) return { ...baseMapping, job_title: 'job_title', date: 'date', time: 'time', mode: 'mode' };
    if (eventType.includes('payment')) return { ...baseMapping, amount: 'amount', transaction_id: 'transaction_id' };
    if (eventType.includes('job')) return { ...baseMapping, job_title: 'job_title', company_name: 'company_name', location: 'location' };
    return baseMapping;
  };

  const createAllTriggers = async () => {
    setCreatingAllTriggers(true);
    tapFeedback();
    try {
      const categories = activeTab === "website_user" ? websiteUserTriggerCategories : employerTriggerCategories;
      const allTriggerEvents = categories.flatMap(c => c.triggers);
      const existingEvents = triggers.map(t => t.trigger_event);
      const missingTriggers = allTriggerEvents.filter(t => !existingEvents.includes(t.event));

      if (missingTriggers.length === 0) {
        toast.info("All triggers are already created!");
        setCreatingAllTriggers(false);
        return;
      }

      let created = 0, failed = 0;
      for (const trigger of missingTriggers) {
        try {
          const matchedTemplate = findMatchingTemplate(trigger.name, trigger.templateMatch);
          const { error } = await supabase.from('email_automation_rules').insert([{
            name: trigger.name,
            description: trigger.description,
            trigger_event: trigger.event,
            template_id: matchedTemplate?.id || null,
            delay_minutes: 0,
            is_active: false,
            trigger_conditions: {},
            variable_mapping: generateVariableMappingForEvent(trigger.event),
            created_by: user?.id || '',
            target_user_type: activeTab === "website_user" ? "job_seeker" : "employer"
          }]);
          if (error) { failed++; } else { created++; }
        } catch { failed++; }
      }

      await fetchTriggers();
      successFeedback();
      if (failed === 0) toast.success(`✅ Created ${created} triggers!`);
      else toast.warning(`Created ${created}, ${failed} failed`);
    } catch (error) {
      toast.error("Failed to create triggers");
    } finally {
      setCreatingAllTriggers(false);
    }
  };

  const bulkToggleTriggers = async (activate: boolean) => {
    setBulkActivating(true);
    tapFeedback();
    try {
      const categories = activeTab === "website_user" ? websiteUserTriggerCategories : employerTriggerCategories;
      const allEvents = categories.flatMap(c => c.triggers.map(t => t.event));
      const tabTriggers = triggers.filter(t => allEvents.includes(t.trigger_event));
      const triggersWithTemplate = tabTriggers.filter(t => t.template_id);
      if (triggersWithTemplate.length === 0) { toast.error("No triggers with templates"); setBulkActivating(false); return; }

      const { error } = await supabase.from('email_automation_rules')
        .update({ is_active: activate })
        .in('id', triggersWithTemplate.map(t => t.id));
      if (error) throw error;

      await fetchTriggers();
      successFeedback();
      toast.success(activate ? `✅ Activated ${triggersWithTemplate.length} triggers!` : `⚪ Deactivated ${triggersWithTemplate.length} triggers`);
    } catch { toast.error("Failed to update triggers"); }
    finally { setBulkActivating(false); }
  };

  const toggleTrigger = async (triggerId: string, isActive: boolean, triggerEvent?: string, triggerName?: string) => {
    if (isActive) {
      const trigger = triggers.find(t => t.id === triggerId);
      if (!trigger?.template_id) {
        toast.error("Please select a template first");
        if (triggerEvent && triggerName) openTemplateDialog(triggerEvent, triggerName, triggerId);
        return;
      }
    }
    try {
      const { error } = await supabase.from('email_automation_rules').update({ is_active: isActive }).eq('id', triggerId);
      if (error) throw error;
      setTriggers(prev => prev.map(t => t.id === triggerId ? { ...t, is_active: isActive } : t));
      toast.success(isActive ? "Trigger Enabled" : "Trigger Disabled");
    } catch { toast.error("Failed to update trigger"); }
  };

  const openTemplateDialog = (eventType: string, eventName: string, existingTriggerId?: string, targetUserType?: string) => {
    if (templates.length === 0) {
      toast.error("Please create an email template first");
      setCreateTemplateDialog(true);
      return;
    }
    const existingTrigger = existingTriggerId ? triggers.find(t => t.id === existingTriggerId) : null;
    setSelectedTrigger({ event: eventType, name: eventName, triggerId: existingTriggerId, targetUserType: targetUserType || activeTab });
    setSelectedTemplateId(existingTrigger?.template_id || templates[0]?.id || "");
    setSelectedDelay(existingTrigger?.delay_minutes || 0);
    setTemplateDialog(true);
  };

  const saveTriggerWithTemplate = async () => {
    if (!selectedTrigger || !selectedTemplateId) return;
    setSavingTrigger(true);
    try {
      const variableMapping = generateVariableMappingForEvent(selectedTrigger.event);
      if (selectedTrigger.triggerId) {
        const { error } = await supabase.from('email_automation_rules')
          .update({ template_id: selectedTemplateId, delay_minutes: selectedDelay, variable_mapping: variableMapping })
          .eq('id', selectedTrigger.triggerId);
        if (error) throw error;
        setTriggers(prev => prev.map(t => t.id === selectedTrigger.triggerId ? { ...t, template_id: selectedTemplateId, delay_minutes: selectedDelay, variable_mapping: variableMapping } : t));
        toast.success("Trigger Updated");
      } else {
        const { data, error } = await supabase.from('email_automation_rules')
          .insert([{
            name: selectedTrigger.name, description: `Auto-trigger for ${selectedTrigger.name}`,
            trigger_event: selectedTrigger.event, template_id: selectedTemplateId,
            delay_minutes: selectedDelay, is_active: false, trigger_conditions: {},
            variable_mapping: variableMapping, created_by: user?.id || '',
            target_user_type: selectedTrigger.targetUserType === 'website_user' ? 'job_seeker' : 'employer'
          }]).select().single();
        if (error) throw error;
        setTriggers(prev => [data as unknown as AutoTrigger, ...prev]);
        toast.success("Trigger Created");
      }
      setTemplateDialog(false);
      setSelectedTrigger(null);
    } catch { toast.error("Failed to save trigger"); }
    finally { setSavingTrigger(false); }
  };

  const deleteTrigger = async (triggerId: string) => {
    try {
      const { error } = await supabase.from('email_automation_rules').delete().eq('id', triggerId);
      if (error) throw error;
      setTriggers(prev => prev.filter(t => t.id !== triggerId));
      toast.success("Trigger Deleted");
    } catch { toast.error("Failed to delete trigger"); }
  };

  const saveNewTemplate = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.html_content) {
      toast.error("Name, subject, and HTML content are required");
      return;
    }
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from('email_templates').insert([{
        ...newTemplate, created_by: user?.id || '', is_active: true, variables: {}
      }]);
      if (error) throw error;
      await fetchTemplates();
      setCreateTemplateDialog(false);
      setNewTemplate({ name: '', subject: '', category: 'general', html_content: '', text_content: '' });
      toast.success("Template created!");
    } catch { toast.error("Failed to create template"); }
    finally { setSavingTemplate(false); }
  };

  const openTestTriggerDialog = (eventType: string) => {
    setTestTriggerEvent(eventType);
    setTestEmail(""); setTestName("Test User"); setTestResult(null);
    setTestTriggerDialog(true);
  };

  const fireTestTrigger = async () => {
    if (!testTriggerEvent || !testEmail) { toast.error("Please enter an email"); return; }
    setTestingTrigger(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('email-api/email-trigger', {
        body: {
          event_type: testTriggerEvent, email: testEmail, name: testName,
          metadata: { otp: '123456', job_title: 'Test Job', company_name: 'Test Company', amount: '₹1,000', transaction_id: 'TXN' + Date.now() },
          triggered_by: 'manual_test', trigger_source: 'admin_panel'
        }
      });
      if (error) throw error;
      setTestResult({
        success: data?.success !== false,
        message: data?.success !== false ? `✅ Test email sent to ${testEmail}` : `❌ Failed: ${data?.error || 'Unknown error'}`
      });
      if (data?.success !== false) toast.success(`Test email sent to ${testEmail}`);
      else toast.error(data?.error || "Failed");
    } catch (error) {
      setTestResult({ success: false, message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown'}` });
      toast.error("Could not fire test trigger");
    } finally { setTestingTrigger(false); }
  };

  const handleRefresh = async () => {
    setRefreshing(true); tapFeedback();
    await Promise.all([fetchTriggers(), fetchTemplates()]);
    setRefreshing(false); successFeedback(); toast.success("Refreshed");
  };

  const getTriggerForEvent = (eventType: string) => triggers.find(t => t.trigger_event === eventType);

  const delayOptions = [
    { value: 0, label: "Immediate" }, { value: 5, label: "5 minutes" },
    { value: 60, label: "1 hour" }, { value: 1440, label: "24 hours" }, { value: 10080, label: "1 week" },
  ];

  const getStatsForTab = (tab: string) => {
    const categories = tab === "website_user" ? websiteUserTriggerCategories : employerTriggerCategories;
    const allEvents = categories.flatMap(c => c.triggers.map(t => t.event));
    const tabTriggers = triggers.filter(t => allEvents.includes(t.trigger_event));
    const totalPossible = categories.flatMap(c => c.triggers).length;
    return {
      active: tabTriggers.filter(t => t.is_active).length,
      inactive: tabTriggers.filter(t => !t.is_active).length,
      total: tabTriggers.length,
      missing: totalPossible - tabTriggers.length,
      totalPossible
    };
  };

  const renderTriggerCategories = (categories: typeof websiteUserTriggerCategories) => {
    return categories.map((category) => {
      const CategoryIcon = category.icon;
      const categoryEvents = category.triggers.map(t => t.event);
      const categoryTriggers = triggers.filter(t => categoryEvents.includes(t.trigger_event));
      return (
        <Card key={category.id} className="overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br", category.color)}>
                  <CategoryIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {categoryTriggers.filter(t => t.is_active).length} / {category.triggers.length} active
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {category.triggers.map((trigger) => {
              const existingTrigger = getTriggerForEvent(trigger.event);
              const linkedTemplate = existingTrigger ? templates.find(t => t.id === existingTrigger.template_id) : null;
              return (
                <div key={trigger.event} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{trigger.name}</h4>
                      {existingTrigger && (
                        <Badge variant={existingTrigger.is_active ? "default" : "secondary"} className="text-xs">
                          {existingTrigger.is_active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                      {linkedTemplate && (
                        <Badge variant="outline" className="text-xs truncate max-w-[120px]">{linkedTemplate.name}</Badge>
                      )}
                      {!existingTrigger && <Badge variant="destructive" className="text-xs">Not Setup</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{trigger.description}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {existingTrigger ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTestTriggerDialog(trigger.event)} title="Test">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Switch checked={existingTrigger.is_active} onCheckedChange={(checked) => toggleTrigger(existingTrigger.id, checked, trigger.event, trigger.name)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTemplateDialog(trigger.event, trigger.name, existingTrigger.id)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteTrigger(existingTrigger.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openTemplateDialog(trigger.event, trigger.name, undefined, activeTab)}>
                        <Plus className="w-4 h-4 mr-1" /> Setup
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
          <div className="flex items-center justify-between p-4"><Skeleton className="h-10 w-40" /></div>
        </div>
        <div className="container max-w-4xl px-4 py-6 space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  const userStats = getStatsForTab("website_user");
  const employerStats = getStatsForTab("employer");
  const currentStats = activeTab === "website_user" ? userStats : employerStats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50 pb-24">
      {/* Header */}
      <div className={cn("sticky top-0 z-40 border-b bg-background/95 backdrop-blur-xl", isIOS && "shadow-sm", isAndroid && "shadow-md")}>
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { tapFeedback(); navigate('/owner-portal'); }}
                className={cn("rounded-full", isIOS && "active:scale-95", isAndroid && "active:opacity-70")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-orange-700">Email Auto-Triggers</h1>
                  <p className="text-xs text-muted-foreground">Event-based Email Automation</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateTemplateDialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> Template
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 w-full">
        <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-hidden">
          {/* Quick Actions */}
          <Card className={cn(cardClass, "border-2 border-dashed border-orange-300 bg-gradient-to-r from-orange-50 to-red-50")}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Quick Actions</h3>
                    <p className="text-xs text-muted-foreground">
                      {currentStats.missing > 0 ? `${currentStats.missing} triggers pending setup` : "All triggers configured!"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button size="sm" variant="default" onClick={createAllTriggers}
                    disabled={creatingAllTriggers || currentStats.missing === 0}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                    {creatingAllTriggers ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    <span className="truncate">Create All</span>
                  </Button>
                  <Button size="sm" variant="default" onClick={() => bulkToggleTriggers(true)}
                    disabled={bulkActivating || currentStats.total === 0}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                    {bulkActivating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Power className="w-4 h-4 mr-1" />}
                    <span className="truncate">Activate All</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bulkToggleTriggers(false)}
                    disabled={bulkActivating || currentStats.active === 0}>
                    <PowerOff className="w-4 h-4 mr-1" /> <span className="truncate">Deactivate</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="website_user" className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                <User className="w-4 h-4" /> Job Seeker
                <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{userStats.active}/{userStats.totalPossible}</Badge>
              </TabsTrigger>
              <TabsTrigger value="employer" className="flex items-center gap-2 data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <Building2 className="w-4 h-4" /> Employers
                <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{employerStats.active}/{employerStats.totalPossible}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="website_user" className="mt-4 space-y-4">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-green-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-green-600">{userStats.active}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Active</p></CardContent></Card>
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-orange-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-orange-600">{userStats.inactive}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Inactive</p></CardContent></Card>
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-red-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-red-600">{userStats.missing}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Missing</p></CardContent></Card>
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-blue-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-blue-600">{templates.length}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Templates</p></CardContent></Card>
              </div>
              {renderTriggerCategories(websiteUserTriggerCategories)}
            </TabsContent>

            <TabsContent value="employer" className="mt-4 space-y-4">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-green-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-green-600">{employerStats.active}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Active</p></CardContent></Card>
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-indigo-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-indigo-600">{employerStats.inactive}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Inactive</p></CardContent></Card>
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-red-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-red-600">{employerStats.missing}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Missing</p></CardContent></Card>
                <Card className={cn(cardClass, "border-l-2 sm:border-l-4 border-l-blue-500")}><CardContent className="p-2 sm:pt-4 sm:pb-3 sm:px-4"><div className="text-lg sm:text-2xl font-bold text-blue-600">{templates.length}</div><p className="text-[10px] sm:text-xs text-muted-foreground">Templates</p></CardContent></Card>
              </div>
              {renderTriggerCategories(employerTriggerCategories)}
            </TabsContent>
          </Tabs>
        </main>
      </ScrollArea>

      {/* Template Selection Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTrigger?.triggerId ? "Edit Trigger" : "Setup Trigger"}</DialogTitle>
            <DialogDescription>{selectedTrigger?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Email Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                        <Badge variant="outline" className="text-xs">{template.category}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Delay</Label>
              <Select value={String(selectedDelay)} onValueChange={(v) => setSelectedDelay(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {delayOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>{option.label}</span></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTemplateId && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1">Subject:</p>
                <p className="text-sm text-muted-foreground">{templates.find(t => t.id === selectedTemplateId)?.subject}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancel</Button>
            <Button onClick={saveTriggerWithTemplate} disabled={savingTrigger}>
              {savingTrigger && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={createTemplateDialog} onOpenChange={setCreateTemplateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
            <DialogDescription>Create a new email template for auto-triggers</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={newTemplate.name} onChange={(e) => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Welcome Email" />
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input value={newTemplate.subject} onChange={(e) => setNewTemplate(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Welcome to Workly India, {name}!" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['general', 'onboarding', 'application', 'interview', 'payment', 'marketing', 'referral'].map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>HTML Content</Label>
              <Textarea value={newTemplate.html_content} onChange={(e) => setNewTemplate(p => ({ ...p, html_content: e.target.value }))}
                placeholder="<h1>Hello {name}!</h1><p>Welcome...</p>" rows={6} />
              <p className="text-xs text-muted-foreground">Use {'{name}'}, {'{job_title}'}, {'{company_name}'} etc. as variables</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTemplateDialog(false)}>Cancel</Button>
            <Button onClick={saveNewTemplate} disabled={savingTemplate}>
              {savingTemplate && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Trigger Dialog */}
      <Dialog open={testTriggerDialog} onOpenChange={setTestTriggerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Email Trigger</DialogTitle>
            <DialogDescription>Send a test email for: {testTriggerEvent}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Test User Name</Label>
              <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Test User" />
            </div>
            {testResult && (
              <div className={cn("p-3 rounded-lg text-sm", testResult.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                {testResult.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestTriggerDialog(false)}>Cancel</Button>
            <Button onClick={fireTestTrigger} disabled={testingTrigger}>
              {testingTrigger && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" /> Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailAutoTriggers;
