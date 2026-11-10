import { useEffect, useState } from "react";
import { Award, Calendar, Medal, Trophy } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useLeaderboardHistory } from "@/hooks/useLeaderboard";
import { supabase } from "@/integrations/supabase/client";

const CompetitionHistory = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  const { data: history, isLoading } = useLeaderboardHistory(userId || undefined);
  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Award className="h-5 w-5 text-warning" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Past Competitions" />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading history...</div>
        ) : !history?.length ? (
          <div className="py-12 text-center"><p className="text-muted-foreground">No competition history yet.</p><p className="mt-2 text-sm text-muted-foreground">Start referring to appear in future competitions!</p></div>
        ) : history.map((entry) => (
          <Card key={`${entry.cycle_id}-${entry.user_id}`} className="p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground"><Calendar className="mt-0.5 h-4 w-4 shrink-0" /><span>{format(new Date(entry.cycle_start), "MMMM d, yyyy")} - {format(new Date(entry.cycle_end), "MMMM d, yyyy")}</span></div>
              {entry.final_rank <= 3 && <Badge className="shrink-0 gap-1">{rankIcon(entry.final_rank)}Rank #{entry.final_rank}</Badge>}
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1"><dt className="text-muted-foreground">Company</dt><dd className="font-semibold">{entry.company_name}</dd></div>
              <div><dt className="text-muted-foreground">Active Referrals</dt><dd className="font-semibold">{entry.active_referrals_count}</dd></div>
              <div><dt className="text-muted-foreground">Reward Earned</dt><dd className="font-bold text-success">{entry.reward_amount > 0 ? `₹${entry.reward_amount}` : "-"}</dd></div>
            </dl>
            {entry.reward_amount > 0 && <p className="mt-3 rounded bg-success/10 p-2 text-sm text-success">Winner! Reward credited to your wallet.</p>}
          </Card>
        ))}
      </main>
    </div>
  );
};

export default CompetitionHistory;