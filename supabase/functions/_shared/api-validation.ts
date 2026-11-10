// Shared validation utilities for API endpoints
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  data?: any;
}

export interface ApiKeyValidation {
  isValid: boolean;
  keyData?: any;
  error?: string;
}

export async function validateApiKey(
  apiKey: string | null,
  supabase: any
): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return {
      isValid: false,
      error: 'API key is required'
    };
  }

  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (keyError || !keyData) {
    return {
      isValid: false,
      error: 'Invalid or inactive API key'
    };
  }

  return {
    isValid: true,
    keyData
  };
}

export async function checkRateLimit(
  apiKeyId: string,
  supabase: any
): Promise<ValidationResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: keyData } = await supabase
    .from('api_keys')
    .select('rate_limit_tier')
    .eq('id', apiKeyId)
    .single();

  const tierLimits: { [key: string]: number } = {
    'free': 1000,
    'pro': 10000,
    'enterprise': 100000
  };

  const limit = tierLimits[keyData?.rate_limit_tier || 'free'];

  const { count } = await supabase
    .from('api_request_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', oneHourAgo);

  if (count && count >= limit) {
    return {
      isValid: false,
      error: `Rate limit exceeded. Limit: ${limit} requests/hour`
    };
  }

  return { isValid: true };
}

export function validateJobPostingData(data: any): ValidationResult {
  const required = ['title', 'description', 'location', 'job_type'];
  const missing = required.filter(field => !data[field]);

  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Missing required fields: ${missing.join(', ')}`
    };
  }

  if (data.title.length < 5 || data.title.length > 30) {
    return {
      isValid: false,
      error: 'Title must be between 5 and 30 characters'
    };
  }

  if (data.description.length < 20 || data.description.length > 10000) {
    return {
      isValid: false,
      error: 'Description must be between 20 and 10000 characters'
    };
  }

  const validJobTypes = ['full-time', 'part-time', 'contract', 'internship', 'temporary'];
  if (!validJobTypes.includes(data.job_type)) {
    return {
      isValid: false,
      error: `Invalid job_type. Must be one of: ${validJobTypes.join(', ')}`
    };
  }

  return { isValid: true, data };
}

export function validateApplicationData(data: any): ValidationResult {
  if (!data.job_id) {
    return {
      isValid: false,
      error: 'job_id is required'
    };
  }

  if (data.cover_letter && data.cover_letter.length > 5000) {
    return {
      isValid: false,
      error: 'Cover letter must be less than 5000 characters'
    };
  }

  return { isValid: true, data };
}

export async function logApiRequest(
  supabase: any,
  data: {
    api_key_id?: string;
    endpoint: string;
    method: string;
    status_code: number;
    response_time_ms: number;
    request_params?: any;
    response_size_bytes?: number;
    ip_address?: string;
    user_agent?: string;
    error_message?: string;
  }
) {
  await supabase.from('api_request_logs').insert(data);
}

export function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, '');
}
