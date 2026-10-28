-- Create employer_notifications table
CREATE TABLE public.employer_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employer_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own employer notifications"
ON public.employer_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own employer notifications"
ON public.employer_notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own employer notifications"
ON public.employer_notifications
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "System can create employer notifications"
ON public.employer_notifications
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_employer_notifications_user_id ON public.employer_notifications(user_id);
CREATE INDEX idx_employer_notifications_created_at ON public.employer_notifications(created_at DESC);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_employer_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_employer_notifications_updated_at
  BEFORE UPDATE ON public.employer_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_employer_notification_updated_at();

-- Create function to create employer notifications for new job applications 
CREATE OR REPLACE FUNCTION public.create_employer_job_application_notification()
RETURNS TRIGGER AS $$
DECLARE
    job_title TEXT;
    company_name TEXT;
    employer_id UUID;
    applicant_name TEXT;
BEGIN
    -- Get job and company details
    SELECT j.title, c.company_name, c.user_id 
    INTO job_title, company_name, employer_id
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Get applicant name
    SELECT COALESCE(p.full_name, 'Someone') 
    INTO applicant_name
    FROM profiles p
    WHERE p.user_id = NEW.user_id;
    
    -- Create notification for employer
    INSERT INTO employer_notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        employer_id,
        'New Job Application',
        applicant_name || ' applied for your ' || job_title || ' position',
        'application',
        '/employer-portal/job-analytics/' || NEW.job_id,
        jsonb_build_object(
            'job_id', NEW.job_id,
            'application_id', NEW.id,
            'applicant_id', NEW.user_id,
            'job_title', job_title
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for job applications
CREATE TRIGGER create_employer_job_application_notification_trigger
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.create_employer_job_application_notification();

-- Create function to create employer notifications for interview scheduling
CREATE OR REPLACE FUNCTION public.create_employer_interview_notification()
RETURNS TRIGGER AS $$
DECLARE
    job_title TEXT;
    employer_id UUID;
    applicant_name TEXT;
BEGIN
    -- Get job details and employer
    SELECT j.title, c.user_id 
    INTO job_title, employer_id
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Get applicant name
    SELECT COALESCE(p.full_name, 'Applicant') 
    INTO applicant_name
    FROM profiles p
    WHERE p.user_id = NEW.applicant_id;
    
    -- Create notification for employer
    INSERT INTO employer_notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        employer_id,
        'Interview Scheduled',
        'Interview scheduled with ' || applicant_name || ' for ' || job_title,
        'interview',
        '/employer-portal/interviews',
        jsonb_build_object(
            'job_id', NEW.job_id,
            'interview_id', NEW.id,
            'applicant_id', NEW.applicant_id,
            'scheduled_at', NEW.scheduled_at
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for interviews
CREATE TRIGGER create_employer_interview_notification_trigger
  AFTER INSERT ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.create_employer_interview_notification();