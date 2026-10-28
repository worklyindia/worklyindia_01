import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIDataAccessLog {
  id: string;
  ai_type: 'whatsapp_ai' | 'career_chat_ai';
  access_type: string;
  user_identifier: string;
  matched_user_id: string | null;
  matched_user_name: string | null;
  matched_user_type: string | null;
  data_accessed: Record<string, any>;
  request_metadata: Record<string, any>;
  response_time_ms: number | null;
  created_at: string;
}

export interface AIAccessFilters {
  aiType?: 'whatsapp_ai' | 'career_chat_ai' | 'all';
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  accessType?: string;
}

export interface AIAccessStats {
  totalAccesses: number;
  todayAccesses: number;
  weekAccesses: number;
  monthAccesses: number;
  whatsappAccesses: number;
  careerChatAccesses: number;
  uniqueUsers: number;
  avgResponseTime: number;
}

export const useAIDataAccessLogs = (filters: AIAccessFilters = {}, page: number = 1, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['ai-data-access-logs', filters, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('ai_data_access_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (filters.aiType && filters.aiType !== 'all') {
        query = query.eq('ai_type', filters.aiType);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters.searchTerm) {
        query = query.or(`user_identifier.ilike.%${filters.searchTerm}%,matched_user_name.ilike.%${filters.searchTerm}%`);
      }

      if (filters.accessType) {
        query = query.eq('access_type', filters.accessType);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        logs: (data || []) as AIDataAccessLog[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    }
  });
};

export const useAIAccessStats = () => {
  return useQuery({
    queryKey: ['ai-access-stats'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get total counts
      const { count: totalCount } = await supabase
        .from('ai_data_access_logs')
        .select('id', { count: 'exact', head: true });

      const { count: todayCount } = await supabase
        .from('ai_data_access_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart);

      const { count: weekCount } = await supabase
        .from('ai_data_access_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStart);

      const { count: monthCount } = await supabase
        .from('ai_data_access_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart);

      const { count: whatsappCount } = await supabase
        .from('ai_data_access_logs')
        .select('id', { count: 'exact', head: true })
        .eq('ai_type', 'whatsapp_ai');

      const { count: careerChatCount } = await supabase
        .from('ai_data_access_logs')
        .select('id', { count: 'exact', head: true })
        .eq('ai_type', 'career_chat_ai');

      // Get unique users count
      const { data: uniqueUsersData } = await supabase
        .from('ai_data_access_logs')
        .select('user_identifier')
        .not('user_identifier', 'is', null);
      
      const uniqueUsers = new Set(uniqueUsersData?.map(d => d.user_identifier)).size;

      // Get average response time
      const { data: responseData } = await supabase
        .from('ai_data_access_logs')
        .select('response_time_ms')
        .not('response_time_ms', 'is', null)
        .limit(1000);

      const avgResponseTime = responseData && responseData.length > 0
        ? responseData.reduce((sum, d) => sum + (d.response_time_ms || 0), 0) / responseData.length
        : 0;

      return {
        totalAccesses: totalCount || 0,
        todayAccesses: todayCount || 0,
        weekAccesses: weekCount || 0,
        monthAccesses: monthCount || 0,
        whatsappAccesses: whatsappCount || 0,
        careerChatAccesses: careerChatCount || 0,
        uniqueUsers,
        avgResponseTime: Math.round(avgResponseTime)
      } as AIAccessStats;
    },
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15, // Admin analytics — 15 min is plenty
    refetchOnWindowFocus: false,
  });
};

export const useAIAccessTrends = (days: number = 7) => {
  return useQuery({
    queryKey: ['ai-access-trends', days],
    queryFn: async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('ai_data_access_logs')
        .select('created_at, ai_type')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      // Group by date
      const trends: Record<string, { whatsapp: number; career_chat: number; total: number }> = {};

      data?.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        if (!trends[date]) {
          trends[date] = { whatsapp: 0, career_chat: 0, total: 0 };
        }
        trends[date].total++;
        if (log.ai_type === 'whatsapp_ai') {
          trends[date].whatsapp++;
        } else {
          trends[date].career_chat++;
        }
      });

      return Object.entries(trends).map(([date, counts]) => ({
        date,
        ...counts
      }));
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
};

export const useRecentAIAccess = (limit: number = 10) => {
  return useQuery({
    queryKey: ['recent-ai-access', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_data_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as AIDataAccessLog[];
    },
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });
};
