import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Wallet, 
  TrendingUp, 
  Calendar,
  Phone,
  Plus,
  Minus,
  Copy,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { useReferralSystem } from "@/hooks/useReferralSystem";
import { useSupabaseDownload } from "@/hooks/useSupabaseDownload";
import { format } from "date-fns";
import { toast } from "sonner";
import AddReferralBalanceDialog from "@/components/AddReferralBalanceDialog";
import DeductReferralBalanceDialog from "@/components/DeductReferralBalanceDialog";
import { useNativeFeel } from "@/hooks/useNativeFeel";

interface ReferralManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employer: {
    user_id: string;
    company_name: string;
  };
}

const ReferralManagementDialog = ({ open, onOpenChange, employer }: ReferralManagementDialogProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeductDialog, setShowDeductDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "history">("overview");
  const { tapFeedback, successFeedback } = useNativeFeel();
  
  const {
    referralCode,
    referralWallet,
    commissionHistory,
    referredUsers,
    walletAdjustments,
    isLoadingCode,
    isLoadingWallet,
    isLoadingHistory,
    isLoadingUsers,
    isLoadingAdjustments
  } = useReferralSystem(employer.user_id);

  const handleCopyReferralCode = () => {
    if (referralCode?.referral_code) {
      tapFeedback();
      navigator.clipboard.writeText(referralCode.referral_code);
      toast.success("Referral code copied!");
    }
  };

  const queryClient = useQueryClient();
  
  const handleWalletUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["referralWallet", employer.user_id] });
    queryClient.invalidateQueries({ queryKey: ["referralWalletAdjustments", employer.user_id] });
    queryClient.invalidateQueries({ queryKey: ["commissionHistory", employer.user_id] });
  };

  const { downloadCSV, downloadPDF, isDownloading } = useSupabaseDownload();

  const exportReferralHistoryPDF = async () => {
    const allHistory = [
      ...(commissionHistory || []).map(c => ({ ...c, type: 'commission' as const })),
      ...(walletAdjustments || []).map(a => ({ ...a, type: 'adjustment' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (allHistory.length === 0) {
      toast.error("No history to export");
      return;
    }

    const pdfData = allHistory.map(item => {
      const isCommission = item.type === 'commission';
      const description = isCommission 
        ? `Commission from ${'profiles' in item && item.profiles?.full_name || 'companies' in item && item.companies?.company_name || 'Unknown'}`
        : `${'adjustment_type' in item && item.adjustment_type === 'add' ? 'Added' : 'Deducted'}: ${'reason' in item ? item.reason : ''}`;
      const amount = isCommission 
        ? ('commission_amount' in item ? item.commission_amount : 0)
        : ('amount' in item ? item.amount : 0);
      const sign = isCommission ? '+' : ('adjustment_type' in item && item.adjustment_type === 'add' ? '+' : '-');
      
      return {
        Date: format(new Date(item.created_at), 'dd MMMM yyyy'),
        Type: isCommission ? 'Commission' : 'Adjustment',
        Description: description.substring(0, 35),
        Amount: `${sign}₹${amount}`,
        Status: 'status' in item ? item.status : 'completed'
      };
    });

    await downloadPDF(`referral_history_${employer.company_name}_${format(new Date(), 'yyyy-MM-dd')}`, pdfData, 'Referral History');
    toast.success(`Exported ${allHistory.length} transactions to PDF`);
  };

  const exportReferralHistoryCSV = async () => {
    const allHistory = [
      ...(commissionHistory || []).map(c => ({ ...c, type: 'commission' as const })),
      ...(walletAdjustments || []).map(a => ({ ...a, type: 'adjustment' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (allHistory.length === 0) {
      toast.error("No history to export");
      return;
    }

    const csvData = allHistory.map(item => {
      const isCommission = item.type === 'commission';
      const description = isCommission 
        ? `Commission from ${'profiles' in item && item.profiles?.full_name || 'companies' in item && item.companies?.company_name || 'Unknown'}`
        : `${'adjustment_type' in item && item.adjustment_type === 'add' ? 'Added' : 'Deducted'}: ${'reason' in item ? item.reason : ''}`;
      const amount = isCommission 
        ? ('commission_amount' in item ? item.commission_amount : 0)
        : ('amount' in item ? item.amount : 0);
      const sign = isCommission ? '+' : ('adjustment_type' in item && item.adjustment_type === 'add' ? '+' : '-');
      
      return {
        Date: format(new Date(item.created_at), 'dd MMMM yyyy'),
        Type: isCommission ? 'Commission' : 'Adjustment',
        Description: description,
        'Amount (₹)': `${sign}${amount}`,
        Status: 'status' in item ? item.status : 'completed'
      };
    });

    await downloadCSV(`referral_history_${employer.company_name}_${format(new Date(), 'yyyy-MM-dd')}`, csvData);
    toast.success(`Exported ${allHistory.length} transactions to CSV`);
  };

  const handleClose = () => {
    tapFeedback();
    onOpenChange(false);
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex flex-col items-center text-center">
            <Wallet className="h-6 w-6 text-green-600 mb-2" />
            <div className="text-lg font-bold text-green-600">
              ₹{referralWallet?.balance_amount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Referral Balance</p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex flex-col items-center text-center">
            <Users className="h-6 w-6 text-blue-600 mb-2" />
            <div className="text-lg font-bold text-blue-600">
              {referralCode?.total_referrals || 0}
            </div>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex flex-col items-center text-center">
            <TrendingUp className="h-6 w-6 text-purple-600 mb-2" />
            <div className="text-lg font-bold text-purple-600">
              ₹{referralWallet?.total_earned || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex flex-col items-center text-center">
            <Copy className="h-6 w-6 text-orange-600 mb-2" />
            <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded truncate max-w-full">
              {referralCode?.referral_code || 'N/A'}
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleCopyReferralCode}
              className="h-8 text-xs mt-1 active:scale-95"
              disabled={!referralCode?.referral_code}
            >
              Copy
            </Button>
          </div>
        </Card>
      </div>

      {/* Wallet Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Referral Wallet Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => { tapFeedback(); setShowAddDialog(true); }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-base h-12 active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Balance
            </Button>
            <Button 
              onClick={() => { tapFeedback(); setShowDeductDialog(true); }}
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-base h-12 active:scale-95 transition-transform"
            >
              <Minus className="h-4 w-4 mr-2" />
              Deduct Balance
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMembers = () => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <Users className="h-5 w-5" />
        Referred Members ({referredUsers?.length || 0})
      </h3>
      <div className="space-y-3">
        {isLoadingUsers ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 h-16 rounded"></div>
            ))}
          </div>
        ) : referredUsers && referredUsers.length > 0 ? (
          referredUsers.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {user.profiles?.full_name || user.companies?.company_name || 'Unknown'}
                  </h4>
                  {user.profiles?.phone && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                      <Phone className="h-3 w-3" />
                      {user.profiles.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(user.created_at), 'dd MMMM yyyy')}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  Active
                </Badge>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No referred members yet</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => {
    const allHistory = [
      ...(commissionHistory || []).map(c => ({ ...c, type: 'commission' as const })),
      ...(walletAdjustments || []).map(a => ({ ...a, type: 'adjustment' as const }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transaction History ({allHistory.length})
          </h3>
          {allHistory.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3 text-xs active:scale-95"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportReferralHistoryPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportReferralHistoryCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  CSV Download
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="space-y-3">
          {isLoadingHistory || isLoadingAdjustments ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-20 rounded"></div>
              ))}
            </div>
          ) : allHistory && allHistory.length > 0 ? (
            allHistory.map((item) => {
              const isCommission = item.type === 'commission';
              
              return (
                <Card key={item.id} className="p-4">
                  {isCommission ? (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                          <h4 className="font-medium text-sm">Commission Earned</h4>
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          {'profiles' in item && item.profiles?.full_name || 
                           'companies' in item && item.companies?.company_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Source: ₹{'source_payment_amount' in item ? item.source_payment_amount : 0} ({'source_type' in item ? item.source_type : 'N/A'})
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.created_at), 'dd MMMM yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-green-600">
                          +₹{'commission_amount' in item ? item.commission_amount : 0}
                        </div>
                        <Badge 
                          variant={'status' in item && item.status === 'paid' ? 'default' : 'secondary'}
                          className="text-xs mt-1"
                        >
                          {'status' in item ? item.status : 'N/A'}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {'adjustment_type' in item && item.adjustment_type === 'add' ? (
                            <Plus className="h-4 w-4 text-green-600" />
                          ) : (
                            <Minus className="h-4 w-4 text-red-600" />
                          )}
                          <h4 className="font-medium text-sm">
                            {'adjustment_type' in item && item.adjustment_type === 'add' ? 'Balance Added' : 'Balance Deducted'}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Reason: {'reason' in item ? item.reason : 'N/A'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.created_at), 'dd MMMM yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-base font-bold ${'adjustment_type' in item && item.adjustment_type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                          {'adjustment_type' in item && item.adjustment_type === 'add' ? '+' : '-'}₹{'amount' in item ? item.amount : 0}
                        </div>
                        <Badge variant="outline" className="text-xs mt-1">
                          Admin Adjustment
                        </Badge>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No transaction history yet</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent 
          side="bottom" 
          className="rounded-t-3xl p-0 h-[95vh] [&>button]:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 pb-2 border-b flex-shrink-0">
              <StandardSheetHeader 
                title={`Referral - ${employer.company_name}`}
                onClose={handleClose}
              />
            </div>

            {/* Tab Navigation */}
            <div className="border-b bg-gray-50 px-4 py-2">
              <div className="flex space-x-1">
                {[
                  { key: "overview", label: "Overview" },
                  { key: "members", label: "Members" },
                  { key: "history", label: "History" },
                ].map((tab) => (
                  <Button
                    key={tab.key}
                    variant={activeTab === tab.key ? "default" : "ghost"}
                    size="sm"
                    onClick={() => { tapFeedback(); setActiveTab(tab.key as any); }}
                    className="flex-1 text-xs active:scale-95"
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 native-scrolling overflow-y-auto p-4">
              {activeTab === "overview" && renderOverview()}
              {activeTab === "members" && renderMembers()}
              {activeTab === "history" && renderHistory()}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Balance Dialog */}
      <AddReferralBalanceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        userId={employer.user_id}
        onSuccess={handleWalletUpdate}
      />

      {/* Deduct Balance Dialog */}
      <DeductReferralBalanceDialog
        open={showDeductDialog}
        onOpenChange={setShowDeductDialog}
        userId={employer.user_id}
        currentBalance={referralWallet?.balance_amount || 0}
        onSuccess={handleWalletUpdate}
      />
    </>
  );
};

export default ReferralManagementDialog;
