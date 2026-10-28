/**
 * DISABLED: User Analytics with Realtime
 * 
 * This hook has been disabled to reduce Supabase Cached Egress.
 * Realtime subscription + 30-second polling removed.
 * 
 * To re-enable: restore from git history
 */

interface UserAnalytics {
  totalUniqueToday: number;
  newUsersToday: number;
  returningUsersToday: number;
  loading: boolean;
}

export const useUserAnalytics = (): UserAnalytics => {
  // Return static empty data - no database calls, no realtime
  return {
    totalUniqueToday: 0,
    newUsersToday: 0,
    returningUsersToday: 0,
    loading: false,
  };
};
