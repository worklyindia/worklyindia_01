import { useMyLeaderboardPosition } from '@/hooks/useLeaderboard';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

export const MyPosition = () => {
  const { data: position, isLoading } = useMyLeaderboardPosition();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading your position...</div>
      </Card>
    );
  }

  if (!position || position.rank === 0) {
    return (
      <Card className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5">
        <h3 className="text-base sm:text-lg font-bold mb-2">📊 Your Position</h3>
        <p className="text-sm sm:text-base text-muted-foreground">
          You haven't made any active referrals yet. Start referring to join the leaderboard! 🚀
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5">
      <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">📊 Your Position</h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Current Rank</p>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xl sm:text-2xl font-bold px-3 py-1 sm:px-4 sm:py-2">
              #{position.rank}
            </Badge>
          </div>
        </div>
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Active Referrals</p>
          <p className="text-2xl sm:text-3xl font-bold">{position.active_referrals_count}</p>
        </div>
      </div>
      {position.rank > 1 && position.next_rank_gap > 0 && (
        <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-background rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
          <p className="text-xs sm:text-sm">
            <span className="font-semibold">{position.next_rank_gap}</span> more to reach{' '}
            <span className="font-bold">Rank #{position.rank - 1}</span>! 🎯
          </p>
        </div>
      )}
      {position.rank <= 3 && (
        <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-xs sm:text-sm font-semibold text-green-600">
            🏆 You're in the winning zone! Keep it up to secure your prize!
          </p>
        </div>
      )}
    </Card>
  );
};
