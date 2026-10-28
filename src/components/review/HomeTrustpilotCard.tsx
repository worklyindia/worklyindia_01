import { Star, ExternalLink } from "lucide-react";

const REVIEW_URL = "https://www.trustpilot.com/evaluate/worklyindia.devs.surf";

const HomeTrustpilotCard = () => (
  <section className="px-4 py-4">
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-5 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
      <div className="relative flex flex-col items-center text-center gap-3">
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
              <Star className="w-4 h-4 text-primary-foreground fill-current" />
            </span>
          ))}
        </div>
        <h3 className="text-lg font-bold text-foreground">Loved Workly India?</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Share your experience on Trustpilot — your review helps other job seekers trust us.
        </p>
        <a
          href={REVIEW_URL}
          target="_blank"
          rel="noopener"
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary/10 px-4 py-4 text-base font-semibold text-foreground shadow-md transition-colors hover:bg-primary/20 active:scale-[0.98]"
        >
          Review us on
          <Star className="w-5 h-5 text-primary fill-current" />
          <span className="font-bold">Trustpilot</span>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>
    </div>
  </section>
);

export default HomeTrustpilotCard;
