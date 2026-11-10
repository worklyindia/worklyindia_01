import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { reactiveResumeApi, ReactiveResumeData } from '@/services/reactiveResumeApi';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface UserResume {
  id: string;
  user_id: string;
  reactive_resume_id: string | null;
  name: string;
  template: string | null;
  resume_data: Json | null;
  external_api_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useReactiveResume() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isApiConfigured, setIsApiConfigured] = useState(reactiveResumeApi.isConfigured());

  // Check API configuration on mount
  useEffect(() => {
    setIsApiConfigured(reactiveResumeApi.isConfigured());
  }, []);

  // Configure API URL
  const configureApi = useCallback((url: string) => {
    reactiveResumeApi.setApiUrl(url);
    setIsApiConfigured(true);
  }, []);

  // Test API connection
  const testConnection = useMutation({
    mutationFn: async () => {
      return await reactiveResumeApi.testConnection();
    },
    onSuccess: (isConnected) => {
      if (isConnected) {
        toast({
          title: 'Connection Successful',
          description: 'Reactive Resume API is reachable',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: 'Could not reach Reactive Resume API',
          variant: 'destructive',
        });
      }
    },
  });

  // Fetch user's resumes from Supabase
  const { data: userResumes, isLoading: isLoadingResumes } = useQuery({
    queryKey: ['user-resumes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as UserResume[];
    },
  });

  // Create resume (local + Reactive Resume API if configured)
  const createResume = useMutation({
    mutationFn: async (resumeData: { name: string; template: string; data: ReactiveResumeData }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let reactiveResumeId: string | null = null;

      // If Reactive Resume API is configured, create there first
      if (isApiConfigured) {
        try {
          const response = await reactiveResumeApi.createResume(resumeData.data);
          reactiveResumeId = response.id;
        } catch (error) {
          console.warn('Failed to create in Reactive Resume API, saving locally only:', error);
        }
      }

      // Save to Supabase
      const { data, error } = await supabase
        .from('user_resumes')
        .insert([{
          user_id: user.id,
          reactive_resume_id: reactiveResumeId,
          name: resumeData.name,
          template: resumeData.template,
          resume_data: resumeData.data as unknown as Json,
          external_api_url: reactiveResumeApi.getApiUrl(),
          last_synced_at: reactiveResumeId ? new Date().toISOString() : null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as UserResume;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-resumes'] });
      toast({
        title: 'Resume Created',
        description: 'Your resume has been saved successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error Creating Resume',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update resume
  const updateResume = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; template: string; data: ReactiveResumeData }> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get existing resume
      const { data: existingResume } = await supabase
        .from('user_resumes')
        .select('*')
        .eq('id', id)
        .single();

      let lastSyncedAt = existingResume?.last_synced_at;

      // If Reactive Resume API is configured and resume exists there, update
      if (isApiConfigured && existingResume?.reactive_resume_id && data.data) {
        try {
          await reactiveResumeApi.updateResume(existingResume.reactive_resume_id, data.data);
          lastSyncedAt = new Date().toISOString();
        } catch (error) {
          console.warn('Failed to update in Reactive Resume API:', error);
        }
      }

      // Update in Supabase
      const updateData: {
        name?: string;
        template?: string;
        resume_data?: any;
        last_synced_at?: string | null;
      } = {};
      if (data.name) updateData.name = data.name;
      if (data.template) updateData.template = data.template;
      if (data.data) updateData.resume_data = data.data;
      updateData.last_synced_at = lastSyncedAt;

      const { data: updated, error } = await supabase
        .from('user_resumes')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return updated as UserResume;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-resumes'] });
      toast({
        title: 'Resume Updated',
        description: 'Your changes have been saved',
      });
    },
  });

  // Delete resume
  const deleteResume = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get existing resume
      const { data: existingResume } = await supabase
        .from('user_resumes')
        .select('*')
        .eq('id', id)
        .single();

      // Delete from Reactive Resume API if exists
      if (isApiConfigured && existingResume?.reactive_resume_id) {
        try {
          await reactiveResumeApi.deleteResume(existingResume.reactive_resume_id);
        } catch (error) {
          console.warn('Failed to delete from Reactive Resume API:', error);
        }
      }

      // Delete from Supabase
      const { error } = await supabase
        .from('user_resumes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-resumes'] });
      toast({
        title: 'Resume Deleted',
        description: 'Resume has been removed',
      });
    },
  });

  // Download PDF from Reactive Resume API
  const downloadPdf = useMutation({
    mutationFn: async ({ resumeId, filename }: { resumeId: string; filename: string }) => {
      // Get resume from Supabase to get reactive_resume_id
      const { data: resume } = await supabase
        .from('user_resumes')
        .select('*')
        .eq('id', resumeId)
        .single();

      if (!resume?.reactive_resume_id) {
        throw new Error('Resume not synced with Reactive Resume API');
      }

      await reactiveResumeApi.downloadPdf(resume.reactive_resume_id, filename);
    },
    onSuccess: () => {
      toast({
        title: 'PDF Downloaded',
        description: 'Your resume PDF has been downloaded',
      });
    },
    onError: (error) => {
      toast({
        title: 'Download Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    // State
    isApiConfigured,
    userResumes: userResumes || [],
    isLoadingResumes,

    // Actions
    configureApi,
    testConnection: testConnection.mutate,
    isTestingConnection: testConnection.isPending,
    
    createResume: createResume.mutate,
    isCreating: createResume.isPending,
    
    updateResume: updateResume.mutate,
    isUpdating: updateResume.isPending,
    
    deleteResume: deleteResume.mutate,
    isDeleting: deleteResume.isPending,
    
    downloadPdf: downloadPdf.mutate,
    isDownloading: downloadPdf.isPending,
  };
}
