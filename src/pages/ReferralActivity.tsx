import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReferralSystem } from "@/hooks/useReferralSystem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, Wallet, Phone, MessageCircle, Plus, Minus, ChevronDown, ChevronUp, Mail, IndianRupee, Clock, Download, FileText, FileSpreadsheet, RefreshCw, Table } from "lucide-react";
import { format } from "date-fns";
import { useWithdrawalRequests } from "@/hooks/useWithdrawalRequests";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseDownload } from "@/hooks/useSupabaseDownload";

const ReferralActivity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'history'>('members');
  const [isExporting, setIsExporting] = useState(false);
  
  const {
    commissionHistory,
    referredUsers,
    walletAdjustments,
    isLoadingHistory,
    isLoadingUsers,
    isLoadingAdjustments,
  } = useReferralSystem();
  
  const { withdrawalRequests, isLoading: isLoadingWithdrawals } = useWithdrawalRequests(user?.id);

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`, "_blank");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return { date: dateStr, time: timeStr };
  };

  // Calculate total earnings from a specific referred user
  const getUserTotalEarnings = (userId: string) => {
    return commissionHistory
      ?.filter(c => c.referred_user_id === userId && c.status === 'completed')
      .reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;
  };

  // Calculate last 24 hours earnings from a specific referred user
  const getUserLast24hEarnings = (userId: string) => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return commissionHistory
      ?.filter(c => 
        c.referred_user_id === userId && 
        c.status === 'completed' &&
        new Date(c.created_at) >= oneDayAgo
      )
      .reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;
  };

  // Merge all transactions
  const allTransactions = [
    ...(commissionHistory || []).map(c => ({
      id: c.id,
      type: 'commission' as const,
      amount: Number(c.commission_amount),
      created_at: c.created_at,
      status: c.status,
      data: c
    })),
    ...(walletAdjustments || []).map(w => ({
      id: w.id,
      type: w.adjustment_type as 'add' | 'deduct',
      amount: Number(w.amount),
      created_at: w.created_at,
      status: 'completed',
      data: w
    })),
    ...(withdrawalRequests || []).map(wr => ({
      id: wr.id,
      type: 'withdrawal' as const,
      amount: Number(wr.amount),
      created_at: wr.created_at,
      status: wr.status,
      data: wr
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const toggleExpand = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  // Prepare members data for export
  const getMembersExportData = (usePdfSafe = false) => {
    if (!referredUsers || referredUsers.length === 0) return [];
    
    const currencyPrefix = usePdfSafe ? 'Rs ' : '₹';
    
    return referredUsers.map(r => {
      const totalEarnings = getUserTotalEarnings(r.referred_user_id);
      const last24h = getUserLast24hEarnings(r.referred_user_id);
      const isDeleted = r.profiles?.account_status === 'deleted' || r.companies?.account_status === 'deleted';
      const hasCommission = commissionHistory?.some(c => c.referred_user_id === r.referred_user_id && c.status === 'completed');
      const status = isDeleted ? 'Deleted' : hasCommission ? 'Active' : 'Inactive';
      const { date: joinedDateStr, time: joinedTimeStr } = formatDate(r.created_at);
      
      return {
        name: r.profiles?.full_name || r.companies?.company_name || 'User',
        company: r.companies?.company_name || '-',
        email: r.profiles?.email || '-',
        phone: r.profiles?.phone || r.companies?.phone || '-',
        whatsapp: r.profiles?.whatsapp_number || r.companies?.whatsapp_number || '-',
        joinedDate: joinedDateStr,
        joinedTime: joinedTimeStr,
        status,
        totalEarned: `${currencyPrefix}${totalEarnings.toFixed(2)}`,
        last24h: `${currencyPrefix}${last24h.toFixed(2)}`
      };
    });
  };

  // Prepare history data for export
  const getHistoryExportData = (usePdfSafe = false) => {
    if (!allTransactions || allTransactions.length === 0) return [];
    
    const currencyPrefix = usePdfSafe ? 'Rs ' : '₹';
    
    return allTransactions.map(t => {
      let type = '';
      let description = '';
      let sourceAmount = '-';
      
      if (t.type === 'commission') {
        const c = t.data as typeof commissionHistory[0];
        type = 'Commission';
        description = `From ${c.profiles?.full_name || c.companies?.company_name || 'User'}`;
        sourceAmount = `${currencyPrefix}${Number(c.source_payment_amount).toFixed(2)}`;
      } else if (t.type === 'withdrawal') {
        type = 'Withdrawal';
        description = `ID: ${(t.data as typeof withdrawalRequests[0]).withdrawal_id}`;
      } else {
        type = t.type === 'add' ? 'Credit' : 'Debit';
        description = (t.data as typeof walletAdjustments[0]).reason || '';
      }
      
      const date = new Date(t.created_at);
      return {
        date: format(date, 'dd MMMM yyyy'),
        time: format(date, 'hh:mm a'),
        type,
        description,
        amount: `${t.type === 'commission' || t.type === 'add' ? '+' : '-'}${currencyPrefix}${Math.abs(t.amount).toFixed(2)}`,
        status: t.status,
        sourceAmount
      };
    });
  };

  // Export using generate-download edge function
  const { download, isDownloading } = useSupabaseDownload();

  const handleExportPDF = async () => {
    const data = activeTab === 'members' ? getMembersExportData(true) : getHistoryExportData(true);
    if (data.length === 0) {
      toast.error(`No ${activeTab} to export`);
      return;
    }

    setIsExporting(true);
    const filename = activeTab === 'members' 
      ? `referral_members_${format(new Date(), 'yyyy-MM-dd')}`
      : `referral_history_${format(new Date(), 'yyyy-MM-dd')}`;
    
    const config = {
      title: activeTab === 'members' ? 'Referral Members Report' : 'Referral Transaction History',
      subtitle: `Generated: ${format(new Date(), 'dd MMMM yyyy hh:mm a')}`,
      columns: activeTab === 'members' ? [
        { key: 'name', header: 'Name', width: 85 },
        { key: 'company', header: 'Company', width: 70 },
        { key: 'email', header: 'Email', width: 95 },
        { key: 'phone', header: 'Phone', width: 70 },
        { key: 'joinedDate', header: 'Joined', width: 55 },
        { key: 'status', header: 'Status', width: 45, colorize: true },
        { key: 'totalEarned', header: 'Earned', width: 55 }
      ] : [
        { key: 'date', header: 'Date', width: 65 },
        { key: 'time', header: 'Time', width: 50 },
        { key: 'type', header: 'Type', width: 65 },
        { key: 'description', header: 'Description', width: 110 },
        { key: 'amount', header: 'Amount', width: 65, colorize: true },
        { key: 'status', header: 'Status', width: 55, colorize: true },
        { key: 'sourceAmount', header: 'Source', width: 65 }
      ],
      summaryBoxes: activeTab === 'members' ? [
        { label: 'Total Members', value: referredUsers?.length || 0, color: 'purple' as const }
      ] : [
        { label: 'Total Transactions', value: allTransactions.length, color: 'purple' as const }
      ]
    };

    const template = activeTab === 'members' ? 'referral-members' : 'referral-history';

    await download({
      type: 'pdf',
      filename,
      data,
      template,
      config
    } as any);
    
    setIsExporting(false);
  };

  const handleExportCSV = async () => {
    const data = activeTab === 'members' ? getMembersExportData(false) : getHistoryExportData(false);
    if (data.length === 0) {
      toast.error(`No ${activeTab} to export`);
      return;
    }

    setIsExporting(true);
    const filename = activeTab === 'members' 
      ? `referral_members_${format(new Date(), 'yyyy-MM-dd')}`
      : `referral_history_${format(new Date(), 'yyyy-MM-dd')}`;
    
    const config = {
      title: activeTab === 'members' ? 'Referral Members Report' : 'Referral Transaction History',
      columns: activeTab === 'members' ? [
        { key: 'name', header: 'Name' },
        { key: 'company', header: 'Company' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'whatsapp', header: 'WhatsApp' },
        { key: 'joinedDate', header: 'Joined Date' },
        { key: 'status', header: 'Status' },
        { key: 'totalEarned', header: 'Total Earned' },
        { key: 'last24h', header: 'Last 24h' }
      ] : [
        { key: 'date', header: 'Date' },
        { key: 'time', header: 'Time' },
        { key: 'type', header: 'Type' },
        { key: 'description', header: 'Description' },
        { key: 'amount', header: 'Amount' },
        { key: 'status', header: 'Status' },
        { key: 'sourceAmount', header: 'Source Amount' }
      ]
    };

    await download({
      type: 'csv',
      filename,
      data,
      config
    } as any);
    
    setIsExporting(false);
  };

  // Export to Google Sheets
  const handleExportGoogleSheets = async () => {
    const data = activeTab === 'members' ? getMembersExportData(false) : getHistoryExportData(false);
    if (data.length === 0) {
      toast.error(`No ${activeTab} to export`);
      return;
    }

    setIsExporting(true);
    
    try {
      const sheetData = activeTab === 'members' 
        ? data.map(d => ({
            date: d.joinedDate,
            time: d.joinedTime,
            type: 'Referral Member',
            description: `User - ${d.company !== '-' ? d.company : 'Individual'}`,
            points: d.status,
            amount: d.totalEarned
          }))
        : data.map(d => ({
            date: d.date,
            time: d.time,
            type: d.type,
            description: d.description,
            points: d.amount,
            amount: d.sourceAmount,
            status: d.status
          }));

      const now = new Date();
      const timestamp = format(now, 'dd-MM-yyyy HH-mm-ss');
      const uniqueId = Math.random().toString(36).substring(2, 8);
      const sheetName = activeTab === 'members' 
        ? `Referral Members - ${timestamp} (${uniqueId})` 
        : `Referral History - ${timestamp} (${uniqueId})`;
      
      const { data: result, error } = await supabase.functions.invoke('export-to-sheets', {
        body: {
          transactions: sheetData,
          exportType: 'wallet',
          jobTitle: sheetName
        }
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Failed to create Google Sheet');

      window.open(result.spreadsheetUrl, '_blank');
      toast.success('Google Sheet created successfully!');
    } catch (error) {
      console.error('Google Sheets export error:', error);
      toast.error('Google Sheets export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card text-foreground p-4 shadow-sm border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/referral')}
            className="text-foreground hover:bg-muted h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">Referral Activity</h1>
            <p className="text-sm text-muted-foreground">
              {referredUsers?.length || 0} Members • {allTransactions.length || 0} Transactions
            </p>
          </div>
          
          {/* Export Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-foreground hover:bg-muted h-8 px-2 text-xs"
                disabled={isExporting || isDownloading}
              >
                {isExporting || isDownloading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting || isDownloading}>
                <FileText className="h-4 w-4 mr-2" />
                PDF Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting || isDownloading}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                CSV Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportGoogleSheets} disabled={isExporting || isDownloading}>
                <Table className="h-4 w-4 mr-2" />
                Google Sheets
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Tabs defaultValue="members" value={activeTab} onValueChange={(value) => setActiveTab(value as 'members' | 'history')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-card shadow-sm border">
            <TabsTrigger value="members" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Users className="h-4 w-4 mr-2" />
              Members ({referredUsers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Wallet className="h-4 w-4 mr-2" />
              History ({allTransactions.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4">
            {isLoadingUsers ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3"></div>
                <span className="text-muted-foreground">Loading members...</span>
              </div>
            ) : referredUsers && referredUsers.length > 0 ? (
              <div className="space-y-3">
                {referredUsers.map((referredUser) => {
                  const isExpanded = expandedUserId === referredUser.id;
                  const totalEarnings = getUserTotalEarnings(referredUser.referred_user_id);
                  const last24hEarnings = getUserLast24hEarnings(referredUser.referred_user_id);
                  const email = referredUser.profiles?.email;
                  const phone = referredUser.profiles?.phone || referredUser.companies?.phone;
                  const whatsapp = referredUser.profiles?.whatsapp_number || referredUser.companies?.whatsapp_number;
                  
                  return (
                    <Card 
                      key={referredUser.id} 
                      className={`border-l-4 border-l-purple-500 bg-card shadow-sm overflow-hidden transition-all duration-200 ${isExpanded ? 'ring-2 ring-purple-200' : ''}`}
                    >
                      {/* Main row - clickable */}
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => toggleExpand(referredUser.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={referredUser.profiles?.profile_image_url} />
                            <AvatarFallback className="bg-purple-100 text-purple-700">
                              {(referredUser.profiles?.full_name || referredUser.companies?.company_name || 'U')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-800 truncate">
                                {referredUser.profiles?.full_name || referredUser.companies?.company_name || 'User'}
                              </h3>
                              {referredUser.companies && (
                                <Badge variant="outline" className="text-xs shrink-0">Company</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Joined {formatDate(referredUser.created_at).date}
                            </p>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-green-600">₹{totalEarnings.toFixed(2)}</p>
                            {last24hEarnings > 0 && (
                              <p className="text-xs text-green-500">+₹{last24hEarnings.toFixed(2)} today</p>
                            )}
                          </div>
                          
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </div>
                      
                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t bg-gray-50">
                          <div className="pt-3 space-y-3">
                            {email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-slate-600">{email}</span>
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              {phone && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCall(phone)}
                                  className="flex-1"
                                >
                                  <Phone className="h-4 w-4 mr-1" />
                                  Call
                                </Button>
                              )}
                              {whatsapp && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleWhatsApp(whatsapp)}
                                  className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                                >
                                  <MessageCircle className="h-4 w-4 mr-1" />
                                  WhatsApp
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="w-16 h-16 text-purple-200 mb-4" />
                <h3 className="font-semibold text-slate-700 mb-2">No referrals yet</h3>
                <p className="text-muted-foreground text-center">
                  Share your referral code to start earning commission
                </p>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            {isLoadingHistory || isLoadingAdjustments || isLoadingWithdrawals ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3"></div>
                <span className="text-muted-foreground">Loading history...</span>
              </div>
            ) : allTransactions.length > 0 ? (
              <div className="space-y-2">
                {allTransactions.map((transaction) => {
                  const isCommission = transaction.type === 'commission';
                  const isWithdrawal = transaction.type === 'withdrawal';
                  const isAdd = transaction.type === 'add';
                  const isDeduct = transaction.type === 'deduct';
                  
                  return (
                    <Card key={transaction.id} className="p-3 bg-card shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full shrink-0 ${
                          isCommission || isAdd ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {isCommission || isAdd ? (
                            <Plus className={`h-4 w-4 ${isCommission || isAdd ? 'text-green-600' : ''}`} />
                          ) : (
                            <Minus className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-800 text-sm">
                              {isCommission && 'Commission Earned'}
                              {isWithdrawal && 'Withdrawal'}
                              {isAdd && 'Wallet Credit'}
                              {isDeduct && 'Wallet Debit'}
                            </h4>
                            {isWithdrawal && (
                              <Badge 
                                variant={transaction.status === 'success' ? 'default' : transaction.status === 'failed' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {transaction.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(transaction.created_at).date} {formatDate(transaction.created_at).time}
                          </p>
                          {isCommission && (
                            <p className="text-xs text-slate-500 mt-1">
                              From: {(transaction.data as typeof commissionHistory[0]).profiles?.full_name || 
                                     (transaction.data as typeof commissionHistory[0]).companies?.company_name || 'User'}
                            </p>
                          )}
                        </div>
                        
                        <div className={`font-semibold ${isCommission || isAdd ? 'text-green-600' : 'text-red-600'}`}>
                          {isCommission || isAdd ? '+' : '-'}₹{Math.abs(transaction.amount).toFixed(2)}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Wallet className="w-16 h-16 text-purple-200 mb-4" />
                <h3 className="font-semibold text-slate-700 mb-2">No transactions yet</h3>
                <p className="text-muted-foreground text-center">
                  Your commission history will appear here
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ReferralActivity;
