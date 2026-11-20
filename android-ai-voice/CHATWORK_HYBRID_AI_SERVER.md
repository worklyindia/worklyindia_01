# ChatWork Hybrid AI Server Architecture

## Goal

Let the same ChatWork account use AI from Android, a Windows laptop, a Windows desktop, and optional Hugging Face hosted compute. Prefer the user's own available hardware, switch to another compatible worker when one becomes unhealthy, and keep requests queued when no worker is available.

This document is an implementation plan, not a claim that servers have already been provisioned. No laptop/desktop agent is installed, no Hugging Face endpoint is deployed, and no production routing or database changes are made by this document.

## Reliability promise and limits

- Do not promise zero downtime. A laptop can lose power, a phone can sleep, internet can fail, and free hosted compute can pause or reach quotas.
- A request can continue only if another compatible worker or a separately provisioned always-on hosted endpoint is reachable.
- If all workers are offline, preserve eligible requests in a durable queue and resume them after a worker returns. Tell the app that the request is queued rather than pretending it is running.
- For genuinely continuous service, at least one always-on hosted worker/API and monitoring are required. That may have a recurring cost.

## Proposed topology

```text
ChatWork Android app / Windows emulator / Website
                       |
                 HTTPS + user auth
                       |
          ChatWork AI Coordinator API
        (Supabase Edge Function gateway)
                       |
          durable request / worker registry
              (Supabase Postgres)
                       |
          capability-aware task scheduler
             /          |           \
       Windows PC   Windows laptop   Android
       worker       worker           local worker
             \          |           /
              optional hosted fallback
              Hugging Face Endpoint/job
```

The Windows and Android workers initiate outbound authenticated connections or poll for work. Do not require users to expose router ports or publish a home computer directly to the internet. A worker must only receive jobs for capabilities it advertises.

## Components

### 1. Coordinator API

- Authenticate every user request with the existing Workly/ChatWork identity.
- Validate model/task, input size, user entitlement, rate limits and allowed output types.
- Create a durable job with an idempotency key; return a job ID immediately.
- Select a healthy worker matching the requested capability, model version, memory/VRAM and architecture.
- Track queued, assigned, running, succeeded, failed, cancelled and expired states.
- Never expose Hugging Face tokens, Supabase service-role keys, or worker secrets to the Android app or browser.

### 2. Worker registry and health

Each worker registers:
- random worker ID and revocable device credential;
- platform/architecture (Windows x64, Android ARM64, etc.);
- supported tasks and exact model/runtime versions;
- RAM, available disk, optional GPU/VRAM and concurrency limits;
- app/runtime version and last health timestamp.

Workers send heartbeats and capability updates. Mark a worker unhealthy after missed heartbeat windows. A job lease expires if a worker disappears; retry only when the task is safe to retry and the idempotency key prevents duplicate side effects.

### 3. Windows worker (laptop and desktop)

- Ship a separate Windows worker service; running the Android APK in BlueStacks is only a client/emulator and does not make Windows a server.
- Start the worker on Windows sign-in/boot using a managed Windows service or Task Scheduler.
- Download model files from Hugging Face Hub to a local cache; pin model revisions and verify checksums where available.
- Load only models supported by the machine's CPU/GPU and memory. Advertise capability only after a successful model/runtime self-test.
- Use outbound HTTPS/WebSocket or short polling; never open an unauthenticated inbound port.
- Provide a tray/status view for connected, loading, busy, offline and error states.

### 4. Android worker

- Run only models explicitly supported by the phone's CPU, RAM, storage and Android runtime.
- Treat Android as an opportunistic worker: Doze, battery saver, thermal throttling, app force-stop and background restrictions can pause it.
- Prefer foreground execution with a clear user-visible notification for long tasks. Do not claim it can serve requests continuously while the app is closed.
- Never attempt to load desktop-only or multi-gigabyte models just because they exist on Hugging Face.

### 5. Hugging Face

