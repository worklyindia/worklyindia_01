import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface JobSeekerFilters {
  search: string;
  location: string;
  industry: string;
  status: string;
}

interface JobSeeker {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  current_position: string;
  company: string;
  industry: string;
  bio: string;
  skills: string[];
  languages: string[];
  experience_years: number;
  profile_image_url: string;
  is_profile_complete: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  total_applications: number;
  account_status: string;
}

export function useJobSeekerManagement() {
  const [jobSeekers, setJobSeekers] = useState<JobSeeker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<JobSeekerFilters>({
    search: "",
    location: "",
    industry: "",
    status: ""
  });

  const pageSize = 20;

  const fetchJobSeekers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_all_jobseekers', {
        p_search: filters.search || '',
        p_location: filters.location || '',
        p_industry: filters.industry || '',
        p_status: filters.status || 'all',
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) {
        throw error;
      }

      setJobSeekers(data || []);

      // Get total count for pagination using RPC to bypass RLS
      const { data: totalCountData, error: countError } = await supabase.rpc('get_total_jobseekers_count', {
        p_search: filters.search || '',
        p_location: filters.location || '',
        p_industry: filters.industry || '',
        p_status: filters.status || 'all'
      });

      if (countError) {
        throw countError;
      }

      setTotalCount(totalCountData || 0);

    } catch (err) {
      console.error('Error fetching job seekers:', err);
      let message = 'Failed to fetch job seekers';
      
      // Handle specific error types
      if (err && typeof err === 'object' && 'message' in err) {
        const errorMessage = (err as any).message;
        if (errorMessage.includes('Access denied')) {
          message = 'Access denied. Admin privileges required to view job seekers.';
        } else if (errorMessage.includes('structure of query')) {
          message = 'Database function error. Please try refreshing the page.';
        } else {
          message = errorMessage;
        }
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const updateJobSeekerStatus = async (userId: string, action: string) => {
    try {
      const { error } = await supabase.rpc('admin_update_user_status', {
        p_user_id: userId,
        p_status: action
      });

      if (error) {
        throw error;
      }

      // Refresh the data
      await fetchJobSeekers();
    } catch (err) {
      console.error('Error updating job seeker status:', err);
      throw err;
    }
  };

  const updateJobSeekerProfile = async (userId: string, updates: Partial<JobSeeker>) => {
    try {
      // Update profile data via admin RPC (bypasses RLS safely)
      const { error } = await supabase.rpc('admin_update_jobseeker_profile', {
        p_user_id: userId,
        p_full_name: updates.full_name,
        p_phone: updates.phone,
        p_location: updates.location,
        p_current_position: updates.current_position,
        p_company: updates.company,
        p_industry: updates.industry,
        p_bio: updates.bio,
        p_skills: updates.skills as any,
        p_languages: updates.languages as any,
        p_experience_years: updates.experience_years,
        p_preferred_location: undefined,
        p_job_type: undefined,
        p_whatsapp_number: undefined,
        p_instagram_link: undefined,
        p_facebook_link: undefined,
        p_youtube_link: undefined,
        p_linkedin_link: undefined,
        p_precise_address: undefined,
        p_city: undefined,
        p_state: undefined,
        p_country: undefined,
        p_postal_code: undefined
      });

      if (error) {
        throw error;
      }

      // Refresh the data
      await fetchJobSeekers();
    } catch (err) {
      console.error('Error updating job seeker profile:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchJobSeekers();
  }, [currentPage, filters]);

  return {
    jobSeekers,
    loading,
    error,
    totalCount,
    currentPage,
    setCurrentPage,
    filters,
    setFilters,
    updateJobSeekerStatus,
    updateJobSeekerProfile,
    refreshData: fetchJobSeekers
  };
}