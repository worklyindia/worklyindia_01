# CDN Services Setup — Cloudflare · ImageKit · Cloudinary

Job portal ke liye 3 services ka **complete map** — kya milta hai, kya configure hai, kaise use karna hai.

---

## ✅ Currently Configured Secrets

| Secret | Service | Purpose |
|--------|---------|---------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | Account identifier |
| `CLOUDINARY_API_KEY` | Cloudinary | Upload auth |
| `CLOUDINARY_API_SECRET` | Cloudinary | Sign upload requests |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit | Client-side SDK |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit | Server upload auth |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit | Base CDN URL |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | API auth |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Account scope |
| `CLOUDFLARE_ZONE_ID` | ⏸ pending | Cache purge (Vercel-deployed, optional) |

---

## ☁️ CLOUDINARY — Primary Image/Video Host

**Free tier:** 25 GB storage + 25 GB bandwidth/month + unlimited transformations.

### What it does for a job site:
| Feature | Use case in your project |
|---------|--------------------------|
| **Image upload + auto-optimize** | Company logos, profile pics, blog covers, banners |
| **On-the-fly transformation** | One source → infinite sizes (avatar, thumbnail, card, hero) |
| **Auto WebP/AVIF** | `f_auto` serves AVIF to Chrome, WebP to Safari |
| **Face-detect crop** | Profile avatars cropped to face automatically |
| **Video hosting** | Job intro videos, employer brand videos |
| **PDF preview** | Resume PDFs → JPG thumbnails |
| **OG image generation** | Dynamic share cards for jobs/blogs (text overlay) |
| **AI background removal** | Clean up user-uploaded logos |
| **Watermark overlay** | Brand logo on shared images |

### How to use (already wired):
```ts
import { uploadImage, cldAvatar, cldCard, cldOgImage, cldSrcSet } from "@/lib/mediaCdn";

// Upload
const { url } = await uploadImage(file, { folder: "company-logos" });

// Transform (no API call — pure URL build)
<img src={cldAvatar(url, 64)} />              // 64x64 face crop
<img src={cldCard(url, 600)} />               // 600x338 card thumb
<img srcSet={cldSrcSet(url)} src={url} />     // Responsive

// OG image for social shares
const og = cldOgImage("Frontend Developer", "Acme Corp");
// → https://res.cloudinary.com/<cloud>/image/upload/w_1200,h_630,.../og-base.png
```

---

## 🖼️ IMAGEKIT — Fallback CDN + Real-Time Optimization

**Free tier:** 20 GB bandwidth + 20 GB storage/month.

### What it does:
| Feature | Use case |
|---------|----------|
| **Auto fallback** | If Cloudinary fails/quota → ImageKit takes over |
| **URL-based transforms** | `?tr=w-400,h-400,q-80,f-auto` |
| **Smart cropping** | Face-aware focal point |
| **Image search by AI tags** | Auto-tag uploaded images |
| **Video CDN** | HLS streaming support |
| **DAM (Digital Asset Manager)** | Browse/manage uploads in dashboard |

### How to use (already wired):
```ts
import { uploadToImageKit, ikAvatar, ikCard } from "@/lib/mediaCdn";

const { data } = await uploadToImageKit(file, { fileName: "logo.png", folder: "/logos" });
<img src={ikAvatar(data.url, 96)} />
<img src={ikCard(data.url, 600)} />
```

### Universal helper:
```ts
import { cdnImage } from "@/lib/mediaCdn";
// Auto-detects host (Cloudinary OR ImageKit) and applies right transform
<img src={cdnImage(anyUrl, { w: 400 })} />
```

---

## 🟧 CLOUDFLARE — Edge, Cache, Security, Analytics

**Free tier:** Unlimited bandwidth + 100K requests/day on Workers.

