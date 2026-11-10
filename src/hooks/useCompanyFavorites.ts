import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useCompanyFavorites = (companyId: string | undefined) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!companyId || !user) {
      setIsFavorited(false);
      return;
    }

    const checkFavoriteStatus = async () => {
      try {
        const { data, error } = await supabase.rpc('is_company_favorited', {
          p_company_id: companyId,
          p_user_id: user.id
        });

        if (error) throw error;
        setIsFavorited(data || false);
      } catch (err: any) {
        console.error('Error checking favorite status:', err);
        console.error('Error details:', {
          message: err?.message,
          code: err?.code,
          details: err?.details
        });
      }
    };

    checkFavoriteStatus();
  }, [companyId, user]);

  const toggleFavorite = async () => {
    if (!user || !companyId) {
      toast.error("Please log in to add favorites");
      return;
    }

    // Verify session is still valid
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please log in to add favorites");
      return;
    }

    // Optimistic update - immediately toggle UI
    const previousState = isFavorited;
    setIsFavorited(!isFavorited);
    setLoading(true);
    
    try {
      if (previousState) {
        // Remove from favorites
        const { error } = await supabase
          .from('company_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('company_id', companyId);

        if (error) throw error;
        toast.success("Removed from favorites");
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('company_favorites')
          .insert({
            user_id: user.id,
            company_id: companyId
          });

        if (error) throw error;
        toast.success("Added to favorites");
      }
    } catch (err: any) {
      // Revert on error
      setIsFavorited(previousState);
      
      console.error('Error toggling favorite:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      });
      
      // Show more specific error message
      if (err?.code === '42501' || err?.message?.includes('policy')) {
        toast.error("Please log in to add favorites");
      } else if (err?.code === 'PGRST116') {
        toast.error("Company not found");
      } else {
        toast.error(err?.message || "Failed to update favorites");
      }
    } finally {
      setLoading(false);
    }
  };

  return { isFavorited, loading, toggleFavorite };
};