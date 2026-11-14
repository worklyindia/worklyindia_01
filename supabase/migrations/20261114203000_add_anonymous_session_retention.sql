do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'purge-workly-anonymous-app-sessions';
exception when undefined_table then null;
end $$;
select cron.schedule(
  'purge-workly-anonymous-app-sessions',
  '50 3 * * *',
  $$delete from public.app_anonymous_sessions where created_at < now() - interval '90 days'$$
);
