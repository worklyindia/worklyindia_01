import PageHeader from "@/components/PageHeader";
import SEO from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Heart, Rocket, Users, Mail, MessageCircle, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { usePlatformStats, formatStatNumber, getDisplayStats } from "@/hooks/usePlatformStats";

const perks = [
  { icon: Users, title: "Remote-first", desc: "Fully remote across India. Work from wherever you're most productive." },
  { icon: Rocket, title: "Ownership", desc: "Small team, high impact. Your work ships to real users every week." },
  { icon: Briefcase, title: "Meaningful work", desc: "Help lakhs of Indians find genuine remote-work jobs, not scams." },
  { icon: Heart, title: "Flexible hours", desc: "We care about outcomes, not clock-in times." },
];

const Careers = () => {
  const { data: rawStats } = usePlatformStats();
  const stats = getDisplayStats(rawStats);

  const careersEmail = BRAND_CONFIG.email;
  const mailtoOpen = `mailto:${careersEmail}?subject=${encodeURIComponent(
    "Interested in joining Workly India",
  )}&body=${encodeURIComponent(
    "Hi Workly India team,\n\nI'd love to work with you. Here's a bit about me:\n\n- Role I'm interested in: \n- Years of experience: \n- Portfolio / LinkedIn / GitHub: \n- Why I want to join: \n\nResume attached.\n\nThanks!",
  )}`;
  const waLink = `https://wa.me/${BRAND_CONFIG.whatsappNumber}?text=${encodeURIComponent(
    "Hi Workly India! I'm interested in joining your team.",
  )}`;

  const statCards = [
    { label: "Job seekers on platform", value: stats.users },
    { label: "Companies hiring", value: stats.companies },
    { label: "Active remote jobs", value: stats.activeJobs },
    { label: "Cities represented", value: stats.locations },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Careers at Workly India"
        description="Join Workly India — a small, remote-first team helping millions of Indians find genuine remote-work jobs. We hire on merit, not location."
        keywords="careers workly india, remote jobs, work with workly, remote job platform team"
        canonical="/careers"
      />
      <PageHeader title="Careers" />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Hero */}
        <section className="text-center py-10">
          <Badge className="mb-4">Remote-first team</Badge>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Build the future of work in India</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            We're a lean, remote-first team based in Patan, Gujarat, connecting every Indian with genuine
            remote-work opportunities. Small team, big mission.
          </p>
        </section>

        {/* Live platform stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {statCards.map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                {formatStatNumber(s.value)}
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </section>

        {/* Perks */}
        <section className="grid md:grid-cols-2 gap-4 mb-10">
          {perks.map((p) => (
            <Card key={p.title} className="p-5 flex gap-4 items-start">
              <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                <p.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </Card>
          ))}
        </section>

        {/* Open roles — honest empty state (we don't post fake openings) */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Open roles</h2>
          <Card className="p-8 text-center">
            <Briefcase className="w-10 h-10 mx-auto text-primary mb-3" />
            <h3 className="text-lg font-semibold mb-2">No specific roles listed right now</h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-5">
              We hire opportunistically. If your skills match what we need — engineering, design,
              growth, ops, or customer support — we'd love to hear from you. Send a short note and
              your work; we read every application.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <a href={mailtoOpen}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email your interest
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp us
                </a>
              </Button>
            </div>
          </Card>
        </section>

        {/* Location + contact CTA */}
        <Card className="p-6 text-center bg-gradient-to-br from-primary/5 to-secondary/5">
          <MapPin className="w-8 h-8 mx-auto text-primary mb-2" />
          <h3 className="text-xl font-semibold mb-1">Based in India, remote everywhere</h3>
          <p className="text-muted-foreground mb-4">
            HQ: {BRAND_CONFIG.location}. Team spread across India.
            <br />
            Questions? Write to{" "}
            <a href={`mailto:${careersEmail}`} className="text-primary underline">
              {careersEmail}
            </a>
          </p>
          <Button asChild variant="outline">
            <Link to="/contact-us">Contact us</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Careers;
