import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmployerSettings {
  // Notification preferences
  new_applications: boolean;
  interview_reminders: boolean;
  weekly_reports: boolean;
  job_expiry_alerts: boolean;
  boost_notifications: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  
  // Privacy settings
  company_visibility: boolean;
  contact_visibility: boolean;
  job_posting_visibility: boolean;
  logo_visibility: boolean;
  show_in_directory: boolean;
  allow_direct_contact: boolean;
  quick_login_enabled: boolean;
}

const defaultSettings: EmployerSettings = {
  new_applications: true,
  interview_reminders: true,
  weekly_reports: true,
  job_expiry_alerts: true,
  boost_notifications: true,
  email_notifications: true,
  push_notifications: true,
  sms_notifications: false,
  company_visibility: true,
  contact_visibility: true,
  job_posting_visibility: true,
  logo_visibility: true,
  show_in_directory: true,
  allow_direct_contact: true,
  quick_login_enabled: true,
};

export const useEmployerSettings = () => {
  const [settings, setSettings] = useState<EmployerSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('employer_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading employer settings:', error);
        setSettings(defaultSettings);
        setIsLoading(false);
        return;
      }

      if (data) {
        setSettings({
          new_applications: data.new_applications,
          interview_reminders: data.interview_reminders,
          weekly_reports: data.weekly_reports,
          job_expiry_alerts: data.job_expiry_alerts,
          boost_notifications: data.boost_notifications,
          email_notifications: data.email_notifications,
          push_notifications: data.push_notifications,
          sms_notifications: data.sms_notifications,
          company_visibility: data.company_visibility,
          contact_visibility: data.contact_visibility,
          job_posting_visibility: data.job_posting_visibility,
          logo_visibility: data.logo_visibility,
          show_in_directory: data.show_in_directory,
          allow_direct_contact: data.allow_direct_contact,
          quick_login_enabled: data.quick_login_enabled ?? true,
        });
      } else {
        // No settings found, use defaults
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error in loadSettings:', error);
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<EmployerSettings>) => {
    if (!settings) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to update settings",
          variant: "destructive",
        });
        return;
      }

      const updatedSettings = { ...settings, ...newSettings };
      
      // Optimistically update UI
      setSettings(updatedSettings);

      const { error } = await supabase
        .from('employer_settings')
        .upsert({
          user_id: user.id,
          ...updatedSettings,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating employer settings:', error);
        toast({
          title: "Error",
          description: "Failed to update settings",
          variant: "destructive",
        });
        // Revert on error
        loadSettings();
        return;
      }

      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    } catch (error) {
      console.error('Error in updateSettings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
      // Revert on error
      loadSettings();
    }
  };

  const toggleSetting = (setting: keyof EmployerSettings) => {
    if (!settings) return;
    const newValue = !settings[setting];
    updateSettings({ [setting]: newValue });
  };

  return {
    settings,
    isLoading,
    updateSettings,
    toggleSetting,
    loadSettings,
  };
};