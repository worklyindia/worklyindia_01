import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIChatPlan {
  id: string;
  name: string;
  price_inr: number;
  messages_per_month: number;
  voice_playback_per_month: number;
  voice_input_per_month: number;
  image_analysis_per_month: number;
  ai_image_generation_per_month: number;
  ai_model_tier: string;
  priority_support: boolean;
  features: string[];
  is_active: boolean;
  display_order: number;
}

const PLAN_COLUMNS = ['name','price_inr','messages_per_month','voice_playback_per_month','voice_input_per_month','image_analysis_per_month','ai_image_generation_per_month','ai_model_tier','priority_support','features','is_active','display_order'] as const;
const cleanPlan = (d: Record<string, any>) => Object.fromEntries(PLAN_COLUMNS.filter(k => d[k] !== undefined).map(k => [k, d[k]])) as any;

export const useAIChatPlansManagement = () => {
  const [plans, setPlans] = useState<AIChatPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Transform features from Json to string[] and ensure ai_image_generation_per_month has default
      const transformedData = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : [],
        ai_image_generation_per_month: plan.ai_image_generation_per_month ?? 5
      })) as AIChatPlan[];
      
      setPlans(transformedData);
    } catch (error) {
      console.error('Error fetching AI chat plans:', error);
      toast.error('Failed to load AI chat plans');
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async (planData: Omit<AIChatPlan, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_plans')
        .insert(cleanPlan(planData))
        .select()
        .single();

      if (error) throw error;
      
      const transformedData = {
        ...data,
        features: Array.isArray(data.features) ? data.features : []
      } as AIChatPlan;
      
      setPlans(prev => [...prev, transformedData]);
      toast.success('AI chat plan created successfully');
      return transformedData;
    } catch (error) {
      console.error('Error creating AI chat plan:', error);
      toast.error('Failed to create AI chat plan');
      throw error;
    }
  };

  const updatePlan = async (id: string, planData: Partial<AIChatPlan>) => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_plans')
        .update(cleanPlan(planData))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const transformedData = {
        ...data,
        features: Array.isArray(data.features) ? data.features : []
      } as AIChatPlan;
      
      setPlans(prev => prev.map(plan => plan.id === id ? transformedData : plan));
      toast.success('AI chat plan updated successfully');
      return transformedData;
    } catch (error) {
      console.error('Error updating AI chat plan:', error);
      toast.error('Failed to update AI chat plan');
      throw error;
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_chat_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPlans(prev => prev.filter(plan => plan.id !== id));
      toast.success('AI chat plan deleted successfully');
    } catch (error) {
      console.error('Error deleting AI chat plan:', error);
      toast.error('Failed to delete AI chat plan');
      throw error;
    }
  };

  return {
    plans,
    loading,
    refetch: fetchPlans,
    createPlan,
    updatePlan,
    deletePlan
  };
};
