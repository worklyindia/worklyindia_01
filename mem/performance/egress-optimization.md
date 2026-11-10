---
name: Egress Optimization
description: Supabase free tier egress strategy — proxy Storage images through wsrv.nl (free, auto-WebP) since render endpoint is paid-only
type: preference
---
Supabase Free plan = 5GB Cached Egress / month. Storage Image Transformations are NOT available on Free plan (render endpoint returns 403), so we proxy Storage images through **wsrv.nl** — a free Cloudflare-backed image resizer with auto WebP and global cache.

**Rules for any new `<img>` rendering a Supabase Storage URL:**

1. Wrap src with `storageImageUrl(url, width)` from `@/utils/imageUrl` — now routes through `https://wsrv.nl/?url=...&w=X&q=70&output=webp`.
2. Add `loading="lazy"` and `decoding="async"`.
3. Width hints by context: avatar 96–128, card thumb 400, hero/full 1280.
4. Always set `cacheControl: "31536000"` (1 year) on Storage uploads.
5. Do NOT call the Supabase render endpoint directly — it 403s on Free plan and poisons CDN cache.
6. Don't purge `ai-engagement-images` bucket — leave existing buckets alone.

Helpers (all proxy via wsrv.nl now):
- `storageImageUrl(url, w, q)` — `src/utils/imageUrl.ts`
- `sbImage / sbAvatar / sbThumb / sbSrcSet` — `src/lib/supabaseImage.ts`
- `cdnImage(url, {w,h,q})` in `src/lib/mediaCdn.ts` (Supabase branch uses wsrv.nl)

Non-Supabase URLs (Cloudinary, ImageKit, asset CDN, data:, blob:, local) pass through unchanged.
