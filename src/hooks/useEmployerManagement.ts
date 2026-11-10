import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmployerFilters {
  search: string;
  location: string;
  industry: string;
  status: string;
}

interface Employer {
  user_id: string;
  company_name: string;
  legal_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  location: string;
  precise_address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  industry: string;
  company_size: string;
  website: string;
  description: string;
  logo_url: string;
  hr_contact_name: string;
  instagram_link: string;
  facebook_link: string;
  youtube_link: string;
  linkedin_link: string;
  is_verified: boolean;
  is_profile_complete: boolean;
  created_at: string;
  last_sign_in_at: string;
  total_jobs: number;
  active_jobs: number;
  badge_color?: string;
  account_status?: string;
  verified_plan_end?: string;
}

export function useEmployerManagement() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<EmployerFilters>({
    search: "",
    location: "",
    industry: "",
    status: ""
  });

  const pageSize = 20;

  const fetchEmployers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching employers with filters:', filters);

      const { data, error } = await supabase.rpc('get_all_employers', {
        p_search: filters.search || '',
        p_location: filters.location || '',
        p_industry: filters.industry || '',
        p_status: filters.status || 'all',
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) {
        console.error('❌ Error from get_all_employers:', error);
        throw error;
      }

      console.log('✅ Received employer data:', data?.length, 'employers');
      if (data && data.length > 0) {
        console.log('📋 First employer fields:', Object.keys(data[0]));
        console.log('📋 First employer data sample:', data[0]);
      }

      setEmployers(data || []);

      // Get total count for pagination
      const { count } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });
      
      setTotalCount(count || 0);

    } catch (err) {
      console.error('❌ Error fetching employers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch employers');
    } finally {
      setLoading(false);
    }
  };

  const updateEmployerVerification = async (companyId: string, isVerified: boolean, badgeColor?: string) => {
    try {
      const { error } = await supabase.rpc('admin_update_company_verification', {
        p_company_id: companyId,
        p_is_verified: isVerified,
        p_badge_color: badgeColor || null
      });

      if (error) {
        throw error;
      }

      // Refresh the data
      await fetchEmployers();
    } catch (err) {
      console.error('Error updating employer verification:', err);
      throw err;
    }
  };

  const updateEmployerProfile = async (userId: string, updates: Partial<Employer>) => {
    try {
      // Update company data with all fields
      const { error } = await supabase
        .from('companies')
        .update({
          company_name: updates.company_name,
          legal_name: updates.legal_name,
          email: updates.email,
          phone: updates.phone,
          whatsapp_number: updates.whatsapp_number,
          location: updates.location,
          precise_address: updates.precise_address,
          city: updates.city,
          state: updates.state,
          country: updates.country,
          postal_code: updates.postal_code,
          industry: updates.industry,
          company_size: updates.company_size,
          website: updates.website,
          description: updates.description,
          hr_contact_name: updates.hr_contact_name,
          instagram_link: updates.instagram_link,
          facebook_link: updates.facebook_link,
          youtube_link: updates.youtube_link,
          linkedin_link: updates.linkedin_link,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Refresh the data
      await fetchEmployers();
    } catch (err) {
      console.error('Error updating employer profile:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchEmployers();
  }, [currentPage, filters]);

  return {
    employers,
    loading,
    error,
    totalCount,
    currentPage,
    setCurrentPage,
    filters,
    setFilters,
    updateEmployerVerification,
    updateEmployerProfile,
    refreshData: fetchEmployers
  };
}