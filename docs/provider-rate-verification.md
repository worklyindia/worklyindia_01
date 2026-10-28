# Provider Rate Verification Checklist (Enterprise/AI Plans + Interview)

Status: `auto_apply = OFF`, both modules `review_only = true` (frozen).
Live pricing will NOT change until rates are verified AND the owner confirms.

Table to update: `public.ai_pricing_provider_rates`
(update `unit_price_usd` / `unit_price_inr` / `usd_inr` / `source_url` / `source_doc_date`, keep `is_active = true`)

## Rates to verify against your actual invoice / contract

| # | Module | rate_key | Provider / Service | Unit | Seeded rate | Your actual rate | Invoice source |
|---|--------|----------|--------------------|------|-------------|------------------|----------------|
| 1 | shared | `usd_inr_fx` | RBI reference FX | 1 USD | ₹88 | ______ | card/bank statement FX incl. markup |
| 2 | shared | `llm_chat_input_per_1k_tokens` | Gemini 2.5 Flash — input tokens | 1K input tokens | $0.0003 ($0.30/1M) | ______ | Gemini/Lovable AI usage invoice |
| 3 | shared | `llm_chat_output_per_1k_tokens` | Gemini 2.5 Flash — output tokens | 1K output tokens | $0.0025 ($2.50/1M) | ______ | same |
| 4 | shared | `stt_per_minute` | OpenAI gpt-4o-mini-transcribe | 1 audio minute | $0.003 | ______ | OpenAI billing |
| 5 | shared | `tts_per_1k_chars` | OpenAI gpt-4o-mini-tts | 1K characters | $0.015 | ______ | OpenAI billing |
| 6 | shared | `image_gen_per_image` | Gemini 2.5 Flash Image | 1 image | $0.039 | ______ | Gemini/Lovable AI invoice |
| 7 | ai_chat_plan | `platform_infra_per_plan_month` | Supabase / Lovable Cloud | 1 subscriber-month | ₹6 | ______ | Supabase invoice ÷ active subscribers |
| 8 | interview | `video_room_per_participant_minute` | 100ms live room | 1 participant-minute | $0.004 | ______ | 100ms invoice/contract |
| 9 | interview | `video_recording_per_minute` | 100ms recording + storage/egress | 1 recorded minute | $0.012 | ______ | 100ms invoice/contract |
| 10 | interview | `platform_infra_per_interview` | Supabase / Lovable Cloud | 1 interview | ₹1.50 | ______ | Supabase invoice ÷ interviews/month |

## Usage assumptions to confirm (in `ai_pricing_modules.usage_assumptions`)

AI plans:
- chat message: 1,500 input + 500 output tokens
- image analysis: 1,200 + 258 image tokens input, 300 output
- voice input: 40 audio seconds per use
- voice playback: 500 characters per use
- overhead: 10%

Interview:
- 2 participants, 30 min average, recording ON, transcription ON
- AI report: 6,000 input + 1,200 output tokens
- overhead: 10%, max documented duration cap 120 min

## Internal caps replacing "unlimited" (Enterprise)
messages 3,000/mo · voice input 600/mo · voice playback 600/mo · image analysis 500/mo · image generation 150/mo

## Process after verification
1. Update the rows above (SQL editor or migration) with invoice rates + real source links/dates.
2. Ask for a fresh dry-run: provider → usage → cost → GST 18% → gateway 2.5% → min profit → min margin → final safe price.
3. Owner reviews the report.
4. Only after explicit owner confirmation: enable `auto_apply` for `ai_chat_plan` / `interview`.

The other 5 modules (`wallet_points`, `job_boost`, `verification_badge`, `job_posting`, `job_renewal`) stay untouched.
