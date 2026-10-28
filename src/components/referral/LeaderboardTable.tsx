import { useCurrentLeaderboard } from '@/hooks/useLeaderboard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Award, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useHourlyRefresh } from '@/hooks/useHourlyRefresh';

interface LeaderboardTableProps {
  showHeaderOnly?: boolean;
}

export const LeaderboardTable = ({ showHeaderOnly = false }: LeaderboardTableProps) => {
  const { data: leaderboard, isLoading } = useCurrentLeaderboard();

  // Get current user
  const [userId, setUserId] = useState<string | null>(null);

  // Shared server-anchored hourly countdown (same for every user, survives refresh)
  const { secondsLeft: timeUntilRefresh } = useHourlyRefresh([
    'currentLeaderboard',
    'myLeaderboardPosition',
  ]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const formatRefreshTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400" />;
      case 3:
        return <Award className="w-4 h-4 sm:w-6 sm:h-6 text-amber-600" />;
      default:
        return <span className="w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center text-sm sm:text-base font-bold">{rank}</span>;
    }
  };

  // If showing header only (for title line)
  if (showHeaderOnly) {
    return (
      <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
        <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${timeUntilRefresh === 0 ? 'animate-spin' : ''}`} />
        <span>{formatRefreshTime(timeUntilRefresh)}</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-6">Loading leaderboard...</div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-6">
        No referrals yet. Be the first to refer and win! 🚀
      </div>
    );
  }

  return (
    <>
      {/* Total participants count */}
      <div className="mb-3 text-xs sm:text-sm text-muted-foreground">
        <span className="font-medium">{leaderboard?.length || 0}</span> participants competing
      </div>

      <div className="space-y-2 sm:space-y-3">
        {leaderboard.map((entry) => {
          const isCurrentUser = entry.user_id === userId;
          return (
            <div
              key={entry.user_id}
              className={`flex items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg transition-colors ${
                isCurrentUser ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/30'
              }`}
            >
              <div className="flex-shrink-0 w-6 sm:w-8">
                {getRankIcon(entry.rank)}
              </div>
              <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                <AvatarImage src={entry.logo_url || ''} alt={entry.company_name} />
                <AvatarFallback>{entry.company_name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate">
                  {entry.company_name}
                  {isCurrentUser && <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-primary">⭐ YOU</span>}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="font-bold text-base sm:text-lg">{entry.active_referrals_count}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  <span className="hidden sm:inline">Active Referrals</span>
                  <span className="sm:hidden">Active</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
