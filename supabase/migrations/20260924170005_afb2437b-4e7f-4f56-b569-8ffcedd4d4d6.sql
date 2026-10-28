CREATE TABLE IF NOT EXISTS public.job_alert_sent_jobs (
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  ist_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
GRANT ALL ON public.job_alert_sent_jobs TO service_role;
ALTER TABLE public.job_alert_sent_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.job_alert_daily_digests (
  user_id uuid NOT NULL,
  ist_date date NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  job_count integer NOT NULL DEFAULT 0,
  channels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ist_date)
);
GRANT ALL ON public.job_alert_daily_digests TO service_role;
ALTER TABLE public.job_alert_daily_digests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_job_alert_daily_user_sent ON public.job_alert_daily_digests(user_id, created_at DESC) WHERE status = 'sent';