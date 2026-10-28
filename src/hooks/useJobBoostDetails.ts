import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface JobBoostDetails {
  id: string;
  job_id: string;
  boost_start_date: string;
  boost_end_date: string;
  boost_package_id: string;
  amount_paid: number;
  status: string;
  created_at: string;
  package_name: string;
  boost_days: number;
  boost_level: number;
}

export const useJobBoostDetails = (jobId: string | null) => {
  const [boostDetails, setBoostDetails] = useState<JobBoostDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setBoostDetails(null);
      return;
    }

    const fetchBoostDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 Fetching boost details for jobId:', jobId);

        // Fetch active boost for the job
        const { data: boostData, error: boostError } = await supabase
          .from('job_boosts')
          .select(`
            id,
            job_id,
            boost_start_date,
            boost_end_date,
            boost_package_id,
            amount_paid,
            status,
            created_at,
            boost_packages (
              name,
              boost_days,
              boost_level
            )
          `)
          .eq('job_id', jobId)
          .eq('status', 'active')
          .not('boost_end_date', 'is', null)
          .gte('boost_end_date', new Date().toISOString());

        console.log('🔍 Boost query result:', { boostData, boostError });

        if (boostError) {
          if (boostError.code === 'PGRST116') {
            // No active boost found
            console.log('❌ No active boost found for job:', jobId);
            setBoostDetails(null);
          } else {
            throw boostError;
          }
        } else if (boostData && boostData.length > 0) {
          const boost = boostData[0]; // Take the first active boost
          console.log('✅ Found active boost:', boost);
          setBoostDetails({
            ...boost,
            package_name: boost.boost_packages?.name || 'Unknown Package',
            boost_days: boost.boost_packages?.boost_days || 0,
            boost_level: boost.boost_packages?.boost_level || 1
          });
        } else {
          // Fallback: Check job table directly for boost information
          console.log('🔄 No job_boosts record found, checking job table directly...');
          const { data: jobData, error: jobError } = await supabase
            .from('jobs')
            .select('id, is_boosted, boost_level, boost_end_date')
            .eq('id', jobId)
            .single();

          if (jobError) {
            console.error('💥 Error fetching job data:', jobError);
            setBoostDetails(null);
          } else if (jobData && jobData.is_boosted && jobData.boost_end_date) {
            const endDate = new Date(jobData.boost_end_date);
            const now = new Date();
            
            if (endDate > now) {
              console.log('✅ Found active job boost in jobs table:', jobData);
              setBoostDetails({
                id: `fallback-${jobData.id}`,
                job_id: jobData.id,
                boost_start_date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // Estimate start date
                boost_end_date: jobData.boost_end_date,
                boost_package_id: '',
                amount_paid: 0,
                status: 'active',
                created_at: new Date().toISOString(),
                package_name: `Level ${jobData.boost_level} Boost`,
                boost_days: Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                boost_level: jobData.boost_level || 1
              });
            } else {
              console.log('❌ Job boost has expired');
              setBoostDetails(null);
            }
          } else {
            console.log('❌ No boost data found in either table');
            setBoostDetails(null);
          }
        }
      } catch (err) {
        console.error('💥 Error fetching boost details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch boost details');
      } finally {
        setLoading(false);
      }
    };

    fetchBoostDetails();
  }, [jobId]);

  return { boostDetails, loading, error };
};