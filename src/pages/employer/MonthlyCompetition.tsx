import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeaderboardTimer } from "@/components/referral/LeaderboardTimer";
import { LeaderboardTable } from "@/components/referral/LeaderboardTable";
import { MyPosition } from "@/components/referral/MyPosition";
import { LeaderboardHistory } from "@/components/referral/LeaderboardHistory";
import { Trophy, Medal, Award, TrendingUp, Users, Gift, Star, Crown, Zap, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import { useCompetitionPrizes } from "@/hooks/useCompetitionPrizes";
import { Skeleton } from "@/components/ui/skeleton";

const MonthlyCompetition = () => {
  const navigate = useNavigate();
  const { data: prizes, isLoading } = useCompetitionPrizes();
  const [showRules, setShowRules] = useState(false);

  const formatPrize = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getPrizeAmount = (rank: number) => {
    const prize = prizes?.find(p => p.rank === rank);
    return prize?.prize_amount || 0;
  };

  return (
    <>
      <SEO 
        title="Monthly Referral Competition - Win Amazing Prizes"
        description="Compete every month to bring the most active users and win cash prizes. Join the leaderboard competition and earn rewards!"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
        {/* Hero Header */}
        <div className="bg-gradient-to-r from-primary via-primary/90 to-accent text-primary-foreground">
          <div className="container mx-auto px-4 py-8">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-4 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="text-center space-y-3 md:space-y-4 py-6 md:py-8">
              <div className="animate-scale-in">
                <Trophy className="w-12 h-12 md:w-20 md:h-20 mx-auto mb-3 md:mb-4 text-yellow-300 drop-shadow-glow" />
              </div>
              
              <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold mb-2 animate-fade-in px-2">
                Monthly Referral Competition
              </h1>
              
              <p className="text-base md:text-xl lg:text-2xl text-primary-foreground/90 animate-fade-in px-2">
                Compete. Refer. Win. Repeat Every Month!
              </p>
              
              <div className="animate-fade-in">
                <LeaderboardTimer />
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
          {/* Prize Cards - Featured Section */}
          <Card className="border-2 border-primary/20 shadow-lg bg-gradient-to-br from-background to-primary/5">
            <CardHeader>
              <CardTitle className="text-xl md:text-3xl flex items-center gap-2 justify-center">
                <Crown className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
                Win Amazing Cash Prizes
              </CardTitle>
              <CardDescription className="text-center text-sm md:text-lg">
                Top 3 referrers get rewarded automatically every month!
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 max-w-md mx-auto">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4 max-w-md mx-auto">
                  {/* 1st Place */}
                  <div className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg md:text-xl">
                    <Medal className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-yellow-500 shrink-0" />
                    <span className="font-semibold text-foreground">1st Place</span>
                    <span className="font-bold text-yellow-600 ml-auto">{formatPrize(getPrizeAmount(1))}</span>
                  </div>

                  {/* 2nd Place */}
                  <div className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg md:text-xl">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-gray-500 shrink-0" />
                    <span className="font-semibold text-foreground">2nd Place</span>
                    <span className="font-bold text-gray-600 ml-auto">{formatPrize(getPrizeAmount(2))}</span>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg md:text-xl">
                    <Star className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-amber-600 shrink-0" />
                    <span className="font-semibold text-foreground">3rd Place</span>
                    <span className="font-bold text-amber-600 ml-auto">{formatPrize(getPrizeAmount(3))}</span>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground text-center">
                  <Zap className="w-4 h-4 text-primary shrink-0" />
                  <span>Prizes are automatically credited to your Referral Wallet at month end</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Position */}
          <div className="animate-fade-in">
            <MyPosition />
          </div>

          {/* Leaderboard */}
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between gap-2 mb-2">
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  <span className="whitespace-nowrap">Leaderboard</span>
                </CardTitle>
                <LeaderboardTable showHeaderOnly />
              </div>
              <CardDescription className="space-y-2">
                <p>Rankings updated every hour</p>
                <p className="text-xs">
                  <strong>How to Win:</strong> Only referrals made THIS MONTH who completed at least one purchase (generated commission) count towards your ranking. Share your code, get active users, and watch your rank climb! Count resets to 0 at the start of each new month.
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeaderboardTable />
            </CardContent>
          </Card>

          {/* Competition Rules */}
          <Card className="border-2 border-muted">
            <CardHeader className="p-0">
              <Button
                variant="ghost"
                className="w-full justify-between px-3 py-3 md:px-4 md:py-4 h-auto hover:bg-muted/50"
                onClick={() => setShowRules(!showRules)}
              >
                <div className="flex items-center gap-2 text-left">
                  <span className="text-base md:text-lg lg:text-xl font-semibold">
                    📋 Competition Rules & Guidelines
                  </span>
                </div>
                {showRules ? (
                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground shrink-0" />
                )}
              </Button>
            </CardHeader>
            {showRules && (
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg mb-3">✅ What Counts</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                        <span><strong>Active Users Only:</strong> Users who generate commission payments</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                        <span><strong>Valid Referrals:</strong> Properly signed up using your referral code</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                        <span><strong>Real Activity:</strong> Genuine users making actual payments</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg mb-3">❌ What Doesn&apos;t Count</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                        <span><strong>Inactive Users:</strong> Registered but never made payments</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                        <span><strong>Banned/Deleted:</strong> Users with suspended or deleted accounts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                        <span><strong>Duplicate Entries:</strong> Same user counted multiple times</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Important Notes
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Competition runs from <strong>1st to last day</strong> of each month (IST timezone)</li>
                    <li>• Rankings update in <strong>real-time</strong> - check your position anytime</li>
                    <li>• In case of a tie, <strong>first to reach the count wins</strong></li>
                    <li>• Winners are determined <strong>automatically</strong> at 23:59 on last day</li>
                    <li>• Prizes are <strong>instantly credited</strong> to Referral Wallet</li>
                    <li>• New cycle starts automatically at 00:00 on 1st of next month</li>
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Past Winners History */}
          <Card className="border-2 border-muted">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Gift className="w-6 h-6 text-primary" />
                Past Competition Winners
              </CardTitle>
              <CardDescription>
                View historical leaderboard results and past winners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <LeaderboardHistory />
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <Card className="border-2 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10">
            <CardContent className="p-8 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h3 className="text-2xl font-bold mb-3">Ready to Compete?</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Start referring active users today and climb the leaderboard! The more commission-generating users you refer, the higher your chances of winning.
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate('/employer/referral')}
                className="gap-2"
              >
                <Users className="w-5 h-5" />
                Go to Referral Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default MonthlyCompetition;
