import { ShieldAlert } from "lucide-react";

interface ExternalJobPolicyFooterProps {
  source?: string;
  applyUrl?: string;
}

type PlatformKey = "careerjet" | "adzuna" | "jooble";

const PLATFORM_NAMES: Record<PlatformKey, string> = {
  careerjet: "Careerjet",
  adzuna: "Adzuna",
  jooble: "Jooble",
};

function detectPlatform(source?: string, applyUrl?: string): PlatformKey | null {
  const hay = `${source || ""} ${applyUrl || ""}`.toLowerCase();
  if (hay.includes("careerjet")) return "careerjet";
  if (hay.includes("adzuna")) return "adzuna";
  if (hay.includes("jooble")) return "jooble";
  return null;
}

/**
 * Shown on external job detail pages (Careerjet / Adzuna / Jooble).
 * Displays a plain disclaimer that the listing belongs to the third-party
 * platform and that Workly India's policies do not apply to it.
 */
const ExternalJobPolicyFooter = ({ source, applyUrl }: ExternalJobPolicyFooterProps) => {
  const platform = detectPlatform(source, applyUrl);
  if (!platform) return null;
  const platformName = PLATFORM_NAMES[platform];

  return (
    <div className="px-4 pt-5 pb-2">
      <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              This job is listed by <span className="text-amber-700 dark:text-amber-300">{platformName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Workly India only displays this listing from {platformName}. Please review the terms and policies on
              the {platformName} website before applying. Our site policies do not apply to third-party job listings
              or the destination page.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground text-center">
        {platformName} is an independent third-party job platform. Workly India is not responsible for the accuracy
        of listings, the hiring process, or any interaction that happens on {platformName} or the employer's site.
      </p>
    </div>
  );
};

export default ExternalJobPolicyFooter;
