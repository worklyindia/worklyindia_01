# Har page ka alag Google search result (Per-page SEO)

## Problem
Google par har page ka description same aata hai ("India's #1 work from home job portal..."). Website ek hi base page se chalti hai, aur Google pehli baar wahi same base text padhta hai. Page ka asli title/description baad me load hota hai, isliye Google sab pages ko ek jaisa dikhata hai.

## Kya banega
1. **Har page ka apna title, description, keywords, share image aur sahi link (canonical)** — website publish hote waqt har page ki alag ready copy banegi, taaki Google ko pehli nazar me hi sahi info mile.
2. **Pages jo cover honge:**
   - About Us, Mission & Vision, Why Choose Workly India, Blog (+ har blog post), Trust & Safety, Employer / Job Seeker / Community Guidelines, Accessibility, Privacy, Refund & Cancellation, Terms & Conditions, FAQ, Disclaimer, DMCA / Copyright, Cookie Policy, Contact Us, Sitemap, Careers, Press / Media Kit
   - Refer page, Resume page, Job seeker login, Employer login, Employer page, Developer page (+ Developer menu ke saare document pages), Jobs page (+ category/location pages), AI Chat page, Job Post page
   - Developer FAQ aur Website FAQ — dono ka alag SEO + FAQ structured info
3. **Har job ka automatic SEO** — naya job post hote hi uske URL par job title, company, location, salary wala apna title/description + Google Jobs format (JobPosting) banega. Job band/expire hone par Google ko sahi signal milega.
4. **Login/private pages** (dashboard, settings, wallet etc.) Google me index nahi honge — sirf public pages dikhenge.
5. **404 se bachav** — sitemap me sirf asli, chalne wale pages honge; purane/redirect URLs (jaise /contact, /copyright, /cookies) sitemap se hatenge; galat URL par asli 404 status milega taaki Search Console me "soft 404" error na aaye.
6. Jobs aur blog sitemap naye jobs/posts ke saath update hote rahenge.

## Technical details
- Root cause: Vercel rewrites every path to one static `index.html`; `react-helmet-async` tags only apply after JS runs, so Google's first fetch sees identical head.
- Central route SEO registry (`src/config/seoRoutes.ts`): path -> title, description, keywords, canonical, robots, JSON-LD type (Organization/WebPage/FAQPage/BreadcrumbList/AboutPage/ContactPage). Reused by `RouteSEO`/`SEO` client-side and by the build script, so both always match.
- Build step `scripts/prerender-seo.mjs` (after `vite build`): writes `dist/<route>/index.html` with route-specific head; Vercel serves real files before the catch-all rewrite. Doc pages read from the existing doc catalog; blog posts fetched from the owner's Supabase at build.
- Dynamic jobs: Vercel serverless/edge function for `/jobs/:id` (and external job detail) that fetches the job from the owner's Supabase (ref jubwzelupbntbetpajqb, anon read) and injects title/description/canonical/JobPosting JSON-LD into `index.html`; returns 404/410 for missing or expired jobs. Short CDN cache so new jobs appear immediately.
- Unknown paths: function returns 404 status with the app shell for routes not in the registry/router list.
- Sitemaps: audit `public/*sitemap*.xml` and `generate-dynamic-sitemaps.mjs`, drop redirect/private/404 URLs, keep base domain unchanged, no fake `lastmod`.
- Private routes get `noindex` in registry; `robots.txt` reviewed, not replaced.
- Small tests for the registry: every public route has unique title + description, private routes are noindex.
- Changes reach Google only after the next publish/deploy and Google re-crawl (Search Console "Request indexing" speeds it up).
