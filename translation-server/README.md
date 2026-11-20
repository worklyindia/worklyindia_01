# Workly Self-Hosted Translation Server

This service runs Google's MADLAD-400 3B multilingual translation model on infrastructure controlled by Workly. Translation requests are processed by this service; it does not call Google Translate, a hosted inference API, or another translation vendor.

## Model and licence

- Model: `google/madlad400-3b-mt`
- Model card: https://huggingface.co/google/madlad400-3b-mt
- Model card lists Apache-2.0 and 419 languages.
- Keep the model card and upstream notices with deployments. Validate translation quality and language coverage before enabling broadly.

## Hardware

This is a large model, not a Cloudflare Worker workload. Use a dedicated GPU host. Plan for at least 16 GB GPU VRAM and 24 GB system RAM for a practical initial deployment; actual memory depends on framework/runtime and concurrency. CPU-only mode is included for testing, but will be slow and is not recommended for production. Model weights download to the server's Hugging Face cache on first startup and are not included in this repository or any Android APK.

## Run

Set a long random service token before starting:

```bash
export TRANSLATION_SERVICE_TOKEN='replace-with-a-long-random-secret'
docker build -t workly-translation ./translation-server
docker run --gpus all -p 8080:8080 \
  -e TRANSLATION_SERVICE_TOKEN="$TRANSLATION_SERVICE_TOKEN" \
  -v workly-model-cache:/models \
  workly-translation
```

Health check: `GET /health`

Translate: `POST /translate` with `Authorization: Bearer <token>` and JSON:

```json
{
  "text": "Kem cho? Majama?",
  "sourceLang": "auto",
  "targetLang": "en"
}
```

## Connect to Supabase

Configure these Supabase Edge Function secrets (never put them in browser code):

- `TRANSLATION_SERVICE_URL`: private HTTPS base URL of this service, without a trailing slash.
- `TRANSLATION_SERVICE_TOKEN`: same random token configured on the container.

The existing `ai-career-chat/translate` edge route forwards translation requests to this service. Language detection/proofreading mode remains on the existing AI gateway until a dedicated self-hosted language-identification model is deployed.

## Security and operations

- Put the service behind HTTPS and a firewall; do not expose port 8080 publicly without a TLS reverse proxy.
- Keep the bearer token only in server-side secrets and rotate it if exposed.
- Start with one worker and low concurrency; the model is loaded once per process.
- Add provider-side request limits, monitoring, and GPU capacity before production traffic.
- Translation may be inaccurate for rare languages, slang, Romanized Indian languages, or domain-specific job/legal content. Do not treat it as certified translation.
