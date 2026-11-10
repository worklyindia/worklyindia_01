-- Drop and recreate get_company_interviews function with VideoSDK and Jitsi fields
DROP FUNCTION IF EXISTS public.get_company_interviews(text, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_company_interviews(
  p_status text DEFAULT NULL,
  p_from timestamp with time zone DEFAULT NULL,
  p_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  job_id uuid,
  applicant_id uuid,
  scheduled_at timestamp with time zone,
  scheduled_end_at timestamp with time zone,
  mode text,
  location_url text,
  daily_room_url text,
  daily_room_name text,
  host_meeting_token text,
  participant_meeting_tokens jsonb,
  host_user_id uuid,
  jitsi_room_name text,
  jitsi_meeting_url text,
  jitsi_password text,
  videosdk_room_id text,
  videosdk_meeting_url text,
  videosdk_host_token text,
  videosdk_participant_tokens jsonb,
  status text,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  job_title text,
  applicant_full_name text,
  applicant_phone text,
  applicant_location text,
  applicant_current_position text,
  applicant_profile_image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.job_id,
    i.applicant_id,
    i.scheduled_at,
    i.scheduled_end_at,
    i.mode,
    i.location_url,
    i.daily_room_url,
    i.daily_room_name,
    i.host_meeting_token,
    i.participant_meeting_tokens::jsonb,
    i.host_user_id,
    i.jitsi_room_name,
    i.jitsi_meeting_url,
    i.jitsi_password,
    i.videosdk_room_id,
    i.videosdk_meeting_url,
    i.videosdk_host_token,
    i.videosdk_participant_tokens::jsonb,
    i.status,
    i.notes,
    i.created_at,
    i.updated_at,
    j.title AS job_title,
    COALESCE(p.full_name, '') AS applicant_full_name,
    COALESCE(p.phone, '') AS applicant_phone,
    COALESCE(p.location, '') AS applicant_location,
    COALESCE(p.current_position, '') AS applicant_current_position,
    COALESCE(p.profile_image_url, '') AS applicant_profile_image_url
  FROM public.interviews i
  JOIN public.jobs j ON j.id = i.job_id
  JOIN public.companies c ON c.id = j.company_id
  LEFT JOIN public.profiles p ON p.user_id = i.applicant_id
  WHERE c.user_id = auth.uid()
    AND (p_status IS NULL OR i.status = p_status)
    AND (p_from IS NULL OR i.scheduled_at >= p_from)
    AND (p_to IS NULL OR i.scheduled_at <= p_to)
  ORDER BY i.scheduled_at ASC;
END;
$$;