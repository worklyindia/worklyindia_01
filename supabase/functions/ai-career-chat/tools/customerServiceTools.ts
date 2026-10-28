// Customer Service Action Tools - AI can perform real actions
// These give AI the power to resolve issues without human intervention

/**
 * Search for any user by email, phone, name, or user_id
 */
export async function findUser(supabase: any, query: string, searchType: 'auto' | 'email' | 'phone' | 'name' | 'user_id' = 'auto') {
  try {
    const trimmed = query.trim();
    
    // Auto-detect search type
    let detectedType = searchType;
    if (searchType === 'auto') {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        detectedType = 'user_id';
      } else if (trimmed.includes('@') && trimmed.includes('.')) {
        detectedType = 'email';
      } else if (trimmed.replace(/[^0-9]/g, '').length >= 10) {
        detectedType = 'phone';
      } else {
        detectedType = 'name';
      }
    }

    // Search profiles
    let profileQuery = supabase.from('profiles').select(`
      user_id, full_name, email, phone, whatsapp_number, location, 
      current_position, company, industry, account_status, 
      is_profile_complete, created_at, profile_image_url
    `);

    // Search companies
    let companyQuery = supabase.from('companies').select(`
      id, user_id, company_name, email, phone, whatsapp_number,
      location, industry, account_status, is_verified, is_profile_complete,
      created_at, logo_url, job_posting_visibility
    `);

    switch (detectedType) {
      case 'email':
        profileQuery = profileQuery.ilike('email', `%${trimmed}%`);
        companyQuery = companyQuery.ilike('email', `%${trimmed}%`);
        break;
      case 'phone':
        const digits = trimmed.replace(/[^0-9]/g, '');
        profileQuery = profileQuery.or(`phone.ilike.%${digits}%,whatsapp_number.ilike.%${digits}%`);
        companyQuery = companyQuery.or(`phone.ilike.%${digits}%,whatsapp_number.ilike.%${digits}%`);
        break;
      case 'user_id':
        profileQuery = profileQuery.eq('user_id', trimmed);
        companyQuery = companyQuery.eq('user_id', trimmed);
        break;
      case 'name':
        profileQuery = profileQuery.ilike('full_name', `%${trimmed}%`);
        companyQuery = companyQuery.ilike('company_name', `%${trimmed}%`);
        break;
    }

    const [{ data: profiles }, { data: companies }] = await Promise.all([
      profileQuery.limit(10),
      companyQuery.limit(10)
    ]);

    return {
      search_query: trimmed,
      search_type: detectedType,
      job_seekers_found: profiles?.length || 0,
      employers_found: companies?.length || 0,
      job_seekers: profiles || [],
      employers: companies || [],
      total_found: (profiles?.length || 0) + (companies?.length || 0)
    };
  } catch (err: any) {
    return { error: `User search failed: ${err.message}` };
  }
}

/**
 * Get complete user details including applications, jobs, tickets
 */
export async function getUserDetails(supabase: any, userId: string) {
  try {
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return { error: 'Invalid user ID format. Please provide a valid UUID.' };
    }

    const [
      { data: profile },
      { data: company },
      { data: applications },
      { data: postedJobs },
      { data: tickets },
      { data: referralWallet }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase.from('companies').select('*').eq('user_id', userId).single(),
      supabase.from('job_applications').select('id, job_id, status, applied_at').eq('applicant_id', userId).order('applied_at', { ascending: false }).limit(20),
      supabase.from('jobs').select('id, title, status, created_at, views_count').eq('posted_by', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('support_tickets').select('id, title, status, priority, created_at, category').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('referral_wallets').select('*').eq('user_id', userId).single()
    ]);

    const userType = company ? 'employer' : 'job_seeker';

    return {
      user_id: userId,
      user_type: userType,
      
      profile: profile || null,
      company: company || null,
      
      account_status: profile?.account_status || company?.account_status || 'unknown',
      is_complete: profile?.is_profile_complete || company?.is_profile_complete || false,
      
      activity: {
        applications: applications || [],
        total_applications: applications?.length || 0,
        posted_jobs: postedJobs || [],
        total_jobs_posted: postedJobs?.length || 0
      },
      
      support: {
        tickets: tickets || [],
        open_tickets: tickets?.filter((t: any) => t.status === 'open').length || 0
      },
      
      financial: {
        referral_balance: referralWallet?.balance_amount || 0,
        total_referral_earnings: referralWallet?.total_earned_amount || referralWallet?.total_earned || 0
      },
      
      summary: `${userType === 'employer' ? company?.company_name : profile?.full_name || 'Unknown'} - ${userType} - Status: ${profile?.account_status || company?.account_status || 'active'}`
    };
  } catch (err: any) {
    return { error: `Failed to get user details: ${err.message}` };
  }
}

