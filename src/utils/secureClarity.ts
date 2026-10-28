// Secure Clarity API integration
// The hardcoded token has been removed for security

import { supabase } from '@/integrations/supabase/client';

export interface ClarityData {
  sessions?: number;
  users?: number;
  pageViews?: number;
  // Add other Clarity data types as needed
}

export async function getClarityData(): Promise<ClarityData | null> {
  try {
    // Use Supabase Edge Function to securely call Clarity API
    // This keeps the API token server-side
    const { data, error } = await supabase.functions.invoke('get-clarity-data');
    
    if (error) {
      console.error('Failed to fetch Clarity data:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Clarity API error:', error);
    return null;
  }
}

export function isClarityConfigured(): boolean {
  // Check if Clarity is properly configured without exposing tokens
  return typeof window !== 'undefined' && 
         document.querySelector('script[src*="clarity.ms"]') !== null;
}

// Safe analytics tracking function
export function trackClarityEvent(eventName: string, properties?: Record<string, any>): void {
  try {
    // Use Clarity's client-side API if available
    if (typeof window !== 'undefined' && (window as any).clarity) {
      (window as any).clarity('event', eventName, properties);
    }
  } catch (error) {
    console.warn('Clarity event tracking failed:', error);
  }
}
