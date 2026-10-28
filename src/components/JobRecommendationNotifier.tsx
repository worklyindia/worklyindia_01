import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { JobStatusNotificationService } from '@/services/JobStatusNotificationService';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

export const JobRecommendationNotifier: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!shouldEnableRealtime()) return;

    console.log('🔔 Setting up job recommendation notifications for user:', user.id);

    // Listen for new jobs that might match user profile
    const jobChannel = supabase
      .channel(`job-recommendations-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
        },
        async (payload) => {
          console.log('🔔 New job posted:', payload);
          const newJob = payload.new as any;
          
          // Only process active, published jobs
          if (newJob.status === 'published' && newJob.is_active) {
            // Get user profile to check for matches
            const { data: profile } = await supabase
              .from('profiles')
              .select('skills, current_position, location, experience_years')
              .eq('user_id', user.id)
              .single();

            if (profile && shouldRecommendJob(newJob, profile)) {
              // Send job recommendation notification
              setTimeout(async () => {
                await JobStatusNotificationService.notifyJobRecommendation(
                  user.id,
                  newJob.id,
                  newJob.title,
                  newJob.company_name || 'Company',
                  newJob.location || 'Location',
                  calculateMatchScore(newJob, profile)
                );
              }, 2000); // Delay to allow job to be fully created
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔔 Cleaning up job recommendation listeners');
      supabase.removeChannel(jobChannel);
    };
  }, [user]);

  return null; // This component doesn't render anything
};

// Helper function to determine if job should be recommended to user
function shouldRecommendJob(job: any, profile: any): boolean {
  if (!job || !profile) return false;
  
  // Basic matching logic
  const jobTitle = job.title?.toLowerCase() || '';
  const jobDescription = job.description?.toLowerCase() || '';
  const jobLocation = job.location?.toLowerCase() || '';
  
  const userSkills = Array.isArray(profile.skills) 
    ? profile.skills.map((s: string) => s.toLowerCase()) 
    : [];
  const userPosition = profile.current_position?.toLowerCase() || '';
  const userLocation = profile.location?.toLowerCase() || '';
  
  // Check for skill matches
  const hasSkillMatch = userSkills.some((skill: string) => 
    skill.length > 2 && (jobTitle.includes(skill) || jobDescription.includes(skill))
  );
  
  // Check for position relevance
  const hasPositionMatch = userPosition.length > 2 && (
    jobTitle.includes(userPosition) || 
    jobDescription.includes(userPosition)
  );
  
  // Check for location match (broader matching)
  const hasLocationMatch = !userLocation || 
    jobLocation.includes(userLocation) || 
    userLocation.includes(jobLocation) ||
    job.is_remote;
  
  // Recommend if there's at least one meaningful match and location is compatible
  return (hasSkillMatch || hasPositionMatch) && hasLocationMatch;
}

// Helper function to calculate match score
function calculateMatchScore(job: any, profile: any): number {
  if (!job || !profile) return 0;
  
  let score = 0;
  const maxScore = 100;
  
  const jobTitle = job.title?.toLowerCase() || '';
  const jobDescription = job.description?.toLowerCase() || '';
  const jobLocation = job.location?.toLowerCase() || '';
  
  const userSkills = Array.isArray(profile.skills) 
    ? profile.skills.map((s: string) => s.toLowerCase()) 
    : [];
  const userPosition = profile.current_position?.toLowerCase() || '';
  const userLocation = profile.location?.toLowerCase() || '';
  
  // Skill matches (40 points max)
  const matchingSkills = userSkills.filter((skill: string) => 
    skill.length > 2 && (jobTitle.includes(skill) || jobDescription.includes(skill))
  );
  score += Math.min(matchingSkills.length * 15, 40);
  
  // Position relevance (30 points max)
  if (userPosition.length > 2 && (jobTitle.includes(userPosition) || jobDescription.includes(userPosition))) {
    score += 30;
  }
  
  // Location match (20 points max)
  if (job.is_remote) {
    score += 20;
  } else if (userLocation && (jobLocation.includes(userLocation) || userLocation.includes(jobLocation))) {
    score += 15;
  }
  
  // Experience level match (10 points max)
  if (job.experience_level && profile.experience_years) {
    const experienceMatch = Math.abs(job.experience_level - profile.experience_years) <= 2;
    if (experienceMatch) score += 10;
  }
  
  return Math.min(score, maxScore);
}