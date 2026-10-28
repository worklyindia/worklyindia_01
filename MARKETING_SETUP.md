# Marketing & Monitoring Setup Guide

## 🎯 Overview
Your website now has integrated error monitoring and marketing tools. Follow these steps to complete the setup.

---

## 1. ✅ Sentry Error Monitoring (CONFIGURED)

**Status:** ✅ Integrated and configured

The Sentry DSN has been added to your secrets. Sentry will:
- Capture all JavaScript errors automatically
- Record user sessions when errors occur
- Track performance issues
- Send alerts for critical errors

**What's working:**
- Error boundary integration
- Automatic error reporting
- Session replay on errors
- Performance monitoring

**No action needed** - Sentry is ready to use!

---

## 2. 📊 Google Analytics 4 (ALREADY CONFIGURED)

**Status:** ✅ Already working

Your GA4 tracking ID: `G-4498933555`

**What's tracking:**
- Page views
- Job applications
- Resume downloads
- Search queries
- User registrations
- And 15+ custom events

**Features:**
- Automatic page view tracking
- Custom event tracking via `src/utils/ga4Events.ts`
- E-commerce tracking ready

**No action needed** - GA4 is fully operational!

---

## 3. 📱 Meta Pixel (Facebook/Instagram Ads)

**Status:** ⚠️ Needs configuration

**To complete setup:**

1. Go to [Facebook Events Manager](https://business.facebook.com/events_manager/)
2. Create a Pixel or use existing one
3. Copy your Pixel ID
4. Open `index.html` and replace `YOUR_PIXEL_ID` with your actual ID (line 395 and line 441)

Example:
```javascript
fbq('init', '1234567890'); // Replace with your Pixel ID
```

**What will track:**
- Page views
- Lead generation
- Registration completions
- Job applications
- Search activity
- Content views

**Files involved:**
- `index.html` - Meta Pixel script
- `src/utils/marketing.ts` - Event tracking functions

---

## 4. 🔍 Microsoft Clarity

**Status:** ⚠️ Needs configuration

**To complete setup:**

1. Go to [Microsoft Clarity](https://clarity.microsoft.com/)
2. Create a project
3. Copy your Clarity ID
4. Open `index.html` and replace `YOUR_CLARITY_ID` with your actual ID (line 401)

Example:
```javascript
"clarity", "script", "abc123xyz"); // Replace with your Clarity ID
```

**What you'll get:**
- Session recordings
- Heatmaps
- User behavior analytics
- Rage clicks detection
- Dead clicks analysis
- Scroll depth tracking

**Files involved:**
- `index.html` - Clarity script
- `src/utils/marketing.ts` - Custom event tracking
- `src/utils/secureClarity.ts` - Edge function integration

---

## 📈 How to Use Marketing Events

### Track Custom Events

```typescript
import { 
  trackMetaPixelEvent, 
  trackClarityEvent 
} from '@/utils/marketing';

// Track Meta Pixel event
trackMetaPixelEvent('Purchase', { 
  value: 299, 
  currency: 'INR' 
});

// Track Clarity event
trackClarityEvent('user_upgraded', { 
  plan: 'premium' 
});
```

### Track Job Application
```typescript
import { trackJobApplication } from '@/utils/ga4Events';
import { trackMetaSubmitApplication } from '@/utils/marketing';

// Track in GA4
trackJobApplication(jobId, jobTitle, companyName);

// Track in Meta Pixel
trackMetaSubmitApplication({ 
  job_id: jobId,
  job_title: jobTitle 
});
```

---

## 🔐 Security Notes

1. **Sentry DSN**: Stored securely in Supabase secrets ✅
2. **Meta Pixel ID**: Public identifier - safe to use in HTML ✅
3. **Clarity ID**: Public identifier - safe to use in HTML ✅
4. **GA4 ID**: Public identifier - already configured ✅

---

## 📊 Analytics Dashboard Access

| Tool | Dashboard URL | What to Monitor |
|------|--------------|-----------------|
| **Sentry** | https://sentry.io | Errors, performance issues |
| **GA4** | https://analytics.google.com | Traffic, conversions, events |
| **Meta Pixel** | https://business.facebook.com/events_manager | Ad performance, conversions |
| **Clarity** | https://clarity.microsoft.com | User behavior, heatmaps |

---

## 🚀 Next Steps

1. ✅ Sentry - Ready to use
2. ✅ Google Analytics - Already tracking
3. ⚠️ Replace `YOUR_PIXEL_ID` in `index.html` (line 395)
4. ⚠️ Replace `YOUR_CLARITY_ID` in `index.html` (line 401)
5. 🎯 Test everything by visiting your site
6. 📊 Check dashboards after 24 hours

---

## 💡 Pro Tips

1. **Test Events**: Use browser console to verify events are firing
   ```javascript
   window.fbq('track', 'TestEvent'); // Meta Pixel test
   window.clarity('event', 'test'); // Clarity test
   ```

2. **Verify GA4**: Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger)

3. **Check Sentry**: Errors will appear in your Sentry dashboard immediately

4. **Monitor Performance**: Check Sentry's Performance tab for slow operations

---

## 📞 Need Help?

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/react/
- **GA4 Docs**: https://support.google.com/analytics/
- **Meta Pixel Docs**: https://www.facebook.com/business/help/742478679120153
- **Clarity Docs**: https://docs.microsoft.com/en-us/clarity/

---

**Status Summary:**
- ✅ Error Monitoring: Fully configured
- ✅ Analytics: Fully configured  
- ⚠️ Meta Pixel: Needs ID
- ⚠️ Clarity: Needs ID

**Completion: 50%** (2 of 4 tools ready)
