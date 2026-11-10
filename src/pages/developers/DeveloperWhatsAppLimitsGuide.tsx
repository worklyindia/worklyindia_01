import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BadgeCheck, CheckCircle2, Clock, Gauge, ShieldCheck, TrendingUp, AlertTriangle, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goBack } from "@/lib/goBack";
import { cn } from "@/lib/utils";

const TIERS = [
  { tier: "Tier 1", limit: "250", note: "Every new number starts here" },
  { tier: "Tier 2", limit: "2,000", note: "Unlocked by business verification" },
  { tier: "Tier 3", limit: "10,000", note: "First automatic upgrade" },
  { tier: "Tier 4", limit: "100,000", note: "Next automatic upgrade" },
  { tier: "Tier 5", limit: "Unlimited", note: "No daily cap — highest trust level" },
];

const SECTIONS: { icon: typeof Gauge; title: string; points: string[]; tone?: "default" | "warning" }[] = [
  {
    icon: Gauge,
    title: "What the 24-hour limit means",
    points: [
      "The limit is the number of unique customers your number can start a business-initiated conversation with in a rolling 24-hour window.",
      "It is not a message count. You can exchange unlimited messages inside an open 24-hour customer-service window with a customer who messaged you first.",
      "Only business-initiated conversations (template messages sent outside an open window) count towards the limit.",
      "The counter resets on a rolling basis — each conversation frees up its slot exactly 24 hours after it started. The reset time shown on the previous page tells you when your next slots open up.",
    ],
  },
  {
    icon: BadgeCheck,
    title: "Where your limit starts",
    points: [
      "If your number already sends WhatsApp messages somewhere else, its existing tier and quality rating come with it. Connecting the number here does not reset your limit — the tier is read straight from Meta.",
      "A number that has never been registered with WhatsApp Business starts at Tier 1 (250 unique customers per 24 hours), which is Meta's default for every new number.",
      "Only the daily usage counter starts fresh when you connect. That counter shows how many of today's slots you have already used here — it is not your tier.",
      "Your tier can only go down when Meta lowers it after a drop in quality. Connecting, disconnecting or reconnecting a number never reduces it.",
    ],
  },
  {
    icon: TrendingUp,
    title: "How your limit increases",
    points: [
      "Meta sets one limit for your whole business portfolio, and every number in it shares that limit: 250, 2,000, 10,000, 100,000, then Unlimited.",
      "250 to 2,000: verify your business with Meta (or have your partner verify it), or send 2,000 delivered messages to unique customers outside customer-service windows within 30 days using high-quality templates.",
      "2,000 to 10,000 to 100,000 to Unlimited is automatic. Keep quality GREEN and start conversations with at least half of your current limit in unique customers over the last 7 days.",
      "Example: on the 2,000 tier, reach 1,000+ unique customers in 7 days to move to 10,000. On 10,000 you need 5,000+, and on 100,000 you need 50,000+ to become Unlimited.",
      "Upgrades usually take effect within 24 hours after you meet the requirement.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Quality rating: the deciding factor",
    points: [
      "GREEN — healthy. Your number is eligible for upgrades.",
      "YELLOW — warning. Upgrades pause. If quality stays low, your limit can be reduced to the tier below.",
      "RED — restricted. Your limit drops immediately and repeated RED status can get the number blocked by Meta.",
      "Quality is driven by how customers react to your messages: blocks, reports and spam complaints lower it; reads, replies and opt-ins keep it high.",
      "Always send to customers who opted in, keep templates relevant, and include a clear way to stop messages.",
    ],
  },
  {
    icon: AlertTriangle,
    tone: "warning",
    title: "Mistakes that lower your limit",
    points: [
      "Messaging customers who never opted in. Reports and blocks from people who did not ask to hear from you are the single fastest way to lose your limit.",
      "Uploading purchased, scraped or rented phone lists. Those numbers never gave permission, so they block you and the damage is permanent for that campaign.",
      "Sending one huge blast to your entire list at once. A sudden spike towards cold contacts triggers spam flags — send in smaller batches instead.",
      "Using pressure or clickbait language: \"Act now!!!\", fake offers, ALL CAPS or misleading claims. Customers report these within seconds.",
      "Ignoring a stop or unsubscribe request. Every message sent after a customer says stop counts against your rating and can get the number blocked by Meta.",
      "Retrying failed sends in a tight loop after the limit is reached. It does not free up slots any faster and it hurts your quality score.",
      "Sending at odd hours when customers are asleep. An annoyed recipient who blocks you counts exactly the same as an angry one.",
      "Changing your display name or business profile often. Meta re-reviews the number and it stays on the current tier until the new name is approved.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "What happens when you hit the limit",
    points: [
      "New business-initiated sends fail with Meta's rate-limit error until slots free up.",
      "Nothing is lost — wait for the rolling reset, then resend. Replies inside open customer windows keep working normally.",
      "Repeatedly hammering the limit with low-quality sends hurts your rating, so pace your campaigns instead of retrying in a loop.",
    ],
  },
  {
    icon: Users,
    title: "Practical tips to grow faster",
    points: [
      "Warm up a new number: start with your most engaged customers, not a cold list.",
      "Send in batches spread across the day rather than one large blast.",
      "Keep your display name, business profile and website verified and consistent — Meta's checks trust complete profiles.",
      "Remove numbers that block or report you from future campaigns immediately.",
      "Watch the usage bar on the previous page: staying consistently above 50% usage with GREEN quality is exactly what triggers the next upgrade.",
    ],
  },
];

export default function DeveloperWhatsAppLimitsGuide() {
  const navigate = useNavigate();

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Back" onClick={() => goBack(navigate, "/developers/whatsapp-limits")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold">How limits increase</h1>
      </header>
      <main className="min-h-0 w-full flex-1 overflow-y-auto pb-10">
        <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-5 sm:px-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            WhatsApp controls how many customers a business number can reach per day through messaging tiers.
            This guide explains how the limit works, when it increases, and the rules that decide your tier.
          </p>

          <section aria-label="Warning" className="rounded-xl border border-warning/50 bg-warning/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
              <h2 className="font-semibold">Read this before you send</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your limit only goes down when customers block, report or mark your messages as spam.
              One careless campaign can undo weeks of growth, so check the mistake list further down this page
              before you start sending.
            </p>
          </section>

          <section aria-label="Messaging tiers" className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Messaging tiers</h2>
            </div>
            <ul className="divide-y divide-border">
              {TIERS.map((t, i) => (
                <li key={t.tier} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.limit} unique customers / 24h</p>
                    <p className="text-xs text-muted-foreground">{t.note}</p>
                  </div>
                  {i < TIERS.length - 1 && <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </li>
              ))}
            </ul>
          </section>

          {SECTIONS.map((s) => {
            const warn = s.tone === "warning";
            return (
              <section
                key={s.title}
                aria-label={s.title}
                className={cn(
                  "rounded-xl border p-4",
                  warn ? "border-warning/50 bg-warning/5" : "border-border bg-card",
                )}
              >
                <div className="mb-3 flex items-center gap-2">
                  <s.icon className={cn("h-4 w-4 shrink-0", warn ? "text-warning" : "text-primary")} />
                  <h2 className="font-semibold">{s.title}</h2>
                </div>
                <ul className="space-y-2.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      {warn ? (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section aria-label="Reset timing" className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">When does usage reset?</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              There is no fixed midnight reset. Each conversation slot opens again exactly 24 hours after that conversation started,
              so your available capacity grows back continuously throughout the day. The “resets” time on the limits page shows when
              your oldest active conversations free up next.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
