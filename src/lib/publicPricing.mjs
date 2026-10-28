export const PRICING_TITLE = 'Website Pricing & Plans | Workly India';
export const PRICING_DESCRIPTION = 'Current Workly India prices for job postings, job boosts, verification badges, interviews, AI plans, developer API subscriptions and job duration extensions.';
export const PRICING_TABLES = ['job_posting_settings', 'boost_packages', 'verification_packages', 'interview_pricing_settings', 'ai_chat_plans', 'app_settings', 'domain_pricing_settings'];
export const PUBLIC_PRICING_URL = 'https://jubwzelupbntbetpajqb.supabase.co/rest/v1/rpc/get_public_pricing';
export const PUBLIC_PRICING_KEY = 'sb_publishable_T8RX2Ow8JaudpytTYl0jZg_aWZeYR2o';

export async function fetchPublicPricing(signal) {
  const response = await fetch(PUBLIC_PRICING_URL, { method: 'POST', headers: { apikey: PUBLIC_PRICING_KEY, 'Content-Type': 'application/json' }, body: '{}', signal });
  if (!response.ok) throw new Error('Current prices could not be loaded.');
  return response.json();
}
const number = (value) => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export const formatPrice = (price) => price === 0 ? 'Free' : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(price)}`;
const count = (value) => Number(value) >= 999999 ? 'Unlimited' : new Intl.NumberFormat('en-IN').format(Number(value) || 0);
const features = (value) => Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
const plan = (id, name, price, unit, details = [], recommended = false) => ({ id: String(id), name, price, unit, details, recommended });

/** One catalog for the live page, raw crawler HTML, JSON and structured offers. Never invent unsaved prices. */
export function pricingSections(data = {}) {
  const packages = (Array.isArray(data.jobs?.duration_packages) ? data.jobs.duration_packages : [])
    .filter((p) => p && p.is_active !== false && Number(p.months) > 0 && number(p.points ?? p.price) !== null)
    .sort((a, b) => Number(a.points ?? a.price) - Number(b.points ?? b.price) || a.months - b.months);
  const durations = packages.map((p) => plan(p.months, `${p.months} ${Number(p.months) === 1 ? 'month' : 'months'}`, Number(p.points ?? p.price), 'per job', [`${p.months} ${Number(p.months) === 1 ? 'month' : 'months'} validity`], p.is_default === true));
  if (!durations.length && number(data.jobs?.points_required_per_job) !== null) durations.push(plan('base', 'Job posting', number(data.jobs.points_required_per_job), 'per job / month', ['Owner-configured base rate']));
  const settings = data.settings || {};
  const interview = data.interview;
  const interviews = interview ? [plan('candidate', 'Interview scheduling', number(interview.points_per_interview), 'per candidate', ['Phone, in-person and online interviews'])] : [];
  if (interview?.enable_duration_pricing && number(interview.points_per_minute) > 0) interviews.push(plan('video', 'Video duration', number(interview.points_per_minute), 'per minute / candidate', ['Additional charge for 100ms and VideoSDK meetings']));
  const developer = [];
  if (number(settings.api_subscription_price) !== null) developer.push(plan('subscription', 'Developer API subscription', number(settings.api_subscription_price), 'per month', [number(settings.api_trial_days) !== null ? `${count(settings.api_trial_days)}-day first-subscription trial` : '', number(settings.api_free_calls) !== null ? `${count(settings.api_free_calls)} included calls each month with an active subscription` : '', 'Unused calls carry forward', 'Existing subscribers retain their subscribed price'].filter(Boolean)));
  if (number(settings.api_call_price) !== null) developer.push(plan('calls', 'Additional API calls', number(settings.api_call_price), 'per call', ['Purchased separately from the subscription']));
  const result = [
    { id: 'job-postings', name: 'Job Postings', icon: 'jobs', target: '/post-job', note: 'Posting prices for one job, by listing duration.', plans: durations },
    { id: 'job-boost', name: 'Job Boost', icon: 'boost', target: '/employee', note: 'Boost packages for an existing job listing.', plans: (data.boost || []).map((p) => plan(p.id,p.name,number(p.price_inr),`for ${p.boost_days} days`, [`Boost level ${p.boost_level}`, `${p.boost_days} days of promotion`],p.most_popular)) },
    { id: 'verification', name: 'Verify Badge', icon: 'badge', target: '/employee', note: 'Company verification packages and badge validity.', plans: (data.verification || []).filter((p) => p.validity_days > 0).map((p) => plan(p.id,p.name,number(p.price_inr),`for ${p.validity_days} days`,[`${p.badge_color} verification badge`,`${p.validity_days}-day validity`],p.most_popular)) },
    { id: 'interviews', name: 'Interviews', icon: 'interview', target: '/employee', note: interview ? `Total = candidate charge + applicable video duration charge.${number(interview.minimum_points) !== null ? ` Minimum total: ${formatPrice(Number(interview.minimum_points))}.` : ''} Duration is charged for each candidate; other meeting modes have no duration charge.` : 'No active interview rates are currently available.', plans: interviews },
    { id: 'ai', name: 'AI Plans', icon: 'ai', target: '/ai-assistant', note: 'ChatWork AI monthly subscriptions.', plans: (data.ai || []).map((p) => plan(p.id,p.name,number(p.price_inr),'per month',[`${count(p.messages_per_month)} messages / month`,`${count(p.voice_playback_per_month)} voice playbacks / month`,`${count(p.voice_input_per_month)} voice inputs / month`,`${count(p.image_analysis_per_month)} image analyses / month`,`${count(p.ai_image_generation_per_month)} AI image generations / month`,`${p.ai_model_tier} model tier`,...(p.priority_support ? ['Priority support'] : []),...features(p.features)])) },
    { id: 'developers', name: 'Developer Pricing', icon: 'developer', target: '/developers', note: 'API subscriptions and additional call pricing.', plans: developer },
    { id: 'extend-job', name: 'Extend Job Duration', icon: 'extend', target: '/employee', note: 'The same saved duration packages apply when extending an existing job.', plans: durations.map((p) => ({...p, unit: 'per job extension'})) },
  ];
  if (data.domain?.sales_enabled) result.push({ id: 'domains', name: 'Domains', icon: 'domain', target: '/domains', note: 'Registration and renewal prices depend on the exact domain name and current availability. Check a live quote before purchasing.', plans: data.domain.currency === 'INR' && number(data.domain.protection_price_per_year) > 0 ? [plan('protection','Domain protection',number(data.domain.protection_price_per_year),'per year',['Optional domain add-on'])] : [] });
  return result.map((section) => ({ ...section, plans: section.plans.filter((p) => p.price !== null || p.priceLabel) }));
}

export function pricingSchema(sections, url) {
  return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: PRICING_TITLE, description: PRICING_DESCRIPTION, url, mainEntity: { '@type': 'OfferCatalog', name: 'Workly India pricing', itemListElement: sections.map((section) => ({ '@type': 'OfferCatalog', name: section.name, itemListElement: section.plans.filter((p) => p.price !== null).map((p) => ({ '@type': 'Offer', name: `${section.name}: ${p.name}`, price: p.price, priceCurrency: 'INR', url: `${url}#${section.id}`, description: [p.unit,...p.details].join('. '), itemOffered: { '@type': 'Service', name: `${section.name}: ${p.name}` } })) })) } };
}