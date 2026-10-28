import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";
import { notifyAccountDeleted } from "@/lib/accountStatusNotify";

interface EmployerFilters {
  search: string;
  location: string;
  industry: string;
  status: string;
  showDeleted: boolean;
}

interface Employer {
  user_id: string;
  company_id: string;
  company_name: string;
  email: string;
  phone: string;
  location: string;
  industry: string;
  company_size: string;
  website: string;
  description: string;
  logo_url: string;
  is_verified: boolean;
  is_profile_complete: boolean;
  created_at: string;
  last_sign_in_at: string;
  total_jobs: number;
  active_jobs: number;
  badge_color?: string;
  account_status: string;
  account_status_reason?: string;
  job_posting_visibility: boolean;
  verified_plan_start?: string;
  verified_plan_end?: string;
  // Additional comprehensive fields
  business_type: string;
  legal_name: string;
  cin_number: string;
  gst_number: string;
  msme_number: string;
  registered_address: string;
  support_email: string;
  hr_contact_name: string;
  interview_contact_details: string;
  mission: string;
  vision: string;
  core_values: string;
  services_description: string;
  pricing_plans: string;
  differentiating_factors: string;
  founder_name: string;
  founder_bio: string;
  key_team_members: string;
  clients_description: string;
  testimonials: string;
  data_privacy_measures: string;
  refund_policy: string;
  dispute_resolution: string;
  instagram_link: string;
  facebook_link: string;
  youtube_link: string;
  linkedin_link: string;
  whatsapp_number: string;
  incorporation_date: string;
  profile_views_count: number;
  precise_address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  company_details: string;
  organisation_size: string;
}

interface FilterOption {
  value: string;
  count: number;
}