Use the Hugging Face Hub as a model source and optional hosted compute:
- Hub downloads are model artifacts, not a guaranteed always-on inference server.
- A Space or free hosted resource must be treated as best-effort and may sleep, queue, throttle or be unavailable.
- For a reliable hosted fallback, use a paid always-on Inference Endpoint or other explicitly provisioned compute, with budget limits and a health check.
- Keep HF access tokens only in server-side secrets. Use least-privilege read access for private model downloads.
- Record model license, revision, hardware requirements and terms before enabling each model.

### 6. Routing and fallback

Route by capability, not by device preference alone:
1. Choose the best healthy local worker that supports the exact task/model and has capacity.
2. If it stops responding, expire its lease and retry on another compatible worker.
3. If no local worker is healthy, use the configured Hugging Face hosted fallback only if enabled and within budget.
4. If no eligible worker exists, leave the job queued with a clear status and retry when a worker registers.
5. If a task cannot safely be retried (for example, an external action), require idempotency or mark it for reconciliation instead of blindly repeating it.

Do not silently substitute a different model when quality, language, privacy or output format would change. Return the selected provider/model and any fallback notice to the client.

## Security requirements

- TLS for every network hop.
- Short-lived user access tokens and revocable per-worker credentials.
- Worker credentials stored in Windows Credential Manager / Android Keystore, not source code or plain text config.
- Server-side secrets only; never bundle HF tokens or Supabase service-role keys in the APK.
- Per-user quotas, per-device concurrency caps, request-size limits and abuse protection.
- Validate model files and pin revisions; scan/allow-list worker packages and updates.
- Avoid logging prompts, generated private content or credentials by default. Apply retention controls.
- Provide a device list with revoke/disconnect controls.

## Suggested data model (migration required before implementation)

- `ai_workers`: worker ID, owner/user ID, platform, architecture, status, capabilities JSON, last heartbeat, app version, revoked timestamp.
- `ai_jobs`: job ID, owner/user ID, task, model/revision, input reference, status, priority, idempotency key, assigned worker, lease expiry, retry count, timestamps, result reference, safe error code.
- `ai_worker_events`: minimal audit events for registration, health changes, lease expiry and revocation.

Use private RLS policies and server-side RPC/Edge Functions for registration, lease claiming and completion. Clients must not be allowed to claim jobs for other users or update arbitrary job states. Store large inputs/results in private object storage and pass short-lived signed references, not huge payloads through the database.

## Rollout phases

1. **Inventory and hardware check** — confirm the laptop/desktop CPU, RAM, GPU/VRAM and free disk; map each requested model to supported runtimes.
2. **Coordinator foundation** — add migrations, RLS, worker registration, heartbeat, durable queue, lease claiming, job status and cancellation.
3. **Windows worker MVP** — build a signed Windows x64 worker, local model cache, capability self-test, auto-start and secure outbound connection.
4. **Android worker MVP** — add only compatible on-device tasks, visible foreground execution and lifecycle-safe cancellation.
5. **Hugging Face integration** — Hub download support first; hosted fallback only after a specific endpoint/Space and cost policy are configured.
6. **Client integration** — ChatWork app and website submit jobs to one API and display queued/running/fallback/completed states.
7. **Reliability tests** — unplug network, power off a worker mid-job, revoke a device, run out of disk, simulate expired credentials and verify lease recovery and no duplicate completion.
8. **Production rollout** — deploy migrations and services only after review, secrets configuration, cost approval and end-to-end tests.

## Acceptance criteria

- The same authenticated account sees the same job status on app and website.
- A laptop worker can disconnect without corrupting the job; another compatible worker can take over safely.
- Offline requests remain queued and resume when a compatible worker returns.
- No worker is reachable through an unauthenticated public inbound port.
- Revoked devices cannot register or claim new jobs.
- Hugging Face hosted fallback is opt-in, budget-capped and reports when it is unavailable.
- The UI never labels a queued job as running or claims 100% uptime.
- Windows, Android and hosted worker capabilities are tested independently before being advertised.

## Not included yet

This architecture document does not create the Windows executable/service, Android worker, database migrations, Edge Functions, Hugging Face endpoint, paid compute, or production secrets. Those are separate implementation and deployment steps.
