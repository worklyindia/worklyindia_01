import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CleanupSetting {
  value: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
  enabled: boolean;
}

export interface CleanupSettings {
  otp_codes: CleanupSetting;
  live_sessions: CleanupSetting;
  api_health_checks: CleanupSetting;
  api_request_logs: CleanupSetting;
  function_logs: CleanupSetting;
  notifications: CleanupSetting;
  chat_messages: CleanupSetting;
  cached_audio: CleanupSetting;
  ai_response_cache: CleanupSetting;
  cleanup_logs: CleanupSetting;
  daily_visitors: CleanupSetting;
  cron_history: CleanupSetting;
}

export const defaultSettings: CleanupSettings = {
  otp_codes: { value: 1, unit: 'minutes', enabled: true },
  live_sessions: { value: 1, unit: 'minutes', enabled: true },
  api_health_checks: { value: 1, unit: 'hours', enabled: true },
  api_request_logs: { value: 30, unit: 'days', enabled: true },
  function_logs: { value: 1, unit: 'days', enabled: true },
  notifications: { value: 3, unit: 'days', enabled: true },
  chat_messages: { value: 7, unit: 'days', enabled: true },
  cached_audio: { value: 3, unit: 'days', enabled: true },
  ai_response_cache: { value: 3, unit: 'days', enabled: true },
  cleanup_logs: { value: 7, unit: 'days', enabled: true },
  daily_visitors: { value: 1, unit: 'days', enabled: true },
  cron_history: { value: 3, unit: 'days', enabled: true },
};

export const timeOptions = [
  { label: '1 second', value: 1, unit: 'seconds' },
  { label: '10 seconds', value: 10, unit: 'seconds' },
  { label: '30 seconds', value: 30, unit: 'seconds' },
  { label: '1 minute', value: 1, unit: 'minutes' },
  { label: '5 minutes', value: 5, unit: 'minutes' },
  { label: '15 minutes', value: 15, unit: 'minutes' },
  { label: '30 minutes', value: 30, unit: 'minutes' },
  { label: '1 hour', value: 1, unit: 'hours' },
  { label: '3 hours', value: 3, unit: 'hours' },
  { label: '6 hours', value: 6, unit: 'hours' },
  { label: '12 hours', value: 12, unit: 'hours' },
  { label: '1 day', value: 1, unit: 'days' },
  { label: '3 days', value: 3, unit: 'days' },
  { label: '7 days', value: 7, unit: 'days' },
  { label: '14 days', value: 14, unit: 'days' },
  { label: '30 days', value: 30, unit: 'days' },
] as const;

export const categoryLabels: Record<keyof CleanupSettings, { title: string; description: string }> = {
  otp_codes: { title: 'OTP Codes', description: 'Verify hone ke baad delete' },
  live_sessions: { title: 'Live Sessions', description: 'User session tracking data' },
  api_health_checks: { title: 'Health Checks', description: 'API health monitoring logs' },
  api_request_logs: { title: 'API Logs', description: 'API request/response logs' },
  function_logs: { title: 'Function Logs', description: 'Edge function execution logs' },
  notifications: { title: 'Notifications', description: 'Read notifications cleanup' },
  chat_messages: { title: 'Chat Messages', description: 'Old conversation messages' },
  cached_audio: { title: 'Audio Cache', description: 'TTS cached audio files' },
  ai_response_cache: { title: 'AI Cache', description: 'AI response cache data' },
  cleanup_logs: { title: 'Cleanup Logs', description: 'Cleanup execution history' },
  daily_visitors: { title: 'Visitor Data', description: 'Daily visitor tracking' },
  cron_history: { title: 'Cron History', description: 'Supabase internal job logs (134 MB!)' },
};

export function useCleanupSettings() {
  const [settings, setSettings] = useState<CleanupSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaningTable, setIsCleaningTable] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cleanup_schedule_settings')
        .select('*')
        .eq('setting_key', 'power_cleanup_settings')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.setting_value) {
        const savedSettings = data.setting_value as unknown as CleanupSettings;
        setSettings({ ...defaultSettings, ...savedSettings });
      }
    } catch (error) {
      console.error('Error fetching cleanup settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: CleanupSettings) => {
    setIsSaving(true);
    try {
      // First check if setting exists
      const { data: existing } = await supabase
        .from('cleanup_schedule_settings')
        .select('id')
        .eq('setting_key', 'power_cleanup_settings')
        .single();

      let error;
      if (existing) {
        // Update existing
        const result = await supabase
          .from('cleanup_schedule_settings')
          .update({
            setting_value: JSON.parse(JSON.stringify(newSettings)),
            is_enabled: true,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', 'power_cleanup_settings');
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('cleanup_schedule_settings')
          .insert([{
            setting_key: 'power_cleanup_settings',
            setting_value: JSON.parse(JSON.stringify(newSettings)),
            is_enabled: true
          }]);
        error = result.error;
      }

      if (error) throw error;

      setSettings(newSettings);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateSetting = useCallback((
    key: keyof CleanupSettings,
    value: number,
    unit: CleanupSetting['unit']
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value, unit }
    }));
  }, []);

  const toggleSetting = useCallback((key: keyof CleanupSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled }
    }));
  }, []);

  const cleanTable = useCallback(async (tableKey: keyof CleanupSettings) => {
    setIsCleaningTable(tableKey);
    try {
      const setting = settings[tableKey];
      
      const response = await supabase.functions.invoke('auto-egress-manager', {
        body: {
          action: 'clean_specific_table',
          tableKey,
          retention: {
            value: setting.value,
            unit: setting.unit
          }
        }
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result?.success) {
        toast.success(`${categoryLabels[tableKey].title}: ${result.deleted || 0} rows deleted`);
      } else {
        toast.error(result?.error || 'Cleanup failed');
      }
    } catch (error) {
      console.error('Error cleaning table:', error);
      toast.error('Failed to clean table');
    } finally {
      setIsCleaningTable(null);
    }
  }, [settings]);

  const cleanAllTables = useCallback(async () => {
    setIsCleaningTable('all');
    try {
      const response = await supabase.functions.invoke('auto-egress-manager', {
        body: {
          action: 'power_cleanup',
          settings
        }
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result?.success) {
        toast.success(`All tables cleaned: ${result.totalDeleted || 0} total rows deleted`);
      } else {
        toast.error(result?.error || 'Cleanup failed');
      }
    } catch (error) {
      console.error('Error cleaning all tables:', error);
      toast.error('Failed to clean tables');
    } finally {
      setIsCleaningTable(null);
    }
  }, [settings]);

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    toast.info('Settings reset to defaults (not saved yet)');
  }, []);

  return {
    settings,
    isLoading,
    isSaving,
    isCleaningTable,
    fetchSettings,
    saveSettings,
    updateSetting,
    toggleSetting,
    cleanTable,
    cleanAllTables,
    resetToDefaults,
  };
}
