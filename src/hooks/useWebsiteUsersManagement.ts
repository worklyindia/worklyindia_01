import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyAccountStatusChange } from "@/lib/accountStatusNotify";

interface WebsiteUserFilters {
  search: string;
  location: string;
  industry: string;
  status: string;
}

interface WebsiteUser {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  industry: string;
  current_position: string;
  company: string;
  skills: string[];
  profile_image_url: string;
  bio: string;
  education: string;
  experience_years: number;
  experience_level: number;
  preferred_location: string;
  job_type: string;
  whatsapp_number: string;
  instagram_link: string;
  facebook_link: string;
  youtube_link: string;
  linkedin_link: string;
  precise_address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  languages: string[];
  is_profile_complete: boolean;
  created_at: string;
  last_sign_in_at: string;
  total_applications: number;
  account_status: string;
}

export function useWebsiteUsersManagement(adminVerified: boolean = false) {
  const [users, setUsers] = useState<WebsiteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<WebsiteUserFilters>({
    search: "",
    location: "",
    industry: "",
    status: ""
  });

  // Get unique locations and industries for filters
  const availableLocations = Array.from(
    new Set(users?.map(u => u.location).filter(Boolean))
  ).map(location => ({ value: location, count: users?.filter(u => u.location === location).length || 0 }));

  const availableIndustries = Array.from(
    new Set(users?.map(u => u.industry).filter(Boolean))
  ).map(industry => ({ value: industry, count: users?.filter(u => u.industry === industry).length || 0 }));

  const fetchUsers = useCallback(async () => {
    // Guard: Don't make RPC call if admin not verified
    if (!adminVerified) {
      console.log('🚫 Admin not verified, skipping fetch');
      setLoading(false);
      setError('Admin verification required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching website users...', {
        filters,
        adminVerified
      });

      // Use the database function to get all users without pagination
      const { data: usersData, error: usersError } = await supabase.rpc('get_all_website_users', {
        p_search: filters.search || '',
        p_location: filters.location || '',
        p_industry: filters.industry || '',
        p_status: filters.status === 'all' ? '' : filters.status,
        p_limit: 10000, // Large limit to get all users
        p_offset: 0
      });

      console.log('📊 RPC Response:', {
        hasData: !!usersData,
        dataLength: usersData?.length,
        hasError: !!usersError,
        error: usersError
      });

      if (usersError) {
        console.error('❌ RPC Error Details:', {
          code: usersError.code,
          message: usersError.message,
          details: usersError.details,
          hint: usersError.hint
        });
        throw usersError;
      }

      setUsers(usersData || []);
      setTotalCount(usersData?.length || 0);
      console.log('✅ Successfully loaded users:', usersData?.length);

    } catch (err: any) {
      // Log full error object for diagnostics
      try {
        console.error('Error fetching users (raw):', err);
        if (err && typeof err === 'object') {
          console.error('Error details:', JSON.stringify(err));
        }
      } catch {}

      // Normalize common Supabase/PostgREST error shapes
      const code = err?.code || err?.status || err?.name;
      const msg = err?.message || err?.error_description || err?.hint || err?.details || '';

      // Handle specific authentication and authorization errors
      if (code === 'PGRST103' || code === 'AUTHZ' || /JWT|auth/i.test(msg)) {
        setError('You need to be authenticated to access this feature. Please login.');
      } else if (code === 'PERM1' || /Admin access required|not permitted|forbidden/i.test(msg) || /Access denied\. Admin role required/i.test(msg)) {
        setError('Admin access required to view user data.');
      } else if (/permission denied|access denied|RLS|row level/i.test(msg)) {
        setError('You do not have permission to view this data.');
      } else if (code === 'PGRST116' || /function .*get_all_website_users.* does not exist/i.test(msg)) {
        setError('Database function error. Please contact admin.');
      } else if (/structure of query does not match function result type/i.test(msg)) {
        setError('Please ensure you have admin access to view user data.');
      } else {
        const fallback = msg || (err instanceof Error ? err.message : 'Failed to fetch users');
        setError(`Error: ${fallback}. Please try again or contact admin.`);
      }
    } finally {
      setLoading(false);
    }
  }, [adminVerified, filters.search, filters.location, filters.industry, filters.status]);

  const updateUserProfile = async (userId: string, updates: Partial<WebsiteUser>) => {
    try {
      console.log('Updating user profile:', userId, updates);
      
      const { data, error } = await supabase.rpc('admin_update_jobseeker_profile_full', {
        p_user_id: userId,
        p_full_name: updates.full_name ?? null,
        p_phone: updates.phone ?? null,
        p_location: updates.location ?? null,
        p_current_position: updates.current_position ?? null,
        p_company: updates.company ?? null,
        p_industry: updates.industry ?? null,
        p_bio: updates.bio ?? null,
        p_skills: updates.skills ?? null,
        p_languages: updates.languages ?? null,
        p_experience_years: updates.experience_years ?? null,
        p_preferred_location: updates.preferred_location ?? null,
        p_job_type: updates.job_type ?? null,
        p_whatsapp_number: updates.whatsapp_number ?? null,
        p_instagram_link: updates.instagram_link ?? null,
        p_facebook_link: updates.facebook_link ?? null,
        p_youtube_link: updates.youtube_link ?? null,
        p_linkedin_link: updates.linkedin_link ?? null,
        p_precise_address: updates.precise_address ?? null,
        p_city: updates.city ?? null,
        p_state: updates.state ?? null,
        p_country: updates.country ?? null,
        p_postal_code: updates.postal_code ?? null
      });

      if (error) {
        console.error('RPC error:', error);
        throw new Error(error.message || 'Failed to update profile');
      }

      console.log('Profile update successful, refreshing data...');
      // Refresh the data
      await fetchUsers();
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw new Error(err.message || 'Failed to update user profile');
    }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      console.log('Updating user status:', userId, 'to', status);

      const previous = users.find(u => u.user_id === userId);

      const { data, error } = await supabase.rpc('admin_update_user_status', {
        p_user_id: userId,
        p_status: status
      });

      if (error) {
        console.error('RPC error:', error);
        throw new Error(error.message || 'Failed to update user status');
      }

      // Notify the job seeker on Push + Email + Telegram about the change
      void notifyAccountStatusChange({
        userId,
        previousStatus: previous?.account_status || 'active',
        nextStatus: status,
        audience: 'job_seeker',
        name: previous?.full_name,
        email: previous?.email,
      });

      console.log('Status update successful, refreshing data...');
      // Refresh the data
      await fetchUsers();
    } catch (err) {
      console.error('Error updating user status:', err);
      throw new Error(err.message || 'Failed to update user status');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    totalCount,
    filters,
    setFilters,
    availableLocations,
    availableIndustries,
    updateUserProfile,
    updateUserStatus,
    refreshData: fetchUsers
  };
}