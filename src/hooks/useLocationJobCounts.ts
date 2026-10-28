import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

interface LocationJobCounts {
  cityCount: number;
  stateCount: number;
  countryCount: number;
  loading: boolean;
}

interface LocationData {
  city: string | null;
  state: string | null;
  country: string | null;
}

export const useLocationJobCounts = (location: LocationData): LocationJobCounts => {
  const [counts, setCounts] = useState<LocationJobCounts>({
    cityCount: 0,
    stateCount: 0,
    countryCount: 0,
    loading: true
  });

  const fetchCounts = useCallback(async () => {
    if (!location.city && !location.state && !location.country) {
      console.log('❌ No location data available');
      setCounts({ cityCount: 0, stateCount: 0, countryCount: 0, loading: false });
      return;
    }
    
    console.log('🔍 Fetching job counts for:', { 
      city: location.city, 
      state: location.state, 
      country: location.country 
    });

    setCounts(prev => ({ ...prev, loading: true }));

    try {
      // Normalize search terms - trim whitespace
      const cityTerm = (location.city || '').trim();
      const stateTerm = (location.state || '').trim();
      const countryTerm = (location.country || '').trim();

      // Fetch counts for all three location levels in parallel
      // Use OR to match exact value OR value with trailing spaces
      const [cityResult, stateResult, countryResult] = await Promise.all([
        // City count - Match exact OR with trailing spaces
        cityTerm
          ? supabase
              .from('jobs')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active')
              .eq('visibility', 'public')
              .or(`city.eq.${cityTerm},city.ilike.${cityTerm} %`)
          : Promise.resolve({ count: 0 }),
        
        // State count - Match exact OR with trailing spaces
        stateTerm
          ? supabase
              .from('jobs')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active')
              .eq('visibility', 'public')
              .or(`state.eq.${stateTerm},state.ilike.${stateTerm} %`)
          : Promise.resolve({ count: 0 }),
        
        // Country count - Match exact OR with trailing spaces
        countryTerm
          ? supabase
              .from('jobs')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active')
              .eq('visibility', 'public')
              .or(`country.eq.${countryTerm},country.ilike.${countryTerm} %`)
          : Promise.resolve({ count: 0 })
      ]);

      console.log('📊 Raw query results:', {
        cityResult: cityResult.count,
        stateResult: stateResult.count,
        countryResult: countryResult.count,
        cityError: (cityResult as any).error,
        stateError: (stateResult as any).error,
        countryError: (countryResult as any).error
      });

      const counts = {
        cityCount: cityResult.count || 0,
        stateCount: stateResult.count || 0,
        countryCount: countryResult.count || 0,
        loading: false
      };
      
      console.log('✅ Job counts fetched:', counts);
      setCounts(counts);
    } catch (error) {
      console.error('❌ Error fetching location job counts:', error);
      setCounts({ cityCount: 0, stateCount: 0, countryCount: 0, loading: false });
    }
  }, [location.city, location.state, location.country]);

  useEffect(() => {
    fetchCounts();

    if (!shouldEnableRealtime()) return;

    // Create unique channel name to avoid conflicts
    const channelName = `location-job-counts-${Date.now()}`;
    
    // Subscribe to real-time job changes
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'jobs',
          filter: 'status=eq.active' // Only active jobs
        },
        (payload) => {
          console.log('🔄 Real-time job change detected:', payload);
          
          // Check if this change affects our location counts
          const record = (payload.new || payload.old) as any;
          const shouldUpdate = 
            !location.city && !location.state && !location.country || // No location set
            record?.city === location.city || 
            record?.state === location.state || 
            record?.country === location.country;
          
          if (shouldUpdate) {
            console.log('✅ Location match - refreshing counts');
            fetchCounts();
          } else {
            console.log('⏭️ Location mismatch - skipping update');
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to job updates');
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from real-time updates');
      supabase.removeChannel(channel);
    };
  }, [fetchCounts, location.city, location.state, location.country]);

  return counts;
};
