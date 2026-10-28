import { MapPin, Heart, Briefcase } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import ShareDialog from "@/components/ShareDialog";
import { useHybridFavorites } from "@/hooks/useHybridFavorites";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { formatSalaryWithPeriod } from "@/utils/salaryToINR";
import { guessCompanyLogoUrl } from "@/utils/companyLogoGuess";
import CompanyLetterAvatar from "@/components/CompanyLetterAvatar";
import type { JoobleJob } from "@/hooks/useJoobleJobs";

interface ExternalJobCardProps {
  job: JoobleJob;
}

/**
 * External job card styled identically to the internal JobCard. Clicking
 * "View Details" opens an in-app detail page (`/external-job/:id`) so the
 * experience matches native website jobs — the underlying source is not
 * surfaced to the user.
 */
const ExternalJobCard = ({ job }: ExternalJobCardProps) => {
  const navigate = useNavigate();
  const { isFavorited, toggleFavorite } = useHybridFavorites();
  const { tapFeedback, successFeedback } = useNativeFeel();
  const [logoOk, setLogoOk] = useState(true);
  const logoUrl = job.company_logo || guessCompanyLogoUrl(job.company);

  const jobId = `ext-${job.external_id}`;

  // Strip HTML for description preview
  const cleanDescription = (job.description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const openDetails = () => {
    tapFeedback();
    try {
      sessionStorage.setItem(`ext_job_${jobId}`, JSON.stringify(job));
    } catch {}
    navigate(`/external-job/${encodeURIComponent(jobId)}`);
  };

  const country = "India";

  return (
    <div
      className="job-card card-press group w-full max-w-full overflow-hidden p-3 sm:p-4 relative cursor-pointer hover-lift"
      onClick={openDetails}
    >
      <div className="flex items-start space-x-2 sm:space-x-3 mb-2 sm:mb-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-border">
          {logoUrl && logoOk ? (
            <img
              src={logoUrl}
              alt={`${job.company} logo`}
              className="w-full h-full object-contain bg-white"
              onError={() => setLogoOk(false)}
              loading="lazy"
            />
          ) : (
            <CompanyLetterAvatar company={job.company} textClassName="text-sm sm:text-base" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-xs sm:text-sm text-card-foreground group-hover:text-primary transition-smooth leading-tight mb-1 line-clamp-2">
            {job.title}
          </h3>
          <div className="flex items-center flex-nowrap gap-x-1.5 min-w-0">
            <p className="text-muted-foreground text-xs truncate leading-tight min-w-0">
              {job.company || "Company"}
            </p>
            {job.updated && (() => {
              const raw = String(job.updated);
              const d = new Date(raw);
              if (isNaN(d.getTime())) return null;
              const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long' });
              const hasTimeComponent = /\d{1,2}:\d{2}/.test(raw)
                && !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
              const time = hasTimeComponent
                ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                : null;
              return (
                <span className="text-muted-foreground text-[11px] leading-tight whitespace-nowrap shrink-0">
                  • {day}{time ? ` • ${time}` : ''}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Location - plain text line (matches internal JobCard styling) */}
      {(job.location || country) && (() => {
        const parts: string[] = [];
        const loc = (job.location || '').trim();
        if (loc) parts.push(loc);
        // Only append country if the location doesn't already contain it,
        // so "India" doesn't render as "India, India" for Jooble jobs.
        if (country && !new RegExp(`\\b${country}\\b`, 'i').test(loc)) {
          parts.push(country);
        }
        if (parts.length === 0) return null;
        return (
          <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground min-w-0">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{parts.join(', ')}</span>
          </div>
        );
      })()}

      <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
        {(() => {
          const original = (job.salary || "").trim();
          if (original) {
            return (
              <span className="font-bold text-success text-sm sm:text-base break-words">
                {formatSalaryWithPeriod(original)}
              </span>
            );
          }
          return (
            <span className="text-muted-foreground text-xs font-medium">Salary: As per company standards</span>
          );
        })()}
        {cleanDescription && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            {cleanDescription}
          </p>
        )}
      </div>



      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 flex-nowrap min-w-0 w-full overflow-hidden">
            {job.type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                {job.type}
              </Badge>
            )}
            {(() => {
              const src = (job.source || '').toLowerCase();
              const extId = String(job.external_id || '');
              const isAdzuna = src.includes('adzuna') || extId.startsWith('adzuna_');
              const isCareerjet = src.includes('careerjet') || extId.startsWith('careerjet_');
              const isJooble = !isAdzuna && !isCareerjet && (src.includes('jooble') || extId.startsWith('jooble_'));
              const label = isAdzuna
                ? 'Adzuna'
                : isCareerjet
                ? 'Careerjet'
                : isJooble
                ? 'Jooble'
                : (job.source || 'Partner');
              const cls = isAdzuna
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                : isCareerjet
                ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
              return (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 shrink-0 whitespace-nowrap ${cls}`}>
                  <Briefcase className="w-2.5 h-2.5 mr-0.5" />
                  {label}
                </Badge>
              );
            })()}

            {(job.category || job.category_tag) && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 min-w-0 max-w-full truncate inline-block"
                title={job.category || job.category_tag}
              >
                {job.category || job.category_tag}
              </Badge>
            )}
          </div>

        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openDetails();
            }}
            title="View job details"
          >
            View Details
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${
              isFavorited(jobId)
                ? "text-red-500 hover:text-red-600"
                : "text-muted-foreground hover:text-primary"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              successFeedback();
              toggleFavorite(jobId, job);
            }}
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${
                isFavorited(jobId) ? "fill-current heart-pop" : ""
              }`}
            />
          </Button>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <ShareDialog
              jobTitle={job.title}
              company={job.company || "Company"}
              jobId={jobId}
              location={job.location}
              job_type={job.type}
              isExternal
              externalJob={job}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default ExternalJobCard;
