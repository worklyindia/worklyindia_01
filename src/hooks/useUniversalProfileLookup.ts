import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LookupType = 'phone' | 'email' | 'name' | 'user_id';

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

interface JobApplication {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  status: string;
  applied_at: string;
  cover_letter: string | null;
}

interface JobPosting {
  id: string;
  title: string;
  company_name: string;
  location: string;
  status: string;
  created_at: string;
  applications_count: number;
  views_count: number;
}

interface InterviewData {
  id: string;
  job_title: string;
  company_name: string;
  scheduled_at: string;
  status: string;
  interview_type: string;
  notes: string | null;
}

interface SupportTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  category: string;
}

interface LookupResult {
  websiteUsers: WebsiteUser[];
  employers: Employer[];
  applications: JobApplication[];
  jobPostings: JobPosting[];
  interviews: InterviewData[];
  supportTickets: SupportTicket[];
}

export function useUniversalProfileLookup() {
  const [results, setResults] = useState<LookupResult>({
    websiteUsers: [],
    employers: [],
    applications: [],
    jobPostings: [],
    interviews: [],
    supportTickets: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<LookupType>('phone');

  const normalizePhone = (phone: string) => {
    return phone.replace(/[^0-9]/g, '');
  };

  const detectSearchType = (query: string): LookupType => {
    const trimmed = query.trim();
    
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return 'user_id';
    }
    
    // Email pattern
    if (trimmed.includes('@') && trimmed.includes('.')) {
      return 'email';
    }
    
    // Phone pattern (mostly numbers)
    const digitsOnly = trimmed.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return 'phone';
    }
    
    // Default to name search
    return 'name';
  };

  const searchProfiles = useCallback(async (query: string, type?: LookupType) => {
    if (!query || query.trim().length < 2) {
      setResults({
        websiteUsers: [],
        employers: [],
        applications: [],
        jobPostings: [],
        interviews: [],
        supportTickets: []
      });
      return;
    }

    const detectedType = type || detectSearchType(query);
    setSearchType(detectedType);
    setSearchQuery(query);
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Universal lookup:', { query, type: detectedType });

      // Build query based on type
      let profilesQuery = supabase.from('profiles').select(`
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
      `);

      let companiesQuery = supabase.from('companies').select(`
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
      `);

      // Apply filters based on search type
      switch (detectedType) {
        case 'email':
          profilesQuery = profilesQuery.ilike('email', `%${query}%`);
          companiesQuery = companiesQuery.ilike('email', `%${query}%`);
          break;
        case 'phone':
          const normalizedPhone = normalizePhone(query);
          profilesQuery = profilesQuery.or(`phone.ilike.%${normalizedPhone}%,whatsapp_number.ilike.%${normalizedPhone}%`);
          companiesQuery = companiesQuery.or(`phone.ilike.%${normalizedPhone}%,whatsapp_number.ilike.%${normalizedPhone}%`);
          break;
        case 'user_id':
          profilesQuery = profilesQuery.eq('user_id', query);
          companiesQuery = companiesQuery.eq('user_id', query);
          break;
        case 'name':
          profilesQuery = profilesQuery.ilike('full_name', `%${query}%`);
          companiesQuery = companiesQuery.or(`company_name.ilike.%${query}%,hr_contact_name.ilike.%${query}%`);
          break;
      }

      // Execute profile queries in parallel
      const [profilesResult, companiesResult] = await Promise.all([
        profilesQuery,
        companiesQuery
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (companiesResult.error) throw companiesResult.error;

      const websiteUsers: WebsiteUser[] = (profilesResult.data || []).map((p: any) => ({
        ...p,
        total_applications: 0,
        last_sign_in_at: null
      }));

      // Get user IDs for additional data fetching
      const userIds = [
        ...websiteUsers.map(u => u.user_id),
        ...(companiesResult.data || []).map((c: any) => c.user_id)
      ].filter(Boolean);

      // Get company IDs
      const companyIds = (companiesResult.data || []).map((c: any) => c.id);

      // Fetch jobs and support tickets (simpler queries that won't have type issues)
      let jobsData: any[] = [];
      let ticketsData: any[] = [];
      
      if (companyIds.length > 0) {
        const jobsResult = await supabase
          .from('jobs')
          .select('id, title, location, status, created_at, views_count, company_id')
          .in('company_id', companyIds)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (jobsResult.data) {
          jobsData = jobsResult.data;
        }
      }

      if (userIds.length > 0) {
        const ticketsResult = await supabase
          .from('support_tickets')
          .select('id, title, status, priority, created_at, category')
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (ticketsResult.data) {
          ticketsData = ticketsResult.data;
        }
      }

      // Process job counts
      const jobCounts: Record<string, { total: number; active: number }> = {};
      jobsData.forEach((job: any) => {
        if (!jobCounts[job.company_id]) {
          jobCounts[job.company_id] = { total: 0, active: 0 };
        }
        jobCounts[job.company_id].total++;
        if (job.status === 'active') {
          jobCounts[job.company_id].active++;
        }
      });

      // Process employers with counts
      const employers: Employer[] = (companiesResult.data || []).map((company: any) => ({
        ...company,
        company_id: company.id,
        total_jobs: jobCounts[company.id]?.total || 0,
        active_jobs: jobCounts[company.id]?.active || 0,
        last_sign_in_at: null
      }));

      // Get company names for jobs
      const companyNameMap: Record<string, string> = {};
      (companiesResult.data || []).forEach((c: any) => {
        companyNameMap[c.id] = c.company_name;
      });

      // Process job postings
      const jobPostings: JobPosting[] = jobsData.map((job: any) => ({
        id: job.id,
        title: job.title,
        company_name: companyNameMap[job.company_id] || 'Unknown Company',
        location: job.location || '',
        status: job.status,
        created_at: job.created_at,
        applications_count: 0,
        views_count: job.views_count || 0
      }));

      // Process support tickets
      const supportTickets: SupportTicket[] = ticketsData.map((ticket: any) => ({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        category: ticket.category
      }));

      setResults({
        websiteUsers,
        employers,
        applications: [], // Simplified - can be expanded later
        jobPostings,
        interviews: [], // Simplified - can be expanded later
        supportTickets
      });

      console.log('✅ Universal lookup complete:', {
        users: websiteUsers.length,
        employers: employers.length,
        jobs: jobPostings.length,
        tickets: supportTickets.length
      });

    } catch (err) {
      console.error('❌ Universal lookup error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults({
      websiteUsers: [],
      employers: [],
      applications: [],
      jobPostings: [],
      interviews: [],
      supportTickets: []
    });
    setSearchQuery('');
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    searchQuery,
    searchType,
    searchProfiles,
    clearResults,
    detectSearchType
  };
}
