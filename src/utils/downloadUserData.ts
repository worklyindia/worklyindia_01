import { supabase } from "@/integrations/supabase/client";
import { downloadService } from "./downloadService";

export const downloadUserData = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Fetch all user data from various tables
    const [
      profileData,
      settingsData,
      applicationsData,
      favoritesData,
      experiencesData,
      educationData,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('job_applications').select('*').eq('applicant_id', user.id),
      supabase.from('job_favorites').select('*').eq('user_id', user.id),
      supabase.from('professional_experiences').select('*').eq('user_id', user.id),
      supabase.from('education_entries').select('*').eq('user_id', user.id),
    ]);

    const userData = {
      user_info: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      profile: profileData.data || null,
      settings: settingsData.data || null,
      applications: applicationsData.data || [],
      favorites: favoritesData.data || [],
      experiences: experiencesData.data || [],
      education: educationData.data || [],
      export_date: new Date().toISOString(),
    };

    // Use Supabase download service - file will be auto-deleted after download
    const result = await downloadService.downloadJSON(
      `user-data-${new Date().toISOString().split('T')[0]}`,
      userData
    );

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    return true;
  } catch (error) {
    console.error('Error downloading user data:', error);
    throw error;
  }
};