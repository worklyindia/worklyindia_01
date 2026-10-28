import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, Table, ExternalLink, Settings, CheckCircle, XCircle, FileSpreadsheet, BarChart3, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
}

interface SyncResult {
  success: boolean;
  rowsWritten?: number;
  error?: string;
}

const GoogleSheetsWidget = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({});
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<Record<string, SheetConfig>>({
    jobs: { spreadsheetId: '', sheetName: 'Jobs Data' },
    analytics: { spreadsheetId: '', sheetName: 'Analytics Report' },
    financial: { spreadsheetId: '', sheetName: 'Financial Report' }
  });

  const syncToSheets = async (type: 'jobs' | 'analytics' | 'financial' | 'all') => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'sheets', type }
      });

      if (error) throw error;

      if (result?.success) {
        setSyncResults(result.results);
        setLastSync(result.syncedAt);
        
        const successCount = Object.values(result.results as Record<string, SyncResult>).filter((r: SyncResult) => r.success).length;
        toast.success(`Synced ${successCount} sheet(s) successfully`);
      } else {
        throw new Error(result?.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sheets sync error:', error);
      toast.error(error.message || 'Failed to sync to Google Sheets');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      const settings = [
        { setting_key: 'google_sheets_jobs_id', setting_value: config.jobs.spreadsheetId },
        { setting_key: 'google_sheets_analytics_id', setting_value: config.analytics.spreadsheetId },
        { setting_key: 'google_sheets_financial_id', setting_value: config.financial.spreadsheetId }
      ];

      for (const setting of settings) {
        await supabase.from('app_settings').upsert(setting, { onConflict: 'setting_key' });
      }

      toast.success('Sheet configuration saved');
      setConfigOpen(false);
    } catch (error: any) {
      toast.error('Failed to save configuration');
    }
  };

  const openSheet = (spreadsheetId: string) => {
    if (spreadsheetId) {
      window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
    }
  };

  const sheets = [
    { key: 'jobs', label: 'Jobs Data', icon: FileSpreadsheet, description: 'All job listings with details' },
    { key: 'analytics', label: 'Analytics Report', icon: BarChart3, description: 'User signups, traffic, applications' },
    { key: 'financial', label: 'Financial Report', icon: Wallet, description: 'Wallet transactions, earnings' }
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Table className="h-5 w-5 text-green-600" />
            Google Sheets Sync
          </CardTitle>
          <CardDescription>
            Auto-sync data to Google Sheets
            {lastSync && (
              <span className="ml-2 text-xs">
                (Last sync: {new Date(lastSync).toLocaleString()})
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Google Sheets</DialogTitle>
                <DialogDescription>
                  Enter your Google Sheet IDs for each data type
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {sheets.map((sheet) => (
                  <div key={sheet.key} className="space-y-2">
                    <Label>{sheet.label} - Spreadsheet ID</Label>
                    <Input
                      placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      value={config[sheet.key as keyof typeof config]?.spreadsheetId || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        [sheet.key]: { ...prev[sheet.key as keyof typeof prev], spreadsheetId: e.target.value }
                      }))}
                    />
                  </div>
                ))}
                <Button onClick={saveConfig} className="w-full">
                  Save Configuration
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            onClick={() => syncToSheets('all')}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sheets.map((sheet) => {
            const result = syncResults[sheet.key];
            const sheetConfig = config[sheet.key as keyof typeof config];
            
            return (
              <div 
                key={sheet.key} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <sheet.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{sheet.label}</p>
                    <p className="text-xs text-muted-foreground">{sheet.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {result && (
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {result.rowsWritten} rows
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </>
                      )}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncToSheets(sheet.key as 'jobs' | 'analytics' | 'financial')}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  {sheetConfig?.spreadsheetId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSheet(sheetConfig.spreadsheetId)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleSheetsWidget;