### What it does for a job site:
| Service | Status | Use case |
|---------|--------|----------|
| **CDN/Cache** | ✅ Active via Vercel | Static asset caching |
| **Cache Purge API** | ⏸ Pending `ZONE_ID` | Force-refresh cached pages after job edit |
| **Turnstile (CAPTCHA)** | 🔧 Recommended | Free reCAPTCHA alternative for signup, job-apply, contact forms |
| **Web Analytics** | 🔧 Recommended | Free privacy-friendly analytics (no cookies) |
| **R2 Object Storage** | 🔧 Optional | Resume PDFs, bulk file storage (no egress fees!) |
| **Workers** | 🔧 Optional | Edge logic, A/B tests |
| **Email Routing** | 🔧 Optional | `careers@yourdomain.com` → personal inbox (free) |
| **DNS** | 🔧 Optional | Move domain DNS for faster propagation |
| **WAF + DDoS** | ✅ Auto on free | Bot/attack protection |
| **Bot Fight Mode** | 🔧 Recommended | Block scrapers stealing jobs |

### How to add the 3 high-value free services later (no code yet, just signal):

#### 1. Turnstile CAPTCHA (replace any reCAPTCHA, protect signups)
- Cloudflare Dashboard → Turnstile → "Add Site" → get `site_key` + `secret_key`
- Add as Lovable secrets: `TURNSTILE_SITE_KEY` (public, OK in code) + `TURNSTILE_SECRET` (server)
- Tell me when ready and I'll wire it into Auth + ContactForm + JobApply.

#### 2. Web Analytics (replace GA4 if desired, privacy-first)
- Cloudflare Dashboard → Analytics → Web Analytics → add site → paste 1-line script in `index.html`
- No code change needed from agent; you can paste yourself or ask me.

#### 3. R2 Storage (resumes, bulk PDFs, ZERO egress fees)
- Better than Supabase Storage for large/heavy downloadables
- Need: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID`
- Tell me when ready, I'll add an `r2-upload` edge function.

---

## 🎯 Recommended Routing Strategy (what to host where)

| Asset Type | Recommended Host | Why |
|------------|------------------|-----|
| Company logos, avatars | **Cloudinary** | Face-crop + auto-format |
| Blog cover images | **Cloudinary** | OG image generation |
| Job share OG cards | **Cloudinary** | Text overlay |
| User-uploaded screenshots | **ImageKit** | Bandwidth fallback |
| Resumes (PDF) | **Cloudflare R2** (when added) | Zero egress on downloads |
| Static UI assets | **Vercel + Cloudflare cache** | Already optimal |
| Wallpapers (bundled) | **Vite bundle (WebP)** ✅ done | Cached forever, immutable |

---

## 🔧 Edge Function: `media-cdn`

Single function handles all 3 providers. Endpoints:
- `health` — check which secrets are wired
- `upload-cloudinary` — sign + upload (used by `uploadImage`)
- `upload-imagekit` — multipart upload (fallback)
- `cf-purge` — purge specific URLs (needs ZONE_ID)
- `cf-purge-all` — full zone purge (use sparingly)

**Deploy when on paid Supabase plan:**
```
supabase functions deploy media-cdn
```

---

## 📊 Monthly Egress Math (with this setup)

| Source | Before | After |
|--------|--------|-------|
| Wallpapers (bundled WebP) | Supabase Storage 7MB × visits | **Vite cache, ~0** |
| Company logos | Supabase Storage | **Cloudinary 25GB free** |
| Blog images | Supabase Storage | **Cloudinary auto-WebP** |
| Profile pics | Supabase Storage | **Cloudinary face-crop** |
| Static pages | Supabase render | **Vercel + Cloudflare edge cache** |

**Result:** Supabase egress drops ~80%, Cloudinary handles peak with free tier covering ~10K daily visits.

---

## ✅ TL;DR — What's Active vs Pending

| Done now |
| --- |
| Cloudinary upload + transform (avatars, cards, OG, srcSet) |
| ImageKit fallback upload + transform |
| Cloudflare API token (purge ready when ZONE_ID added) |
| Universal `cdnImage()` helper auto-detects host |
| Edge function `media-cdn` ready to deploy |

| Pending (tell me when you want each) |
| --- |
| `CLOUDFLARE_ZONE_ID` → enable cache purge |
| Turnstile CAPTCHA → bot-proof signup/apply forms |
| Cloudflare Web Analytics → privacy-first stats |
| Cloudflare R2 → resume/PDF storage with zero egress |
| Cloudflare Email Routing → custom domain inbox |
