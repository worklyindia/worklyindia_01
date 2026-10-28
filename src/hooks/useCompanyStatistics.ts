import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CompanyStatistics {
  total_employees: number;
  years_in_business: number;
  open_positions: number;
  client_satisfaction_rating: number;
  total_reviews: number;
  average_rating: number;
}

export const useCompanyStatistics = (companyId: string | undefined) => {
  const [statistics, setStatistics] = useState<CompanyStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchStatistics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase.rpc('get_company_statistics', {
          p_company_id: companyId
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setStatistics({
            total_employees: data[0].total_employees || 0,
            years_in_business: data[0].years_in_business || 0,
            open_positions: Number(data[0].open_positions) || 0,
            client_satisfaction_rating: Number(data[0].client_satisfaction_rating) || 0,
            total_reviews: Number(data[0].total_reviews) || 0,
            average_rating: Number(data[0].average_rating) || 0
          });
        } else {
          setStatistics({
            total_employees: 0,
            years_in_business: 0,
            open_positions: 0,
            client_satisfaction_rating: 0,
            total_reviews: 0,
            average_rating: 0
          });
        }
      } catch (err) {
        console.error('Error fetching company statistics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [companyId]);

  return { statistics, loading, error };
};