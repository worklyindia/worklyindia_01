import defaultHero from "@/assets/built-with-love-hero.webp";
import { useAuthImages } from "@/hooks/useAuthImages";

const MadeWithLoveSection = () => {
  const { data: images } = useAuthImages();
  // Owner-managed image takes priority; ignore legacy doves placeholder so the
  // refreshed default illustration shows until the owner uploads a new one.
  const stored = images?.home_hero_image;
  const isLegacy = typeof stored === "string" && /doves|doves-heart/i.test(stored);
  const heroSrc = stored && !isLegacy ? stored : defaultHero;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-primary/5 to-primary/10 pt-10 pb-6 px-4">
      {/* Soft glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-primary/10 blur-3xl animate-pulse" />
      </div>

      <div className="relative max-w-md mx-auto flex flex-col items-center text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-primary/80 font-semibold mb-3">
          Spreading Opportunities
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Built with <span className="text-primary">Love</span> for Every Dreamer
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Connecting talent and trust across India — one job, one story, one heartbeat at a time.
        </p>

        {/* Doves illustration */}
        <div className="relative w-full max-w-[320px] aspect-square">
          {/* Pulsing heart aura behind the doves */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-rose-500/20 blur-2xl animate-pulse" />
          </div>

          <img
            src={heroSrc}
            alt="Two doves forming a heart — symbol of trust and opportunity"
            loading="eager"
            width={1024}
            height={1024}
            className="relative w-full h-full object-contain select-none pointer-events-none rounded-3xl"
            style={{ animation: "float-gentle 6s ease-in-out infinite" }}
            draggable={false}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.src !== defaultHero) el.src = defaultHero;
            }}
          />
        </div>

        <p className="mt-6 text-xs text-muted-foreground italic">
          “May your next opportunity find you with grace.”
        </p>
      </div>

      <style>{`
        @keyframes float-gentle {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.02); }
        }
      `}</style>
    </section>
  );
};

export default MadeWithLoveSection;
