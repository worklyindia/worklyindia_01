import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ScrollReveal from "@/components/animations/ScrollReveal";
import { setCacheData, getCacheData } from "@/utils/offlineCache";

import imgNoFee from "@/assets/trust-badges/no-registration-fee.webp";
import imgVerified from "@/assets/trust-badges/verified-jobs.webp";
import imgCompanies from "@/assets/trust-badges/real-companies.webp";
import imgUpdates from "@/assets/trust-badges/daily-updates.webp";
import imgSSL from "@/assets/trust-badges/ssl-secured.webp";
import imgUdyam from "@/assets/trust-badges/udyam-registered.webp";

export interface HomeTrustBadge {
  id: string;
  title: string;
  subtitle: string;
  description?: string | null;
  image_url: string | null;
  gradient: string;
  ring: string;
  glow: string;
  tint: string;
  sort_order: number;
  is_active: boolean;
}

// Fallback images keyed by lowercased title — used when no image_url uploaded yet.
const FALLBACK_IMAGES: Record<string, string> = {
  "no registration fee": imgNoFee,
  "verified jobs": imgVerified,
  "real companies": imgCompanies,
  "daily updates": imgUpdates,
  "ssl secured": imgSSL,
  "udyam registered": imgUdyam,
};

export const resolveBadgeImage = (b: Pick<HomeTrustBadge, "image_url" | "title">) =>
  b.image_url || FALLBACK_IMAGES[b.title.trim().toLowerCase()] || null;

// Fallback descriptions shown when the DB description is empty.
const BADGE_DETAILS: Record<string, string> = {
  "no registration fee":
    "You never pay any registration fee on our platform. Applying for jobs, creating your profile and uploading your resume are 100% free — no hidden charges and no premium plan needed.",
  "verified jobs":
    "Every job listing is personally checked by our team. Fake companies, scam jobs and misleading ads are removed right away, so you can apply without worry.",
  "real companies":
    "We work directly with reputed employers — no fake agencies and no middlemen. Each company's address, contact details and background are checked before listing.",
  "daily updates":
    "Fresh job openings are added every day across all categories. With instant alerts you never miss your dream job.",
  "ssl secured":
    "Your data is protected with bank-level 256-bit SSL encryption. Your personal details, resume and applications stay private and safe.",
  "udyam registered":
    "We are a Government of India UDYAM registered business — legally verified and officially trusted by employers and job seekers.",
};

export const getBadgeDescription = (badge: Pick<HomeTrustBadge, "description" | "title" | "subtitle">): string => {
  const db = badge.description?.trim();
  if (db) return db;
  return (
    BADGE_DETAILS[badge.title.trim().toLowerCase()] ||
    `${badge.title} — ${badge.subtitle || "Trusted feature of our platform."}`
  );
};

const TRUST_BADGES_CACHE_KEY = "home_trust_badges_v2";
const TRUST_BADGES_TTL_MS = 30 * 60 * 1000; // 30 minutes

const HomeTrustBadges = () => {
  const [badges, setBadges] = useState<HomeTrustBadge[]>(
    () => getCacheData<HomeTrustBadge[]>(TRUST_BADGES_CACHE_KEY) ?? []
  );

  useEffect(() => {
    // Skip network call when a fresh cached copy is available.
    if (getCacheData<HomeTrustBadge[]>(TRUST_BADGES_CACHE_KEY)) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("home_trust_badges")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!cancelled && data) {
        const list = data as unknown as HomeTrustBadge[];
        setBadges(list);
        setCacheData(TRUST_BADGES_CACHE_KEY, list, TRUST_BADGES_TTL_MS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (badges.length === 0) return null;

  return (
    <div className="px-4 py-6 space-y-3">
      {badges.map((item, i) => {
        const img = resolveBadgeImage(item);
        return (
          <ScrollReveal key={item.id} type="fade-up" stagger={80} index={i}>
            <div
              className={`relative w-full overflow-hidden rounded-2xl bg-card/80 backdrop-blur-xl ring-1 ${item.ring} p-4 shadow-lg ${item.glow}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.tint} pointer-events-none`} />
              <div className="relative flex items-center gap-3">
                <div className="relative shrink-0">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md overflow-hidden p-1`}
                  >
                    {img ? (
                      <img src={img} alt={item.title} loading="lazy" width={48} height={48} className="w-full h-full object-contain drop-shadow" />
                    ) : (
                      <span className="text-primary-foreground font-bold text-lg">{item.title.charAt(0)}</span>
                    )}
                  </div>
                  <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-primary-foreground drop-shadow" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-foreground leading-snug">{item.title}</h3>
                  {item.subtitle && (
                    <p className="text-xs text-muted-foreground font-medium">{item.subtitle}</p>
                  )}
                </div>
              </div>
              <div className="relative mt-3 space-y-2">
                {getBadgeDescription(item).split("\n\n").map((para, idx) => (
                  <p key={idx} className="text-sm text-foreground/85 leading-relaxed">{para}</p>
                ))}
              </div>
            </div>
          </ScrollReveal>
        );
      })}
    </div>
  );
};

export default HomeTrustBadges;
