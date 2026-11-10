-- Allow job_interactions to store profile views without a job_id
ALTER TABLE public.job_interactions 
  ALTER COLUMN job_id DROP NOT NULL;

-- Create or replace function to log a profile view with SECURITY DEFINER to bypass RLS
create or replace function public.log_profile_view(
  p_profile_user_id uuid,
  p_viewer_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Avoid counting self-views
  if p_profile_user_id = p_viewer_id then
    return;
  end if;

  insert into public.job_interactions (
    interaction_type,
    job_id,
    user_id,
    metadata
  ) values (
    'profile_view',
    null,
    p_viewer_id,
    jsonb_build_object(
      'profile_user_id', p_profile_user_id,
      'viewer_id', p_viewer_id
    )
  );
end;
$$;

-- Create or replace function to get views with period breakdown
create or replace function public.get_user_profile_views_with_period(
  p_user_id uuid
)
returns table (
  total_views bigint,
  views_last_30_days bigint,
  views_today bigint
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select created_at
    from public.job_interactions
    where interaction_type = 'profile_view'
      and metadata->>'profile_user_id' = p_user_id::text
  )
  select
    (select count(*) from base) as total_views,
    (select count(*) from base where created_at >= now() - interval '30 days') as views_last_30_days,
    (
      select count(*)
      from base
      where created_at >= (timezone('UTC', date_trunc('day', timezone('Asia/Kolkata', now()))))
    ) as views_today;
$$;

-- Helpful indexes for performance
create index if not exists idx_job_interactions_profile_views 
  on public.job_interactions (interaction_type, ((metadata->>'profile_user_id'))) 
  where interaction_type = 'profile_view';

create index if not exists idx_job_interactions_created_at 
  on public.job_interactions (created_at desc);
