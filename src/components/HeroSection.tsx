
import TextReveal from "@/components/animations/TextReveal";

const HeroSection = () => {
  return (
    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-6 px-4">
      <div className="max-w-7xl mx-auto text-center">
        <TextReveal>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Find Your Dream
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Remote Job</span>
          </h1>
        </TextReveal>
        <TextReveal delay={200}>
          <p className="text-sm text-muted-foreground">
            50+ active opportunities • Start your Remote journey
          </p>
        </TextReveal>
      </div>
    </div>
  );
};

export default HeroSection;
