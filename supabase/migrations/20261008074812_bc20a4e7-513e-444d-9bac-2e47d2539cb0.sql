CREATE TABLE public.developer_sub_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_user_id uuid NOT NULL,
  external_id text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (developer_user_id, external_id)
);
GRANT SELECT ON public.developer_sub_accounts TO authenticated;
GRANT ALL ON public.developer_sub_accounts TO service_role;
ALTER TABLE public.developer_sub_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers view own sub-accounts" ON public.developer_sub_accounts FOR SELECT TO authenticated USING (developer_user_id = auth.uid());

CREATE TABLE public.developer_sub_account_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.developer_sub_accounts(id) ON DELETE CASCADE,
  developer_user_id uuid NOT NULL,
  waba_id text NOT NULL,
  phone_number_id text NOT NULL UNIQUE,
  display_phone text,
  verified_name text,
  business_name text,
  quality_rating text,
  status text NOT NULL DEFAULT 'connected',
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.developer_sub_account_numbers (sub_account_id);
GRANT SELECT ON public.developer_sub_account_numbers TO authenticated;
GRANT ALL ON public.developer_sub_account_numbers TO service_role;
ALTER TABLE public.developer_sub_account_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers view own sub-account numbers" ON public.developer_sub_account_numbers FOR SELECT TO authenticated USING (developer_user_id = auth.uid());

CREATE TABLE public.developer_sub_account_tokens (
  phone_number_id text PRIMARY KEY REFERENCES public.developer_sub_account_numbers(phone_number_id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_type text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.developer_sub_account_tokens TO service_role;
ALTER TABLE public.developer_sub_account_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.developer_connect_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  sub_account_id uuid NOT NULL REFERENCES public.developer_sub_accounts(id) ON DELETE CASCADE,
  return_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.developer_connect_sessions TO service_role;
ALTER TABLE public.developer_connect_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.api_request_logs ADD COLUMN IF NOT EXISTS sub_account_id uuid;