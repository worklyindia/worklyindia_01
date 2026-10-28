// Smart Job Matching System

export async function smartJobMatch(
  supabase: any,
  user_id: string,
  preferences?: any,
  domain?: string
) {
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (!profile) {
    return { error: 'Profile not found. Please complete your profile first.' };
  }

  // Build matching criteria
  const matchingCriteria = {
    skills: profile.skills || [],
    experience: profile.experience_years || 0,
    location: preferences?.location || profile.city || profile.state,
    jobType: preferences?.job_type || null,
    salaryExpectation: preferences?.min_salary || null
  };

  // Query jobs with complex matching logic
  let query = supabase
    .from('jobs')
    .select(`
      *,
      companies:company_id(company_name, logo_url, is_verified, industry)
    `)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  // Filter by location if specified
  if (matchingCriteria.location) {
    query = query.or(`city.ilike.%${matchingCriteria.location}%,state.ilike.%${matchingCriteria.location}%,location.ilike.%${matchingCriteria.location}%`);
  }

  // Filter by job type
  if (matchingCriteria.jobType) {
    query = query.eq('job_type', matchingCriteria.jobType);
  }

  let { data: jobs, error } = await query.limit(50);

  if (error) {
    console.error('Job search error:', error);
    return { error: error.message };
  }

  if (!jobs || jobs.length === 0) {
    // If strict profile/location filters found nothing, still prefer active
    // Workly India Website jobs over external partners. This matches the Jobs
    // page behavior and prevents partner listings from hiding platform jobs.
    const broader = await supabase
      .from('jobs')
      .select(`
        *,
        companies:company_id(company_name, logo_url, is_verified, industry)
      `)
      .eq('status', 'active')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);

    if (broader.error) {
      console.error('Broader job search error:', broader.error);
      return { error: broader.error.message };
    }

    jobs = broader.data || [];
  }

  if (!jobs || jobs.length === 0) {
    // No active public jobs on our website — fall back to external partner APIs
    // (Careerjet, Adzuna, Jooble) so the user always gets fresh listings,
    // just like the public Jobs page does.
    const externalJobs = await fetchExternalJobs(
      supabase,
      matchingCriteria.skills?.[0] || '',
      matchingCriteria.location || 'India',
      10
    );

    if (externalJobs.length === 0) {
      return {
        matches: [],
        message: 'No jobs found matching your criteria. Try broadening your search or update your profile.'
      };
    }

    return {
      success: true,
      totalMatches: externalJobs.length,
      excellentMatches: 0,
      goodMatches: externalJobs.length,
      fairMatches: 0,
      topMatches: externalJobs,
      matchingCriteria,
      source: 'external_partners',
      sourcesUsed: externalJobs.reduce((acc: any, j: any) => {
        acc[j.source] = (acc[j.source] || 0) + 1;
        return acc;
      }, {}),
      message: `Website pe abhi matching jobs nahi hain, lekin humare partner sites (Careerjet, Adzuna, Jooble) se ${externalJobs.length} fresh jobs mili hain! 🎯`
    };
  }

  // Calculate match scores for each job
  const scoredJobs = jobs.map((job: any) => {
    let matchScore = 0;
    const matchReasons = [];

    // Skills matching (highest weight: 40 points)
    const jobSkills = job.skills_required || [];
    const userSkills = matchingCriteria.skills;
    const matchingSkills = jobSkills.filter((skill: string) => 
      userSkills.some((userSkill: string) => 
        userSkill.toLowerCase() === skill.toLowerCase()
      )
    );
    
    if (matchingSkills.length > 0) {
      const skillMatchPercent = (matchingSkills.length / jobSkills.length) * 40;
      matchScore += skillMatchPercent;
      matchReasons.push(`${matchingSkills.length} matching skills: ${matchingSkills.slice(0, 3).join(', ')}`);
    }

    // Experience matching (25 points)
    const requiredExp = job.experience_level === 'entry' ? 0 : 
                       job.experience_level === 'mid' ? 3 :
                       job.experience_level === 'senior' ? 5 : 0;
    const experienceGap = Math.abs(matchingCriteria.experience - requiredExp);
    
    if (experienceGap === 0) {
      matchScore += 25;
      matchReasons.push('Perfect experience match');
    } else if (experienceGap <= 2) {
      matchScore += 15;
      matchReasons.push('Close experience match');
    }

    // Location matching (15 points)
    if (matchingCriteria.location) {
      const jobLocation = `${job.city} ${job.state} ${job.location}`.toLowerCase();
      if (jobLocation.includes(matchingCriteria.location.toLowerCase())) {
        matchScore += 15;
        matchReasons.push('Location match');
      }
    }

    // Salary matching (10 points)
    if (matchingCriteria.salaryExpectation && job.salary_min) {
      if (job.salary_min >= matchingCriteria.salaryExpectation) {
        matchScore += 10;
        matchReasons.push('Salary meets expectations');
      }
    }

    // Company verification bonus (10 points)
    if (job.companies?.is_verified) {
      matchScore += 10;
      matchReasons.push('Verified company');
    }

    return {
      ...job,
      company: job.companies?.company_name || job.company_name || 'Not specified',
      salary: job.salary_range || (
        job.salary_min && job.salary_max
          ? `₹${Number(job.salary_min).toLocaleString('en-IN')} - ₹${Number(job.salary_max).toLocaleString('en-IN')}`
          : 'Not disclosed'
      ),
      apply_link: `${(domain || '').replace(/\/$/, '') || 'https://worklyindia.devs.surf'}/job/${job.id}`,
      source: 'Website',
      matchScore: Math.round(matchScore),
      matchReasons,
      matchCategory: matchScore >= 75 ? 'excellent' :
                     matchScore >= 50 ? 'good' :
                     matchScore >= 25 ? 'fair' : 'poor'
    };
  });

  // Sort by match score
  scoredJobs.sort((a: any, b: any) => b.matchScore - a.matchScore);

  // Group by match category
  const groupedMatches = {
    excellent: scoredJobs.filter((j: any) => j.matchCategory === 'excellent'),
    good: scoredJobs.filter((j: any) => j.matchCategory === 'good'),
    fair: scoredJobs.filter((j: any) => j.matchCategory === 'fair')
  };

  return {
    success: true,
    totalMatches: scoredJobs.length,
    excellentMatches: groupedMatches.excellent.length,
    goodMatches: groupedMatches.good.length,
    fairMatches: groupedMatches.fair.length,
    topMatches: scoredJobs.slice(0, 10),
    matchingCriteria,
    recommendations: generateRecommendations(profile, scoredJobs)
  };
}

