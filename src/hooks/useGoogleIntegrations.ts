import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GA4Data {
  daily?: {
    today: {
      date: string;
      activeUsers: number;
      sessions: number;
      pageViews: number;
      bounceRate: string;
      avgSessionDuration: string;
      newUsers: number;
    };
    yesterday: {
      date: string;
      activeUsers: number;
      sessions: number;
      pageViews: number;
      bounceRate: string;
      avgSessionDuration: string;
      newUsers: number;
    };
  };
  realtime?: {
    activeUsers: number;
    byLocation: { country: string; city: string; users: number }[];
    fetchedAt: string;
  };
  weekly?: {
    dateRange: { startDate: string; endDate: string };
    dailyTrend: { date: string; activeUsers: number; sessions: number; pageViews: number; newUsers: number }[];
    devices: { device: string; users: number; sessions: number }[];
    trafficSources: { source: string; users: number; sessions: number }[];
    topPages: { path: string; pageViews: number; users: number }[];
    geography: { country: string; region: string; users: number }[];
  };
  customEvents?: {
    dateRange: { startDate: string; endDate: string };
    events: { eventName: string; count: number; users: number }[];
  };
}

export interface SheetsSyncResult {
  success: boolean;
  results: {
    jobs?: { success: boolean; rowsWritten: number; error?: string };
    analytics?: { success: boolean; rowsWritten: number; error?: string };
    financial?: { success: boolean; rowsWritten: number; error?: string };
  };
  executionTimeMs: number;
  syncedAt: string;
}

export interface DriveInvoiceResult {
  success: boolean;
  generated: number;
  invoices: { invoiceId: string; driveFileId: string; driveUrl: string }[];
  executionTimeMs: number;
}

export interface FunctionLog {
  id: string;
  function_name: string;
  status: string;
  execution_time_ms: number;
  created_at: string;
  request_data: any;
  response_data: any;
}

export const useGoogleIntegrations = () => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch GA4 Analytics
  const fetchGA4Analytics = async (type: 'daily' | 'realtime' | 'weekly' | 'custom-events' | 'all' = 'all'): Promise<GA4Data | null> => {
    setLoading(prev => ({ ...prev, ga4: true }));
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'analytics', type }
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch GA4 data');
      }

      toast({
        title: "GA4 Data Fetched",
        description: `Data retrieved in ${data.executionTimeMs}ms`,
      });

      return data.data as GA4Data;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to fetch GA4 analytics';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(prev => ({ ...prev, ga4: false }));
    }
  };

  // Sync Google Sheets
  const syncGoogleSheets = async (type: 'jobs' | 'analytics' | 'financial' | 'all' = 'all'): Promise<SheetsSyncResult | null> => {
    setLoading(prev => ({ ...prev, sheets: true }));
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'sheets', type }
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to sync Google Sheets');
      }

      toast({
        title: "Sheets Synced",
        description: `Synced in ${data.executionTimeMs}ms`,
      });

      return data as SheetsSyncResult;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to sync Google Sheets';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(prev => ({ ...prev, sheets: false }));
    }
  };

  // Generate Drive Invoices
  const generateDriveInvoices = async (options: { transactionId?: string; userId?: string; generateAll?: boolean } = { generateAll: true }): Promise<DriveInvoiceResult | null> => {
    setLoading(prev => ({ ...prev, drive: true }));
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'drive', ...options }
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to generate invoices');
      }

      toast({
        title: "Invoices Generated",
        description: `Generated ${data.generated} invoices`,
      });

      return data as DriveInvoiceResult;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to generate invoices';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(prev => ({ ...prev, drive: false }));
    }
  };

  // Get function logs for Google integrations
  const getFunctionLogs = async (functionName?: string, limit = 20): Promise<FunctionLog[]> => {
    setLoading(prev => ({ ...prev, logs: true }));
    
    try {
      let query = supabase
        .from('function_logs')
        .select('*')
        .in('function_name', ['google-analytics-fetch', 'google-sheets-sync', 'google-drive-invoices'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (functionName) {
        query = query.eq('function_name', functionName);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      return (data || []) as FunctionLog[];
    } catch (err: any) {
      console.error('Error fetching function logs:', err);
      return [];
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  };

  // Get app settings for configuration
  const getAppSettings = async (): Promise<Record<string, string>> => {
    try {
      const { data, error: queryError } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'ga4_property_id',
          'google_sheets_jobs_id',
          'google_sheets_analytics_id',
          'google_sheets_financial_id',
          'google_drive_invoices_folder',
          'ga4_latest_data'
        ]);

      if (queryError) throw queryError;

      const settings: Record<string, string> = {};
      (data || []).forEach(item => {
        if (item.setting_value) {
          settings[item.setting_key] = item.setting_value;
        }
      });

      return settings;
    } catch (err: any) {
      console.error('Error fetching app settings:', err);
      return {};
    }
  };

  // Update app setting
  const updateAppSetting = async (key: string, value: string): Promise<boolean> => {
    try {
      const { error: upsertError } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (upsertError) throw upsertError;

      toast({
        title: "Setting Updated",
        description: `${key} has been updated`,
      });

      return true;
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to update ${key}`,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    loading,
    error,
    fetchGA4Analytics,
    syncGoogleSheets,
    generateDriveInvoices,
    getFunctionLogs,
    getAppSettings,
    updateAppSetting
  };
};
