import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  company_name: string;
  description: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  company_size: string | null;
  incorporation_date: string | null;
  logo_url: string | null;
  website: string | null;
  is_verified: boolean;
  account_status: string;
  trending_score: number;
  created_at: string;
  jobs_count: number;
  profile_views_count: number;
}

export interface FilterCounts {
  all: number;
  trending: number;
  verified: number;
}

interface UseCompaniesDataProps {
  searchTerm: string;
  selectedIndustry: string;
  selectedSize: string;
  selectedLocation: string;
  subFilter: 'all' | 'trending' | 'verified';
}

export const useCompaniesData = ({
  searchTerm,
  selectedIndustry,
  selectedSize,
  selectedLocation,
  subFilter
}: UseCompaniesDataProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filterCounts, setFilterCounts] = useState<FilterCounts>({ all: 0, trending: 0, verified: 0 });

  // Fetch companies with jobs count
  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      
      // Fetch companies with job counts
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .eq('account_status', 'active')
        .eq('is_profile_complete', true)
        .order('created_at', { ascending: false });

      if (companiesError) throw companiesError;

      // Fetch job counts for each company  
      const jobCountsQuery = (supabase as any)
        .from('jobs')
        .select('company_id')
        .eq('is_active', true);
      
      const { data: jobCounts } = await jobCountsQuery;

      // Count jobs per company
      const jobCountMap: Record<string, number> = {};
      jobCounts?.forEach(job => {
        jobCountMap[job.company_id] = (jobCountMap[job.company_id] || 0) + 1;
      });

      // Merge data
      const companiesWithJobs = companiesData?.map(company => ({
        ...company,
        jobs_count: jobCountMap[company.id] || 0,
        trending_score: company.trending_score || 0,
        is_verified: company.is_verified || false,
        profile_views_count: company.profile_views_count || 0,
      })) || [];

      setAllCompanies(companiesWithJobs);
      setCompanies(companiesWithJobs);

      // Calculate filter counts
      const counts: FilterCounts = {
        all: companiesWithJobs.length,
        trending: companiesWithJobs.filter(c => (c.trending_score || 0) > 50).length,
        verified: companiesWithJobs.filter(c => c.is_verified).length,
      };
      setFilterCounts(counts);

    } catch (err) {
      console.error('Error fetching companies:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCompanies();

    // Real-time subscription
    const channel = supabase
      .channel('companies_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'companies' },
        () => {
          // Skip refetch if payment is in progress to prevent UI disruptions
          try {
            if (sessionStorage.getItem('payment_in_progress') === 'true') {
              console.log('🔒 useCompaniesData: Payment in progress, skipping refetch');
              return;
            }
          } catch {}
          console.log('📡 Real-time: Company data changed, refetching...');
          fetchCompanies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...allCompanies];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(company => 
        company.company_name?.toLowerCase().includes(search) ||
        company.description?.toLowerCase().includes(search) ||
        company.industry?.toLowerCase().includes(search) ||
        company.city?.toLowerCase().includes(search) ||
        company.state?.toLowerCase().includes(search)
      );
    }

    // Industry filter
    if (selectedIndustry && selectedIndustry !== 'All Industries') {
      filtered = filtered.filter(company => company.industry === selectedIndustry);
    }

    // Size filter
    if (selectedSize && selectedSize !== 'All Sizes') {
      filtered = filtered.filter(company => company.company_size === selectedSize);
    }

    // Location filter
    if (selectedLocation && selectedLocation !== 'All Locations') {
      filtered = filtered.filter(company => {
        const companyLocation = company.city ? 
          `${company.city}, ${company.state}` : 
          company.state;
        return companyLocation === selectedLocation;
      });
    }

    // Sub-filter (All/Trending/Verified)
    if (subFilter === 'trending') {
      filtered = filtered.filter(c => (c.trending_score || 0) > 50);
    } else if (subFilter === 'verified') {
      filtered = filtered.filter(c => c.is_verified);
    }

    setCompanies(filtered);
  }, [searchTerm, selectedIndustry, selectedSize, selectedLocation, subFilter, allCompanies]);

  // Get available filter options from actual data
  const availableIndustries = Array.from(
    new Set(allCompanies.map(c => c.industry).filter((ind): ind is string => Boolean(ind)))
  ).sort();

  const availableLocations = Array.from(
    new Set(
      allCompanies
        .map(c => c.city ? `${c.city}, ${c.state}` : c.state)
        .filter((loc): loc is string => Boolean(loc))
    )
  ).sort();

  const availableSizes = Array.from(
    new Set(allCompanies.map(c => c.company_size).filter((size): size is string => Boolean(size)))
  ).sort();

  // Industry counts
  const industryCounts = availableIndustries.reduce((acc, industry) => {
    acc[industry] = allCompanies.filter(c => c.industry === industry).length;
    return acc;
  }, {} as Record<string, number>);

  // Total stats
  const totalStats = {
    companies: allCompanies.length,
    jobs: allCompanies.reduce((sum, c) => sum + c.jobs_count, 0),
    avgRating: 4.5, // TODO: Calculate from company_reviews table
    industries: availableIndustries.length,
  };

  return {
    companies,
    allCompanies,
    availableIndustries,
    availableLocations,
    availableSizes,
    industryCounts,
    filterCounts,
    totalStats,
    isLoading,
    error,
  };
};
