/**
 * DISABLED: Live Session Analytics
 * 
 * This hook has been disabled to reduce Supabase Cached Egress.
 * The realtime subscription + 10-second polling was consuming excessive bandwidth.
 * 
 * To re-enable: restore from git history
 */

interface LocationBreakdown {
  country: string;
  state: string;
  city: string;
  count: number;
}

interface SessionAnalytics {
  activeUsers: number;
  locationBreakdown: LocationBreakdown[];
  loading: boolean;
}

export const useLiveSessionAnalytics = (
  timeFilter: 'all' | 'live' | '5min' | '15min' | '1hour' | 'today' = 'all'
): SessionAnalytics => {
  // Return static empty data - no database calls
  return {
    activeUsers: 0,
    locationBreakdown: [],
    loading: false,
  };
};
