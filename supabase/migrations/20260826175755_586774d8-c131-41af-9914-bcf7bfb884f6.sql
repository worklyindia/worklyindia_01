-- Provider rate catalog (official/current API pricing as source of truth)
CREATE TABLE public.ai_pricing_provider_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  rate_key text NOT NULL,
  provider text NOT NULL,
  service text NOT NULL,
  unit text NOT NULL,
  unit_price_usd numeric,
  unit_price_inr numeric,
  usd_inr numeric NOT NULL DEFAULT 88,
  source_url text NOT NULL,
  source_doc_date date NOT NULL DEFAULT current_date,
  effective_from date NOT NULL DEFAULT current_date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, rate_key)
);

GRANT SELECT ON public.ai_pricing_provider_rates TO authenticated;
GRANT ALL ON public.ai_pricing_provider_rates TO service_role;

ALTER TABLE public.ai_pricing_provider_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read provider rates"
  ON public.ai_pricing_provider_rates FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins manage provider rates"
  ON public.ai_pricing_provider_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_ai_pricing_provider_rates_updated_at
  BEFORE UPDATE ON public.ai_pricing_provider_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cost-model configuration on the module rows
ALTER TABLE public.ai_pricing_modules
  ADD COLUMN IF NOT EXISTS usage_assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_usage_caps jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_model text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS review_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_cost_source text;

-- Enterprise/AI plans + interviews become provider-cost driven and stay frozen
UPDATE public.ai_pricing_modules
SET cost_model = 'provider_api',
    review_only = true,
    auto_apply = false,
    usage_assumptions = '{
      "chat_message": {"input_tokens": 1500, "output_tokens": 500, "model": "google/gemini-2.5-flash"},
      "image_analysis": {"input_tokens": 1200, "image_tokens": 258, "output_tokens": 300, "model": "google/gemini-2.5-flash"},
      "voice_input": {"audio_seconds": 40, "model": "openai/gpt-4o-mini-transcribe"},
      "voice_playback": {"characters": 500, "model": "openai/gpt-4o-mini-tts"},
      "image_generation": {"images": 1, "model": "google/gemini-2.5-flash-image"},
      "overhead_percent": 10
    }'::jsonb,
    internal_usage_caps = '{
      "unlimited_sentinel": 999999,
      "messages_per_month": 3000,
      "voice_input_per_month": 600,
      "voice_playback_per_month": 600,
      "image_analysis_per_month": 500,
      "ai_image_generation_per_month": 150
    }'::jsonb
WHERE module = 'ai_chat_plan';

UPDATE public.ai_pricing_modules
SET cost_model = 'provider_api',
    review_only = true,
    auto_apply = false,
    usage_assumptions = '{
      "participants_per_interview": 2,
      "recording_enabled": true,
      "transcription_enabled": true,
      "avg_interview_minutes": 30,
      "ai_report": {"input_tokens": 6000, "output_tokens": 1200, "model": "google/gemini-2.5-flash"},
      "overhead_percent": 10
    }'::jsonb,
    internal_usage_caps = '{"max_interview_minutes": 120}'::jsonb
WHERE module = 'interview';

INSERT INTO public.ai_pricing_provider_rates
  (module, rate_key, provider, service, unit, unit_price_usd, unit_price_inr, usd_inr, source_url, source_doc_date, notes)
VALUES
  ('shared','usd_inr_fx','RBI reference','USD to INR conversion','1 USD', NULL, 88, 88, 'https://www.rbi.org.in/Scripts/ReferenceRateArchive.aspx', current_date, 'FX rate applied to all USD provider list prices.'),
  ('shared','llm_chat_input_per_1k_tokens','Lovable AI Gateway (Google Gemini 2.5 Flash)','LLM text input tokens','1K input tokens', 0.0003, NULL, 88, 'https://ai.google.dev/gemini-api/docs/pricing', current_date, '$0.30 per 1M input tokens.'),
  ('shared','llm_chat_output_per_1k_tokens','Lovable AI Gateway (Google Gemini 2.5 Flash)','LLM text output tokens','1K output tokens', 0.0025, NULL, 88, 'https://ai.google.dev/gemini-api/docs/pricing', current_date, '$2.50 per 1M output tokens.'),
  ('shared','stt_per_minute','Lovable AI Gateway (OpenAI gpt-4o-mini-transcribe)','Speech to text','1 audio minute', 0.003, NULL, 88, 'https://platform.openai.com/docs/pricing', current_date, '$0.003 per audio minute.'),
  ('shared','tts_per_1k_chars','Lovable AI Gateway (OpenAI gpt-4o-mini-tts)','Text to speech','1K characters', 0.015, NULL, 88, 'https://platform.openai.com/docs/pricing', current_date, '$0.015 per 1K input characters of speech.'),
  ('shared','image_gen_per_image','Lovable AI Gateway (Gemini 2.5 Flash Image)','Image generation','1 image', 0.039, NULL, 88, 'https://ai.google.dev/gemini-api/docs/pricing', current_date, '$0.039 per generated image.'),
  ('ai_chat_plan','platform_infra_per_plan_month','Supabase (Lovable Cloud)','Database, edge functions, storage, egress','1 subscriber-month', NULL, 6, 88, 'https://supabase.com/pricing', current_date, 'Amortised platform cost per paid subscriber per month.'),
  ('interview','video_room_per_participant_minute','100ms','Live video room','1 participant-minute', 0.004, NULL, 88, 'https://www.100ms.live/pricing', current_date, 'Conferencing per participant-minute.'),
  ('interview','video_recording_per_minute','100ms','Cloud recording + storage/egress','1 recorded minute', 0.012, NULL, 88, 'https://www.100ms.live/pricing', current_date, 'Composite recording per minute.'),
  ('interview','platform_infra_per_interview','Supabase (Lovable Cloud)','Scheduling, notifications, storage, egress','1 interview', NULL, 1.5, 88, 'https://supabase.com/pricing', current_date, 'Amortised platform cost per interview.');