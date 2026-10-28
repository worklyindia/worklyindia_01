import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeletionRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  reason: string | null;
}

export const useAccountDeletion = (userId: string | undefined) => {
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userId);
  const { toast } = useToast();

  // Keep resolvedUserId in sync with incoming prop
  useEffect(() => {
    setResolvedUserId(userId);
  }, [userId]);

  // Fallback: resolve user id from current auth session when prop is missing
  useEffect(() => {
    if (userId) return;

    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        if (data.user?.id) setResolvedUserId(data.user.id);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const effectiveUserId = useMemo(() => resolvedUserId, [resolvedUserId]);

  const fetchDeletionRequest = useCallback(async () => {
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching deletion request:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setDeletionRequest(data);
        // Calculate time remaining (24 hours from created_at)
        const createdAt = new Date(data.created_at).getTime();
        const expiresAt = createdAt + 24 * 60 * 60 * 1000; // 24 hours in ms
        const remaining = expiresAt - Date.now();
        setTimeRemaining(Math.max(0, remaining));
      } else {
        setDeletionRequest(null);
        setTimeRemaining(0);
      }
    } catch (error) {
      console.error('Error in fetchDeletionRequest:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchDeletionRequest();
  }, [fetchDeletionRequest]);

  // Update countdown every second
  useEffect(() => {
    if (!deletionRequest || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          clearInterval(interval);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [deletionRequest]);

  const requestDeletion = async (reason?: string) => {
    try {
      // Always trust current auth user id over passed-in props
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const authUserId = authData.user?.id;
      if (!authUserId) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in again and retry.',
          variant: 'destructive',
        });
        return false;
      }

      // Check if a pending request already exists
      const { data: existingRequest } = await supabase
        .from('account_deletion_requests')
        .select('id, status')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          // Already has a pending request, just refresh the data
          toast({
            title: 'Request Already Pending',
            description: 'You already have a pending deletion request.',
          });
          await fetchDeletionRequest();
          return true;
        } else {
          // Update existing record to pending status
          const { error } = await supabase
            .from('account_deletion_requests')
            .update({
              status: 'pending',
              reason: reason || 'User requested account deletion',
              created_at: new Date().toISOString(),
            })
            .eq('id', existingRequest.id);

          if (error) throw error;
        }
      } else {
        // Insert new request
        const { error } = await supabase
          .from('account_deletion_requests')
          .insert({
            user_id: authUserId,
            reason: reason || 'User requested account deletion',
            status: 'pending',
          });

        if (error) throw error;
      }

      toast({
        title: 'Deletion Request Submitted',
        description: 'Your account will be deleted in 24 hours. You can cancel anytime before that.',
      });

      setResolvedUserId(authUserId);
      await fetchDeletionRequest();
      return true;
    } catch (error: any) {
      console.error('Error requesting deletion:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to submit deletion request',
        variant: 'destructive',
      });
      return false;
    }
  };

  const cancelDeletion = async () => {
    if (!deletionRequest) return false;

    try {
      const { error } = await supabase
        .from('account_deletion_requests')
        .update({ status: 'cancelled' })
        .eq('id', deletionRequest.id);

      if (error) throw error;

      toast({
        title: 'Deletion Cancelled',
        description: 'Your account deletion request has been cancelled.',
      });

      setDeletionRequest(null);
      setTimeRemaining(0);
      return true;
    } catch (error: any) {
      console.error('Error cancelling deletion:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to cancel deletion request',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Format time remaining as HH:MM:SS
  const formatTimeRemaining = (): string => {
    if (timeRemaining <= 0) return '00:00:00';

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    deletionRequest,
    loading,
    timeRemaining,
    formattedTime: formatTimeRemaining(),
    hasPendingDeletion: !!deletionRequest && timeRemaining > 0,
    requestDeletion,
    cancelDeletion,
    refetch: fetchDeletionRequest,
  };
};
