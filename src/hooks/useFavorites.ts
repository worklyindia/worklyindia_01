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
    } catch (error) {
      console.error('Error fetching favorites:', error);
      setFavorites([]);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    
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

        setFavorites(prev => prev.filter(id => id !== jobId));
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

        setFavorites(prev => [...prev, jobId]);
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