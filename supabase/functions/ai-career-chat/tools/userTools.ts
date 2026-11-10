import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

export async function updateUserProfile(supabase: any, user_id: string, updates: any) {
  if (!user_id) return { error: 'User not authenticated' };
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user_id)
    .select()
    .single();
  
  if (error) {
    console.error('Profile update error:', error);
    return { error: error.message };
  }
  
  return { success: true, profile: data };
}

export async function cancelJobApplication(supabase: any, user_id: string, application_id: string) {
  if (!user_id) return { error: 'User not authenticated' };
  
  // Check if application exists and belongs to user
  const { data: application, error: fetchError } = await supabase
    .from('job_applications')
    .select('id, status')
    .eq('id', application_id)
    .eq('applicant_id', user_id)
    .single();
  
  if (fetchError || !application) {
    return { error: 'Application not found or does not belong to you' };
  }
  
  if (application.status !== 'pending' && application.status !== 'under_review') {
    return { error: 'Cannot cancel application with current status: ' + application.status };
  }
  
  const { error } = await supabase
    .from('job_applications')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('id', application_id)
    .eq('applicant_id', user_id);
  
  if (error) {
    console.error('Cancel application error:', error);
    return { error: error.message };
  }
  
  return { success: true, message: 'Application cancelled successfully' };
}

export async function updateNotificationPreferences(supabase: any, user_id: string, preferences: any) {
  if (!user_id) return { error: 'User not authenticated' };
  
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id, ...preferences, updated_at: new Date().toISOString() })
    .select()
    .single();
  
  if (error) {
    console.error('Notification preferences update error:', error);
    return { error: error.message };
  }
  
  return { success: true, preferences: data };
}

/**
 * Enhanced Report Issue function with ticket number generation
 * Creates a support ticket with readable ticket number like WFH-2024-00001
 */
export async function reportIssue(
  supabase: any, 
  user_id: string | null, 
  issue: {
    issue_type: string;
    description: string;
    title?: string;
    priority?: string;
    conversation_context?: any[];
    ai_attempted_solutions?: string[];
    user_name?: string;
    user_email?: string;
    user_phone?: string;
  }
) {
  try {
    // Generate ticket number using the database function
    const { data: ticketNumberData, error: ticketNumberError } = await supabase
      .rpc('generate_ticket_number');
    
    if (ticketNumberError) {
      console.error('Failed to generate ticket number:', ticketNumberError);
      // Fallback to UUID-based number if function fails
      const fallbackNumber = 'WFH-' + new Date().getFullYear() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: fallbackNumber,
          user_id: user_id || null,
          user_name: issue.user_name || null,
          user_email: issue.user_email || null,
          user_phone: issue.user_phone || null,
          title: issue.title || `${issue.issue_type} Issue`,
          description: issue.description,
          category: issue.issue_type || 'general',
          priority: issue.priority || 'medium',
          status: 'open',
          conversation_context: issue.conversation_context || null,
          ai_attempted_solutions: issue.ai_attempted_solutions || null
        })
        .select()
        .single();
      
      if (error) {
        console.error('Issue report error:', error);
        return { error: error.message };
      }
      
      return {
        success: true,
        ticket_number: fallbackNumber,
        ticket_id: data.id,
        message: `✅ Support ticket created successfully!\n\n📋 Ticket Number: ${fallbackNumber}\n📝 Issue: ${issue.issue_type}\n⏰ Expected Response: 24-48 hours\n\nHamari support team jald hi aapko contact karegi. Aap is ticket number ko save karein.`
      };
    }
    
    const ticketNumber = ticketNumberData;
    
    // Create the support ticket with generated ticket number
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        user_id: user_id || null,
        user_name: issue.user_name || null,
        user_email: issue.user_email || null,
        user_phone: issue.user_phone || null,
        title: issue.title || `${issue.issue_type} Issue`,
        description: issue.description,
        category: issue.issue_type || 'general',
        priority: issue.priority || 'medium',
        status: 'open',
        conversation_context: issue.conversation_context || null,
        ai_attempted_solutions: issue.ai_attempted_solutions || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Issue report error:', error);
      return { error: error.message };
    }
    
    return { 
      success: true, 
      ticket_number: ticketNumber,
      ticket_id: data.id,
      message: `✅ Support ticket successfully created!\n\n📋 **Ticket Number: ${ticketNumber}**\n📝 Issue Type: ${issue.issue_type}\n⏰ Expected Response: 24-48 hours\n\nHamari support team jald hi aapko contact karegi. Aap is ticket number ko save kar lein - isse aap apne ticket ka status track kar sakte hain.`
    };
  } catch (err) {
    console.error('Report issue failed:', err);
    return { 
      error: 'Failed to create support ticket. Please try again or contact support directly at worklyindia@outlook.com'
    };
  }
}

