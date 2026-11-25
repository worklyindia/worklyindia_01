import { useNavigate } from "react-router-dom";
import { useReferralSystem } from "@/hooks/useReferralSystem";
import { useReferralSettings } from "@/hooks/useReferralSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Share2, Link, Building2, Users, Star, Wallet, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyText, shareText } from "@/utils/openExternalShareUrl";

const ReferralCodePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { referralCode, isLoadingCode, generateCode, isGenerating } = useReferralSystem();
  const { settings: referralSettings } = useReferralSettings();
  
  const commissionPercentage = referralSettings?.commission_percentage || 50;

  const referralLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode.referral_code}`
    : "";

  const employerReferralLink = referralCode
    ? `${window.location.origin}/employer-auth?ref=${referralCode.referral_code}`
    : "";

  const copyToClipboard = async (text: string, label: string) => {
    const copied = await copyText(text);
    toast({
      title: copied ? "Copied!" : "Copy failed",
      description: copied ? `${label} copied to clipboard` : "Please try again",
      variant: copied ? "default" : "destructive",
    });
  };

  const shareReferralLink = async (link: string, type: string) => {
    const shared = await shareText(
      "Join Workly India - Remote Jobs",
      `Join India's best remote job platform using my ${type.toLowerCase()} referral link and get exclusive benefits!`,
      link,
    );
    if (!shared && !navigator.share) await copyToClipboard(link, `${type} link`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card text-foreground p-4 shadow-sm border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/employer/referral')}
            className="text-foreground hover:bg-muted h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Your Referral Code</h1>
            <p className="text-sm text-muted-foreground">Share and earn commission</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoadingCode || isGenerating ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <span className="text-muted-foreground">Loading your referral code...</span>
          </div>
        ) : referralCode ? (
          <>
            {/* Referral Code Card */}
            <Card className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-1">Your Referral Code</p>
                <div className="text-3xl font-bold font-mono tracking-wider">
                  {referralCode.referral_code}
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard(referralCode.referral_code, "Referral code")}
                  className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => shareReferralLink(referralLink, "Referral")}
                  className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </Card>

            {/* Job Seeker Referral Link */}
            <Card className="p-4 bg-card shadow-sm border-l-4 border-l-green-500">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-full bg-green-100 shrink-0">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-green-700">Job Seeker Referral Link</h3>
                  <p className="text-xs text-muted-foreground">Share with job seekers to refer them</p>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="text-xs bg-gray-50 font-mono"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(referralLink, "Job seeker link")}
                    className="flex-1 bg-green-50 hover:bg-green-100 border-green-200"
                  >
                    <Copy className="h-4 w-4 mr-1 text-green-600" />
                    <span className="text-green-700">Copy</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shareReferralLink(referralLink, "Job seeker")}
                    className="flex-1 bg-green-50 hover:bg-green-100 border-green-200"
                  >
                    <Share2 className="h-4 w-4 mr-1 text-green-600" />
                    <span className="text-green-700">Share</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Employer Referral Link */}
            <Card className="p-4 bg-card shadow-sm border-l-4 border-l-blue-500">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-full bg-blue-100 shrink-0">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-blue-700">Employer Referral Link</h3>
                  <p className="text-xs text-muted-foreground">Share with employers to refer them</p>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  value={employerReferralLink}
                  readOnly
                  className="text-xs bg-gray-50 font-mono"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(employerReferralLink, "Employer link")}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 border-blue-200"
                  >
                    <Copy className="h-4 w-4 mr-1 text-blue-600" />
                    <span className="text-blue-700">Copy</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shareReferralLink(employerReferralLink, "Employer")}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 border-blue-200"
                  >
                    <Share2 className="h-4 w-4 mr-1 text-blue-600" />
                    <span className="text-blue-700">Share</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Referral Benefits Section */}
            <Card className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Referral Benefits
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-green-700 text-sm">{commissionPercentage}% Commission</h4>
                    <p className="text-xs text-green-600">Lifetime earnings on all payments</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-700 text-sm">Instant Payouts</h4>
                    <p className="text-xs text-blue-600">Commission added to wallet immediately</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-purple-700 text-sm">No Limits</h4>
                    <p className="text-xs text-purple-600">Refer unlimited users & earn more</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-card rounded-lg border-l-4 border-green-500">
                <h4 className="font-semibold text-slate-700 text-sm mb-2">How it works:</h4>
                <ol className="text-xs text-slate-600 space-y-1">
                  <li>1. Share your referral code/link with friends & companies</li>
                  <li>2. When they signup using your code, they become your referral</li>
                  <li>3. Earn {commissionPercentage}% commission on all their payments</li>
                  <li>4. Commission is instantly added to your referral wallet</li>
                </ol>
              </div>
            </Card>

            {/* Tips Section */}
            <Card className="p-4 bg-amber-50 border-amber-200">
              <h3 className="font-semibold text-amber-800 mb-2">💡 Tips to maximize referrals</h3>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Share your link on social media groups</li>
                <li>• Send to friends looking for jobs or hiring</li>
                <li>• Add your referral code to your email signature</li>
              </ul>
            </Card>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <Link className="w-16 h-16 text-blue-200 mb-4" />
            <h3 className="font-semibold text-slate-700 mb-2">No referral code found</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Generate your referral code to start earning
            </p>
            <Button onClick={() => generateCode()}>
              Generate Referral Code
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralCodePage;
