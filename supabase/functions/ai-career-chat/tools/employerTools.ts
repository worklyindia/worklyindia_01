export async function postJob(supabase: any, user_id: string, jobData: any, domain: string) {
  if (!user_id) return { error: 'User not authenticated' };
  
  
  // Get company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user_id)
    .single();
  
  if (companyError || !company) {
    return { error: 'Please complete your company profile first before posting jobs.' };
  }
  
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      company_id: company.id,
      title: jobData.title,
      description: jobData.description,
      location: jobData.location,
      city: jobData.city,
      state: jobData.state,
      job_type: jobData.job_type,
      category: jobData.category,
      salary_min: jobData.salary_min,
      salary_max: jobData.salary_max,
      experience_level: jobData.experience_level,
      skills_required: jobData.skills_required,
      status: 'draft',
      visibility: 'public'
    })
    .select()
    .single();
  
  if (error) {
    console.error('Job post error:', error);
    return { error: error.message };
  }
  
  return { 
    success: true, 
    job_id: data.id,
    job_url: `${domain}/job/${data.id}`,
    message: 'Job created as draft. Please review and publish it from your dashboard.'
  };
}

export async function manageApplications(supabase: any, user_id: string, action: string, application_id?: string, status?: string) {
  if (!user_id) return { error: 'User not authenticated' };
  
  
  if (action === 'list') {
    // Get employer's company
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user_id)
      .single();
    
    if (!company) {
      return { error: 'Company not found' };
    }
    
    // Get all applications for employer's jobs
    const { data: applications, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        jobs:job_id(title, location),
        profiles:applicant_id(full_name, email, phone, skills, experience_years)
      `)
      .in('job_id', 
        supabase.from('jobs').select('id').eq('company_id', company.id)
      )
      .order('applied_at', { ascending: false });
    
    if (error) {
      console.error('Applications fetch error:', error);
      return { error: error.message };
    }
    
    return { applications: applications || [] };
  }
  
  if (action === 'update_status' && application_id && status) {
    // Verify application belongs to employer's job
    const { data: application } = await supabase
      .from('job_applications')
      .select(`
        id,
        jobs:job_id(company_id, companies:company_id(user_id))
      `)
      .eq('id', application_id)
      .single();
    
    if (!application || application.jobs?.companies?.user_id !== user_id) {
      return { error: 'Application not found or access denied' };
    }
    
    const { error } = await supabase
      .from('job_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', application_id);
    
    if (error) {
      console.error('Application status update error:', error);
      return { error: error.message };
    }
    
    try {
      await supabase.functions.invoke('email-api', {
        body: { action: 'application_status_notification', application_id, new_status: status }
      });
    } catch (e) { console.error('Status notification error:', e); }

    return { success: true, message: 'Application status updated successfully!' };
  }
  
  return { error: 'Invalid action' };
}
