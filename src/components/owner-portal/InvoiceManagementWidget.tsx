import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, FileText, ExternalLink, Settings, CheckCircle, Clock, Download, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Invoice {
  invoiceId: string;
  driveFileId: string;
  driveUrl: string;
}

const InvoiceManagementWidget = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, pending: 0 });

  useEffect(() => {
    loadInvoiceStats();
  }, []);

  const loadInvoiceStats = async () => {
    try {
      // Get transactions with invoices
      const { count: totalWithInvoice } = await (supabase
        .from('wallet_transactions' as any)
        .select('*', { count: 'exact', head: true })
        .not('invoice_url', 'is', null) as any);

      // Get this month's transactions
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: thisMonthCount } = await (supabase
        .from('wallet_transactions' as any)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString())
        .eq('status', 'completed') as any);

      // Get pending (completed but no invoice)
      const { count: pendingCount } = await (supabase
        .from('wallet_transactions' as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .is('invoice_url', null) as any);

      setStats({
        total: totalWithInvoice || 0,
        thisMonth: thisMonthCount || 0,
        pending: pendingCount || 0
      });
    } catch (error) {
      console.error('Failed to load invoice stats:', error);
    }
  };

  const generateInvoices = async (generateAll: boolean = false, transactionId?: string) => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'drive', generateAll, transactionId }
      });

      if (error) throw error;

      if (result?.success) {
        if (result.invoices?.length > 0) {
          setRecentInvoices(result.invoices);
          toast.success(`Generated ${result.generated} invoice(s)`);
          loadInvoiceStats();
        } else {
          toast.info(result.message || 'No invoices to generate');
        }
      } else {
        throw new Error(result?.error || 'Failed to generate invoices');
      }
    } catch (error: any) {
      console.error('Invoice generation error:', error);
      toast.error(error.message || 'Failed to generate invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await supabase.from('app_settings').upsert({
        setting_key: 'google_drive_invoices_folder',
        setting_value: folderId
      }, { onConflict: 'setting_key' });

      toast.success('Drive folder configured');
      setConfigOpen(false);
    } catch (error: any) {
      toast.error('Failed to save configuration');
    }
  };

  const openDriveFolder = () => {
    if (folderId) {
      window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Invoice Management
          </CardTitle>
          <CardDescription>
            Auto-generate PDF invoices to Google Drive
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
                <DialogTitle>Configure Google Drive</DialogTitle>
                <DialogDescription>
                  Enter the Google Drive folder ID where invoices will be stored
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Drive Folder ID</Label>
                  <Input
                    placeholder="e.g., 1ABC123xyz..."
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this in the folder URL: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
                  </p>
                </div>
                <Button onClick={saveConfig} className="w-full">
                  Save Configuration
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {folderId && (
            <Button variant="outline" size="icon" onClick={openDriveFolder}>
              <FolderOpen className="h-4 w-4" />
            </Button>
          )}
          <Button 
            onClick={() => generateInvoices(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Generate All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid gap-3 grid-cols-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Generated</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats.thisMonth}</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Recent Invoices */}
        {recentInvoices.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Recently Generated</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentInvoices.map((invoice, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-mono">{invoice.invoiceId}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(invoice.driveUrl, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {stats.pending > 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {stats.pending} transaction(s) without invoice
            </span>
            <Button 
              variant="link" 
              size="sm" 
              className="ml-auto text-amber-600"
              onClick={() => generateInvoices(true)}
              disabled={isLoading}
            >
              Generate Now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceManagementWidget;
