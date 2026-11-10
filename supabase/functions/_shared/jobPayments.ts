// Razorpay-only payments for job posting, job extension and interview scheduling.
// Prices are stored in ₹ (legacy "points" columns hold rupee values, 1 point = ₹1).

export type JobPaymentPurpose = 'job_posting' | 'job_extension' | 'interview';

// Must match the website price calculation in src/hooks/useInterviewPricing.ts
const VIDEO_MODES = ['100ms', '100ms_iframe', 'videosdk', 'videosdk_iframe'];

export async function priceForMonths(supabase: any, months: number): Promise<number> {
  const m = Math.max(1, Math.min(24, Math.floor(Number(months) || 1)));
  // Several rows can be active; use the latest one, exactly like the website does.
  const { data } = await supabase
    .from('job_posting_settings')
    .select('duration_packages, points_required_per_job')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const pkgs = Array.isArray(data?.duration_packages) ? data.duration_packages : [];
  const pkg = pkgs.find((p: any) => Number(p?.months) === m && p?.is_active !== false);
  // Owner page edits `points`; `price` is a legacy mirror that can be stale.
  const price = Number(pkg?.points ?? pkg?.price);
  if (price > 0) return Math.round(price);
  const base = Number(data?.points_required_per_job) || 50;
  return Math.round(base * m);
}

export async function priceForInterviews(
  supabase: any,
  count: number,
  scheduledAt: string,
  scheduledEndAt: string | null | undefined,
  mode: string,
): Promise<number> {
  const { data } = await supabase
    .from('interview_pricing_settings')
    .select('points_per_interview, points_per_minute, minimum_points, enable_duration_pricing')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const perInterview = Number(data?.points_per_interview) || 1;
  const perMinute = Number(data?.points_per_minute) || 0;
  const minimum = Number(data?.minimum_points) || 0;
  const durationEnabled = data?.enable_duration_pricing !== false;
  const start = new Date(scheduledAt).getTime();
  const end = new Date(scheduledEndAt || scheduledAt).getTime();
  const minutes = Math.max(1, Math.ceil((end - start) / 60000));
  let total = count * perInterview;
  if (durationEnabled && perMinute > 0 && VIDEO_MODES.includes(mode)) total += count * minutes * perMinute;
  return Math.max(1, Math.round(Math.max(total, minimum)));
}

export async function assertJobOwner(supabase: any, jobId: string, userId: string) {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, title, company_id, status, expires_at, scheduled_publish_at, publish_mode')
    .eq('id', jobId)
    .single();
  if (error || !job) throw new Error('Job not found');
  if (job.company_id) {
    const { data: company } = await supabase.from('companies').select('user_id').eq('id', job.company_id).maybeSingle();
    if (company?.user_id && company.user_id !== userId) throw new Error('Not authorized for this job');
  }
  return job;
}

const addMonths = (d: Date, months: number) => {
  const n = new Date(d);
  n.setMonth(n.getMonth() + months);
  return n;
};

/** Executes the paid action once the Razorpay payment is verified. */
export async function fulfillJobPayment(supabase: any, pending: any, paymentId: string) {
  const p = pending.payload || {};
  const amount = pending.amount_inr;

  if (pending.purpose === 'job_posting') {
    const job = await assertJobOwner(supabase, p.job_id, pending.user_id);
    const now = new Date();
    const scheduled = p.target_status === 'scheduled' && job.scheduled_publish_at;
    const start = scheduled ? new Date(job.scheduled_publish_at) : now;
    const expires = addMonths(start, Number(p.months) || 1);
    const { error } = await supabase.from('jobs').update({
      status: scheduled ? 'scheduled' : 'active',
      published_at: scheduled ? null : now.toISOString(),
      duration_months: Number(p.months) || 1,
      points_spent: amount,
      expires_at: expires.toISOString(),
    }).eq('id', job.id);
    if (error) throw new Error(`Job activation failed: ${error.message}`);
    await supabase.from('job_payments').insert({
      user_id: pending.user_id, job_id: job.id, points_spent: amount, payment_type: 'job_posting',
      description: `Paid ₹${amount} via Razorpay for ${p.months} month job posting (${paymentId})`,
    }).then(() => {}, () => {});
    return { job_id: job.id, expires_at: expires.toISOString() };
  }

  if (pending.purpose === 'job_extension') {
    const job = await assertJobOwner(supabase, p.job_id, pending.user_id);
    const now = new Date();
    const current = job.expires_at ? new Date(job.expires_at) : now;
    const base = current > now ? current : now;
    const expires = addMonths(base, Number(p.months) || 1);
    const updates: Record<string, unknown> = { expires_at: expires.toISOString() };
    if (job.status === 'expired') updates.status = 'active';
    const { error } = await supabase.from('jobs').update(updates).eq('id', job.id);
    if (error) throw new Error(`Job extension failed: ${error.message}`);
    await supabase.from('job_payments').insert({
      user_id: pending.user_id, job_id: job.id, points_spent: amount, payment_type: 'job_extension',
      description: `Paid ₹${amount} via Razorpay to extend job by ${p.months} month(s) (${paymentId})`,
    }).then(() => {}, () => {});
    return { job_id: job.id, new_expiry_date: expires.toISOString() };
  }

  if (pending.purpose === 'interview') {
    const created: any[] = [];
    for (const a of (p.applicants || [])) {
      if (!a?.applicantId || !a?.jobId) continue;
      await assertJobOwner(supabase, a.jobId, pending.user_id);
      const { data: interview } = await supabase.from('interviews').insert({
        job_id: a.jobId,
        applicant_id: a.applicantId,
        scheduled_at: p.scheduledAt,
        scheduled_end_at: p.scheduledEndAt || null,
        mode: p.mode,
        location_url: p.locationUrl || null,
        notes: p.notes || null,
        status: 'scheduled',
        host_user_id: pending.user_id,
        payment_id: paymentId,
        payment_status: 'paid',
        video_platform: p.videoPlatform || null,
        youtube_stream_key: p.youtubeStreamKey || null,
        youtube_stream_url: p.youtubeStreamUrl || null,
        points_spent: Math.round(amount / Math.max(1, (p.applicants || []).length)),
      }).select().single();
      if (interview) created.push(interview);
    }
    return { interviews: created, scheduled_count: created.length };
  }

  throw new Error('Unknown payment purpose');
}
