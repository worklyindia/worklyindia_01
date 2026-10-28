import { supabase } from '@/integrations/supabase/client';

export const createTestJobApplicationNotifications = async (userId: string) => {
  try {
    // Create a test job application notification
    const { data: notification1, error: error1 } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: '🎉 Application Submitted Successfully',
        message: 'Your application for Software Developer at TechCorp has been submitted and is under review.',
        type: 'success',
        metadata: {
          match_type: 'application',
          job_id: 'sample-job-id',
          company_name: 'TechCorp'
        }
      })
      .select()
      .single();

    // Create a job recommendation notification  
    const { data: notification2, error: error2 } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: '💼 New Job Match Found!',
        message: 'Frontend Developer at StartupX matches your profile (95% match). Apply now!',
        type: 'info',
        metadata: {
          match_type: 'profile_match',
          job_id: 'sample-job-recommendation-id',
          company_name: 'StartupX',
          match_score: 95
        }
      })
      .select()
      .single();

    // Create an interview notification
    const { data: notification3, error: error3 } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: '📅 Interview Scheduled',
        message: 'Your interview for Product Manager at InnovateCorp is scheduled for tomorrow at 2:00 PM.',
        type: 'warning',
        metadata: {
          match_type: 'interview',
          job_id: 'sample-interview-job-id',
          company_name: 'InnovateCorp',
          interview_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      })
      .select()
      .single();

    console.log('✅ Test notifications created:', {
      application: notification1,
      recommendation: notification2,
      interview: notification3
    });

    return { success: true, notifications: [notification1, notification2, notification3] };
  } catch (error) {
    console.error('❌ Error creating test notifications:', error);
    return { success: false, error };
  }
};

// Test the application submission endpoint with sample data
export const testApplicationSubmitEndpoint = async (apiKey: string, jobId: string) => {
  try {
    console.log('🧪 Testing application submission endpoint...');
    
    const testData = {
      job_id: jobId,
      email: "rahul@example.com",
      full_name: "Rahul Kumar",
      phone: "+91 98765 43210",
      location: "Mumbai, Maharashtra",
      skills: ["JavaScript", "React", "Node.js"],
      resume_url: "https://example.com/resume.pdf",
      cover_letter: "I am interested in this position and believe my skills match your requirements perfectly.",
      current_position: "Senior Developer",
      bio: "5+ years experience in full-stack development with focus on React and Node.js.",
      experience_years: 5,
      languages: ["English", "Hindi"],
      whatsapp_number: "+91 98765 43210"
    };
    
    const { data, error } = await supabase.functions.invoke('applications-submit', {
      body: testData,
      headers: {
        'x-api-key': apiKey,
      },
    });
    
    if (error) {
      console.error('❌ Error testing application submission:', error);
      return { success: false, error };
    }
    
    console.log('✅ Application submitted successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error in test:', error);
    return { success: false, error };
  }
};

// Function to create a sample job application flow
export const simulateJobApplicationFlow = async (userId: string, jobId: string) => {
  try {
    console.log('🔄 Simulating job application flow...');
    
    // First, fetch the job to get employer_id
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*, companies!inner(user_id)')
      .eq('id', jobId)
      .single();

    if (jobError || !jobData) {
      console.error('Job fetch error:', jobError);
      return { success: false, error: 'Job not found' };
    }

    const employerId = (jobData.companies as any)?.user_id;
    if (!employerId) {
      console.error('Employer ID not found');
      return { success: false, error: 'Employer not found' };
    }
    
    // Step 1: Create job application (this should trigger the comprehensive notification system)
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .insert({
        applicant_id: userId,
        employer_id: employerId,
        job_id: jobId,
        status: 'applied',
        cover_letter: 'I am very interested in this position and believe my skills match your requirements.',
        applied_at: new Date().toISOString()
      })
      .select()
      .single();

    if (appError) {
      console.error('Application error:', appError);
      throw appError;
    }

    console.log('✅ Job application created:', application.id);
    
    // Step 2: Simulate status update after 2 seconds
    setTimeout(async () => {
      try {
        const { error: updateError } = await supabase
          .from('job_applications')
          .update({ status: 'reviewed' })
          .eq('id', application.id);
          
        if (!updateError) {
          console.log('✅ Application status updated to reviewed');
        }
      } catch (error) {
        console.error('Error updating application status:', error);
      }
    }, 2000);

    return { success: true, applicationId: application.id };
  } catch (error) {
    console.error('❌ Error simulating job application:', error);
    return { success: false, error };
  }
};