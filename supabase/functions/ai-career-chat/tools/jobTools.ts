export async function applyForJob(supabase: any, user_id: string, job_id: string, cover_letter?: string) {
  if (!user_id) return { error: 'User not authenticated' };
  
  // Check if already applied
  const { data: existing } = await supabase
    .from('job_applications')
    .select('id')
    .eq('job_id', job_id)
    .eq('applicant_id', user_id)
    .single();
  
  if (existing) {
    return { error: 'You have already applied for this job' };
  }
  
  // Check if job exists and is active
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title, status, companies:company_id(company_name)')
    .eq('id', job_id)
    .single();
  
  if (jobError || !job) {
    return { error: 'Job not found' };
  }
  
  if (job.status !== 'active') {
    return { error: 'This job is no longer accepting applications' };
  }
  
  // Create application
  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      job_id,
      applicant_id: user_id,
      cover_letter,
      status: 'pending',
      applied_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Job application error:', error);
    return { error: error.message };
  }
  
  return { 
    success: true, 
    application_id: data.id,
    job_title: job.title,
    company: job.companies?.company_name,
    message: 'Application submitted successfully!'
  };
}

export async function manageJobAlerts(supabase: any, user_id: string, action: string, alert?: any) {
  if (!user_id) return { error: 'User not authenticated' };
  
  if (action === 'create') {
    const { data, error } = await supabase
      .from('job_alerts')
      .insert({
        user_id,
        keywords: alert.keywords,
        location: alert.location,
        job_type: alert.job_type,
        category: alert.category,
        frequency: alert.frequency || 'daily',
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Job alert creation error:', error);
      return { error: error.message };
    }
    
    return { success: true, alert: data, message: 'Job alert created successfully!' };
  }
  
  if (action === 'list') {
    const { data, error } = await supabase
      .from('job_alerts')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Job alerts fetch error:', error);
      return { error: error.message };
    }
    
    return { alerts: data || [] };
  }
  
  if (action === 'delete' && alert?.id) {
    const { error } = await supabase
      .from('job_alerts')
      .delete()
      .eq('id', alert.id)
      .eq('user_id', user_id);
    
    if (error) {
      console.error('Job alert deletion error:', error);
      return { error: error.message };
    }
    
    return { success: true, message: 'Job alert deleted successfully!' };
  }
  
  if (action === 'toggle' && alert?.id) {
    const { error } = await supabase
      .from('job_alerts')
      .update({ is_active: alert.is_active })
      .eq('id', alert.id)
      .eq('user_id', user_id);
    
    if (error) {
      console.error('Job alert toggle error:', error);
      return { error: error.message };
    }
    
    return { success: true, message: 'Job alert updated successfully!' };
  }
  
  return { error: 'Invalid action' };
}

export async function submitCompanyReview(supabase: any, user_id: string, company_id: string, review: any) {
  if (!user_id) return { error: 'User not authenticated' };
  
  const { data, error } = await supabase
    .from('company_reviews')
    .insert({
      company_id,
      user_id,
      rating: review.rating,
      review_text: review.review_text,
      reviewer_name: review.reviewer_name,
      reviewer_position: review.reviewer_position
    })
    .select()
    .single();
  
  if (error) {
    console.error('Company review error:', error);
    return { error: error.message };
  }
  
  return { success: true, review: data, message: 'Thank you for your review!' };
}
