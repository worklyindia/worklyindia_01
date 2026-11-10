// Hybrid Applications Hook - Works with or without login

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useJobApplications, JobApplicationData } from './useJobApplications';
import { getLocalApplications, LocalApplication } from '@/lib/localDataStorage';

export const useHybridApplications = () => {
  const { user } = useAuth();
  const { applications: supabaseApps, loading: supabaseLoading, error: supabaseError, stats: supabaseStats } = useJobApplications();
  const [localApplications, setLocalApplications] = useState<JobApplicationData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch local applications for guest users
  useEffect(() => {
    if (!user) {
      const localApps = getLocalApplications();
      const formatted: JobApplicationData[] = localApps.map((app: LocalApplication) => ({
        id: app.id,
        jobId: app.jobId,
        title: app.title,
        company: app.company,
        location: app.location,
        appliedDate: app.appliedDate,
        status: app.status,
        statusColor: app.statusColor,
        salary: app.salary
      }));
      setLocalApplications(formatted);
      setLoading(false);
    } else {
      setLoading(supabaseLoading);
    }
  }, [user, supabaseLoading]);

  // Calculate stats for local or server data
  const getStats = () => {
    const apps = user ? supabaseApps : localApplications;
    
    const totalApplied = apps.length;
    const underReview = apps.filter(app => 
      app.status === 'Under Review' || app.status === 'Shortlisted'
    ).length;
    const interviews = apps.filter(app => 
      app.status === 'Interview Scheduled'
    ).length;
    const hired = apps.filter(app => 
      app.status === 'Hired'
    ).length;

    return {
      totalApplied,
      underReview,
      interviews,
      hired
    };
  };

  return {
    applications: user ? supabaseApps : localApplications,
    loading: user ? supabaseLoading : loading,
    error: user ? supabaseError : null,
    stats: user ? supabaseStats : getStats(),
    isGuest: !user
  };
};