/**
 * Update user account status (activate, suspend, ban)
 */
export async function updateUserStatus(supabase: any, userId: string, newStatus: string, reason?: string) {
  try {
    const validStatuses = ['active', 'suspended', 'banned', 'pending_review'];
    if (!validStatuses.includes(newStatus)) {
      return { error: `Invalid status. Valid options: ${validStatuses.join(', ')}` };
    }

    // Check if user is job seeker or employer
    const { data: profile } = await supabase.from('profiles').select('user_id, account_status').eq('user_id', userId).single();
    const { data: company } = await supabase.from('companies').select('user_id, account_status').eq('user_id', userId).single();

    const updates: any = { account_status: newStatus };
    if (reason) updates.account_status_reason = reason;

    let result;
    if (profile) {
      result = await supabase.from('profiles').update(updates).eq('user_id', userId);
    }
    if (company) {
      result = await supabase.from('companies').update(updates).eq('user_id', userId);
    }

    if (result?.error) {
      return { error: `Failed to update status: ${result.error.message}` };
    }

    return {
      success: true,
      user_id: userId,
      previous_status: profile?.account_status || company?.account_status,
      new_status: newStatus,
      reason: reason || 'No reason provided',
      user_type: company ? 'employer' : 'job_seeker',
      message: `User account status updated to '${newStatus}'`
    };
  } catch (err: any) {
    return { error: `Status update failed: ${err.message}` };
  }
}

/**
 * Create or update a support ticket
 */
export async function manageTicket(
  supabase: any, 
  action: 'create' | 'update' | 'close' | 'escalate',
  ticketData: {
    ticket_id?: string;
    user_id?: string;
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    resolution_notes?: string;
  }
) {
  try {
    if (action === 'create') {
      if (!ticketData.user_id || !ticketData.title) {
        return { error: 'user_id and title are required to create a ticket' };
      }
      
      const { data, error } = await supabase.from('support_tickets').insert({
        user_id: ticketData.user_id,
        title: ticketData.title,
        description: ticketData.description || '',
        category: ticketData.category || 'general',
        priority: ticketData.priority || 'medium',
        status: 'open',
        created_at: new Date().toISOString()
      }).select().single();

      if (error) return { error: `Failed to create ticket: ${error.message}` };
      
      return { success: true, action: 'created', ticket: data };
    }

    if (!ticketData.ticket_id) {
      return { error: 'ticket_id is required for update/close/escalate actions' };
    }

    if (action === 'update') {
      const updates: any = {};
      if (ticketData.status) updates.status = ticketData.status;
      if (ticketData.priority) updates.priority = ticketData.priority;
      if (ticketData.resolution_notes) updates.resolution_notes = ticketData.resolution_notes;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase.from('support_tickets')
        .update(updates)
        .eq('id', ticketData.ticket_id);

      if (error) return { error: `Failed to update ticket: ${error.message}` };
      return { success: true, action: 'updated', ticket_id: ticketData.ticket_id, updates };
    }

    if (action === 'close') {
      const { error } = await supabase.from('support_tickets')
        .update({ 
          status: 'resolved', 
          resolved_at: new Date().toISOString(),
          resolution_notes: ticketData.resolution_notes || 'Resolved by AI Assistant'
        })
        .eq('id', ticketData.ticket_id);

      if (error) return { error: `Failed to close ticket: ${error.message}` };
      return { success: true, action: 'closed', ticket_id: ticketData.ticket_id };
    }

    if (action === 'escalate') {
      const { error } = await supabase.from('support_tickets')
        .update({ 
          priority: 'urgent',
          status: 'escalated',
          escalation_notes: ticketData.resolution_notes || 'Escalated by AI - requires human attention'
        })
        .eq('id', ticketData.ticket_id);

      if (error) return { error: `Failed to escalate ticket: ${error.message}` };
      return { success: true, action: 'escalated', ticket_id: ticketData.ticket_id };
    }

    return { error: `Unknown action: ${action}` };
  } catch (err: any) {
    return { error: `Ticket management failed: ${err.message}` };
  }
}

