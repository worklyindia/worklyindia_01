select cron.unschedule(jobname) from cron.job where jobname in ('referral-cycles-hourly','referral-cycle-start','referral-cycle-finalize','profile-completion-reminders-daily');

select cron.schedule('referral-cycles-hourly', '5 * * * *', $$
  select net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/manage-referral-cycles',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

select cron.schedule('referral-cycle-start', '31 18 * * *', $$
  select net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/manage-referral-cycles',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

select cron.schedule('referral-cycle-finalize', '27 18 * * *', $$
  select net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/manage-referral-cycles',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

select cron.schedule('profile-completion-reminders-daily', '30 4 * * *', $$
  select net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api/profile-completion-reminders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{}'::jsonb
  );
$$);