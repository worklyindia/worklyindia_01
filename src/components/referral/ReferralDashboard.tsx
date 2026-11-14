import { useNavigate } from "react-router-dom";
import { useReferralSystem } from "@/hooks/useReferralSystem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Wallet, TrendingUp, Share2, Gift, Trophy, Settings, ChevronRight } from "lucide-react";
import { useReferralSettings } from "@/hooks/useReferralSettings";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { useWithdrawalRequests } from "@/hooks/useWithdrawalRequests";
import { useToast } from "@/hooks/use-toast";
import { copyText, shareText } from "@/utils/openExternalShareUrl";
import { useEffect, useState } from "react";
import { WithdrawalDialog } from "./WithdrawalDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { copyText, shareText } from "@/utils/openExternalShareUrl";

const ReferralDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { user: employerUser } = useEmployerAuth();
  const isEmployer = !!employerUser;
  const [hasInitialized, setHasInitialized] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  
  
  const { settings: referralSettings, isLoading: isLoadingSettings } = useReferralSettings();
  const { paymentSettings } = usePaymentSettings(user?.id);
  const { createWithdrawal, isCreating, withdrawalRequests, isLoading: isLoadingWithdrawals } = useWithdrawalRequests(user?.id);
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
    isLoadingAdjustments,
    generateCode,
    isGenerating,
  } = useReferralSystem();

  // Debug log to check data loading
  useEffect(() => {
    console.log('Referral Dashboard Data:', {
      referralCode,
      referralWallet,
      isLoadingCode,
      isLoadingWallet,
      isGenerating
    });
  }, [referralCode, referralWallet, isLoadingCode, isLoadingWallet, isGenerating]);

  // Get dynamic commission percentage
  const commissionPercentage = referralSettings?.commission_percentage || 50;

  // Auto-generate referral code if user doesn't have one (only once)
  useEffect(() => {
    if (!isLoadingCode && !referralCode && !isGenerating && !hasInitialized) {
      setHasInitialized(true);
      generateCode();
    }
  }, [isLoadingCode, referralCode, isGenerating, hasInitialized, generateCode]);

  const copyToClipboard = async (text: string) => {
    const copied = await copyText(text);
    toast({
      title: copied ? "Copied!" : "Copy failed",
      description: copied ? "Copied to clipboard" : "Please try again",
      variant: copied ? "default" : "destructive",
    });
  };

  const shareReferralLink = async (link: string) => {
    const shared = await shareText(
      "Join Workly India - Remote Jobs",
      "Join India's best remote job platform using my referral code and get exclusive benefits!",
      link,
    );
    if (!shared && !navigator.share) await copyToClipboard(link);
  };

  const referralLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode.referral_code}`
    : "";

  const employerReferralLink = referralCode
    ? `${window.location.origin}/employer-auth?ref=${referralCode.referral_code}`
    : "";

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`, "_blank");
  };

  const handleWithdraw = (amount: number) => {
    createWithdrawal(amount);
  };

  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Gift className="w-8 h-8 text-green-500" />
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold whitespace-nowrap">Referral Wallet</h1>
          <p className="text-slate-600 text-sm sm:text-base">Earn {commissionPercentage}% lifetime commission on every referral payment!</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {referralCode?.total_referrals || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{referralWallet?.total_earned ? Number(referralWallet.total_earned).toFixed(2) : '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={() => navigate(isEmployer ? '/employer/referral/payment-settings' : '/referral/payment-settings')}
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              ₹{referralWallet?.balance_amount ? Number(referralWallet.balance_amount).toFixed(2) : '0.00'}
            </div>
            <Button 
              size="sm" 
              onClick={() => setWithdrawalOpen(true)}
              disabled={!referralWallet || referralWallet.balance_amount <= 0}
              className="w-full"
            >
              Withdraw
            </Button>
          </CardContent>
        </Card>
      </div>

      <WithdrawalDialog 
        open={withdrawalOpen} 
        onOpenChange={setWithdrawalOpen}
        currentBalance={referralWallet?.balance_amount || 0}
        paymentSettings={paymentSettings}
        onWithdraw={handleWithdraw}
        isProcessing={isCreating}
      />
    </div>
  );
};

export default ReferralDashboard;