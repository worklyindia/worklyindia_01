import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    const cacheKey = 'workly-favorites-v1:' + user.id;
    setLoading(true);

    // Restore the last known IDs first; this keeps the saved list available offline.
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
          setFavorites(parsed);
        }
      }
    } catch {
      // Ignore invalid or unavailable local cache.
    }

    try {
      // Fetch user's favorites
      const { data, error } = await supabase
        .from('job_favorites')
        .select('job_id')
        .eq('user_id', user.id);

      if (error) throw error;

      // Validate each job is still active and accessible
      const favoriteJobIds = data?.map(item => item.job_id) || [];
      const validFavorites = [];

      for (const jobId of favoriteJobIds) {
        const { data: jobData } = await supabase
          .rpc('get_job_for_application', { p_job_id: jobId });
        
        if (jobData && jobData.length > 0) {
          validFavorites.push(jobId);
        }
      }

      setFavorites(validFavorites);
      try { localStorage.setItem(cacheKey, JSON.stringify(validFavorites)); } catch { /* Cache is optional. */ }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      // Keep the last known IDs so the saved list can still render without a connection.
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    if (user) setLoading(true);
    
    // Add small delay to prevent race conditions during route restoration
    const fetchTimer = setTimeout(() => {
      if (isMounted) {
        fetchFavorites();
      }
    }, 50);

    // Refetch whenever favorites are toggled anywhere in the app
    const handleUpdate = () => {
      if (isMounted) fetchFavorites();
    };
    window.addEventListener('favorites-updated', handleUpdate);

    return () => {
      isMounted = false;
      clearTimeout(fetchTimer);
      window.removeEventListener('favorites-updated', handleUpdate);
    };
  }, [fetchFavorites]);


  const toggleFavorite = useCallback(async (jobId: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to save favorites",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const isFavorited = favorites.includes(jobId);

      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('job_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', jobId);

        if (error) throw error;

        setFavorites(prev => {
          const next = prev.filter(id => id !== jobId);
          try { localStorage.setItem('workly-favorites-v1:' + user.id, JSON.stringify(next)); } catch { /* Cache is optional. */ }
          return next;
        });
        window.dispatchEvent(new Event('favorites-updated'));
        toast({
          title: "Removed from favorites",
          description: "Job removed from your favorites list"
        });
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('job_favorites')
          .insert({
            user_id: user.id,
            job_id: jobId
          });

        if (error) throw error;

        setFavorites(prev => {
          const next = [...prev, jobId];
          try { localStorage.setItem('workly-favorites-v1:' + user.id, JSON.stringify(next)); } catch { /* Cache is optional. */ }
          return next;
        });
        window.dispatchEvent(new Event('favorites-updated'));
        toast({
          title: "Added to favorites",
          description: "Job saved to your favorites list"
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, favorites, toast]);

  const isFavorited = useCallback((jobId: string) => {
    return favorites.includes(jobId);
  }, [favorites]);

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorited,
    refetch: fetchFavorites
  };
};