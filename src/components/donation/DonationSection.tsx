import { useState } from "react";
import { Heart, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFeaturedDonationCampaign } from "@/hooks/useDonationCampaign";
import DonateDialog from "./DonateDialog";

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function DonationSection() {
  const { campaign, loading } = useFeaturedDonationCampaign();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (loading || !campaign) return null;

  const pct = campaign.target_amount > 0
    ? Math.min(100, Math.round((Number(campaign.collected_amount) / Number(campaign.target_amount)) * 100))
    : 0;
  const ended = campaign.status === "ended" || (campaign.target_amount > 0 && Number(campaign.collected_amount) >= Number(campaign.target_amount));

  return (
    <section className="px-4 py-6">
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-yellow-950/30 border border-orange-200/60 dark:border-orange-900/40 shadow-md">
        {campaign.image_url && (
          <div className="relative h-48 sm:h-56 overflow-hidden">
            <img
              src={campaign.image_url}
              alt={campaign.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <h2 className="text-white text-2xl font-bold drop-shadow-lg">{campaign.title}</h2>
              {campaign.short_description && (
                <p className="text-white/90 text-sm mt-1 line-clamp-2 drop-shadow">{campaign.short_description}</p>
              )}
            </div>
          </div>
        )}

        <div className="p-5 space-y-4">
          {!campaign.image_url && (
            <div>
              <h2 className="text-2xl font-bold text-foreground">{campaign.title}</h2>
              {campaign.short_description && (
                <p className="text-muted-foreground text-sm mt-1">{campaign.short_description}</p>
              )}
            </div>
          )}

          {/* Progress */}
          <div className="rounded-2xl bg-white/60 dark:bg-black/20 border border-orange-200/50 dark:border-orange-900/30 p-4 space-y-3">
            {/* Row 1: hero amount on its own line */}
            <div className="min-w-0">
              <div className="text-3xl font-extrabold text-orange-700 dark:text-orange-400 tabular-nums leading-tight truncate">
                {formatINR(Number(campaign.collected_amount))}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5 tabular-nums">
                raised of {formatINR(Number(campaign.target_amount))}
              </div>
            </div>

            {/* Row 2: progress bar + % pill */}
            <div className="flex items-center gap-3">
              <Progress value={pct} className="h-2.5 flex-1 bg-orange-100 dark:bg-orange-950/50" />
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-600 text-white tabular-nums shrink-0">
                {pct}%
              </span>
            </div>

            {/* Row 3: donors + live status on their own line */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-orange-200/40 dark:border-orange-900/30">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span className="tabular-nums">{campaign.donor_count}</span> donors
              </span>
              {ended ? (
                <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Target Achieved 🙏
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
                  </span>
                  Live
                </span>
              )}
            </div>
          </div>

          {campaign.long_content && (
            <div className="text-sm text-foreground/80 whitespace-pre-line">
              <p className={expanded ? "" : "line-clamp-4"}>{campaign.long_content}</p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {expanded ? "Show less" : "Read more →"}
              </button>
            </div>
          )}

          {!ended && (
            <Button
              onClick={() => setOpen(true)}
              className="w-full h-12 text-base bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md"
            >
              <Heart className="w-5 h-5 mr-2 fill-white" />
              Donate Now →
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            🙏 All donations used exclusively for Gau Seva. Secure payments via Razorpay.
          </p>
        </div>
      </div>

      {!ended && <DonateDialog open={open} onOpenChange={setOpen} campaign={campaign} />}
    </section>
  );
}
