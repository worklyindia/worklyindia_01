# Deployment Guide

## Environment Variables Required

Both Netlify and Vercel require these environment variables:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Netlify Deployment

### Quick Setup
1. Connect your GitHub repository to Netlify
2. Build settings are auto-detected from `netlify.toml`
3. Add environment variables in Site Settings → Environment Variables
4. Deploy!

### Build Settings (Auto-configured)
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Node Version:** 18

### Features Included
- ✅ SPA routing with fallback to index.html
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ Asset caching (1 year for static assets)
- ✅ HTML no-cache for fresh content
- ✅ CSS/JS minification and bundling
- ✅ Image compression

---

## Vercel Deployment

### Quick Setup
1. Import your GitHub repository in Vercel
2. Framework is auto-detected as Vite
3. Add environment variables in Project Settings → Environment Variables
4. Deploy!

### Build Settings (Auto-configured via vercel.json)
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Region:** Mumbai (bom1) for India-focused apps

### Features Included
- ✅ SPA routing with rewrites
- ✅ Security headers
- ✅ Asset caching (1 year for static assets)
- ✅ Clean URLs (no .html extensions)
- ✅ Edge Network optimization

---

## Troubleshooting

### Build Fails
- Ensure Node.js 18 is used
- Check environment variables are set
- Run `npm run build` locally to verify

### 404 on Page Refresh
- SPA routing is configured, but verify redirects are active
- Netlify: Check `[[redirects]]` in netlify.toml
- Vercel: Check `rewrites` in vercel.json

### Supabase Connection Issues
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase project is active and not paused

---

## Performance Optimizations

### Caching Strategy
| Resource Type | Cache Duration |
|--------------|----------------|
| index.html | No cache (always fresh) |
| /assets/* | 1 year (immutable) |
| *.js, *.css | 1 year (immutable) |

### Security Headers Applied
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: Restricted camera, microphone, geolocation

---

## Quick Commands

```bash
# Local development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npx tsc --noEmit
```