function generateRecommendations(profile: any, jobs: any[]) {
  const recommendations = [];

  // Check if skills are limiting matches
  const avgSkillMatch = jobs.reduce((sum, job) => sum + (job.matchScore || 0), 0) / jobs.length;
  
  if (avgSkillMatch < 40 && (!profile.skills || profile.skills.length < 5)) {
    recommendations.push({
      type: 'skills',
      message: 'Add more skills to your profile to increase match quality',
      action: 'Update profile with relevant skills'
    });
  }

  // Check experience level
  if (!profile.experience_years) {
    recommendations.push({
      type: 'experience',
      message: 'Add your work experience to get better matches',
      action: 'Update experience in profile'
    });
  }

  // Check location specificity
  if (!profile.city) {
    recommendations.push({
      type: 'location',
      message: 'Add your preferred location to find nearby jobs',
      action: 'Update location in profile'
    });
  }

  return recommendations;
}

// AI-powered career path suggestions
export async function suggestCareerPath(supabase: any, user_id: string) {
  // (unchanged)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (!profile) {
    return { error: 'Profile not found' };
  }

  // Get career paths from database
  const { data: careerPaths } = await supabase
    .from('career_paths')
    .select('*')
    .eq('is_active', true);

  if (!careerPaths) {
    return { suggestions: [] };
  }

  // Match user skills to career paths
  const userSkills = profile.skills || [];
  const scoredPaths = careerPaths.map((path: any) => {
    const requiredSkills = path.key_skills || [];
    const matchingSkills = requiredSkills.filter((skill: string) =>
      userSkills.some((userSkill: string) =>
        userSkill.toLowerCase().includes(skill.toLowerCase())
      )
    );

    const matchPercent = requiredSkills.length > 0 
      ? (matchingSkills.length / requiredSkills.length) * 100 
      : 0;

    return {
      ...path,
      matchPercent: Math.round(matchPercent),
      matchingSkills,
      skillsToLearn: requiredSkills.filter((skill: string) =>
        !matchingSkills.includes(skill)
      )
    };
  });

  // Sort by match percentage
  scoredPaths.sort((a: any, b: any) => b.matchPercent - a.matchPercent);

  return {
    success: true,
    careerSuggestions: scoredPaths.slice(0, 5),
    currentSkills: userSkills.length,
    recommendation: scoredPaths[0]?.matchPercent > 60
      ? `You're well-suited for ${scoredPaths[0].title}! Focus on learning: ${scoredPaths[0].skillsToLearn.slice(0, 3).join(', ')}`
      : 'Build more skills to unlock better career opportunities'
  };
}

// ============================================================================
// External partner fallback — Careerjet, Adzuna, Jooble
// Invoked when our internal `jobs` table has zero matches so the AI Career
// Chat still returns real listings (mirrors the Jobs page behavior).
// ============================================================================
export async function fetchExternalJobs(
  supabase: any,
  keywords: string,
  location: string,
  limit = 10
): Promise<any[]> {
  const perSource = Math.max(3, Math.ceil(limit / 2));

  const callFeed = async (action: 'jooble' | 'adzuna' | 'careerjet') => {
    try {
      const { data, error } = await supabase.functions.invoke('get-job-feed', {
        body: {
          action,
          keywords: keywords || '',
          location: location || 'India',
          page: 1,
          limit: perSource,
          sort: 'relevance',
        },
      });
      if (error || !data) return [];
      return Array.isArray((data as any).jobs) ? (data as any).jobs : [];
    } catch (e) {
      console.warn(`[fetchExternalJobs] ${action} failed`, e);
      return [];
    }
  };

  const [jooble, adzuna, careerjet] = await Promise.all([
    callFeed('jooble'),
    callFeed('adzuna'),
    callFeed('careerjet'),
  ]);

  const mapJob = (j: any, source: string) => ({
    id: j.external_id || j.id || `${source}_${Math.random().toString(36).slice(2)}`,
    title: j.title,
    company: j.company || 'Company not disclosed',
    location: j.location || location || 'India',
    salary: j.salary || 'Not specified',
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    job_type: j.type || j.employment || j.contract_time || '',
    category: j.category || '',
    description: j.snippet || j.description || '',
    apply_link: j.link,
    source,
    matchScore: 60,
    matchCategory: 'good',
    matchReasons: [`Fresh listing from ${source}`],
  });

  // Round-robin merge so all 3 partners are represented in the output.
  const arrs = [
    careerjet.map((j: any) => mapJob(j, 'Careerjet')),
    adzuna.map((j: any) => mapJob(j, 'Adzuna')),
    jooble.map((j: any) => mapJob(j, 'Jooble')),
  ];
  const merged: any[] = [];
  const maxLen = Math.max(...arrs.map((a) => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrs) if (arr[i]) merged.push(arr[i]);
  }
  return merged.slice(0, limit);
}
