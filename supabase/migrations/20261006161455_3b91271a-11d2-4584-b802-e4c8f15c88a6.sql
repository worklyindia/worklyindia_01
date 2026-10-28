ALTER TABLE public.payment_profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS postal_code text;