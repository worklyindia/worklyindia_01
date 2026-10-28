# WhatsApp Job Sharing Integration

This document explains the WhatsApp job sharing improvements implemented to fix formatting and link issues.

## Features

### 1. URL Shortener (`/j/:shortId`)

Short, reliable URLs for job listings that work perfectly in WhatsApp messages.

**Example:**
- Before: `https://worklyindia.devs.surf/job/951155a9-0728-4851-bcf5-ac3d708e16ec`
- After: `https://worklyindia.devs.surf/j/abc123`

**How it works:**
- Uses the existing `short_id` column in the `jobs` table
- Redirects to the full job detail page
- Tracks clicks for analytics (when `url_clicks` table is created)

### 2. WhatsApp Message Formatter

Utility functions to create beautifully formatted job messages for WhatsApp.

**Location:** `src/utils/whatsappFormatter.ts`

**Example Output:**
```
1. 🎯 *Software Engineer*
   📍 Mumbai, Maharashtra
   💼 Full Time | 3-5 years
   💰 ₹50,000 - ₹80,000/month
   🏢 Tech Corp
   📂 IT & Software
   👉 Apply: https://worklyindia.devs.surf/j/abc123

✨ *Workly India* - Workly India Jobs
🌐 worklyindia.devs.surf
```

### 3. Improved Error Handling

Better error messages when users click job links from external apps:

- ✅ Shows specific reasons when jobs aren't available (expired, closed, removed)
- ✅ Provides helpful descriptions and next steps
- ✅ Logs referrer information for debugging
- ✅ Graceful handling for invalid links

### 4. Share Component

Easy-to-use component for sharing jobs on WhatsApp:

**Location:** `src/components/ShareJobWhatsApp.tsx`

**Usage:**
```tsx
import { ShareJobWhatsApp } from '@/components/ShareJobWhatsApp';

<ShareJobWhatsApp 
  job={jobData}
  variant="outline"
  size="sm"
/>
```

## Usage Examples

### Format a single job message:

```typescript
import { formatJobForWhatsApp } from '@/utils/whatsappFormatter';

const message = formatJobForWhatsApp({
  id: '123',
  title: 'Software Engineer',
  city: 'Mumbai',
  state: 'Maharashtra',
  job_type: 'Full Time',
  experience_level: '3-5 years',
  salary_min: 50000,
  salary_max: 80000,
  company_name: 'Tech Corp',
  category: 'IT & Software',
  short_id: 'abc123'
});

// Send via WhatsApp
const whatsappUrl = `https://wa.me/919904923067?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank');
```

### Format multiple jobs:

```typescript
import { formatJobsForWhatsApp } from '@/utils/whatsappFormatter';

const message = formatJobsForWhatsApp(jobs, '🚀 *Latest Job Openings*');

// Send via WhatsApp
const whatsappUrl = `https://wa.me/919904923067?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank');
```

### Get short URL for a job:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Option 1: Use existing short_id from database
const { data: job } = await supabase
  .from('jobs')
  .select('short_id')
  .eq('id', jobId)
  .single();

const shortUrl = `https://worklyindia.devs.surf/j/${job.short_id}`;

// Option 2: Use edge function to generate (if you need API access)
const { data } = await supabase.functions.invoke('url-shortener', {
  body: { job_id: jobId }
});

console.log(data.short_url); // https://worklyindia.devs.surf/j/abc123
```

## API Endpoints

### POST /url-shortener
Create a short URL for a job

**Request:**
```json
{
  "job_id": "951155a9-0728-4851-bcf5-ac3d708e16ec"
}
```

**Response:**
```json
{
  "short_url": "https://worklyindia.devs.surf/j/abc123",
  "short_id": "abc123",
  "job_id": "951155a9-0728-4851-bcf5-ac3d708e16ec",
  "job_title": "Software Engineer"
}
```

### GET /url-shortener/:shortId
Redirect to full job URL (handled by edge function)

## Benefits

✅ **Better Readability:** Clear, formatted messages instead of Markdown links  
✅ **Shorter URLs:** Easy to click and share  
✅ **Reliable Links:** Better error handling and tracking  
✅ **Mobile-Friendly:** Optimized for WhatsApp and mobile browsers  
✅ **Professional:** Consistent branding and formatting  

## Next Steps

1. **Create `url_clicks` table** (optional) to track short URL analytics:
```sql
CREATE TABLE url_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id TEXT NOT NULL,
  job_id UUID REFERENCES jobs(id),
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

2. **Update your WhatsApp Business templates** to use the new formatter

3. **Consider adding a "Copy Link" button** that uses short URLs

4. **Monitor analytics** to see which jobs get the most clicks from WhatsApp
