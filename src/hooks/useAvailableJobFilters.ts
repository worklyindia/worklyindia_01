import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

interface AvailableFilters {
  categories: string[];
  skills: string[];
  cities: string[];
  states: string[];
  countries: string[];
  jobTypes: string[];
  languages: string[];
  loading: boolean;
}

const FILTER_CACHE_KEY = 'wfh_available_job_filters_v1';
const FILTER_CACHE_TTL = 60 * 60 * 1000;

export const useAvailableJobFilters = () => {
  const [filters, setFilters] = useState<AvailableFilters>({
    categories: [],
    skills: [],
    cities: [],
    states: [],
    countries: [],
    jobTypes: [],
    languages: [],
    loading: true
  });

  useEffect(() => {
    const fetchAvailableFilters = async () => {
      try {
        const cached = localStorage.getItem(FILTER_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < FILTER_CACHE_TTL) {
            setFilters({ ...parsed.filters, loading: false });
            return;
          }
        }

        // Fetch all active jobs with their categories, skills, location data, job types, and languages
        const { data: jobs, error } = await supabase
          .from('jobs')
          .select('category, skills, city, state, country, location, job_type, languages')
          .eq('status', 'active')
          .eq('visibility', 'public');

        if (error) throw error;

        // Extract unique categories
        const uniqueCategories = [...new Set(
          jobs
            ?.map(job => job.category)
            .filter(Boolean)
        )].sort();

        // Extract unique skills
        const allSkills = jobs?.flatMap(job => job.skills || []) || [];
        const uniqueSkills = [...new Set(allSkills)].sort();

        // Extract unique locations
        const citiesSet = new Set<string>();
        const statesSet = new Set<string>();
        const countriesSet = new Set<string>();

        jobs?.forEach(job => {
          // From structured fields - with trim to avoid duplicates
          if (job.city?.trim()) citiesSet.add(job.city.trim());
          if (job.state?.trim()) statesSet.add(job.state.trim());
          if (job.country?.trim()) countriesSet.add(job.country.trim());

          // Parse from location string (e.g., "Patan, Gujarat, India")
          if (job.location && typeof job.location === 'string') {
            const parts = job.location.split(',').map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length === 3) {
              citiesSet.add(parts[0]);
              statesSet.add(parts[1]);
              countriesSet.add(parts[2]);
            } else if (parts.length === 2) {
              citiesSet.add(parts[0]);
              statesSet.add(parts[1]);
            } else if (parts.length === 1) {
              citiesSet.add(parts[0]);
            }
          }
        });

        // Convert sets to arrays and ensure uniqueness
        const uniqueCities = [...new Set(Array.from(citiesSet))].sort();
        const uniqueStates = [...new Set(Array.from(statesSet))].sort();
        const uniqueCountries = [...new Set(Array.from(countriesSet))].sort();

        // Extract unique job types
        const uniqueJobTypes = [...new Set(
          jobs
            ?.map(job => job.job_type)
            .filter(Boolean)
        )].sort();

        // Extract unique languages from array field
        const allLanguages = jobs?.flatMap(job => job.languages || []) || [];
        const uniqueLanguages = [...new Set(allLanguages)].sort();

        const nextFilters = {
          categories: uniqueCategories,
          skills: uniqueSkills,
          cities: uniqueCities,
          states: uniqueStates,
          countries: uniqueCountries,
          jobTypes: uniqueJobTypes,
          languages: uniqueLanguages,
          loading: false
        };

        localStorage.setItem(FILTER_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), filters: nextFilters }));
        setFilters(nextFilters);
      } catch (error) {
        console.error('Error fetching available filters:', error);
        setFilters(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAvailableFilters();

    if (!shouldEnableRealtime()) return;

    // Set up real-time subscription to update filters when jobs change
    const subscription = supabase
      .channel('job-filters-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs'
        },
        () => {
          // Refetch when jobs are added, updated, or deleted
          fetchAvailableFilters();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return filters;
};
