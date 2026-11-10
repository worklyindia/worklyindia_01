import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRevenueTracking, TimeRange } from "@/hooks/useRevenueTracking";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Zap, 
  ShieldCheck,
  Users,
  RefreshCw,
  ArrowLeft,
  Trophy
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";

const RevenueTracking = () => {
  const navigate = useNavigate();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30d');
  const { revenue, loading, refetch } = useRevenueTracking(selectedRange);

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '3m', label: '3 Months' },
    { value: '6m', label: '6 Months' },
    { value: '1y', label: '1 Year' },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <>
      <SEO 
        title="Revenue Payment Tracking - Owner Portal"
        description="Track all revenue from payments, commissions, and transactions"
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 pb-20">
        {/* Mobile Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/owner-portal')}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">Revenue Tracking</h1>
                <p className="text-xs text-muted-foreground">Payment Analytics</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              className="rounded-full"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Time Range Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {timeRanges.map((range) => (
                  <Button
                    key={range.value}
                    variant={selectedRange === range.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRange(range.value)}
                    className="flex-1 min-w-[80px]"
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Revenue */}
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Gross Revenue</span>
                  <DollarSign className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32 bg-white/20" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">
                      {formatCurrency(
                        revenue.totalPointsRevenue + 
                        revenue.totalBoostRevenue + 
                        revenue.totalVerificationRevenue
                      )}
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      {revenue.percentageChange >= 0 ? (
                        <TrendingUp className="w-4 h-4 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 mr-1" />
                      )}
                      <span>{formatPercentage(revenue.percentageChange)}</span>
                      <span className="ml-2 opacity-80">vs previous</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Net Revenue */}
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Net Revenue</span>
                  <Wallet className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32 bg-white/20" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">
                      {formatCurrency(revenue.netRevenue)}
                    </div>
                    <div className="mt-2 text-sm opacity-90">
                      After commission deductions
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Total Referral Commission */}
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Referral Commission</span>
                  <Users className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32 bg-white/20" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">
                      {formatCurrency(revenue.totalReferralCommission)}
                    </div>
                    <div className="mt-2 text-sm opacity-90">
                      Paid to referrers
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Competition Prizes */}
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Competition Prizes</span>
                  <Trophy className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32 bg-white/20" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">
                      {formatCurrency(revenue.totalCompetitionPrizes)}
                    </div>
                    <div className="mt-2 text-sm opacity-90">
                      {revenue.competitionPrizesCount} winners
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Point Wallet Purchases */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Point Wallet</p>
                    <p className="text-sm text-muted-foreground">
                      {loading ? '...' : `${revenue.transactionsCount} transactions`}
                    </p>
                  </div>
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(revenue.totalPointsRevenue)}</p>
                  </div>
                )}
              </div>

              {/* Job Boost Purchases */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-500 rounded-lg">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Job Boosts</p>
                    <p className="text-sm text-muted-foreground">
                      {loading ? '...' : `${revenue.boostsCount} boosts`}
                    </p>
                  </div>
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(revenue.totalBoostRevenue)}</p>
                  </div>
                )}
              </div>

              {/* Verification Badge Purchases */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Verified Badges</p>
                    <p className="text-sm text-muted-foreground">
                      {loading ? '...' : `${revenue.verificationsCount} purchases`}
                    </p>
                  </div>
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(revenue.totalVerificationRevenue)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Gross Revenue</span>
                {loading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <span className="font-semibold">
                    {formatCurrency(
                      revenue.totalPointsRevenue + 
                      revenue.totalBoostRevenue + 
                      revenue.totalVerificationRevenue
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-b text-red-600 dark:text-red-400">
                <span>(-) Referral Commission</span>
                {loading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <span className="font-semibold">
                    {formatCurrency(revenue.totalReferralCommission)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-b text-red-600 dark:text-red-400">
                <span>(-) Competition Prizes</span>
                {loading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <span className="font-semibold">
                    {formatCurrency(revenue.totalCompetitionPrizes)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-3 bg-green-50 dark:bg-green-950/20 px-4 rounded-lg">
                <span className="font-semibold text-lg">Net Revenue</span>
                {loading ? (
                  <Skeleton className="h-7 w-28" />
                ) : (
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(revenue.netRevenue)}
                  </span>
                )}
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Previous Period Revenue</p>
                    {loading ? (
                      <Skeleton className="h-6 w-24 mt-1" />
                    ) : (
                      <p className="text-lg font-semibold">
                        {formatCurrency(revenue.previousPeriodRevenue)}
                      </p>
                    )}
                  </div>
                  {!loading && (
                    <Badge 
                      variant={revenue.percentageChange >= 0 ? "default" : "destructive"}
                      className="text-sm"
                    >
                      {formatPercentage(revenue.percentageChange)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default RevenueTracking;
