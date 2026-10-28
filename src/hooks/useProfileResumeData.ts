import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Read-only snapshot of the job seeker profile used to pre-fill the
 * resume / cover letter builders. Nothing here ever writes back to the
 * profile — builder drafts live in their own draft tables.
 */
export const useProfileResumeData = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile-resume-data', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user?.id) return null;

      const [profileRes, expRes, eduRes, certRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('professional_experiences')
          .select('*')
          .eq('user_id', user.id)
          .order('start_date', { ascending: false }),
        supabase
          .from('education_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('end_year', { ascending: false }),
        supabase
          .from('certifications')
          .select('*')
          .eq('user_id', user.id)
          .order('issue_date', { ascending: false }),
      ]);

      return {
        profile: (profileRes.data as any) || null,
        experiences: (expRes.data as any[]) || [],
        education: (eduRes.data as any[]) || [],
        certifications: (certRes.data as any[]) || [],
      };
    },
  });
};

const uid = () => Math.random().toString(36).slice(2, 10);

const toList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[,;\n|]/)
    .map((v) => v.trim())
    .filter(Boolean);
};

export type ProfileResumeData = NonNullable<ReturnType<typeof useProfileResumeData>['data']>;

/** Build resume-draft shaped pieces from the profile snapshot. */
export const profileToResumePieces = (src: ProfileResumeData) => {
  const p = src.profile || {};

  const personal = {
    fullName: p.full_name || '',
    professionalTitle: p.current_position || '',
    mobile: p.phone || p.whatsapp_number || '',
    email: p.email || '',
    location: p.location || [p.city, p.state].filter(Boolean).join(', ') || '',
    linkedin: p.linkedin_link || '',
    portfolio: p.github_link || p.gitlab_link || '',
    photoUrl: p.profile_image_url || '',
  };

  const experiences = src.experiences.map((e) => ({
    id: uid(),
    company: e.company || '',
    jobTitle: e.position || '',
    employmentType: '',
    startDate: e.start_date ? String(e.start_date).slice(0, 7) : '',
    endDate: e.end_date ? String(e.end_date).slice(0, 7) : '',
    currentlyWorking: !!e.is_current,
    city: '',
    responsibilities: e.description || '',
    achievements: '',
  }));

  const education = src.education.map((e) => ({
    id: uid(),
    course: [e.degree, e.field_of_study].filter(Boolean).join(' - ') || e.degree || '',
    school: e.institution || '',
    board: '',
    startYear: e.start_year ? String(e.start_year) : '',
    endYear: e.end_year ? String(e.end_year) : '',
    grade: e.grade || '',
  }));

  const skills = toList(p.skills).map((name) => ({
    id: uid(),
    name,
    category: 'technical' as const,
    level: 'Intermediate' as const,
  }));

  const languages = toList(p.languages).map((name) => ({
    id: uid(),
    name,
    proficiency: 'Fluent' as const,
  }));

  const certifications = src.certifications.map((c) => ({
    id: uid(),
    name: c.certification_name || '',
    organization: c.issuing_organization || '',
    issueDate: c.issue_date ? String(c.issue_date).slice(0, 7) : '',
    expiryDate: c.expiry_date ? String(c.expiry_date).slice(0, 7) : '',
    url: c.credential_url || '',
  }));

  return {
    personal,
    summary: p.bio || '',
    experiences,
    education,
    skills,
    languages,
    certifications,
    additional: {
      dob: p.date_of_birth ? String(p.date_of_birth) : '',
      gender: p.gender || '',
    },
    jobPreferences: {
      preferredRole: p.current_position || p.industry || '',
      preferredLocation: p.preferred_location || '',
      employmentTypes: toList(p.job_type),
    },
  };
};
