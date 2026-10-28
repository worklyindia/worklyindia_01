import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BatchQuery {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
  order?: { column: string; ascending: boolean };
}

interface BatchQueryResponse {
  success: boolean;
  results: Array<{
    table: string;
    data: any[] | null;
    error: string | null;
  }>;
  timestamp: string;
  cached?: boolean;
}

export const useBatchQueries = (
  queries: BatchQuery[],
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  return useQuery({
    queryKey: ['batch-queries', JSON.stringify(queries)],
    queryFn: async (): Promise<BatchQueryResponse> => {
      console.log('🔄 Executing batch query for', queries.length, 'tables');
      
      const { data, error } = await supabase.functions.invoke('optimize-queries', {
        body: {
          queries,
          enableCompression: true,
        },
      });

      if (error) {
        console.error('❌ Batch query error:', error);
        throw error;
      }

      console.log('✅ Batch query completed successfully');
      return data as BatchQueryResponse;
    },
    enabled: options?.enabled !== false && queries.length > 0,
    staleTime: options?.staleTime ?? 1000 * 60 * 2, // 2 minutes default
    gcTime: options?.cacheTime ?? 1000 * 60 * 15, // 15 minutes default
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

// Helper to extract data from batch results
export const extractBatchData = <T = any>(
  results: BatchQueryResponse['results'],
  tableName: string
): T[] | null => {
  const result = results.find(r => r.table === tableName);
  return result?.data as T[] | null;
};
