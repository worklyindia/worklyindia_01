import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface InterviewStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalParticipants: number;
  avgAttendance: number;
  avgDuration: number;
  completionRate: number;
  upcomingSessions: number;
  hasData: boolean;
}

const getDateFilter = (period: string) => {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.setHours(0, 0, 0, 0)).toISOString();
    case "week":
      return new Date(now.setDate(now.getDate() - 7)).toISOString();
    case "month":
      return new Date(now.setDate(now.getDate() - 30)).toISOString();
    case "all":
    default:
      return new Date(0).toISOString();
  }
};

export const useInterviewAnalytics = (period: string = "month") => {
  return useQuery({
    queryKey: ["interview-analytics", period],
    queryFn: async (): Promise<InterviewStats> => {
      const dateFilter = getDateFilter(period);

      // Query interviews
      const { data: interviews, error: interviewsError } = await supabase
        .from("interviews")
        .select("*")
        .gte("created_at", dateFilter);

      if (interviewsError) throw interviewsError;

      // Query participants
      const { data: participants, error: participantsError } = await supabase
        .from("interview_participants")
        .select("*")
        .gte("joined_at", dateFilter);

      if (participantsError) throw participantsError;

      const totalSessions = interviews?.length || 0;
      const activeSessions = interviews?.filter(i => i.status === "ongoing").length || 0;
      const completedSessions = interviews?.filter(i => i.status === "completed").length || 0;
      const upcomingSessions = interviews?.filter(i => i.status === "scheduled").length || 0;
      
      const totalParticipants = participants?.length || 0;
      
      // Calculate average duration in minutes
      const totalDuration = interviews?.reduce((sum, interview) => {
        return sum + (interview.meeting_duration_seconds || 0);
      }, 0) || 0;
      const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions / 60) : 0;
      
      // Calculate average attendance per session
      const avgAttendance = totalSessions > 0 ? Math.round(totalParticipants / totalSessions) : 0;
      
      // Calculate completion rate
      const completionRate = totalSessions > 0 
        ? Math.round((completedSessions / totalSessions) * 1000) / 10 
        : 0;

      return {
        totalSessions,
        activeSessions,
        completedSessions,
        totalParticipants,
        avgAttendance,
        avgDuration,
        completionRate,
        upcomingSessions,
        hasData: totalSessions > 0
      };
    },
  });
};