/**
 * Web Search function - searches the internet using Google Custom Search
 */
export interface WebSearchResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  siteName?: string | null;
  publishedDate?: string | null;
  thumbnail?: string | null;
  favicon?: string | null;
  rating?: string | null;
  address?: string | null;
  phone?: string | null;
}

export async function webSearch(
  query: string,
  searchType: string = 'general',
  count = 8,
): Promise<{
  success: boolean;
  results?: WebSearchResult[];
  error?: string;
  totalResults?: string;
  searchTime?: number;
}> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Search service not configured' };
    }

    // Enhance query based on search type for better results
    let enhancedQuery = query;
    let dateRestrict: string | undefined;
    let sort: string | undefined;
    switch (searchType) {
      case 'company':
        enhancedQuery = `${query} company review india legitimacy`;
        break;
      case 'salary':
        enhancedQuery = `${query} salary india Workly India`;
        break;
      case 'career_advice':
        enhancedQuery = `${query} career advice tips india`;
        break;
      case 'job_market':
        enhancedQuery = `${query} job market trends india Workly India`;
        break;
      case 'news':
        enhancedQuery = `${query} news`;
        dateRestrict = 'm1';
        sort = 'date';
        break;
      case 'local':
        enhancedQuery = `${query} address phone contact near me`;
        break;
      default:
        enhancedQuery = query;
    }

    // Call the unified-google-api edge function (real web results with snippets)
    const response = await fetch(`${supabaseUrl}/functions/v1/unified-google-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        service: 'search',
        query: enhancedQuery,
        searchType: 'web',
        num: Math.max(1, Math.min(10, count)),
        dateRestrict,
        sort,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Web search failed:', errorText);
      return { success: false, error: 'Search failed. Please try again.' };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error || 'Search failed' };
    }

    return {
      success: true,
      results: (data.results || []).slice(0, Math.max(1, Math.min(10, count))),
      totalResults: data.totalResults,
      searchTime: data.searchTime,
    };
  } catch (err) {
    console.error('Web search error:', err);
    return { success: false, error: 'Search service temporarily unavailable' };
  }
}


/**
 * Google Images search — returns every image from ONE API call (max 10 per
 * Custom Search call) with a render-safe URL.
 *
 * Many sites block hotlinking (403 / referrer checks), which is why images
 * appeared as broken icons in chat. So each result also carries a proxied
 * `displayUrl` that always renders, plus Google's own thumbnail as fallback.
 */
function proxiedImageUrl(url: string, width = 1024): string {
  try {
    const clean = url.replace(/^https?:\/\//i, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=${width}&output=jpg&we`;
  } catch {
    return url;
  }
}

