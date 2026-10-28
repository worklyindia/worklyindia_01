// Data Sync Manager - Syncs local data to Supabase on login

import { supabase } from '@/integrations/supabase/client';
import { 
  getLocalData, 
  clearLocalData, 
  markAsSynced,
  LocalApplication 
} from './localDataStorage';

export interface SyncResult {
  success: boolean;
  message: string;
  syncedApplications: number;
  syncedFavorites: number;
  errors: string[];
}

// Sync local data to Supabase
export const syncLocalDataToSupabase = async (userId: string): Promise<SyncResult> => {
  const result: SyncResult = {
    success: false,
    message: '',
    syncedApplications: 0,
    syncedFavorites: 0,
    errors: []
  };

  try {
    const localData = getLocalData();
    
    // Check if there's anything to sync
    if (localData.applications.length === 0 && localData.favorites.length === 0) {
      result.success = true;
      result.message = 'No local data to sync';
      return result;
    }

    // Sync Applications
    if (localData.applications.length > 0) {
      const appResult = await syncApplications(userId, localData.applications);
      result.syncedApplications = appResult.synced;
      if (appResult.errors.length > 0) {
        result.errors.push(...appResult.errors);
      }
    }

    // Sync Favorites
    if (localData.favorites.length > 0) {
      const favResult = await syncFavorites(userId, localData.favorites);
      result.syncedFavorites = favResult.synced;
      if (favResult.errors.length > 0) {
        result.errors.push(...favResult.errors);
      }
    }

    // Mark as synced and clear if successful
    if (result.errors.length === 0) {
      markAsSynced();
      clearLocalData();
      result.success = true;
      result.message = `✅ Successfully synced ${result.syncedApplications} applications and ${result.syncedFavorites} favorites`;
    } else {
      result.success = false;
      result.message = `⚠️ Partial sync completed with ${result.errors.length} errors`;
    }

    return result;
  } catch (error) {
    console.error('Sync error:', error);
    result.success = false;
    result.message = '❌ Failed to sync local data';
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
};

// Sync applications to Supabase
const syncApplications = async (userId: string, applications: LocalApplication[]) => {
  let synced = 0;
  const errors: string[] = [];

  for (const app of applications) {
    try {
      // Check if application already exists
      const { data: existing } = await supabase
        .from('job_applications')
        .select('id')
        .eq('applicant_id', userId)
        .eq('job_id', app.jobId)
        .maybeSingle();

      // Skip if already applied
      if (existing) {
        continue;
      }

      // Get job details to find company_id (which is the employer)
      const { data: jobData } = await supabase
        .from('jobs')
        .select('company_id')
        .eq('id', app.jobId)
        .maybeSingle();

      if (!jobData || !jobData.company_id) {
        errors.push(`Job ${app.title} not found or has no company`);
        continue;
      }

      // Insert new application
      const { error } = await supabase
        .from('job_applications')
        .insert({
          applicant_id: userId,
          job_id: app.jobId,
          employer_id: jobData.company_id,
          status: 'applied',
          applied_at: app.appliedDate,
          cover_letter: app.notes || null
        });

      if (error) {
        errors.push(`Failed to sync application for ${app.title}: ${error.message}`);
      } else {
        synced++;
      }
    } catch (error) {
      errors.push(`Error syncing application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { synced, errors };
};

// Sync favorites to Supabase
const syncFavorites = async (userId: string, favorites: string[]) => {
  let synced = 0;
  const errors: string[] = [];

  for (const jobId of favorites) {
    try {
      // Check if favorite already exists
      const { data: existing } = await supabase
        .from('job_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .maybeSingle();

      // Skip if already favorited
      if (existing) {
        continue;
      }

      // Insert new favorite
      const { error } = await supabase
        .from('job_favorites')
        .insert({
          user_id: userId,
          job_id: jobId
        });

      if (error) {
        errors.push(`Failed to sync favorite ${jobId}: ${error.message}`);
      } else {
        synced++;
      }
    } catch (error) {
      errors.push(`Error syncing favorite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { synced, errors };
};

// Check if user has local data that needs syncing
export const hasLocalDataToSync = (): boolean => {
  const localData = getLocalData();
  return localData.applications.length > 0 || localData.favorites.length > 0;
};
