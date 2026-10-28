import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

import { WEBSITE_DOMAIN } from "../_shared/domain.ts";
const SITE_URL = WEBSITE_DOMAIN;
const INDEXNOW_KEY = '4b6258d87a9945a7b7c142a90c49d4dc';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting scheduled jobs publication check...')

    // Find jobs that should be published now
    const { data: scheduledJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('publish_mode', 'schedule')
      .lte('scheduled_publish_at', new Date().toISOString())
      .in('status', ['scheduled', 'draft', 'inactive'])

    if (fetchError) {
      console.error('Error fetching scheduled jobs:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scheduled jobs' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Found ${scheduledJobs?.length || 0} jobs to publish`)

    let publishedCount = 0
    const indexingResults: any[] = []

    if (scheduledJobs && scheduledJobs.length > 0) {
      for (const job of scheduledJobs) {
        try {
          const now = new Date().toISOString()
          const updates: any = {
            status: 'active',
            published_at: now,
            updated_at: now
          }

          // If it's a premiere job and no premiere start time is set, set it now
          if (job.is_premiere && !job.premiere_start_at) {
            updates.premiere_start_at = now
          }

          // Generate slug for unlisted jobs if not exists
          if (job.visibility === 'unlisted' && !job.public_slug) {
            const { data: slugData } = await supabase.rpc('generate_job_slug')
            if (slugData) {
              updates.public_slug = slugData
            }
          }

          const { error: updateError } = await supabase
            .from('jobs')
            .update(updates)
            .eq('id', job.id)

          if (updateError) {
            console.error(`Error publishing job ${job.id}:`, updateError)
          } else {
            console.log(`Successfully published job: ${job.title} (${job.id})`)
            publishedCount++

            // Update trending score for newly published job
            await supabase.rpc('update_job_trending_score', { job_id: job.id })

            // **NEW: Create indexing status entry with Schedule status**
            const jobUrl = `${SITE_URL}/job/${job.id}`
            const indexResult = await createIndexingStatusOnPublish(supabase, job.id, jobUrl, now)
            indexingResults.push({ job_id: job.id, ...indexResult })
          }
        } catch (jobError) {
          console.error(`Error processing job ${job.id}:`, jobError)
        }
      }
    }

    console.log(`Published ${publishedCount} jobs successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Published ${publishedCount} scheduled jobs`,
        publishedJobs: publishedCount,
        indexingResults
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in publish-scheduled-jobs function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Create indexing status entry when job is published
 * Flow: Schedule → Submitted → Public
 * 
 * 1. Creates entry with 'scheduled' status for both Google and Bing
 * 2. Immediately submits to IndexNow (Bing)
 * 3. Adds to Google indexing queue
 * 4. Updates status to 'submitted' after successful submission
 */
async function createIndexingStatusOnPublish(
  supabase: any, 
  jobId: string, 
  jobUrl: string,
  publishedAt: string
): Promise<any> {
  const now = new Date().toISOString()
  
  try {
    // Step 0: Check if entry already exists with submitted timestamps
    // If already submitted, skip to avoid overwriting timestamps
    // Use maybeSingle() for safe handling when no entry exists
    const { data: existingEntry } = await supabase
      .from('job_indexing_status')
      .select('id, google_submitted_at, bing_submitted_at, google_status, bing_status')
      .eq('job_id', jobId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    // If already fully submitted, skip re-submission
    if (existingEntry?.google_submitted_at && existingEntry?.bing_submitted_at) {
      console.log(`[Indexing] Job ${jobId} already submitted, skipping to preserve timestamps`)
      return { 
        success: true, 
        skipped: true,
        reason: 'already_submitted',
        google_status: existingEntry.google_status,
        bing_status: existingEntry.bing_status,
        google_submitted_at: existingEntry.google_submitted_at,
        bing_submitted_at: existingEntry.bing_submitted_at
      }
    }
    
    // Step 1: Create entry with 'scheduled' status (only if not exists)
    console.log(`[Indexing] Creating scheduled entry for job ${jobId}`)
    
    if (!existingEntry) {
      const { error: insertError } = await supabase
        .from('job_indexing_status')
        .insert({
          job_id: jobId,
          url: jobUrl,
          google_status: 'scheduled',
          google_scheduled_at: now,
          is_google_public: false,
          bing_status: 'scheduled',
          bing_scheduled_at: now,
          is_bing_public: false,
          overall_status: 'pending',
          created_at: now,
          updated_at: now
        })

      if (insertError) {
        console.error(`[Indexing] Error creating status entry:`, insertError)
        return { success: false, error: insertError.message }
      }
    }

    // Step 2: Submit to IndexNow (Bing/Yandex) - instant (only if not already submitted)
    let indexNowResult = { bing: false, yandex: false }
    if (!existingEntry?.bing_submitted_at) {
      console.log(`[Indexing] Submitting to IndexNow: ${jobUrl}`)
      indexNowResult = await submitToIndexNow(jobUrl)
      
      // Update status to 'submitted' for Bing
      await supabase
        .from('job_indexing_status')
        .update({
          bing_status: 'submitted',
          bing_submitted_at: now,
          updated_at: now
        })
        .eq('job_id', jobId)
    } else {
      console.log(`[Indexing] Bing already submitted for job ${jobId}, skipping`)
    }
    
    // Step 3: Add to Google indexing queue (only if not already submitted)
    if (!existingEntry?.google_submitted_at) {
      console.log(`[Indexing] Adding to Google queue: ${jobUrl}`)
      await supabase
        .from('google_indexing_queue')
        .upsert({
          url: jobUrl,
          action: 'URL_UPDATED',
          status: 'pending',
          source: 'scheduled_publish',
          job_id: jobId,
          priority: 5,
          retry_count: 0,
          created_at: now
        }, { onConflict: 'url' })

      // Try to invoke job-indexing-webhook for Google immediate submission
      try {
        await supabase.functions.invoke('job-indexing-webhook', {
          body: {
            type: 'INSERT',
            table: 'jobs',
            record: { id: jobId, status: 'active' }
          }
        })
        
        // Update Google status to submitted
        await supabase
          .from('job_indexing_status')
          .update({
            google_status: 'submitted',
            google_submitted_at: now,
            updated_at: now
          })
          .eq('job_id', jobId)

        console.log(`[Indexing] Google submitted for job ${jobId}`)
      } catch (googleErr) {
        console.log(`[Indexing] Google queue scheduled for job ${jobId}`)
      }
    } else {
      console.log(`[Indexing] Google already submitted for job ${jobId}, skipping`)
    }

    console.log(`[Indexing] Status created for job ${jobId}: Google=submitted, Bing=submitted`)
    
    return { 
      success: true, 
      google_status: 'submitted',
      bing_status: 'submitted',
      indexnow_result: indexNowResult
    }

  } catch (error) {
    console.error(`[Indexing] Error for job ${jobId}:`, error)
    return { success: false, error: String(error) }
  }
}

/**
 * Submit URL to IndexNow for instant Bing/Yandex indexing
 */
async function submitToIndexNow(url: string): Promise<{ bing: boolean; yandex: boolean }> {
  const results = { bing: false, yandex: false }
  
  try {
    // Bing IndexNow
    const bingResponse = await fetch(
      `https://www.bing.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
      { method: 'GET' }
    )
    results.bing = bingResponse.ok || bingResponse.status === 202
    console.log(`[IndexNow] Bing: ${bingResponse.status}`)
    
    // Yandex IndexNow
    const yandexResponse = await fetch(
      `https://yandex.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
      { method: 'GET' }
    )
    results.yandex = yandexResponse.ok || yandexResponse.status === 202
    console.log(`[IndexNow] Yandex: ${yandexResponse.status}`)
    
  } catch (error) {
    console.error('[IndexNow] Error:', error)
  }
  
  return results
}