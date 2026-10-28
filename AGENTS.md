<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- YouTube uses synchronous playback claims and keyed audio cleanup to prevent stale-player interference.
- WhatsApp profile and AI settings share a live Meta setup gate; registration and PIN writes use account-scoped existing functions and shared setup predicates, because connection, activation, PIN and business verification are independent states.
- Cross-function media key helpers live in `_shared/mediaR2.ts` with an egress compatibility re-export, because selected deployments omit sibling function directories.
- Deno-check edge modules; deploy only selected functions to the owner's connected external Supabase, using direct deployment when GitHub is unavailable, to respect the function cap.
- Social linking resolves supported account identities through socialTokenOwner using only the supplied user token, never application credential fallback, to prevent linking the wrong account.
- Selected support email stays in URL query params for refresh and linking.
- Owner Secrets: one credential per card; hide alias/JSON duplicates.
- Vercel oac_ client IDs install at vercel.com/integrations/<slug>/new; Owner Secrets override edge env.
- Keep AI context user/platform-specific; atomically reserve shared quota before every AI Connect auto-reply.
- Isolate Developer AI Chat history by audience; verify developer identity server-side so role guidance can't mix.
- Reuse Owner Portal Sheet for Employee/Developer mobile menus.
- One API key row per user; delete it before creating another.
- Monthly refresh carries unused developer API calls forward; free calls only for active subscribers.
- API subscription: guarded Developer-menu page.
- Map owner pricing menus to their guard permission in ROUTE_PERMISSIONS; omissions lock out owners.
- Wrap window.Razorpay for global method choice; open steps resume after refresh only for server-verifiable orders; QR/link timers keep their clock offset.
- AI Connect/OAuth retain platform URLs; credential-free connection events/wake reads refresh authorized scopes.
- API logs stay RLS-private; log every quota-charged call, including status and validation errors.
- API/payment/call-balance/workbook histories: guarded private paginated lists, fixed headers, separate full-period PDFs; verify Razorpay payments.
- Payment Events: body portals, pages, PDFs, compact totals, server wallet ledger, resolved invoices; owner-only menus/PayPal reads. Shared paypalEventCatalog classifies known/future types; Other prevents hiding unknowns.
- Customer webhooks: signed test POST before save; auto-disable after 24h of only failures.
- Isolate developer onboarding from the read-only profile; edits start only from its header edit control.
- Referral forms share validation; guards read saved profiles.
- Referral photos: shared cropper in caller-save mode, referral-only user storage; leave employee/company records untouched.
- Referral profiles keep independent address, OTP-verified unique mobile and photo data; settings/history use routed mobile pages, not dialogs.
- Reuse typed AI-disconnect confirmation for payment cancellations; preserve server behavior.
- Centralize payment defaults/samples; test errors; migrate once preserving edits; report mailbox repairs.
- Only webhook paymentStatusEmail/lifecycle sends receipts; checkout helpers are no-ops.
- Password-recovery routes share a shell and audience OTP/2FA; suppress login redirects to retain the password form.
- Account-change routes share a full-width frame and audience guards; retain OTP across auth updates and scope email drafts per user to prevent resets/leaks.
- Signup uses headerless SignupPage and audience verifiers; switches/legacy redirects retain referral/return queries.
- Public doc catalog drives HTML/copy; refresh all tab snapshots for AI. Guard portal tools.
- Developer OAuth apps: managed only via the authenticated unified-notifications-api subpath (ownership checked); new secrets stay in memory, offered as a local PDF.
- OAuth shares id/email/profile only; never offer or consent to phone scope.
- Sync galleries; previews open originals; Create retains destinations.
- Auth emails use entered OTPs, never links. ConfirmEmailScreen requires a session and stays in loading state until audience redirects unmount it to prevent signup flashes.
- Auth hook, custom signup and email 2FA share the auth email renderer/expiry helpers to prevent audience drift; hosted Supabase Auth expiry must match.
- Share refund helpers for payment history/PDF consistency.
- Domain purchase guards are shared; public cards stream distinct TLDs with fresh marketplace quotes.
- ApplicationSuccessShare is presentation-only; WhatsApp reuse is owner/admin-authorized server-side to protect chats.
- Banner/login caches persist; invalidate on mutations/realtime/reconnect, not polling/focus. Publish both tables. Images use HTTP cache; progress follows Embla.
- Read nested AGENTS.md (src/: search/feed/home/push/job packages). Instagram Login shares normalized exchange/current Graph, separate from Facebook.
- Onboarding shares owner phone rules; phone_change confirms the same Auth phone before locking.
- OnboardingGuard checks confirmed Auth phones; profiles share PhoneVerifyBox and owner locks.
- Support settings are owner/channel/account opt-ins with pre-send checks; synthetic Meta IDs charge the owner. supportWebsiteFacts reads current public contact/policies/FAQs only, preventing stale contacts/private-record leaks. Gmail hourly also runs supportDesk, avoiding duplicate schedules. Meta subscription/signature selection follows login type to keep Page and Instagram apps separate.
- Employee/AI Chat retain guest entry and signed-in guards. PublicIntroductionHero shares photo/mobile framing; callers own login targets.
- Brand asset uploads reuse ImageCropDialog with opt-in circular preview and transparent PNG masking, leaving social/PWA image crops unchanged.
- Favicon and PWA fallbacks use optimized local PNGs derived from the same owner logo, with a separate opaque safe-zone maskable icon; keep runtime and static references aligned.
- Shared brandLogo resolution replaces known superseded artwork in public branding and owner settings with optimized local icons while preserving future owner uploads.
- Notification badge defaults use transparent owner artwork; saved badge changes refresh the existing Firebase worker on save/startup without token or subscription changes. Preserve query configuration/scope and badges/action routing on display fallback; Android/Chrome owns tint.
- Data, auth and edge functions live in the owner's own external Supabase project (ref jubwzelupbntbetpajqb), not Lovable Cloud; never migrate them to Cloud or point the app at another backend — schema changes go through that project.
- Scoped media uploads reuse R2 multipart signing in egress-optimizer with caller-owned keys; email chat copies use a private R2 bucket and mailbox-authorized cleanup, because personal attachments must never become public.
- Email footer previews and both senders use existing social icon/link settings; accept original R2 artwork unchanged so owner updates cannot fall back to stale Supabase images.
- Public BrandSocialBar shares Email Template artwork through a key-filtered settings query; owner writes update its cache and realtime/reconnect refresh it, because separate SVG icons drifted from email settings. Commit media references before cleanup and discard unused uploads on save failure to preserve saved artwork.

- Crawler-visible per-page head: scripts/route-pages.mjs emits <route>.html from src/lib/routeSeo.ts at build; api/job-seo.js renders /job/:id head + JobPosting (404/410 when missing/expired). Why: SPA shell alone gave Google identical descriptions.
- Public Jobs and Resume Builder resource content shares publicCareerContent.mjs between React and route HTML fallbacks; page metadata uses ROUTE_SEO, so visitors and non-JavaScript readers receive the same facts.
- Public website pricing uses the read-only get_public_pricing RPC and shared publicPricing.mjs normalizer for React and Vercel HTML/JSON; never duplicate saved prices or expose customer records/provider costs. Skip static /pricing.html because request-time rendering must retain fresh offers; refresh the open page through realtime plus a visible-page fallback.
- Pricing and job SEO handlers read the bundled dist/index.html (included in both Vercel functions), never fetch the deployment shell over HTTP, because protected deployment URLs return Vercel login HTML instead of the app.
