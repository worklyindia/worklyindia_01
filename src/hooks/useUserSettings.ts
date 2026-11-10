import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  job_alerts: boolean;
  marketing_communications: boolean;
  profile_visibility: boolean;
  activity_status: boolean;
  contact_information: boolean;
  two_factor_enabled: boolean;
  quick_login_enabled: boolean;
}

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        throw error;
      }

      if (data) {
        setSettings({
          email_notifications: data.email_notifications,
          push_notifications: data.push_notifications,
          job_alerts: data.job_alerts,
          marketing_communications: data.marketing_communications,
          profile_visibility: data.profile_visibility,
          activity_status: data.activity_status,
          contact_information: data.contact_information,
          two_factor_enabled: data.two_factor_enabled ?? false,
          quick_login_enabled: data.quick_login_enabled ?? true,
        });
      } else {
        // No settings found, set defaults
        setSettings({
          email_notifications: true,
          push_notifications: true,
          job_alerts: true,
          marketing_communications: false,
          profile_visibility: true,
          activity_status: true,
          contact_information: false,
          two_factor_enabled: false,
          quick_login_enabled: true,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
      // Set defaults on error
      setSettings({
        email_notifications: true,
        push_notifications: true,
        job_alerts: true,
        marketing_communications: false,
        profile_visibility: true,
        activity_status: true,
        contact_information: false,
        two_factor_enabled: false,
        quick_login_enabled: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof UserSettings, value: boolean) => {
    if (!settings) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newSettings = { ...settings, [key]: value };
      
      // Optimistically update UI
      setSettings(newSettings);

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...newSettings,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: "Your preferences have been saved",
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
      // Revert the change
      fetchSettings();
    }
  };

  return {
    settings,
    loading,
    updateSetting,
    refetchSettings: fetchSettings,
  };
};