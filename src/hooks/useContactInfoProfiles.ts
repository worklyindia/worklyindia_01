import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WebsiteUser {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  location: string;
  precise_address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  profile_image_url: string;
  is_profile_complete: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  total_applications: number;
  account_status: string;
  industry: string;
  current_position: string;
  company: string;
  skills: string[];
  bio: string;
  experience_years: number;
  languages: string[];
  preferred_location: string;
  job_type: string;
  instagram_link: string;
  facebook_link: string;
  youtube_link: string;
  linkedin_link: string;
}

interface Employer {
  user_id: string;
  company_id: string;
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
  last_sign_in_at: string | null;
  total_jobs: number;
  active_jobs: number;
  badge_color?: string;
  account_status: string;
  job_posting_visibility: boolean;
  verified_plan_end?: string;
  verified_plan_start?: string;
}

export function useContactInfoProfiles(phoneNumber: string) {
  const [websiteUsers, setWebsiteUsers] = useState<WebsiteUser[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizePhone = (phone: string) => {
    return phone.replace(/[^0-9]/g, '');
  };

  const fetchProfiles = async () => {
    if (!phoneNumber) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const normalizedPhone = normalizePhone(phoneNumber);
      console.log('🔍 Fetching profiles for phone:', normalizedPhone);

      // Fetch website users (profiles table) matching phone number
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          email,
          phone,
          whatsapp_number,
          location,
          precise_address,
          city,
          state,
          country,
          postal_code,
          profile_image_url,
          is_profile_complete,
          created_at,
          account_status,
          industry,
          current_position,
          company,
          skills,
          bio,
          experience_years,
          languages,
          preferred_location,
          job_type,
          instagram_link,
          facebook_link,
          youtube_link,
          linkedin_link
        `)
        .or(`phone.ilike.%${normalizedPhone}%,whatsapp_number.ilike.%${normalizedPhone}%`);

      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Map profiles to users (skip application count fetch for simplicity)
      const usersWithCounts: WebsiteUser[] = (profilesData || []).map((profile: any) => ({
        ...profile,
        total_applications: 0,
        last_sign_in_at: null
      }));

      setWebsiteUsers(usersWithCounts);
      console.log('✅ Found website users:', usersWithCounts.length);

      // Fetch employers (companies table) matching phone number
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          id,
          user_id,
          company_name,
          legal_name,
          email,
          phone,
          whatsapp_number,
          location,
          precise_address,
          city,
          state,
          country,
          postal_code,
          industry,
          company_size,
          website,
          description,
          logo_url,
          hr_contact_name,
          instagram_link,
          facebook_link,
          youtube_link,
          linkedin_link,
          is_verified,
          is_profile_complete,
          created_at,
          badge_color,
          account_status,
          job_posting_visibility,
          verified_plan_end,
          verified_plan_start
        `)
        .or(`phone.ilike.%${normalizedPhone}%,whatsapp_number.ilike.%${normalizedPhone}%`);

      if (companiesError) {
        console.error('❌ Error fetching companies:', companiesError);
        throw companiesError;
      }

      // Get job counts for each company
      const companyIds = companiesData?.map(c => c.id) || [];
      let jobCounts: Record<string, { total: number; active: number }> = {};

      if (companyIds.length > 0) {
        // Get job counts
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('company_id, status')
          .in('company_id', companyIds);

        if (jobsData) {
          jobCounts = jobsData.reduce((acc: Record<string, { total: number; active: number }>, job: any) => {
            const companyId = job.company_id;
            if (!acc[companyId]) acc[companyId] = { total: 0, active: 0 };
            acc[companyId].total++;
            if (job.status === 'active') acc[companyId].active++;
            return acc;
          }, {} as Record<string, { total: number; active: number }>);
        }
      }

      const employersWithCounts: Employer[] = (companiesData || []).map((company: any) => ({
        ...company,
        company_id: company.id,
        total_jobs: jobCounts[company.id]?.total || 0,
        active_jobs: jobCounts[company.id]?.active || 0,
        last_sign_in_at: null
      }));

      setEmployers(employersWithCounts);
      console.log('✅ Found employers:', employersWithCounts.length);

    } catch (err) {
      console.error('❌ Error fetching contact profiles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profiles');
    } finally {
      setLoading(false);
    }
  };

  const updateWebsiteUserStatus = async (userId: string, status: string) => {
    try {
      const { error } = await supabase.rpc('admin_update_user_status', {
        p_user_id: userId,
        p_status: status
      });

      if (error) throw error;
      await fetchProfiles();
    } catch (err) {
      console.error('Error updating user status:', err);
      throw err;
    }
  };

  const updateWebsiteUserProfile = async (userId: string, updates: Partial<WebsiteUser>) => {
    try {
      const { error } = await supabase.rpc('admin_update_jobseeker_profile_full', {
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

      if (error) throw error;
      await fetchProfiles();
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err;
    }
  };

  const updateEmployerJobVisibility = async (userId: string, visible: boolean) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ job_posting_visibility: visible })
        .eq('user_id', userId);

      if (error) throw error;
      await fetchProfiles();
    } catch (err) {
      console.error('Error updating employer job visibility:', err);
      throw err;
    }
  };

  const updateEmployerAccountStatus = async (userId: string, status: 'active' | 'banned' | 'deleted', reason?: string) => {
    try {
      if (status === 'deleted') {
        // Use the RPC function for full deletion
        const { error } = await supabase.rpc('admin_delete_company_complete', {
          target_user_id: userId,
          deletion_reason: reason || 'Deleted by admin'
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('companies')
          .update({ 
            account_status: status,
            account_status_reason: reason || null
          })
          .eq('user_id', userId);

        if (error) throw error;
      }
      await fetchProfiles();
    } catch (err) {
      console.error('Error updating employer account status:', err);
      throw err;
    }
  };

  const deleteWebsiteUser = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('admin_delete_website_user_data', {
        target_user_id: userId
      });

      if (error) throw error;
      await fetchProfiles();
    } catch (err) {
      console.error('Error deleting website user:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [phoneNumber]);

  return {
    websiteUsers,
    employers,
    loading,
    error,
    refreshData: fetchProfiles,
    updateWebsiteUserStatus,
    updateWebsiteUserProfile,
    updateEmployerJobVisibility,
    updateEmployerAccountStatus,
    deleteWebsiteUser
  };
}
