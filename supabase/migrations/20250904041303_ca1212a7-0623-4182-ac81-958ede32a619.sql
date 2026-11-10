
-- 1) Create interviews table with RLS
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_id uuid not null,
  scheduled_at timestamptz not null,
  mode text not null default 'online', -- online | in_person | phone
  location_url text,                   -- meet/zoom link or address
  status text not null default 'scheduled', -- scheduled | rescheduled | completed | cancelled
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interviews enable row level security;

-- Employer (company owner) can manage interviews for their jobs
create policy if not exists "Employers manage interviews for their jobs"
on public.interviews
for all
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = interviews.job_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = interviews.job_id
      and c.user_id = auth.uid()
  )
);

-- Applicants can view (and optionally update) their own interviews
create policy if not exists "Applicants can view their own interviews"
on public.interviews
for select
to authenticated
using (applicant_id = auth.uid());

create policy if not exists "Applicants can update their own interviews"
on public.interviews
for update
to authenticated
using (applicant_id = auth.uid());

-- Keep updated_at fresh
drop trigger if exists trg_interviews_updated_at on public.interviews;
create trigger trg_interviews_updated_at
before update on public.interviews
for each row execute function public.update_updated_at_column();

-- 2) Keep job applications count in sync with jobs
drop trigger if exists trg_sync_app_count_ins on public.job_applications;
drop trigger if exists trg_sync_app_count_upd on public.job_applications;
drop trigger if exists trg_sync_app_count_del on public.job_applications;

create trigger trg_sync_app_count_ins
after insert on public.job_applications
for each row execute function public.sync_job_application_count();

create trigger trg_sync_app_count_upd
after update on public.job_applications
for each row execute function public.sync_job_application_count();

create trigger trg_sync_app_count_del
after delete on public.job_applications
for each row execute function public.sync_job_application_count();

-- 3) Notifications for applications (to employer) and status changes (to applicant)
drop trigger if exists trg_job_application_notification on public.job_applications;
create trigger trg_job_application_notification
after insert on public.job_applications
for each row execute function public.create_job_application_notification();

drop trigger if exists trg_application_status_notification on public.job_applications;
create trigger trg_application_status_notification
after update on public.job_applications
for each row execute function public.create_application_status_notification();

-- 4) Employer metrics auto-update on relevant events
drop trigger if exists trg_employer_metrics_jobs_ins on public.jobs;
drop trigger if exists trg_employer_metrics_jobs_upd on public.jobs;
drop trigger if exists trg_employer_metrics_jobs_del on public.jobs;

create trigger trg_employer_metrics_jobs_ins
after insert on public.jobs
for each row execute function public.update_employer_metrics();

create trigger trg_employer_metrics_jobs_upd
after update on public.jobs
for each row execute function public.update_employer_metrics();

create trigger trg_employer_metrics_jobs_del
after delete on public.jobs
for each row execute function public.update_employer_metrics();

drop trigger if exists trg_employer_metrics_ja_ins on public.job_applications;
drop trigger if exists trg_employer_metrics_ja_upd on public.job_applications;
drop trigger if exists trg_employer_metrics_ja_del on public.job_applications;

create trigger trg_employer_metrics_ja_ins
after insert on public.job_applications
for each row execute function public.update_employer_metrics();

create trigger trg_employer_metrics_ja_upd
after update on public.job_applications
for each row execute function public.update_employer_metrics();

create trigger trg_employer_metrics_ja_del
after delete on public.job_applications
for each row execute function public.update_employer_metrics();

drop trigger if exists trg_employer_metrics_pay_ins on public.job_payments;
drop trigger if exists trg_employer_metrics_pay_upd on public.job_payments;
drop trigger if exists trg_employer_metrics_pay_del on public.job_payments;

create trigger trg_employer_metrics_pay_ins
after insert on public.job_payments
for each row execute function public.update_employer_metrics();

create trigger trg_employer_metrics_pay_upd
after update on public.job_payments
for each row execute function public.update_employer_metrics();

create trigger trg_employer_metrics_pay_del
after delete on public.job_payments
for each row execute function public.update_employer_metrics();

-- 5) Keep updated_at fresh on common tables (only where column exists)
-- jobs
drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.update_updated_at_column();

-- companies
drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.update_updated_at_column();

-- employer_metrics
drop trigger if exists trg_employer_metrics_updated_at on public.employer_metrics;
create trigger trg_employer_metrics_updated_at
before update on public.employer_metrics
for each row execute function public.update_updated_at_column();

-- job_boosts
drop trigger if exists trg_job_boosts_updated_at on public.job_boosts;
create trigger trg_job_boosts_updated_at
before update on public.job_boosts
for each row execute function public.update_updated_at_column();

-- job_payments
drop trigger if exists trg_job_payments_updated_at on public.job_payments;
create trigger trg_job_payments_updated_at
before update on public.job_payments
for each row execute function public.update_updated_at_column();
