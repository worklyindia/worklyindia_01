// Hybrid Favorites Hook
// - Internal jobs (uuid): Supabase for logged-in users, local for guests
// - External jobs (ext-*): Always require login. Persist the full job object
//   locally under `ext_fav_<jobId>` so the Favorites page can render them.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from './useFavorites';
import {
  getLocalFavorites,
  toggleFavoriteInLocal
} from '@/lib/localDataStorage';
import { useToast } from './use-toast';

const EXT_FAV_PREFIX = 'ext_fav_';

export const getExternalFavoriteJob = (jobId: string): any | null => {
  try {
    const raw = localStorage.getItem(`${EXT_FAV_PREFIX}${jobId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveExternalFavoriteJob = (jobId: string, job: any) => {
  try {
    localStorage.setItem(`${EXT_FAV_PREFIX}${jobId}`, JSON.stringify(job));
  } catch {}
};

const removeExternalFavoriteJob = (jobId: string) => {
  try {
    localStorage.removeItem(`${EXT_FAV_PREFIX}${jobId}`);
  } catch {}
};

export const useHybridFavorites = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    favorites: supabaseFavorites,
    loading: supabaseLoading,
    toggleFavorite: supabaseToggle,
    isFavorited: supabaseIsFavorited,
    refetch,
  } = useFavorites();
  const [localFavorites, setLocalFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const locals = getLocalFavorites();
    setLocalFavorites(locals);
  }, [user]);

  /**
   * Toggle favorite.
   * @param jobId - Internal uuid or `ext-*` id for external jobs
   * @param jobData - For external jobs, pass the full job object to persist
   */
  const toggleFavorite = useCallback(
    async (jobId: string, jobData?: any) => {
      const isExternal = typeof jobId === 'string' && jobId.startsWith('ext-');

      // Require login for ALL favorites (internal + external)
      if (!user) {
        toast({
          title: 'Login required',
          description: 'Please login to save jobs to your favorites.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      if (isExternal) {
        // External jobs can't be stored in Supabase (FK to internal jobs table).
        // Persist the full job locally so Favorites page can render it.
        setLoading(true);
        try {
          const wasAdded = toggleFavoriteInLocal(jobId);
          if (wasAdded && jobData) {
            saveExternalFavoriteJob(jobId, jobData);
          } else if (!wasAdded) {
            removeExternalFavoriteJob(jobId);
          }
          setLocalFavorites(getLocalFavorites());
          toast({
            title: wasAdded ? 'Added to favorites' : 'Removed from favorites',
            description: wasAdded
              ? 'Job saved to your favorites.'
              : 'Job removed from your favorites.',
          });
        } catch (error) {
          toast({
            title: 'Error',
            description:
              error instanceof Error ? error.message : 'Failed to update favorites',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
        return;
      }

      // Internal job - use Supabase
      return await supabaseToggle(jobId);
    },
    [user, supabaseToggle, toast, navigate]
  );

  const isFavorited = useCallback(
    (jobId: string) => {
      const isExternal = typeof jobId === 'string' && jobId.startsWith('ext-');
      if (isExternal) return localFavorites.includes(jobId);
      if (user) return supabaseIsFavorited(jobId);
      return localFavorites.includes(jobId);
    },
    [user, supabaseIsFavorited, localFavorites]
  );

  // Combined list: internal from Supabase + external ids from local
  const externalFavoriteIds = localFavorites.filter((id) => id.startsWith('ext-'));
  const combined = user
    ? [...supabaseFavorites, ...externalFavoriteIds]
    : externalFavoriteIds;

  return {
    favorites: combined,
    loading: user ? supabaseLoading : loading,
    toggleFavorite,
    isFavorited,
    refetch,
    isGuest: !user,
  };
};