/**
 * Check job application status and manage applications
 */
export async function manageApplication(
  supabase: any,
  action: 'check' | 'get_details' | 'update_status',
  applicationId?: string,
  userId?: string,
  newStatus?: string
) {
  try {
    if (action === 'check' && userId) {
      const { data: applications } = await supabase
        .from('job_applications')
        .select(`
          id, status, applied_at, cover_letter,
          jobs (id, title, company_id, status)
        `)
        .eq('applicant_id', userId)
        .order('applied_at', { ascending: false })
        .limit(20);

      // Get company names
      const companyIds = applications?.map((a: any) => a.jobs?.company_id).filter(Boolean) || [];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, company_name')
        .in('id', companyIds);

      const companyMap: Record<string, string> = {};
      companies?.forEach((c: any) => { companyMap[c.id] = c.company_name; });

      return {
        user_id: userId,
        total_applications: applications?.length || 0,
        applications: applications?.map((a: any) => ({
          id: a.id,
          job_title: a.jobs?.title,
          company_name: companyMap[a.jobs?.company_id] || 'Unknown',
          status: a.status,
          applied_at: a.applied_at,
          job_status: a.jobs?.status
        })) || [],
        status_summary: {
          pending: applications?.filter((a: any) => a.status === 'pending').length || 0,
          reviewed: applications?.filter((a: any) => a.status === 'reviewed').length || 0,
          shortlisted: applications?.filter((a: any) => a.status === 'shortlisted').length || 0,
          rejected: applications?.filter((a: any) => a.status === 'rejected').length || 0,
          hired: applications?.filter((a: any) => a.status === 'hired').length || 0
        }
      };
    }

    if (action === 'get_details' && applicationId) {
      const { data: application } = await supabase
        .from('job_applications')
        .select(`
          *,
          jobs (id, title, description, company_id, status, location, salary_min, salary_max)
        `)
        .eq('id', applicationId)
        .single();

      if (!application) {
        return { error: 'Application not found' };
      }

      const { data: company } = await supabase
        .from('companies')
        .select('company_name, email, phone')
        .eq('id', application.jobs?.company_id)
        .single();

      return {
        application_id: applicationId,
        status: application.status,
        applied_at: application.applied_at,
        job: {
          title: application.jobs?.title,
          company_name: company?.company_name,
          location: application.jobs?.location,
          salary_range: `${application.jobs?.salary_min || 0} - ${application.jobs?.salary_max || 0}`,
          job_status: application.jobs?.status
        },
        notes: application.notes,
        timeline: application.status_history || []
      };
    }

    return { error: 'Invalid action or missing parameters' };
  } catch (err: any) {
    return { error: `Application operation failed: ${err.message}` };
  }
}

/**
 * Get common FAQ answers for customer queries
 */
