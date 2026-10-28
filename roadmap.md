# WhatsApp activation and verification
- [x] Add conditional PIN activation before AI Connect WhatsApp settings/profile.
- [x] Show English Meta business verification guidance and actual limits without promising approval.
- [x] Pass six setup/PIN tests and four media regression tests; Deno-check both functions. Deploy `workly-india` and `whatsapp-cloud-api` to external Supabase (existing runtime settings retained); confirm protected endpoints respond and signed-out settings redirect without runtime errors.
- [ ] Verify actual connected-number PIN activation and completed-state UI; blocked: external Supabase authenticated preview session unavailable.

# Google Business Profile integration
- [x] Add GBP connect option on AI Connect page (user connects GBP, AI auto-replies to reviews).
- [x] Add GBP connect on owner Customer Service page (website support auto-reply help for reviews).
- [x] Supabase: already connected to owner's external project (Workly india) — no action needed.
- [ ] Signed-in end-to-end check (connect → location list → preview replies); blocked: external Supabase preview session unavailable.

# Requested Edge Function deployment
- [x] Identify the Google Business Profile deployment target (`unified-google-api`) and pass its Deno check.
- [x] Deploy `unified-google-api` source directly to external Supabase `jubwzelupbntbetpajqb` using connected deployment access, without GitHub. Deployment tool reports existing runtime settings retained rather than updated.
- [x] Verify deployed function responds: Google user-connect probe with an intentionally invalid token returns the application's HTTP 401 `Sign in required`, not a startup error.
- [ ] Verify the user's reported Google connection error while signed in; blocked: external Supabase preview session unavailable. Runtime settings update was not confirmed by the deployment tool.

# Jobs and Resume Builder search content
- [x] Improve existing page descriptions and useful public content using verified website capabilities.
- [x] Verify crawler-visible output, three route SEO tests and signed-out page rendering/links without runtime errors.
- [ ] Verify new Jobs/Resume text on the public domain; blocked until Vercel deploys these changes (live pages still have previous titles).

# Public pricing
# Current public contact and social links
- [x] Use Contact Us and owner-saved social links in public HTML, structured data and AI feeds without stale fallback identities.
- [ ] Test anonymous current-data reads and updates/removals; identify live deployment/index refresh limitations.

# Public pricing
- [x] Read owner-saved pricing sources and verify anonymous access in existing Supabase.
- [x] Build complete mobile-friendly public Pricing page and More entry.
- [x] Provide request-time crawler-readable prices, structured offers, JSON, metadata and discovery links.
- [x] Pass 16 focused tests; verify real saved prices, More/back/refresh/category flows, desktop/mobile rendering and initial HTML/JSON.

# Login and public pricing repairs
- [x] Fix Employee login hook-order crash and pass its regression check; signed-out form verified. Authenticated end-to-end testing is unavailable for external Supabase.
- [x] Serve Pricing from bundled website HTML, never a protected Vercel login response; anonymous HTML regression and real saved prices verified on desktop/mobile preview. Apply the same shell repair to job pages.
- [x] Verify repaired live Pricing response: HTTP 200, Website Pricing title and public price data, no Vercel login HTML.