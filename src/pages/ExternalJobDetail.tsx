import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, MapPin, Building, Heart, Briefcase, Globe, ExternalLink, GraduationCap, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ShareDialog from "@/components/ShareDialog";

import JobMarketInsightsPanel from "@/components/JobMarketInsightsPanel";
import ExternalJobPolicyFooter from "@/components/ExternalJobPolicyFooter";
import { useHybridFavorites } from "@/hooks/useHybridFavorites";
import { explainSalaryToINR, formatSalaryWithPeriod, PERIOD_UNIT } from "@/utils/salaryToINR";
import { formatDateWithTime, formatDateSmart } from "@/utils/dateFormatUtils";
import { guessCompanyLogoUrl } from "@/utils/companyLogoGuess";
import CompanyLetterAvatar from "@/components/CompanyLetterAvatar";
import { toast } from "sonner";
import type { JoobleJob } from "@/hooks/useJoobleJobs";
import { decodeSharedJob } from "@/utils/externalJobShare";
import { supabase } from "@/integrations/supabase/client";

const ExternalJobDetail = () => {
  const { id, source, extId, shortId } = useParams<{ id?: string; source?: string; extId?: string; shortId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isFavorited, toggleFavorite } = useHybridFavorites();
  // `undefined` = hydration in progress, `null` = hydration finished but no data
  const [job, setJob] = useState<JoobleJob | null | undefined>(undefined);
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 0) `/ej/s/:shortId` — look up compact share record from DB.
    if (shortId) {
      setJob(undefined);
      (async () => {
        try {
          const { data, error } = await supabase
            .from('external_job_shortlinks')
            .select('payload')
            .eq('short_id', shortId)
            .maybeSingle();
          if (cancelled) return;
          if (error || !data?.payload) {
            setJob(null);
            return;
          }
          const payload = data.payload as Record<string, unknown>;
          const hydrated = (payload.external_id
            ? payload
            : decodeSharedJob(typeof payload === 'string' ? payload : null)) as JoobleJob | null;
          if (hydrated && (hydrated as JoobleJob).external_id) {
            setJob(hydrated as JoobleJob);
            try {
              sessionStorage.setItem(
                `ext_job_ext-${(hydrated as JoobleJob).external_id}`,
                JSON.stringify(hydrated),
              );
            } catch {}
          } else {
            setJob(null);
          }
        } catch {
          if (!cancelled) setJob(null);
        }
      })();
      return () => { cancelled = true; };
    }

    // Resolve which storage key to look up. Legacy `/external-job/:id`
    // uses `ext-{external_id}`, new `/ej/:source/:extId` builds it from parts.
    const resolvedExtId = id
      ? id.replace(/^ext-/, '')
      : (source && extId ? `${source}_${extId}` : '');
    const storageKey = resolvedExtId ? `ext_job_ext-${resolvedExtId}` : '';

    // 1) sessionStorage (same-tab navigations from the feed)
    try {
      if (storageKey) {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          setJob(JSON.parse(raw));
          return;
        }
      }
    } catch {}

    // 2) URL payload (?d=base64) — populated by shared /ej links so the
    //    recipient can render even without sessionStorage. Supports both the
    //    new compact single-letter schema and the legacy verbose schema.
    const d = searchParams.get('d');
    const decoded = decodeSharedJob(d);
    if (decoded && decoded.external_id) {
      setJob(decoded as JoobleJob);
      try {
        sessionStorage.setItem(`ext_job_ext-${decoded.external_id}`, JSON.stringify(decoded));
      } catch {}
      return;
    }

    // 3) Nothing hydrated — mark truly missing so the empty state shows.
    setJob(null);
    return () => { cancelled = true; };
  }, [id, source, extId, shortId, searchParams]);

  if (job === undefined) {
    // Hydration in progress. Show a neutral loading skeleton instead of
    // the "Job not available" screen (which caused the false "not found"
    // flash for recipients of shared links).
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="p-6 text-center max-w-sm">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading job details…</p>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="p-6 text-center max-w-sm">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-semibold mb-2">Job not available</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This shared link is missing job details or has expired. Browse similar jobs instead.
          </p>
          <Button onClick={() => navigate("/jobs")}>Browse Jobs</Button>
        </Card>
      </div>
    );
  }

  // Prefer full description; fall back to Jooble snippet.
  const descriptionHTML = (job.description || job.snippet || "")
    .replace(/&nbsp;/g, " ")
    .trim();
  const { display: inrSalary, breakdown: inrBreakdown, period: salaryPeriod } = explainSalaryToINR(job.salary);

  const handleApply = () => {
    if (!job.link) {
      toast.error("Application link unavailable");
      return;
    }
    window.open(job.link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <Helmet>
        <title>{job.title} - {job.company || "Job"}</title>
        <meta name="description" content={descriptionHTML.replace(/<[^>]*>/g, ' ').slice(0, 155)} />
      </Helmet>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-sm truncate flex-1 mx-2">Job Details</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(`ext-${job.external_id}`, job)}
              className={isFavorited(`ext-${job.external_id}`) ? "text-red-500" : ""}
            >
              <Heart className={`w-5 h-5 ${isFavorited(`ext-${job.external_id}`) ? "fill-current" : ""}`} />
            </Button>
            <ShareDialog
              jobTitle={job.title}
              company={job.company || "Company"}
              jobId={`ext-${job.external_id}`}
              location={job.location}
              job_type={job.type}
              isExternal
              externalJob={job}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Title Card */}
        <Card className="p-4">
          <div className="flex items-start space-x-3 mb-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-border flex items-center justify-center shrink-0">
              {(() => {
                const sourceLogo = job.company_logo || null;
                const guessed = guessCompanyLogoUrl(job.company);
                const logoUrl = sourceLogo || guessed;
                if (logoUrl && logoOk) {
                  return (
                    <img
                      src={logoUrl}
                      alt={`${job.company} logo`}
                      className="w-full h-full object-contain bg-white"
                      onError={() => setLogoOk(false)}
                      loading="lazy"
                    />
                  );
                }
                return <CompanyLetterAvatar company={job.company} textClassName="text-lg" />;
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-base leading-tight mb-1">{job.title}</h2>
              <p className="text-sm text-muted-foreground">{job.company || "Company"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {job.location && (
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                <MapPin className="w-3 h-3 mr-1" />
                {job.location}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
              <Globe className="w-3 h-3 mr-1" />
              India
            </Badge>
            {job.type && (
              <Badge variant="outline" className="text-xs">
                {job.type}
              </Badge>
            )}
            {job.category && (
              <Badge variant="outline" className="text-xs">
                {job.category}
              </Badge>
            )}
          </div>

          {job.salary ? (
            <div className="mb-2">
              <p className="font-bold text-success text-base break-words">
                {formatSalaryWithPeriod(job.salary)}
              </p>
              {job.salary_is_predicted && (
                <p className="text-[11px] text-muted-foreground">Estimated by {job.source}</p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium text-muted-foreground mb-2">Salary: As per company standards</p>
          )}


          {(job.experience || job.education || job.employment) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {job.employment && (
                <Badge variant="outline" className="text-xs">
                  <Briefcase className="w-3 h-3 mr-1" />
                  {job.employment}
                </Badge>
              )}
              {job.experience && (
                <Badge variant="outline" className="text-xs">
                  <Award className="w-3 h-3 mr-1" />
                  {job.experience}
                </Badge>
              )}
              {job.education && (
                <Badge variant="outline" className="text-xs">
                  <GraduationCap className="w-3 h-3 mr-1" />
                  {job.education}
                </Badge>
              )}
            </div>
          )}

          {job.updated && formatDateSmart(job.updated) && (
            <p className="text-xs text-muted-foreground">
              Posted {formatDateSmart(job.updated)}
            </p>
          )}
          {/* Source is intentionally not shown as a clickable URL — the
              external site's link is hidden from users; only the Apply Now
              button below opens the destination. */}

        </Card>

        {/* Full details grid — show every field the provider returns */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Job Information</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {(() => {
              const rows: [string, ReactNode][] = [
                ['Title', job.title],
                ['Company', job.company],
                ['Location', job.location],
                ['Country', 'India'],
                ['Job Type', job.type],
                ['Employment', job.employment],
                ['Contract Time', job.contract_time],
                ['Contract Type', job.contract_type],
                ['Experience', job.experience],
                ['Education', job.education],
                ['Category', job.category],
                ['Salary', job.salary ? formatSalaryWithPeriod(job.salary) : null],
                ['Salary Min', job.salary_min ? `₹${Math.round(job.salary_min).toLocaleString('en-IN')}` : null],
                ['Salary Max', job.salary_max ? `₹${Math.round(job.salary_max).toLocaleString('en-IN')}` : null],
                ['Salary Type', job.salary_is_predicted ? 'Estimated' : (job.salary ? 'Provided' : null)],
                ['Currency', job.currency],
                ['Latitude', job.latitude ?? null],
                ['Longitude', job.longitude ?? null],
                ['Area', Array.isArray(job.area) ? job.area.join(' › ') : null],
                ['Posted', job.updated ? (formatDateSmart(job.updated) || null) : null],
                ['Approx (INR)', inrSalary ? inrSalary.replace(/\/year/g, ' Per Year').replace(/\/month/g, ' Per Month') : null],
              ];
              // Also surface any additional raw fields the provider returned
              // (Adzuna + Jooble A→Z) so nothing stays hidden. Nested
              // objects/arrays are flattened using dotted paths.
              const known = new Set([
                'id','title','company','location','salary','type','snippet','description','link','source','updated',
                'employment','experience','education','company_logo','logo','company_url','category','currency',
                'salary_min','salary_max','salary_is_predicted','contract_time','contract_type','latitude','longitude',
                'area','adref','category_tag','redirect_url','created','__CLASS__',
                // Hide any URL-ish fields so the external site link never leaks to users
                'url','apply_url','source_url','job_url','site','externalUrl','external_url','partner_url',
              ]);
              const isUrlLike = (v: any) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());
              const humanize = (s: string) =>
                s.replace(/__CLASS__/g, 'Class')
                 .replace(/[._]/g, ' ')
                 .replace(/\b\w/g, (c) => c.toUpperCase());
              // Detect date-like strings (RFC 2822 e.g. "Sat, 11 Jul 2026 22:33:37 GMT",
              // ISO 8601, or "YYYY-MM-DD HH:mm:ss") so raw provider date fields render
              // in the same DD/MM/YYYY, hh:mm AM/PM format as the rest of the app.
              const isDateLike = (v: any) => {
                if (typeof v !== 'string') return false;
                const s = v.trim();
                if (s.length < 8 || s.length > 40) return false;
                const looksLikeDate =
                  /^(sun|mon|tue|wed|thu|fri|sat),?\s/i.test(s) ||
                  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(s) ||
                  /^\d{2}[\/-]\d{2}[\/-]\d{2,4}/.test(s) ||
                  /\bGMT\b|\bUTC\b|[+-]\d{4}$/i.test(s);
                if (!looksLikeDate) return false;
                const t = Date.parse(s);
                return !isNaN(t);
              };
              const pushValue = (label: string, v: any) => {
                if (v === null || v === undefined || v === '') return;
                if (isUrlLike(v)) return; // never surface raw URLs to users
                if (Array.isArray(v)) {
                  if (v.length === 0) return;
                  rows.push([label, v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')]);
                  return;
                }
                if (typeof v === 'object') {
                  for (const [ck, cv] of Object.entries(v)) {
                    pushValue(`${label} › ${humanize(ck)}`, cv);
                  }
                  return;
                }
                if (typeof v === 'boolean') {
                  rows.push([label, v ? 'Yes' : 'No']);
                  return;
                }
                if (isDateLike(v)) {
                  rows.push([label, formatDateWithTime(v)]);
                  return;
                }
                rows.push([label, String(v)]);
              };
              if (job.raw && typeof job.raw === 'object') {
                for (const [k, v] of Object.entries(job.raw)) {
                  if (known.has(k)) continue;
                  pushValue(humanize(k), v);
                }
              }
              return rows
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([label, value]) => (
                  <div key={label} className="flex flex-col border-b border-border/40 py-1">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-foreground font-medium break-words">{value}</dd>
                  </div>
                ));
            })()}
          </dl>
        </Card>

        {/* INR calculation breakdown — show users how Approx (INR) was derived */}
        {inrBreakdown && (
          <Card className="p-4 bg-muted/30">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              How we calculated Approx (INR)
            </h3>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans text-muted-foreground">
{inrBreakdown}
            </pre>
          </Card>
        )}

        {/* Description */}
        {descriptionHTML && (
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-2">Job Description</h3>
            <div
              className="text-sm text-foreground/90 prose prose-sm max-w-none dark:prose-invert leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: descriptionHTML }}
            />
          </Card>
        )}

        {/* Job Market Insights – only for Adzuna sourced jobs */}
        {(job.source || '').toLowerCase().includes('adzuna') && (
          <JobMarketInsightsPanel keyword={job.category || job.title} />
        )}

        {/* Apply CTA */}

        <div className="sticky bottom-20 z-10">
          <Button
            className="w-full h-12 text-base font-semibold shadow-lg"
            onClick={handleApply}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Apply Now
          </Button>
        </div>

        {/* Third-party platform policies (Careerjet / Adzuna / Jooble).
            We show the SOURCE platform's policies here, not Workly India's,
            because this listing belongs to that third-party platform. */}
        <div className="mt-8 border-t border-border/50">
          <ExternalJobPolicyFooter source={job.source} applyUrl={job.link} />
        </div>
      </div>
    </div>
  );
};

export default ExternalJobDetail;