export async function getFAQAnswer(supabase: any, topic: string) {
  try {
    // Search FAQs
    const { data: faqs } = await supabase
      .from('faqs')
      .select('question, answer, category')
      .or(`question.ilike.%${topic}%,answer.ilike.%${topic}%,category.ilike.%${topic}%`)
      .limit(5);

    if (!faqs || faqs.length === 0) {
      return {
        found: false,
        topic: topic,
        suggestion: 'No exact FAQ match found. I can still help - please describe your issue in detail.',
        common_topics: ['account', 'payment', 'job posting', 'application', 'verification', 'refund', 'login']
      };
    }

    return {
      found: true,
      topic: topic,
      faqs: faqs,
      count: faqs.length
    };
  } catch (err: any) {
    return { error: `FAQ search failed: ${err.message}` };
  }
}

/**
 * Send notification to user (for follow-ups, updates)
 */
export async function sendUserNotification(
  supabase: any,
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'action_required' = 'info'
) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title: title,
      message: message,
      type: type,
      is_read: false,
      created_at: new Date().toISOString()
    });

    if (error) {
      return { error: `Failed to send notification: ${error.message}` };
    }

    return {
      success: true,
      user_id: userId,
      notification: { title, message, type },
      message: 'Notification sent to user successfully'
    };
  } catch (err: any) {
    return { error: `Notification failed: ${err.message}` };
  }
}

/**
 * Get job details and status
 */
export async function getJobDetails(supabase: any, jobId: string) {
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      return { error: 'Job not found' };
    }

    const [{ data: company }, { count: applicationCount }] = await Promise.all([
      supabase.from('companies').select('company_name, email, is_verified').eq('id', job.company_id).single(),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('job_id', jobId)
    ]);

    return {
      job_id: jobId,
      title: job.title,
      company: company?.company_name || 'Unknown',
      company_verified: company?.is_verified || false,
      status: job.status,
      location: job.location,
      job_type: job.job_type,
      salary_range: `₹${job.salary_min || 0} - ₹${job.salary_max || 0}`,
      posted_at: job.created_at,
      expires_at: job.expires_at,
      views: job.views_count || 0,
      applications: applicationCount || 0,
      description_preview: job.description?.substring(0, 200) + '...',
      is_active: job.status === 'active',
      is_expired: job.expires_at && new Date(job.expires_at) < new Date()
    };
  } catch (err: any) {
    return { error: `Job lookup failed: ${err.message}` };
  }
}

/**
 * Verify employer/company
 */
export async function manageVerification(
  supabase: any,
  action: 'check' | 'verify' | 'revoke',
  companyId: string,
  reason?: string
) {
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('id, company_name, is_verified, verified_plan_start, verified_plan_end')
      .eq('id', companyId)
      .single();

    if (!company) {
      return { error: 'Company not found' };
    }

    if (action === 'check') {
      return {
        company_id: companyId,
        company_name: company.company_name,
        is_verified: company.is_verified,
        verification_start: company.verified_plan_start,
        verification_end: company.verified_plan_end,
        is_expired: company.verified_plan_end && new Date(company.verified_plan_end) < new Date()
      };
    }

    if (action === 'verify') {
      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { error } = await supabase
        .from('companies')
        .update({
          is_verified: true,
          verified_plan_start: now.toISOString(),
          verified_plan_end: endDate.toISOString()
        })
        .eq('id', companyId);

      if (error) return { error: `Verification failed: ${error.message}` };

      return {
        success: true,
        action: 'verified',
        company_id: companyId,
        company_name: company.company_name,
        valid_until: endDate.toISOString(),
        reason: reason || 'Verified by AI Customer Service'
      };
    }

    if (action === 'revoke') {
      const { error } = await supabase
        .from('companies')
        .update({ is_verified: false })
        .eq('id', companyId);

      if (error) return { error: `Revocation failed: ${error.message}` };

      return {
        success: true,
        action: 'revoked',
        company_id: companyId,
        company_name: company.company_name,
        reason: reason || 'Verification revoked by AI'
      };
    }

    return { error: `Unknown action: ${action}` };
  } catch (err: any) {
    return { error: `Verification operation failed: ${err.message}` };
  }
}
