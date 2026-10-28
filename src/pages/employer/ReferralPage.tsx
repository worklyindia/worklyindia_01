import { useNavigate } from "react-router-dom";
import { goBack } from "@/lib/goBack";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Users, Trophy } from "lucide-react";
import ReferralDashboard from "@/components/referral/ReferralDashboard";
import Lottie from "lottie-react";
import referAndEarnAnimation from "@/assets/refer-and-earn.json";
import { useReferralProfile } from "@/hooks/useReferralProfile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";

const ReferralPage = () => {
  const navigate = useNavigate();
  const { data: referralProfile } = useReferralProfile();
  const displayName = referralProfile?.display_name || "Referral profile";
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Header */}
      <div className="sticky top-0 z-10 bg-card text-foreground p-4 shadow-sm border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goBack(navigate, '/employer-portal')}
            aria-label="Go back"
            className="text-foreground hover:bg-muted h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Referral Wallet</h1>
            <p className="text-sm text-muted-foreground">Earn commission on referrals</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open referral profile"
            onClick={() => navigate('/referral-profile')}
            className="h-9 w-9 rounded-full text-foreground hover:bg-muted"
          >
            <Avatar className="h-8 w-8 border border-border">
              <SafeAvatarImage src={referralProfile?.photo_url} width={64} alt={displayName} />
              <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </div>

      {/* Refer & Earn Lottie Banner */}
      <div className="px-4 pt-4">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-500/10 via-green-400/10 to-amber-300/10 border border-success/30 shadow-sm">
          <Lottie animationData={referAndEarnAnimation} loop autoplay className="w-full h-auto" />
        </div>
      </div>

      {/* Main Content */}
      <main className="pb-24">
        <ReferralDashboard />
      </main>

      {/* Bottom Navigation - 3 Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
        <div className="grid grid-cols-3 gap-1 p-2">
          <Button
            variant="ghost"
            className="flex flex-col items-center justify-center h-16 rounded-lg hover:bg-blue-50"
            onClick={() => navigate('/employer/referral-code')}
          >
            <Share2 className="h-5 w-5 text-blue-600 mb-1" />
            <span className="text-xs text-blue-700 font-medium text-center leading-tight">Referral Code</span>
          </Button>
          
          <Button
            variant="ghost"
            className="flex flex-col items-center justify-center h-16 rounded-lg hover:bg-purple-50"
            onClick={() => navigate('/employer/referral-activity')}
          >
            <Users className="h-5 w-5 text-purple-600 mb-1" />
            <span className="text-xs text-purple-700 font-medium text-center leading-tight">Activity</span>
          </Button>
          
          <Button
            variant="ghost"
            className="flex flex-col items-center justify-center h-16 rounded-lg hover:bg-amber-50"
            onClick={() => navigate('/employer/monthly-competition')}
          >
            <Trophy className="h-5 w-5 text-amber-600 mb-1" />
            <span className="text-xs text-amber-700 font-medium text-center leading-tight">Competition</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