export function useEnhancedEmployerManagement(adminVerified: boolean = false) {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [availableLocations, setAvailableLocations] = useState<FilterOption[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<FilterOption[]>([]);
  const [errorStage, setErrorStage] = useState<string>('');
  const [isLimitedView, setIsLimitedView] = useState(false);
  const [filters, setFilters] = useState<EmployerFilters>({
    search: "",
    location: "",
    industry: "",
    status: "",
    showDeleted: false
  });

  const debouncedSearch = useDebounce(filters.search, 300);
  const pageSize = 10000; // Load all employers at once for scroll-based view

  // Helper function to resolve company_id from user_id
  const resolveCompanyId = async (userId: string): Promise<string> => {
    // First check local state
    const employer = employers.find(emp => emp.user_id === userId);
    if (employer?.company_id && employer.company_id !== userId) {
      console.log('✅ Company ID found in local state:', employer.company_id);
      return employer.company_id;
    }

    // Use RPC function to get company_id bypassing RLS
    console.log('🔍 Fetching company_id via RPC for user:', userId);
    const { data: companyId, error } = await supabase.rpc('admin_get_company_id', {
      p_user_id: userId
    });

    if (error) {
      console.error('❌ RPC error fetching company_id:', error);
      throw new Error(`Failed to resolve company ID: ${error.message}`);
    }

    if (!companyId) {
      console.error('❌ No company record found for user_id:', userId);
      throw new Error('Could not find company record for this user. The company may have been deleted or never created.');
    }

    console.log('✅ Found company_id via RPC:', companyId);
    return companyId;
  };

  // Fetch available filter options
  const fetchFilterOptions = async () => {
    try {
      // Try RPC functions first
      const { data: locations, error: locError } = await supabase.rpc('get_available_employer_locations');
      if (!locError && locations) {
        setAvailableLocations(
          locations.map((item: any) => ({ 
            value: item.location, 
            count: item.count 
          }))
        );
      } else {
        // Fallback: compute from companies table directly
        const { data: companiesLoc } = await supabase
          .from('companies')
          .select('location')
          .not('location', 'is', null)
          .neq('location', '');
        
        const locationCounts = (companiesLoc || []).reduce((acc: Record<string, number>, company) => {
          if (company.location) {
            acc[company.location] = (acc[company.location] || 0) + 1;
          }
          return acc;
        }, {});
        
        setAvailableLocations(
          Object.entries(locationCounts).map(([location, count]) => ({
            value: location,
            count: count as number
          }))
        );
      }

      // Try industries RPC
      const { data: industries, error: indError } = await supabase.rpc('get_available_employer_industries');
      if (!indError && industries) {
        setAvailableIndustries(
          industries.map((item: any) => ({ 
            value: item.industry, 
            count: item.count 
          }))
        );
      } else {
        // Fallback: compute from companies table directly
        const { data: companiesInd } = await supabase
          .from('companies')
          .select('industry')
          .not('industry', 'is', null)
          .neq('industry', '');
        
        const industryCounts = (companiesInd || []).reduce((acc: Record<string, number>, company) => {
          if (company.industry) {
            acc[company.industry] = (acc[company.industry] || 0) + 1;
          }
          return acc;
        }, {});
        
        setAvailableIndustries(
          Object.entries(industryCounts).map(([industry, count]) => ({
            value: industry,
            count: count as number
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  // Helper function to extract detailed error message from Supabase error
  const extractErrorMessage = (error: any): string => {
    console.log('🔍 Full error object:', error);
    
    if (typeof error === 'string') return error;
    
    // Check various error properties that Supabase might use
    if (error.message) return error.message;
    if (error.error?.message) return error.error.message;
    if (error.details) return error.details;
    if (error.hint) return error.hint;
    if (error.code) return `Error code: ${error.code}`;
    
    return 'Unknown error occurred';
  };

  const fetchEmployers = async () => {
    // Don't fetch if admin not verified - just wait, don't set error
    if (!adminVerified) {
      console.log('🚫 Admin not verified, waiting for verification...');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setErrorStage('');
      setIsLimitedView(false);
      console.log('🚀 Starting employer fetch with filters:', { debouncedSearch, filters, currentPage });

      // If showing deleted companies, use direct query
      if (filters.showDeleted) {
        setErrorStage('deleted_query');
        console.log('🔸 Fetching deleted companies');
        
        let queryBuilder = supabase
          .from('companies')
          .select(`
            user_id,
            company_name,
            email,
            phone,
            location,
            industry,
            company_size,
            website,
            description,
            logo_url,
            is_verified,
            is_profile_complete,
            created_at,
            updated_at,
            account_status,
            account_status_reason,
            badge_color,
            whatsapp_number,
            hr_contact_name,
            instagram_link,
            facebook_link,
            youtube_link,
            linkedin_link,
            precise_address,
            city,
            state,
            country,
            postal_code,
            company_details,
            organisation_size,
            job_posting_visibility
          `)
          .eq('account_status', 'deleted')
          .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

        // Apply search filter for deleted companies
        if (debouncedSearch) {
          queryBuilder = queryBuilder.ilike('company_name', `%${debouncedSearch}%`);
        }

        const { data: deletedData, error: deletedError } = await queryBuilder;
        
        if (!deletedError && deletedData) {
          console.log('✅ Deleted companies query succeeded, got', deletedData.length, 'companies');
          setErrorStage('success');
          
          const mappedEmployers = (deletedData || []).map((item: any) => ({
            ...item,
            company_id: item.user_id,
            total_jobs: 0,
            active_jobs: 0,
            last_sign_in_at: '',
            job_posting_visibility: false,
            verified_plan_start: null,
            verified_plan_end: null,
            business_type: '',
            legal_name: '',
            cin_number: '',
            gst_number: '',
            msme_number: '',
            registered_address: '',
            support_email: '',
            hr_contact_name: item.hr_contact_name || '',
            interview_contact_details: '',
            mission: '',
            vision: '',
            core_values: '',
            services_description: '',
            pricing_plans: '',
            differentiating_factors: '',
            founder_name: '',
            founder_bio: '',
            key_team_members: '',
            clients_description: '',
            testimonials: '',
            data_privacy_measures: '',
            refund_policy: '',
            dispute_resolution: '',
            instagram_link: item.instagram_link || '',
            facebook_link: item.facebook_link || '',
            youtube_link: item.youtube_link || '',
            linkedin_link: item.linkedin_link || '',
            whatsapp_number: item.whatsapp_number || '',
            incorporation_date: '',
            profile_views_count: 0,
            precise_address: item.precise_address || '',
            city: item.city || '',
            state: item.state || '',
            country: item.country || '',
            postal_code: item.postal_code || '',
            company_details: item.company_details || '',
            organisation_size: item.organisation_size || ''
          }));
          
          setEmployers(mappedEmployers);
          return;
        } else {
          console.log('❌ Deleted companies query failed:', extractErrorMessage(deletedError));
          throw new Error(`Failed to fetch deleted companies: ${extractErrorMessage(deletedError)}`);
        }
      }

      // Attempt 1: Try enhanced RPC function
      setErrorStage('enhanced_rpc');
      console.log('🔸 Attempting enhanced RPC: get_all_employers_enhanced');
      const rpcStatus = filters.status === 'job_banned' ? 'all' : (filters.status || 'all');
      console.log('📋 RPC Parameters:', {
        p_search: debouncedSearch || '',
        p_location: filters.location || '',
        p_industry: filters.industry || '',
        p_status: rpcStatus,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });
      
      const { data: enhancedData, error: enhancedError } = await supabase.rpc('get_all_employers_enhanced', {
        p_search: debouncedSearch || '',
        p_location: filters.location || '',
        p_industry: filters.industry || '',
        p_status: rpcStatus,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (!enhancedError && enhancedData) {
        console.log('✅ Enhanced RPC succeeded, got', enhancedData.length, 'employers');
        
        // Debug: Log the first item to see what fields are available
        if (enhancedData.length > 0) {
          console.log('🏢 First enhanced employer raw data:', enhancedData[0]);
          console.log('🏢 Available enhanced fields:', Object.keys(enhancedData[0]));
        }
        
        setErrorStage('success');

      // Enrich with extra fields from companies and employer_settings
        const userIds = (enhancedData || []).map((item: any) => item.user_id);
        let extraMap: Record<string, any> = {};
        
        console.log('🔍 Fetching extra fields for user IDs:', userIds.length, 'companies');
        let settingsMap: Record<string, any> = {};
        let profilePhoneMap: Record<string, string> = {};
        
        if (userIds.length > 0) {
          const { data: extraData, error: extraError } = await supabase
            .from('companies')
            .select(`
              user_id,
              phone,
              whatsapp_number,
              hr_contact_name,
              instagram_link,
              facebook_link,
              youtube_link,
              linkedin_link,
              precise_address,
              city,
              state,
              country,
              postal_code,
              company_details,
              organisation_size,
              ban_type,
              job_posting_ban_reason,
              badge_color,
              verified_plan_start,
              verified_plan_end,
              is_profile_complete
            `)
            .in('user_id', userIds);

          if (extraError) {
            console.log('⚠️ Extra company fields fetch (enhanced path) failed:', extractErrorMessage(extraError));
          } else if (extraData) {
            extraMap = Object.fromEntries(extraData.map((c: any) => [c.user_id, c]));
          }

          // Fetch phone from profiles as fallback
          const { data: profilePhones, error: profilePhonesError } = await supabase
            .from('profiles')
            .select('user_id, phone')
            .in('user_id', userIds);

          if (profilePhonesError) {
            console.log('⚠️ Profile phones fetch failed:', extractErrorMessage(profilePhonesError));
          } else if (profilePhones) {
            profilePhoneMap = Object.fromEntries(
              profilePhones.filter((p: any) => p.phone?.trim()).map((p: any) => [p.user_id, p.phone])
            );
          }

          // Debug: log phone sources for first few employers
          const sampleIds = userIds.slice(0, 3);
          sampleIds.forEach((uid: string) => {
            const ex = extraMap[uid] || {};
            const rpcItem = (enhancedData || []).find((i: any) => i.user_id === uid);
            console.log(`📞 Phone debug [${uid}]:`, {
              companies_phone: ex.phone || null,
              rpc_phone: rpcItem?.phone || null,
              profiles_phone: profilePhoneMap[uid] || null
            });
          });

          // Fetch employer_settings for job_posting_visibility
          const { data: settingsData, error: settingsError } = await supabase
            .from('employer_settings')
            .select('user_id, job_posting_visibility')
            .in('user_id', userIds);

          if (settingsError) {
            console.log('⚠️ Employer settings fetch failed:', extractErrorMessage(settingsError));
          } else if (settingsData) {
            settingsMap = Object.fromEntries(settingsData.map((s: any) => [s.user_id, s]));
          }
        }

        // Map enhanced response with defaults and merge extras
        const mappedEmployers = (enhancedData || []).map((item: any) => {
          const extra = extraMap[item.user_id] || {};
          const settings = settingsMap[item.user_id] || {};
          
          // Helper function to get first non-empty value - checks for actual content
          const getFirstValue = (...values: any[]) => {
            for (const val of values) {
              // Check if value exists and is not empty
              if (val !== null && val !== undefined && val !== '') {
                // For strings, also check if it's not just whitespace
                if (typeof val === 'string') {
                  const trimmed = val.trim();
                  if (trimmed.length > 0) {
                    return trimmed;
                  }
                } else {
                  return val;
                }
              }
            }
            return '';
          };
          
          // Debug log for first item
          if (item === enhancedData[0]) {
            console.log('🔍 Mapping first employer:', {
              user_id: item.user_id,
              extra_whatsapp: extra.whatsapp_number,
              rpc_whatsapp: item.whatsapp_number,
              final_whatsapp: getFirstValue(extra.whatsapp_number, item.whatsapp_number),
              extra_hr: extra.hr_contact_name,
              rpc_hr: item.hr_contact_name,
              final_hr: getFirstValue(extra.hr_contact_name, item.hr_contact_name)
            });
          }
          
          // Database (extra) fields take absolute priority over RPC results
          return {
            ...item,
            company_id: item.company_id || item.user_id,
            phone: extra.phone || item.phone || profilePhoneMap[item.user_id] || '',
            job_posting_visibility: settings.job_posting_visibility ?? (extra.ban_type === 'job_posting' ? false : true),
            ban_type: extra.ban_type || item.ban_type || null,
            business_type: item.business_type || '',
            legal_name: item.legal_name || '',
            cin_number: item.cin_number || '',
            gst_number: item.gst_number || '',
            msme_number: item.msme_number || '',
            registered_address: item.registered_address || '',
            support_email: item.support_email || '',
            // Critical fields - extra data from companies table takes absolute priority
            hr_contact_name: extra.hr_contact_name || item.hr_contact_name || '',
            whatsapp_number: extra.whatsapp_number || item.whatsapp_number || '',
            instagram_link: extra.instagram_link || item.instagram_link || '',
            facebook_link: extra.facebook_link || item.facebook_link || '',
            youtube_link: extra.youtube_link || item.youtube_link || '',
            linkedin_link: extra.linkedin_link || item.linkedin_link || '',
            website: extra.website || item.website || '',
            company_details: extra.company_details || item.company_details || '',
            organisation_size: extra.organisation_size || item.organisation_size || item.organization_size || item.company_size || '',
            // Location fields - extra data takes priority
            precise_address: extra.precise_address || item.precise_address || '',
            city: extra.city || item.city || '',
            state: extra.state || item.state || '',
            country: extra.country || item.country || '',
            postal_code: extra.postal_code || item.postal_code || '',
            job_posting_ban_reason: extra.job_posting_ban_reason || item.job_posting_ban_reason || null,
            // Verification fields - extra data takes priority over RPC
            badge_color: extra.badge_color || item.badge_color || 'gold',
            verified_plan_start: extra.verified_plan_start || item.verified_plan_start || null,
            verified_plan_end: extra.verified_plan_end || item.verified_plan_end || null,
            // Other fields
            interview_contact_details: item.interview_contact_details || '',
            mission: item.mission || '',
            vision: item.vision || '',
            core_values: item.core_values || '',
            services_description: item.services_description || '',
            pricing_plans: item.pricing_plans || '',
            differentiating_factors: item.differentiating_factors || '',
            founder_name: item.founder_name || '',
            founder_bio: item.founder_bio || '',
            key_team_members: item.key_team_members || '',
            clients_description: item.clients_description || '',
            testimonials: item.testimonials || '',
            data_privacy_measures: item.data_privacy_measures || '',
            refund_policy: item.refund_policy || '',
            dispute_resolution: item.dispute_resolution || '',
            incorporation_date: item.incorporation_date || '',
            profile_views_count: item.profile_views_count || 0,
            is_profile_complete: extra.is_profile_complete ?? item.is_profile_complete ?? false
          };
        });

        // Apply job_banned filter after merging settings data
        let filteredEmployers = mappedEmployers;
        if (filters.status === 'job_banned') {
          filteredEmployers = mappedEmployers.filter(emp => emp.job_posting_visibility === false);
        }

        setEmployers(filteredEmployers);
      } else {
        console.log('❌ Enhanced RPC failed:', extractErrorMessage(enhancedError));
        
        // Check for access denied errors
        const enhancedErrorMsg = extractErrorMessage(enhancedError);
        if (enhancedErrorMsg.includes('Access denied') || enhancedErrorMsg.includes('Admin role required')) {
          setError('Access denied. Please sign in as admin to view employer members.');
          setErrorStage('access_denied');
          return;
        }

      // Attempt 2: Try basic RPC function
      setErrorStage('basic_rpc');
      console.log('🔸 Attempting basic RPC: get_all_employers');
      const rpcStatusBasic = filters.status === 'job_banned' ? 'all' : (filters.status || 'all');
      const { data: basicData, error: basicError } = await supabase.rpc('get_all_employers', {
        p_search: debouncedSearch || '',
        p_location: filters.location || '',
        p_industry: filters.industry || '',
        p_status: rpcStatusBasic,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

        if (!basicError && basicData) {
          console.log('✅ Basic RPC succeeded, got', basicData.length, 'employers');
          setErrorStage('success');

          // Step 2: Enrich with additional company fields and employer_settings
          const userIds = (basicData || []).map((item: any) => item.user_id);
          let extraMap: Record<string, any> = {};
          let settingsMap: Record<string, any> = {};
          let profilePhoneMap: Record<string, string> = {};
          
          if (userIds.length > 0) {
            const { data: extraData, error: extraError } = await supabase
              .from('companies')
              .select(`
                user_id,
                phone,
                whatsapp_number,
                hr_contact_name,
                instagram_link,
                facebook_link,
                youtube_link,
                linkedin_link,
                precise_address,
                city,
                state,
                country,
                postal_code,
                company_details,
                organisation_size,
                website,
                ban_type,
                job_posting_ban_reason,
                badge_color,
                verified_plan_start,
                verified_plan_end
              `)
              .in('user_id', userIds);

            if (extraError) {
              console.log('⚠️ Extra company fields fetch failed:', extractErrorMessage(extraError));
            } else if (extraData) {
              extraMap = Object.fromEntries(extraData.map((c: any) => [c.user_id, c]));
            }

            // Fetch employer_settings for job_posting_visibility
            const { data: settingsData, error: settingsError } = await supabase
              .from('employer_settings')
              .select('user_id, job_posting_visibility')
              .in('user_id', userIds);

            if (settingsError) {
              console.log('⚠️ Employer settings fetch failed:', extractErrorMessage(settingsError));
            } else if (settingsData) {
            settingsMap = Object.fromEntries(settingsData.map((s: any) => [s.user_id, s]));
            }

            // Fetch phone from profiles as fallback
            const { data: profilePhones } = await supabase
              .from('profiles')
              .select('user_id, phone')
              .in('user_id', userIds);

            if (profilePhones) {
              profilePhoneMap = Object.fromEntries(
                profilePhones.filter((p: any) => p.phone?.trim()).map((p: any) => [p.user_id, p.phone])
              );
            }
          }

          // Map basic response to enhanced interface and merge extras
          const mappedEmployers = (basicData || []).map((item: any) => {
            const extra = extraMap[item.user_id] || {};
            const settings = settingsMap[item.user_id] || {};
            
            return {
              ...item,
              company_id: item.user_id,
              account_status: item.account_status || 'active',
              account_status_reason: item.account_status_reason || '',
              phone: extra.phone || item.phone || profilePhoneMap[item.user_id] || '',
              job_posting_visibility: settings.job_posting_visibility ?? (extra.ban_type === 'job_posting' ? false : true),
              ban_type: extra.ban_type || item.ban_type || null,
              // Verification fields - extra data takes priority
              badge_color: extra.badge_color || item.badge_color || 'gold',
              verified_plan_start: extra.verified_plan_start || item.verified_plan_start || null,
              verified_plan_end: extra.verified_plan_end || item.verified_plan_end || null,
              business_type: '',
              legal_name: item.legal_name || '',
              cin_number: '',
              gst_number: '',
              msme_number: '',
              registered_address: '',
              support_email: '',
              // Extra data takes priority
              hr_contact_name: extra.hr_contact_name || item.hr_contact_name || '',
              whatsapp_number: extra.whatsapp_number || item.whatsapp_number || '',
              instagram_link: extra.instagram_link || item.instagram_link || '',
              facebook_link: extra.facebook_link || item.facebook_link || '',
              youtube_link: extra.youtube_link || item.youtube_link || '',
              linkedin_link: extra.linkedin_link || item.linkedin_link || '',
              website: extra.website || item.website || '',
              company_details: extra.company_details || item.company_details || '',
              organisation_size: extra.organisation_size || item.organisation_size || item.organization_size || item.company_size || '',
              precise_address: extra.precise_address || item.precise_address || '',
              city: extra.city || item.city || '',
              state: extra.state || item.state || '',
              country: extra.country || item.country || '',
              postal_code: extra.postal_code || item.postal_code || '',
              interview_contact_details: '',
              mission: '',
              vision: '',
              core_values: '',
              services_description: '',
              pricing_plans: '',
              differentiating_factors: '',
              founder_name: '',
              founder_bio: '',
              key_team_members: '',
              clients_description: '',
              testimonials: '',
              data_privacy_measures: '',
              refund_policy: '',
              dispute_resolution: '',
              incorporation_date: '',
              profile_views_count: 0
            };
          });

          // Apply job_banned filter after merging settings data
          let filteredEmployers = mappedEmployers;
          if (filters.status === 'job_banned') {
            filteredEmployers = mappedEmployers.filter(emp => emp.job_posting_visibility === false);
          }

          setEmployers(filteredEmployers);
        } else {
          console.log('❌ Basic RPC failed:', extractErrorMessage(basicError));
          
          // Check for access denied errors in basic RPC
          const basicErrorMsg = extractErrorMessage(basicError);
          if (basicErrorMsg.includes('Access denied') || basicErrorMsg.includes('Admin role required')) {
            setError('Access denied. Please sign in as admin to view employer members.');
            setErrorStage('access_denied');
            return;
          }

          // Attempt 3: Two-step direct query fallback (limited view)
          setErrorStage('direct_query_smoke_test');
          console.log('🔸 Attempting smoke test query first');
          
          // Step 1: Smoke test with minimal data
          const { data: smokeTest, error: smokeError } = await supabase
            .from('companies')
            .select('user_id')
            .limit(1);
            
          if (smokeError) {
            console.log('❌ Smoke test failed:', extractErrorMessage(smokeError));
            throw new Error(`Database access failed: ${extractErrorMessage(smokeError)}`);
          }
          
          console.log('✅ Smoke test passed, proceeding with limited query');
          setErrorStage('direct_query_limited');
          let queryBuilder = supabase
            .from('companies')
            .select(`
              user_id,
              company_name,
              email,
              phone,
              location,
              industry,
              company_size,
              website,
              description,
              logo_url,
              is_verified,
              is_profile_complete,
              created_at,
              account_status,
              badge_color,
              verified_plan_start,
              verified_plan_end,
              whatsapp_number,
              whatsapp,
              hr_contact_name,
              hr_contact,
              instagram_link,
              facebook_link,
              youtube_link,
              linkedin_link,
              precise_address,
              city,
              state,
              country,
              postal_code,
              company_city,
              company_state,
              company_country,
              company_details,
              organisation_size,
              ban_type,
              job_posting_ban_reason
            `)
            .neq('account_status', 'deleted')
            .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

          // Apply filters
          if (debouncedSearch) {
            queryBuilder = queryBuilder.ilike('company_name', `%${debouncedSearch}%`);
          }
          if (filters.location) {
            queryBuilder = queryBuilder.ilike('location', `%${filters.location}%`);
          }
          if (filters.industry) {
            queryBuilder = queryBuilder.ilike('industry', `%${filters.industry}%`);
          }
          if (filters.status && filters.status !== 'all') {
            // Apply status filter based on account_status
            if (filters.status === 'banned') {
              queryBuilder = queryBuilder.eq('account_status', 'banned');
            }
            // Note: job_banned filter will be applied after fetching data since job_posting_visibility is in employer_settings
            // Note: active/inactive filters need auth.users table which is not accessible in direct query
          }

          const { data: directData, error: directError } = await queryBuilder;

          if (!directError && directData) {
            console.log('✅ Direct query succeeded, got', directData.length, 'employers (limited view)');
            setErrorStage('success');
            setIsLimitedView(true);
            
            // Fetch employer_settings for job_posting_visibility
            const userIds = directData.map((item: any) => item.user_id);
            let settingsMap: Record<string, any> = {};
            
            if (userIds.length > 0) {
              const { data: settingsData, error: settingsError } = await supabase
                .from('employer_settings')
                .select('user_id, job_posting_visibility')
                .in('user_id', userIds);

              if (settingsError) {
                console.log('⚠️ Employer settings fetch failed:', extractErrorMessage(settingsError));
              } else if (settingsData) {
                settingsMap = Object.fromEntries(settingsData.map((s: any) => [s.user_id, s]));
              }
            }
            
            // Map direct response with fallback values
            let mappedEmployers = (directData || []).map((item: any) => {
              const settings = settingsMap[item.user_id] || {};
              return {
                ...item,
                company_id: item.user_id,
                total_jobs: 0,
                active_jobs: 0,
                last_sign_in_at: '',
                account_status_reason: '',
                job_posting_visibility: settings.job_posting_visibility ?? (item.ban_type === 'job_posting' ? false : true),
                ban_type: item.ban_type || null,
                // Verification fields from direct query
                badge_color: item.badge_color || 'gold',
                verified_plan_start: item.verified_plan_start || null,
                verified_plan_end: item.verified_plan_end || null,
              business_type: '',
              legal_name: '',
              cin_number: '',
              gst_number: '',
              msme_number: '',
              registered_address: '',
              support_email: '',
              hr_contact_name: item.hr_contact_name || item.hr_contact || '',
              interview_contact_details: '',
              mission: '',
              vision: '',
              core_values: '',
              services_description: '',
              pricing_plans: '',
              differentiating_factors: '',
              founder_name: '',
              founder_bio: '',
              key_team_members: '',
              clients_description: '',
              testimonials: '',
              data_privacy_measures: '',
              refund_policy: '',
              dispute_resolution: '',
              instagram_link: item.instagram_link || '',
              facebook_link: item.facebook_link || '',
              youtube_link: item.youtube_link || '',
              linkedin_link: item.linkedin_link || '',
              whatsapp_number: item.whatsapp_number || item.whatsapp || '',
              incorporation_date: '',
              profile_views_count: 0,
              precise_address: item.precise_address || '',
              city: item.city || '',
              state: item.state || '',
              country: item.country || '',
              postal_code: item.postal_code || '',
              company_details: item.company_details || '',
              organisation_size: item.organisation_size || ''
              };
            });

            // Apply job_banned filter after merging settings data
            if (filters.status === 'job_banned') {
              mappedEmployers = mappedEmployers.filter(emp => emp.job_posting_visibility === false);
            }

            setEmployers(mappedEmployers);
            
            // Debug: Log the first mapped employer in limited view
            if (mappedEmployers.length > 0) {
              console.log('🏢 First mapped employer (limited view):', mappedEmployers[0]);
            }
            
            // Don't set error for limited view, just flag it
            console.log('⚠️ Using limited view mode');
          } else {
            console.log('❌ All fetch attempts failed. Direct query error:', extractErrorMessage(directError));
            setErrorStage('all_failed');
            throw new Error(`All data fetch methods failed. Last error: ${extractErrorMessage(directError)}`);
          }
        }
      }

      // Get total count for pagination with filters applied (with fallback)
      console.log('🔸 Fetching total count for pagination');
      try {
        let countQuery;
        
        if (filters.showDeleted) {
          countQuery = supabase
            .from('companies')
            .select('*', { count: 'exact', head: true })
            .eq('account_status', 'deleted');
        } else {
          countQuery = supabase
            .from('companies')
            .select('*', { count: 'exact', head: true })
            .neq('account_status', 'deleted');
        }

        if (debouncedSearch) {
          countQuery = countQuery.ilike('company_name', `%${debouncedSearch}%`);
        }
        if (filters.location) {
          countQuery = countQuery.ilike('location', `%${filters.location}%`);
        }
        if (filters.industry) {
          countQuery = countQuery.ilike('industry', `%${filters.industry}%`);
        }
        if (filters.status && filters.status !== 'all') {
          // Apply status filters for count query
          if (filters.status === 'banned') {
            countQuery = countQuery.eq('account_status', 'banned');
          }
          // For job_banned, use the filtered employers count since it requires employer_settings join
        }

        const { count, error: countError } = await countQuery;
        
        if (countError) {
          console.log('⚠️ Count query failed:', extractErrorMessage(countError));
          // For job_banned filter, use filtered employers count
          if (filters.status === 'job_banned') {
            setTotalCount(employers.length || 0);
          } else {
            setTotalCount(employers.length || 0);
          }
        } else {
          // For job_banned filter, use filtered employers count instead of DB count
          if (filters.status === 'job_banned') {
            console.log('✅ Using filtered employers count for job_banned:', employers.length);
            setTotalCount(employers.length || 0);
          } else {
            console.log('✅ Total count:', count);
            setTotalCount(count || 0);
          }
        }
      } catch (countErr) {
        console.log('⚠️ Count query crashed:', extractErrorMessage(countErr));
        // Final fallback: use employers.length as estimate
        setTotalCount(employers.length || 0);
      }

    } catch (err) {
      console.error('💥 Critical error in fetchEmployers:', err);
      const errorMessage = extractErrorMessage(err);
      
      if (errorMessage.includes('Access denied') || errorMessage.includes('Admin role required')) {
        setError('Access denied. Please sign in as admin to view employer members.');
        setErrorStage('access_denied');
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('insufficient_privilege')) {
        setError('Permission denied. Admin access required to view employer data.');
        setErrorStage('permission_denied');
      } else {
        setError(`Failed to fetch employers: ${errorMessage}`);
        setErrorStage('unknown_error');
      }
    } finally {
      setLoading(false);
      console.log('🏁 Fetch employers completed');
    }
  };

  const updateEmployerVerification = async (companyId: string, isVerified: boolean, badgeColor?: string) => {
    try {
      const startDate = new Date();
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      
      const { error } = await supabase.rpc('admin_update_company_verification_details', {
        p_company_id: companyId,
        p_is_verified: isVerified,
        p_badge_color: isVerified ? (badgeColor || 'gold') : null,
        p_start: isVerified ? startDate.toISOString() : null,
        p_end: isVerified ? endDate.toISOString() : null
      });

      if (error) {
        console.error('Error updating verification:', error);
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
    console.log('🚀 updateEmployerProfile: Starting update for user:', userId);
    console.log('📝 updateEmployerProfile: Updates to apply:', JSON.stringify(updates, null, 2));
    
    // Store original data for potential rollback
    const originalEmployer = employers.find(emp => emp.user_id === userId);
    console.log('💾 updateEmployerProfile: Original employer data:', originalEmployer);
    
    // Optimistic update - update local state first
    setEmployers(prev => prev.map(emp => 
      emp.user_id === userId 
        ? { ...emp, ...updates }
        : emp
    ));

    try {
      // Prepare RPC payload
      const rpcPayload: any = {
        p_user_id: userId,
        p_company_name: updates.company_name ?? null,
        p_email: updates.email ?? null,
        p_phone: updates.phone ?? null,
        p_whatsapp_number: updates.whatsapp_number ?? null,
        p_website: updates.website ?? null,
        p_legal_name: updates.legal_name ?? null,
        p_hr_contact_name: updates.hr_contact_name ?? null,
        p_precise_address: updates.precise_address ?? null,
        p_city: updates.city ?? null,
        p_state: updates.state ?? null,
        p_country: updates.country ?? null,
        p_postal_code: updates.postal_code ?? null,
      };

      console.log('📞 updateEmployerProfile: Calling admin_update_company_profile with payload:', JSON.stringify(rpcPayload, null, 2));
      
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_update_company_profile', rpcPayload);
      
      console.log('📡 updateEmployerProfile: RPC response - data:', rpcData, 'error:', rpcError);

      if (rpcError) {
        console.warn('⚠️ updateEmployerProfile: RPC failed, error details:', {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        });
        
        // Fallback to direct update
        console.log('🔄 updateEmployerProfile: Attempting direct database update...');
        
        const updateData: any = { updated_at: new Date().toISOString() };
        if (updates.company_name !== undefined) updateData.company_name = updates.company_name;
        if (updates.email !== undefined) updateData.email = updates.email;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.whatsapp_number !== undefined) updateData.whatsapp_number = updates.whatsapp_number;
        if (updates.website !== undefined) updateData.website = updates.website;
        if (updates.legal_name !== undefined) updateData.legal_name = updates.legal_name;
        if (updates.hr_contact_name !== undefined) updateData.hr_contact_name = updates.hr_contact_name;
        if (updates.precise_address !== undefined) updateData.precise_address = updates.precise_address;
        if (updates.city !== undefined) updateData.city = updates.city;
        if (updates.state !== undefined) updateData.state = updates.state;
        if (updates.country !== undefined) updateData.country = updates.country;
        if (updates.postal_code !== undefined) updateData.postal_code = updates.postal_code;

        console.log('📦 updateEmployerProfile: Direct update data:', JSON.stringify(updateData, null, 2));

        const { data: directData, error: directError } = await supabase
          .from('companies')
          .update(updateData)
          .eq('user_id', userId)
          .select();

        console.log('🔍 updateEmployerProfile: Direct update response - data:', directData, 'error:', directError);

        if (directError) {
          console.error('❌ updateEmployerProfile: Direct update failed:', {
            message: directError.message,
            details: directError.details,
            hint: directError.hint,
            code: directError.code
          });
          await fetchEmployers();
          throw new Error(`Database update failed: ${directError.message}`);
        }
        
        if (!directData || directData.length === 0) {
          console.error('❌ updateEmployerProfile: No records updated - user may not exist');
          await fetchEmployers();
          throw new Error('No company record found for this user. Please refresh and try again.');
        }
        
        console.log('✅ updateEmployerProfile: Direct update successful, records updated:', directData.length);
      } else {
        console.log('✅ updateEmployerProfile: RPC update successful, result:', rpcData);
      }

      // Always refresh data to ensure consistency
      console.log('🔄 updateEmployerProfile: Refreshing employer data...');
      await fetchEmployers();
      console.log('✅ updateEmployerProfile: Update process completed successfully');
      
    } catch (err: any) {
      console.error('💥 updateEmployerProfile: Critical error during update:', {
        error: err,
        message: err.message,
        stack: err.stack
      });
      
      // Revert optimistic update on any error
      console.log('🔄 updateEmployerProfile: Reverting optimistic update...');
      await fetchEmployers();
      
      throw new Error(err.message || 'Failed to update company profile. Please try again.');
    }
  };

  const setJobPostingVisibility = async (userId: string, visible: boolean) => {
    try {
      console.log('🔄 Setting job posting visibility:', { userId, visible });
      
      // Optimistic UI update - update local state immediately
      setEmployers(prev => prev.map(emp => 
        emp.user_id === userId 
          ? { ...emp, job_posting_visibility: visible }
          : emp
      ));
      
      // Resolve company_id using helper function
      const companyId = await resolveCompanyId(userId);

      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('❌ No valid session found');
        // Revert optimistic update
        await fetchEmployers();
        throw new Error('No valid session found. Please refresh and try again.');
      }

      console.log('📞 Calling handle-company-ban edge function...');
      // Call edge function with proper auth
      const { data, error } = await supabase.functions.invoke('handle-company-ban', {
        body: {
          company_id: companyId,
          user_id: userId,
          action: visible ? 'unban' : 'ban',
          ban_type: 'job_posting',
          reason: visible ? 'Job posting restored by admin' : 'Job posting disabled by admin'
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        // Fallback: Update employer_settings directly
        console.log('🔄 Edge function failed, attempting direct database update...');
        const { error: dbError } = await supabase
          .from('employer_settings')
          .upsert({
            user_id: userId,
            job_posting_visibility: visible,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (dbError) {
          console.error('❌ Direct database update also failed:', dbError);
          // Revert optimistic update
          await fetchEmployers();
          throw new Error(`Failed to update job posting visibility: ${error.message || 'Unknown error'}`);
        }

        console.log('✅ Job posting visibility updated via direct database update');
        // Refresh to confirm the change
        await fetchEmployers();
        return;
      }

      console.log('✅ Job posting visibility updated via edge function:', data);
      console.log('🔍 Edge function response details:', JSON.stringify(data, null, 2));
      
      // Refresh data to ensure UI is in sync with database
      console.log('🔄 Refreshing employer data after job posting visibility change...');
      await fetchEmployers();
      
      // Verify the update was successful
      const updatedEmployer = employers.find(emp => emp.user_id === userId);
      console.log('✅ Updated employer job_posting_visibility:', updatedEmployer?.job_posting_visibility);
      
    } catch (err: any) {
      console.error('🚨 Error in setJobPostingVisibility:', err);
      console.error('🚨 Error stack:', err.stack);
      // Revert optimistic update on error
      await fetchEmployers();
      throw new Error(err.message || 'Failed to update job posting visibility');
    }
  };

  const setAccountStatus = async (userId: string, status: 'active' | 'banned' | 'deleted', reason?: string) => {
    try {
      console.log('🚀 Setting account status:', { userId, status, reason });
      
      // Handle deletion separately - delete ONLY company data, keep user account
      if (status === 'deleted') {
        console.log('🔸 Using admin_delete_company_complete for deletion (keeps user account)');

        // Capture the contact BEFORE the company row is removed, so the
        // "employer profile deleted" template can still reach the employer.
        const { data: contact } = await supabase
          .from('companies')
          .select('company_name, email')
          .eq('user_id', userId)
          .maybeSingle();

        const { data, error } = await supabase.rpc('admin_delete_company_complete', {
          target_user_id: userId
        });

        if (error) {
          console.error('❌ Error deleting company:', error);
          throw new Error(error.message || 'Failed to delete company');
        }
        
        // Check if function returned error
        const result = data as { success?: boolean; error?: string } | null;
        if (result && typeof result === 'object' && 'success' in result && !result.success) {
          throw new Error(result.error || 'Failed to delete company');
        }
        
        console.log('✅ Company data deleted successfully (user account remains):', data);

        void notifyAccountDeleted({
          userId,
          audience: 'employer',
          name: contact?.company_name,
          email: contact?.email,
        });

        await fetchEmployers();
        return;
      }

      // For ban/unban, use edge function
      // Resolve company_id using helper function
      const companyId = await resolveCompanyId(userId);

      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('❌ No valid session found');
        throw new Error('No valid session found. Please refresh and try again.');
      }

      const action = status === 'banned' ? 'ban' : 'unban';
      const actionReason = reason || (status === 'banned' ? 'Profile banned by admin' : 'Profile unbanned by admin');

      console.log('📞 Calling handle-company-ban edge function...');
      // Call edge function with profile ban type
      const { data, error } = await supabase.functions.invoke('handle-company-ban', {
        body: {
          company_id: companyId,
          user_id: userId,
          action: action,
          ban_type: 'profile',
          reason: actionReason
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        // Fallback: Update company status directly
        console.log('🔄 Edge function failed, attempting direct database update...');
        const { error: dbError } = await supabase
          .from('companies')
          .update({
            account_status: status,
            account_status_reason: actionReason,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (dbError) {
          console.error('❌ Direct database update also failed:', dbError);
          throw new Error(`Failed to update profile status: ${error.message || 'Unknown error'}`);
        }

        console.log('✅ Profile status updated via direct database update');
        await fetchEmployers();
        return;
      }

      console.log('✅ Profile status updated via edge function:', data);
      await fetchEmployers();
    } catch (err: any) {
      console.error('🚨 Error in setAccountStatus:', err);
      console.error('🚨 Error stack:', err.stack);
      throw new Error(err.message || 'Failed to update account status');
    }
  };

  const recoverCompany = async (userId: string) => {
    try {
      console.log('🚀 Recovering company:', userId);
      
      const { error } = await supabase
        .from('companies')
        .update({ 
          account_status: 'active',
          account_status_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error recovering company:', error);
        throw error;
      }

      // Log recovery action to audit trail
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          await supabase
            .from('company_audit_logs')
            .insert({
              company_id: userId,
              admin_id: user.id,
              action: 'recovered',
              old_status: 'deleted',
              new_status: 'active',
              reason: 'Company profile recovered by admin'
            });
        }
      } catch (auditError) {
        console.warn('⚠️ Failed to log audit trail:', auditError);
      }

      console.log('✅ Company recovered successfully');
      await fetchEmployers();
    } catch (error) {
      console.error('❌ Failed to recover company:', error);
      throw error;
    }
  };

  // Function to update verification details (used by VerificationAdminDialog)
  const updateVerificationDetails = async (
    companyId: string, 
    isVerified: boolean, 
    badgeColor?: string, 
    startDate?: Date, 
    endDate?: Date
  ) => {
    try {
      console.log('Updating verification details:', { companyId, isVerified, badgeColor, startDate, endDate });
      const { error } = await supabase.rpc('admin_update_company_verification_details', {
        p_company_id: companyId,
        p_is_verified: isVerified,
        p_badge_color: badgeColor,
        p_start: startDate?.toISOString(),
        p_end: endDate?.toISOString()
      });

      if (error) {
        console.error('Error updating verification details:', error);
        throw error;
      }

      await fetchEmployers();
    } catch (err) {
      console.error('Error in updateVerificationDetails:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    // Only fetch if admin is verified
    if (adminVerified) {
      fetchEmployers();
    }
  }, [currentPage, debouncedSearch, filters.location, filters.industry, filters.status, filters.showDeleted, adminVerified]);

  return {
    employers,
    loading,
    error,
    totalCount,
    currentPage,
    setCurrentPage,
    filters,
    setFilters,
    availableLocations,
    availableIndustries,
    updateEmployerVerification,
    updateEmployerProfile,
    setJobPostingVisibility,
    setAccountStatus,
    updateVerificationDetails,
    refreshData: fetchEmployers,
    errorStage,
    isLimitedView,
    recoverCompany
  };
}