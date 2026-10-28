import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, TrendingDown, Users } from "lucide-react";

interface FinancialBreakdownProps {
  data?: {
    total_wallet_points: number;
    total_wallet_purchased: number;
    total_wallet_spent: number;
    total_referral_balance: number;
    total_referral_earned: number;
    total_referral_withdrawn: number;
    total_users_with_wallet: number;
    total_users_with_referral: number;
  };
  isLoading?: boolean;
}

export const FinancialBreakdown = ({ data, isLoading }: FinancialBreakdownProps) => {
  if (isLoading || !data) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            Wallet Points Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Balance</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold break-all">{data.total_wallet_points.toLocaleString()}</p>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                <TrendingUp className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Purchased (24h)</span>
              </p>
              <p className="text-base sm:text-lg md:text-xl font-semibold break-all">{data.total_wallet_purchased.toLocaleString()}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                <TrendingDown className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Spent (24h)</span>
              </p>
              <p className="text-base sm:text-lg md:text-xl font-semibold break-all">{data.total_wallet_spent.toLocaleString()}</p>
            </div>
          </div>
          <Separator />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3 flex-shrink-0" />
              Users with Wallet
            </p>
            <p className="text-base sm:text-lg md:text-xl font-semibold">{data.total_users_with_wallet}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            Referral Wallet Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Balance</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold break-all">₹{Number(data.total_referral_balance).toLocaleString()}</p>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                <TrendingUp className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Earned (24h)</span>
              </p>
              <p className="text-base sm:text-lg md:text-xl font-semibold break-all">₹{Number(data.total_referral_earned).toLocaleString()}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                <TrendingDown className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Withdrawn (24h)</span>
              </p>
              <p className="text-base sm:text-lg md:text-xl font-semibold break-all">₹{Number(data.total_referral_withdrawn).toLocaleString()}</p>
            </div>
          </div>
          <Separator />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3 flex-shrink-0" />
              Active Referrers
            </p>
            <p className="text-base sm:text-lg md:text-xl font-semibold">{data.total_users_with_referral}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