export async function imageSearch(
  query: string,
  count = 10,
): Promise<{
  success: boolean;
  results?: Array<{
    title: string;
    imageUrl: string;
    displayUrl: string;
    thumbnail?: string;
    link: string;
    displayLink: string;
    width?: number;
    height?: number;
  }>;
  error?: string;
}> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return { success: false, error: 'Search service not configured' };
    }

    const call = async (imgSize?: string) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/unified-google-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ service: 'search', query, searchType: 'image', imgSize, num: 10 }),
      });
      if (!response.ok) {
        console.error('Image search failed:', await response.text());
        return null;
      }
      const data = await response.json();
      if (!data.success) return null;
      return (data.results || []).filter(
        (r: any) => r.imageUrl && /^https:\/\//i.test(r.imageUrl),
      );
    };

    // First try HD/large images; if the size filter returns nothing, retry
    // unfiltered so the user still gets results from the same query.
    let raw = await call('xlarge');
    if (!raw || raw.length === 0) raw = await call(undefined);

    // Every image is returned ALREADY PROXIED as `imageUrl`, because the model
    // usually embeds that field — using the raw host URL is exactly why chat
    // showed broken-image icons for hotlink-protected sites (Facebook, news
    // CDNs, Google-cached images).
    const mapped = (raw || [])
      .slice(0, Math.max(1, Math.min(10, count)))
      .map((r: any) => ({
        title: r.title,
        imageUrl: proxiedImageUrl(r.imageUrl),
        displayUrl: proxiedImageUrl(r.imageUrl),
        originalImageUrl: r.imageUrl,
        thumbnail: r.thumbnail ? proxiedImageUrl(r.thumbnail, 320) : undefined,
        link: r.link,
        displayLink: r.displayLink,
        width: r.width,
        height: r.height,
      }));

    // Drop entries whose proxied URL does not actually return an image, so the
    // reply never contains a dead ![](...) embed.
    const checked = await Promise.all(
      mapped.map(async (r: any) => {
        try {
          const head = await fetch(r.imageUrl, { method: 'HEAD' });
          const type = head.headers.get('content-type') || '';
          return head.ok && type.startsWith('image/') ? r : null;
        } catch {
          return null;
        }
      }),
    );
    let results = checked.filter(Boolean) as typeof mapped;
    // If the liveness check knocked everything out (network hiccup), keep the
    // proxied list rather than telling the user "no images found".
    if (!results.length) results = mapped;

    if (!results.length) return { success: false, error: `No images found for "${query}".` };
    return { success: true, results };

  } catch (err) {
    console.error('Image search error:', err);
    return { success: false, error: 'Image search temporarily unavailable' };
  }
}

export async function requestRefund(supabase: any, user_id: string, transaction_id: string, reason: string) {
  if (!user_id) return { error: 'User not authenticated' };
  
  const { data, error } = await supabase
    .from('refund_requests')
    .insert({
      user_id,
      transaction_id,
      reason,
      status: 'pending'
    })
    .select()
    .single();
  
  if (error) {
    console.error('Refund request error:', error);
    return { error: error.message };
  }
  
  return { 
    success: true, 
    refund_id: data.id,
    message: 'Refund request submitted. We will process it within 5-7 business days.'
  };
}

export async function deleteAccountRequest(supabase: any, user_id: string, reason: string) {
  if (!user_id) return { error: 'User not authenticated' };
  
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .insert({
      user_id,
      reason,
      status: 'pending'
    })
    .select()
    .single();
  
  if (error) {
    console.error('Account deletion request error:', error);
    return { error: error.message };
  }
  
  return { 
    success: true,
    message: 'Account deletion request submitted. Your account will be deleted within 30 days. You can cancel this request anytime before that.'
  };
}

export async function viewReferralStatus(supabase: any, user_id: string) {
  if (!user_id) return { error: 'User not authenticated' };
  
  const [profileResult, referralsResult, earningsResult] = await Promise.all([
    supabase.from('profiles').select('referral_code').eq('user_id', user_id).single(),
    supabase.from('referrals').select('*').eq('referrer_id', user_id),
    supabase.from('referral_earnings').select('*').eq('user_id', user_id)
  ]);
  
  return {
    referral_code: profileResult.data?.referral_code,
    total_referrals: referralsResult.data?.length || 0,
    referrals: referralsResult.data || [],
    total_earnings: earningsResult.data?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0,
    earnings: earningsResult.data || []
  };
}
